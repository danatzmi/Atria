import { ImageResponse } from "next/og";
import { atriaIconDataUri } from "@/lib/brand-icon";

// The manifest's "any" icon: a 512 PNG for Android and for any install
// surface that will not take an SVG.
//
// A plain Route Handler rather than another app/icon.* file, deliberately.
// The icon.* convention makes Next emit an extra <link rel="icon">, and a
// PNG sitting alongside icon.svg would compete with it for the browser tab
// — where the vector is the one we want. Nothing links to this but the
// manifest.
export const contentType = "image/png";

export function GET() {
  const size = 512;
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%" }}>
        {/* "any" is used as supplied, so it keeps the mark's own corners —
            this is the version that shows up in a launcher that does not
            mask, and it should look like the favicon. */}
        {/* Satori JSX, not the DOM — next/image has nothing to do
            here and cannot render inside an ImageResponse. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={atriaIconDataUri({ radius: 12 })} width={size} height={size} alt="" />
      </div>
    ),
    { width: size, height: size }
  );
}
