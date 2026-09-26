// The Atria mark, in one place.
//
// The outline is Geist Bold — the typeface the app is set in — pinned from
// its variable axis at wght=700 and transformed into a 64x64 box: cap
// height 48.4% of the tile, ink centred on (32, 32). Geist is SIL OFL.
//
// Kept here rather than only in app/icon.svg because the PWA icons are
// generated at request time and must be the same mark, pixel for pixel. The
// literal in app/icon.svg mirrors this constant; if one changes, change
// both.
export const ATRIA_A_PATH =
  "M16.78 47.62 28.04 16.38H35.96L47.22 47.62H40.29L37.99 40.97H25.99L23.68 47.62ZM27.87 35.48H36.13L32.01 23.4Z";

export const ATRIA_BLACK = "#09090b";

// Returns the mark as a standalone SVG document.
//
// `radius` is the only thing that varies between uses, and it varies for a
// reason that is easy to get wrong: iOS and Android apply their OWN mask to
// home-screen icons. Handing them artwork that is already rounded means the
// corners get cut twice — the transparent area outside our rounded rect
// gets composited against black or white depending on the OS, which shows
// up as pale or dark notches on the corners. So home-screen icons are
// drawn FULL BLEED (radius 0) and the platform rounds them; only the
// browser-tab favicon, which nothing masks, carries its own corners.
export function atriaIconSvg({ radius = 0 }: { radius?: number } = {}): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">`,
    `<rect width="64" height="64"${radius ? ` rx="${radius}"` : ""} fill="${ATRIA_BLACK}"/>`,
    `<path d="${ATRIA_A_PATH}" fill="#ffffff"/>`,
    `</svg>`,
  ].join("");
}

// Satori (what ImageResponse renders with) rasterises an <img> data URI
// reliably, where its support for inline SVG children is partial. Base64
// rather than percent-encoding so the `#` in the fill colours cannot
// terminate the URI.
export function atriaIconDataUri(options?: { radius?: number }): string {
  const svg = atriaIconSvg(options);
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
