import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

export const PROJECT_FILES_BUCKET = "project-files";

// Matches [storage].file_size_limit in supabase/config.toml.
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

// How long a signed URL stays valid. The bucket is private, so nothing is
// reachable without one.
//
// Longer than it needs to be for a single page view, on purpose: the URL is
// reused from the cache below, and it must never expire while still being
// handed out. The cost of the longer window is that a URL which leaks — say,
// copied out of devtools — stays usable for that long.
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 2;

// How long the same URL *string* is reused across renders.
//
// This is the part that matters for speed. Supabase mints a fresh token on
// every call (the payload carries `iat` as well as `exp`, so it is not
// deterministic even for an identical expiry), which means every render used
// to produce a brand-new URL. next/image caches optimized output keyed by the
// source URL, so a rotating URL meant a guaranteed cache MISS on every single
// page view: refetch the multi-megabyte original from Supabase, re-encode,
// discard. Reusing one URL turns those into HITs.
//
// Must stay comfortably below the TTL above, so a cached URL can never be
// served after it has expired.
const SIGNED_URL_CACHE_SECONDS = 60 * 30;

// How often the cache KEY rotates — the part that actually bounds how old a
// URL can be when it is handed out.
//
// `revalidate` alone could not do that. Next's data cache is
// stale-while-revalidate: once an entry is older than `revalidate` it is not
// discarded, it is SERVED and refreshed in the background. So a page nobody
// had opened for three hours would hand its first visitor a URL minted three
// hours ago — past the 2h TTL, and a broken image — while quietly fetching a
// good one for the next person. Intermittent by construction, and invisible
// to whoever reloaded and saw it work.
//
// Putting the current bucket in the key removes the possibility instead of
// shortening the window: a new bucket has no entry at all, so the first
// request of each bucket is a genuine miss and blocks for a fresh URL.
//
// Derived from the TTL rather than written as a literal hour, because the
// invariant is a relationship, not a number: an entry minted at the start of
// a bucket is still served at the end of it, so the oldest URL ever handed
// out is one bucket old and must still be valid then. Halving the TTL keeps
// that true with a wide margin, and keeps it true if the TTL ever changes.
const SIGNED_URL_BUCKET_SECONDS = SIGNED_URL_TTL_SECONDS / 2;

// Cache keys are the storage keys themselves, which is safe because a key is
// owner-scoped by construction ({user_id}/{project_id}/...) — see
// buildStorageKey. Two users can never request the same key, so a cached URL
// cannot be handed to someone who shouldn't have it.
async function signBatch(
  supabase: SupabaseClient,
  storageKeys: string[]
): Promise<[string, string][]> {
  const { data, error } = await supabase.storage
    .from(PROJECT_FILES_BUCKET)
    .createSignedUrls(storageKeys, SIGNED_URL_TTL_SECONDS);

  // Throwing rather than returning [] matters more than it looks: the caller
  // wraps this in unstable_cache, and a returned value is a value worth
  // caching. A transient network blip would be frozen in as "this project has
  // no images" for the life of the entry. A throw is not cached.
  if (error) {
    throw new Error(`Failed to sign URLs: ${error.message}`);
  }
  if (!data) {
    throw new Error("Failed to sign URLs: storage returned no data");
  }
  return data
    .filter((entry) => !entry.error && entry.signedUrl)
    .map((entry) => [entry.path ?? "", entry.signedUrl as string]);
}

// Path convention for objects in the project-files bucket:
// {user_id}/{project_id}/{file_id}-{sanitized_filename}
// The leading user_id segment is what storage RLS policies check against
// auth.uid(), so it must always be the first path segment.
export function buildStorageKey(
  userId: string,
  projectId: string,
  fileId: string,
  filename: string
): string {
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${userId}/${projectId}/${fileId}-${sanitized}`;
}

// Returns a short-lived signed URL for a private storage object, or null if
// the object doesn't exist / can't be signed (e.g. already deleted).
export async function createSignedUrl(
  supabase: SupabaseClient,
  storageKey: string
): Promise<string | null> {
  const urls = await createSignedUrls(supabase, [storageKey]);
  return urls.get(storageKey) ?? null;
}

// Batch equivalent of createSignedUrl — one request for many objects.
// Returns a Map from storageKey to signed URL; keys that failed to sign are
// simply absent from the map.
export async function createSignedUrls(
  supabase: SupabaseClient,
  storageKeys: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (storageKeys.length === 0) return result;

  // Sorted so the same set of keys produces one cache entry regardless of
  // the order they arrive in.
  const cacheKey = [...storageKeys].sort();

  // See SIGNED_URL_BUCKET_SECONDS: this is what guarantees a URL is never
  // served after it has expired, whatever the data cache decides to do with
  // stale entries.
  const timeBucket = Math.floor(
    Date.now() / (SIGNED_URL_BUCKET_SECONDS * 1000)
  ).toString();

  const entries = await unstable_cache(
    () => signBatch(supabase, storageKeys),
    ["signed-urls", timeBucket, ...cacheKey],
    // Kept, though the bucket is what fixes the bug. Omitting it means
    // "cache indefinitely" (see the unstable_cache docs), and with a key
    // that rotates hourly every past bucket would then be retained forever —
    // a slow leak of dead entries. This lets them age out. It cannot
    // reintroduce the staleness it failed to prevent before: an entry can
    // now only be served inside its own bucket, so the worst case is one
    // bucket old, which is half the TTL.
    { revalidate: SIGNED_URL_CACHE_SECONDS }
  )();

  for (const [key, url] of entries) {
    result.set(key, url);
  }
  return result;
}
