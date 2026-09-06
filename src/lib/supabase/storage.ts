import type { SupabaseClient } from "@supabase/supabase-js";

export const PROJECT_FILES_BUCKET = "project-files";

// Matches [storage].file_size_limit in supabase/config.toml.
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

// Signed URLs are short-lived — the bucket is private, so every render that
// needs to display an image/file fetches a fresh URL server-side.
const SIGNED_URL_TTL_SECONDS = 60 * 10;

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

// Widths for on-the-fly image resizing. A binder is full of phone photos —
// 3–5MB, 4032px wide — and rendering those raw into a 300px tile means the
// browser downloads tens of megabytes to draw thumbnails. These are ~2x the
// largest CSS size each surface renders at, so they stay sharp on retina.
//
// Opt-in per call site, never the default: downloads and the PDF export
// must keep the untouched original.
export const IMAGE_PREVIEW_WIDTH = 800;
export const IMAGE_COVER_WIDTH = 1200;

// Resizing is a Supabase *paid-plan* feature, and it's disabled by default
// on the local stack. When it isn't available the request simply serves the
// original file (verified: HTTP 200, original bytes) — so this degrades to
// today's behavior rather than breaking images.
function previewTransform(width?: number) {
  return width ? { transform: { width, resize: "contain" as const } } : undefined;
}

// Returns a short-lived signed URL for a private storage object, or null if
// the object doesn't exist / can't be signed (e.g. already deleted).
// `previewWidth` requests a resized rendition — only pass it for an <img>
// preview, never for a download link.
export async function createSignedUrl(
  supabase: SupabaseClient,
  storageKey: string,
  previewWidth?: number
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(PROJECT_FILES_BUCKET)
    .createSignedUrl(storageKey, SIGNED_URL_TTL_SECONDS, previewTransform(previewWidth));

  if (error || !data) return null;
  return data.signedUrl;
}

// Batch equivalent of createSignedUrl — one request for many objects.
// Returns a Map from storageKey to signed URL; keys that failed to sign are
// simply absent from the map.
export async function createSignedUrls(
  supabase: SupabaseClient,
  storageKeys: string[],
  previewWidth?: number
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (storageKeys.length === 0) return result;

  // The batch endpoint takes only `download`/`cacheNonce` — `transform` is
  // available on the single-URL call alone. So a resized batch fans out into
  // one signing call per key, issued in parallel. Signing is a cheap
  // token-minting operation against a same-region database, and it buys back
  // orders of magnitude more bytes than it costs round trips. The untransformed
  // path (downloads, PDF export) keeps its single batched request.
  if (previewWidth) {
    const signed = await Promise.all(
      storageKeys.map(async (key) => [key, await createSignedUrl(supabase, key, previewWidth)] as const)
    );
    for (const [key, url] of signed) {
      if (url) result.set(key, url);
    }
    return result;
  }

  const { data, error } = await supabase.storage
    .from(PROJECT_FILES_BUCKET)
    .createSignedUrls(storageKeys, SIGNED_URL_TTL_SECONDS);

  if (error || !data) return result;

  for (const entry of data) {
    if (!entry.error && entry.signedUrl) {
      result.set(entry.path ?? "", entry.signedUrl);
    }
  }
  return result;
}
