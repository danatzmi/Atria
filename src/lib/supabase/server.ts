import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Session-scoped client for use in Server Components, Server Actions, and
// Route Handlers. Every query made with this client is subject to the
// signed-in user's RLS policies — this is the only client app code should
// use to read or write user data.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — the middleware refreshes
            // the session cookie on every request, so this can be ignored.
          }
        },
      },
    }
  );
}
