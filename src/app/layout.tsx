import type { Metadata } from "next";
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
