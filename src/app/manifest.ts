import type { MetadataRoute } from "next";
import { SITE_NAME } from "@/lib/site";
import { ATRIA_BLACK } from "@/lib/brand-icon";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — a beautiful digital binder for real-world projects`,
    // What fits under a home-screen icon. Anything longer is truncated
    // with an ellipsis, which looks like a bug rather than a choice.
    short_name: SITE_NAME,
    description: "A calm, uncluttered workspace for organising project materials.",
    // Straight to the projects list, not the marketing page — someone who
    // installed the app has already been sold.
    start_url: "/projects",
    display: "standalone",
    // The splash screen, so it matches the app's own canvas rather than
    // the icon. Opening to a black screen that flashes white is worse than
    // opening to the colour the app actually is.
    background_color: "#ffffff",
    // Tints the status bar, and the app's global header is this colour —
    // so the chrome and the header read as one surface.
    theme_color: ATRIA_BLACK,
    icons: [
      {
        src: "/icon.svg",
        type: "image/svg+xml",
        sizes: "any",
        purpose: "any",
      },
      {
        src: "/icon-512",
        type: "image/png",
        sizes: "512x512",
        purpose: "any",
      },
      // Listed last and separately: a launcher that supports masking picks
      // this one and crops it itself; one that does not ignores it.
      {
        src: "/icon-maskable",
        type: "image/png",
        sizes: "512x512",
        purpose: "maskable",
      },
    ],
  };
}
