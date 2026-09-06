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

const nextConfig: NextConfig = {
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
