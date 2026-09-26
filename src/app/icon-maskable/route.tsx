import { ImageResponse } from "next/og";
import { atriaIconDataUri } from "@/lib/brand-icon";

// The manifest's "maskable" icon.
//
// Android crops home-screen icons to whatever shape the launcher uses —
// circle, squircle, teardrop — and only guarantees the central 80% survives.
// Supplying a maskable variant is what stops the OS shrinking the whole
// icon into a white plate with visible padding around it.
//
// Full bleed with no radius, because the launcher supplies the shape. The
// mark needs no extra padding: its ink spans roughly 67% of the tile
// corner-to-corner, comfortably inside the 80% safe circle.
export const contentType = "image/png";

export function GET() {
  const size = 512;
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%" }}>
        {/* Satori JSX, not the DOM — next/image has nothing to do
            here and cannot render inside an ImageResponse. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={atriaIconDataUri()} width={size} height={size} alt="" />
      </div>
    ),
    { width: size, height: size }
  );
}
