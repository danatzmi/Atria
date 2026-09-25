import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

// Storage lives on the Supabase project's own host, so the allow-list is
// derived from the same env var the client uses rather than hard-coded —
// local (127.0.0.1:54321 over http) and the deployed project (*.supabase.co
// over https) then both work without a second place to keep in sync.
//
// Without an entry here next/image refuses the URL outright, so a missing or
// malformed NEXT_PUBLIC_SUPABASE_URL would silently break every image. It's
// required for the app to function at all, so failing the build is the right
// response.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!supabaseUrl) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL is not set — next/image can't be configured to load Supabase Storage images."
  );
}
const { protocol, hostname, port } = new URL(supabaseUrl);

// `supabase start` serves storage from 127.0.0.1, and Next refuses to
// optimize images fetched from a loopback/private address unless explicitly
// allowed — matching remotePatterns isn't enough. That guard exists to stop
// the optimizer being used to probe private networks, so it's opened only
// when Supabase itself is local, i.e. local development. A deployed project
// has a public *.supabase.co host, so this evaluates to false there and the
// protection stays on.
const isLocalSupabase =
  hostname === "localhost" ||
  hostname === "0.0.0.0" ||
  /^127\./.test(hostname) ||
  /^10\./.test(hostname) ||
  /^192\.168\./.test(hostname);

// Every non-internal IPv4 address this machine answers on, so a phone or
// tablet on the same network can load the dev server.
function localNetworkHosts(): string[] {
  const hosts = new Set<string>();
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === "IPv4" && !address.internal) hosts.add(address.address);
    }
  }
  return [...hosts];
}

// Loopback is listed explicitly. localNetworkHosts() skips internal
// addresses, so 127.0.0.1 was absent — and with allowedDevOrigins set, an
// origin that is not on the list has its Server Action requests stripped of
// cookies. The symptom is brutal to diagnose: pages render signed in
// (Server Components read cookies fine) while every Server Action behaves
// as though nobody is logged in.
//
// It is not a hypothetical origin either: Supabase's local site_url is
// http://127.0.0.1:3000, so every link in a confirmation or password-reset
// email lands there.
const LAN_HOSTS = ["127.0.0.1", "localhost", ...localNetworkHosts()];

const nextConfig: NextConfig = {
  // Next 16 blocks requests for /_next/* dev assets from any origin it
  // doesn't recognise. Reaching `next dev` from a phone on the same
  // network — http://<lan-ip>:3000 — is exactly that case: the HTML
  // renders, the client bundle is blocked, React never hydrates, and every
  // button on the page is silently dead, with no error in the browser.
  //
  // Listed as exact hosts, computed above from this machine's own network
  // interfaces: Next rejects broad wildcards like "10.*" on purpose (see
  // matchWildcardDomain in its csrf-protection module), and hardcoding one
  // address would break the next time the router hands out a different
  // lease. Development only — `next build`/`next start` ignore this.
  allowedDevOrigins: LAN_HOSTS,
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: protocol.replace(":", "") as "http" | "https",
        hostname,
        port,
        // Signed URLs all live under the storage object path; scoping to it
        // keeps the optimizer from being pointed at anything else on the host.
        pathname: "/storage/v1/object/**",
      },
    ],
    // Photos are decorative binder content, never pixel-critical UI, so a
    // long immutable cache is safe and keeps repeat views instant. Note the
    // signed URL's own token rotates every 10 minutes (see
    // SIGNED_URL_TTL_SECONDS), which changes the cache key — so this helps
    // within a session more than across days.
    minimumCacheTTL: 60 * 60 * 24,
    dangerouslyAllowLocalIP: isLocalSupabase,
  },
};

export default nextConfig;
