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

// Returns a short-lived signed URL for a private storage object, or null if
// the object doesn't exist / can't be signed (e.g. already deleted).
export async function createSignedUrl(
  supabase: SupabaseClient,
  storageKey: string
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(PROJECT_FILES_BUCKET)
    .createSignedUrl(storageKey, SIGNED_URL_TTL_SECONDS);

  if (error || !data) return null;
  return data.signedUrl;
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
