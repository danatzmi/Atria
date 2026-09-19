import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeftIcon } from "../projects/[id]/folder/item-icon";
import { SettingsNav } from "./settings-nav";

// Two columns on desktop, stacked on mobile.
//
// The page fills the screen while the CONTENT keeps a readable measure —
// the previous single narrow column left most of a wide display empty, but
// simply widening it would have produced long unreadable lines of text.
// The width lives on the section, not the page.
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="w-full flex-1 px-6 py-8">
      <div className="mx-auto w-full max-w-5xl">
        <Link
          href="/projects"
          className="group -ml-1 inline-flex items-center gap-0.5 text-[13px] font-medium text-zinc-500 transition-colors hover:text-zinc-900"
        >
          <ChevronLeftIcon className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          Projects
        </Link>

        <h1 className="mt-6 text-xl font-semibold tracking-tight text-zinc-900">
          Settings
        </h1>

        <div className="mt-8 flex flex-col gap-8 md:flex-row md:gap-12">
          <SettingsNav />
          {/* max-w-xl keeps prose readable regardless of how wide the
              window gets. */}
          <div className="min-w-0 flex-1">
            <div className="max-w-xl">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
