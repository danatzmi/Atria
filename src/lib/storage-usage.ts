import type { SupabaseClient } from "@supabase/supabase-js";

// Total bytes this user's files occupy, across every project they own.
//
// No user filter, deliberately: read with the caller's own client, RLS
// already confines `files` to rows they own. Adding `.eq("user_id", …)`
// would not be wrong so much as untrue — `files` has no user_id column, and
// reaching for one through a join would be a second, weaker copy of the
// rule the database already enforces.
//
// Cover images are not rows in `files` and carry no recorded size, so they
// are excluded. That makes this a slight under-count of real bucket usage —
// tolerable, and the alternative is a per-object storage listing on every
// upload.
export async function getStorageUsed(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase.from("files").select("size_bytes");

  if (error) {
    // Surfaced to the caller as a thrown error rather than a 0, which would
    // read as "plenty of room" and wave the upload through.
    throw new Error(`Could not read storage usage: ${error.message}`);
  }

  return (data ?? []).reduce((total, f) => total + (f.size_bytes ?? 0), 0);
}
