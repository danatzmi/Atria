import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { browserOrigin } from "@/lib/browser-origin";

// Where the email links land. Supabase sends a one-time `code`; trading it
// for a session is what actually signs the person in, and it has to happen
// server-side because the PKCE verifier lives in a cookie that was set when
// the email was requested.
//
// Used by password recovery today, and by anything else that mails a link
// (email confirmation, magic links) without changing.

// `next` arrives in a URL the user can edit, and it is fed straight to a
// redirect — so it is treated as hostile. Only a path on this origin is
// allowed: no scheme, no host, and no protocol-relative "//evil.com",
// which a naive startsWith("/") check would wave through.
function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/projects";
  return raw;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const origin = await browserOrigin(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  // The redirect is built FIRST so the new session's cookies can be written
  // onto it, and a Supabase client is constructed here rather than reusing
  // lib/supabase/server's — that one writes through next/headers, which is
  // right everywhere else and wrong here.
  //
  // The failure it causes is worth describing, because everything looks
  // fine: the browser does end up holding a session, pages render signed
  // in, and only Server Actions invoked from the page the redirect landed
  // on behave as though nobody is logged in. Reloading that page fixes it,
  // which makes it look intermittent. The cause is that the cookies were
  // not on the redirect response itself, so the very next request — the
  // GET for the destination page — was still anonymous.
  const response = NextResponse.redirect(`${origin}${next}`);
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          // Reads the request's cookies — the PKCE verifier is in here.
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Expired, already used, or opened in a different browser than the one
    // that asked — all indistinguishable from here and all fixed the same
    // way, so they get one honest message rather than a code to decipher.
    console.error("[atria] auth callback exchange failed:", error.message);
    return NextResponse.redirect(`${origin}/login?error=link_expired`);
  }

  return response;
}
