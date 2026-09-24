import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/tooltip";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// iOS Safari zooms the whole page when a form field with a computed
// font-size under 16px takes focus, and does not zoom back out.
//
// The fix for that lives on the fields themselves, not here: every
// text-entry input is `text-base sm:text-sm`, so it is 16px on a phone and
// 14px from sm up. At 16px the trigger never fires.
//
// Deliberately NOT pinned with maximumScale/userScalable. Those would stop
// a low-vision reader pinching to enlarge anything — a WCAG 1.4.4 failure
// that Lighthouse flags by name — and with the fields at 16px they would
// not be preventing anything anyway. iOS has also ignored user-scalable=no
// since iOS 10, so relying on it would have left the zoom fixed on some
// phones and not others.
//
// If a field is ever added below 16px on mobile, the zoom comes back. Fix
// the field, not this.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Atria",
  description: "A beautiful digital binder for real-world projects.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased motion-safe:scroll-smooth`}
    >
      <body className="min-h-full flex flex-col bg-white text-zinc-900">
        {/* A client component wrapping server-rendered children — they are
            passed through as a prop, so nothing below is pulled into the
            client bundle by this. */}
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
