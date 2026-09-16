import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client: bypasses RLS entirely.
//
// Only for server code acting on behalf of the system rather than a signed-in
// user — currently just the payment webhook, which has no session and must
// write billing columns that are deliberately revoked from `authenticated`
// (see migrations/0007_subscriptions.sql).
//
// Never import this into anything that runs in the browser, and never use it
// to serve a user request: RLS is the app's authorization boundary, and this
// key steps around it.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to use the admin client."
    );
  }
  return createSupabaseClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
