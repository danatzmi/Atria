import { ImageResponse } from "next/og";
import { atriaIconDataUri } from "@/lib/brand-icon";

// iOS home-screen icon. Next emits <link rel="apple-touch-icon"> for this
// automatically; iOS ignores icon.svg entirely, which is why it exists.
//
// 180x180 is the size iOS actually asks for on a modern iPhone. Larger
// would be downscaled rather than used, so this is the honest number.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
        }}
      >
        {/* Full bleed, no corner radius: iOS applies its own squircle
            mask. Rounding it here would round it twice and leave pale
            notches where our transparent corners meet the mask. */}
        <img src={atriaIconDataUri()} width={size.width} height={size.height} alt="" />
      </div>
    ),
    { ...size }
  );
}
