import { headers } from "next/headers";

// The origin the BROWSER is on — not necessarily the one in request.url.
//
// Behind a proxy, and on Vercel, request.url carries an internal host; the
// Next dev server reports localhost regardless of what was typed. Building
// a redirect or an email link from that sends the user to a different
// origin than the one their session cookie belongs to, and the cookie is
// simply not sent there. Nothing errors: pages render signed out, or a
// reset link points at the wrong host.
//
// `origin` is preferred where present because on a Server Action POST the
// browser sends it and it is exactly what we want. It is absent on plain
// GETs (a Route Handler following an email link), which is why the
// forwarded host is the fallback rather than the other way round.
export async function browserOrigin(fallbackUrl?: string): Promise<string> {
  const h = await headers();

  const origin = h.get("origin");
  if (origin) return origin;

  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    // Vercel always sets x-forwarded-proto. Locally there is no proxy, so
    // loopback is assumed http — guessing https there would produce links
    // the dev server cannot serve.
    const proto =
      h.get("x-forwarded-proto") ??
      (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
    return `${proto}://${host}`;
  }

  return fallbackUrl ? new URL(fallbackUrl).origin : "";
}
