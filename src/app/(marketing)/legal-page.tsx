import Link from "next/link";
import type { ReactNode } from "react";
import { SITE_NAME, SUPPORT_EMAIL } from "@/lib/site";

// Shared shell for the legal pages, so Terms and Privacy can't drift apart
// visually and only their prose differs.
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col bg-white">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-zinc-900 transition-opacity hover:opacity-80"
        >
          {SITE_NAME}
        </Link>
        <Link
          href="/login"
          className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900"
        >
          Sign in
        </Link>
      </header>

      {/* Narrow measure — legal text is long, and a full-width column of it
          is genuinely hard to read. */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
          {title}
        </h1>
        <p className="mt-2 text-sm text-zinc-400">Last updated {updated}</p>

        {/* prose-ish spacing without pulling in a typography plugin. */}
        <div className="mt-10 space-y-6 text-[15px] leading-relaxed text-zinc-600 [&_h2]:pt-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-zinc-900 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
          {children}
        </div>

        <p className="mt-12 border-t border-zinc-100 pt-6 text-sm text-zinc-500">
          Questions?{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="font-medium text-zinc-900 underline underline-offset-2 transition-colors hover:text-zinc-600"
          >
            {SUPPORT_EMAIL}
          </a>
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}

// Also used by the marketing homepage.
export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="flex flex-col gap-4 border-t border-zinc-100 pt-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-zinc-400">
          © {year} {SITE_NAME}
        </p>
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link
            href="/terms"
            className="text-sm text-zinc-500 transition-colors hover:text-zinc-900"
          >
            Terms of Service
          </Link>
          <Link
            href="/privacy"
            className="text-sm text-zinc-500 transition-colors hover:text-zinc-900"
          >
            Privacy Policy
          </Link>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-sm text-zinc-500 transition-colors hover:text-zinc-900"
          >
            Contact
          </a>
        </nav>
      </div>
    </footer>
  );
}
