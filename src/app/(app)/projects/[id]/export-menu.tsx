"use client";

import { useState } from "react";
import Link from "next/link";

// Standard printer glyph — the conventional Print/Save-as-PDF affordance,
// rather than a document icon.
function PrinterIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M5 2.75C5 1.784 5.784 1 6.75 1h6.5c.966 0 1.75.784 1.75 1.75v3.552c.377.046.752.097 1.126.153A2.212 2.212 0 0 1 18 8.653v4.097A2.25 2.25 0 0 1 15.75 15h-.241l.305 1.984A1.75 1.75 0 0 1 14.084 19H5.916a1.75 1.75 0 0 1-1.73-2.016L4.492 15H4.25A2.25 2.25 0 0 1 2 12.75V8.653c0-1.082.775-2.034 1.874-2.198.374-.056.75-.107 1.126-.153V2.75Zm8.5 3.397a41.533 41.533 0 0 0-7 0V2.75a.25.25 0 0 1 .25-.25h6.5a.25.25 0 0 1 .25.25v3.397ZM6.608 12.5a.25.25 0 0 0-.247.212l-.693 4.5a.25.25 0 0 0 .247.288h8.17a.25.25 0 0 0 .246-.288l-.692-4.5a.25.25 0 0 0-.247-.212H6.608Z"
        clipRule="evenodd"
      />
      <path d="M14 7.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z" />
    </svg>
  );
}

const TRIGGER_CLASS =
  "rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900";

// From the Overview there's only one sensible export, so the icon stays a
// plain link. Inside a tab it's genuinely ambiguous — "export" could mean
// this tab or the whole binder — and the export page's own scope switch is
// only discoverable after committing to one. Asking here costs one tap and
// removes the wrong-document round trip.
export function ExportMenu({
  projectId,
  activeTabId,
}: {
  projectId: string;
  activeTabId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const base = `/projects/${projectId}/export`;

  if (!activeTabId) {
    return (
      <Link
        href={base}
        target="_blank"
        rel="noopener noreferrer"
        className={TRIGGER_CLASS}
        aria-label="Export PDF"
        title="Export PDF"
      >
        <PrinterIcon className="h-4 w-4" />
      </Link>
    );
  }

  const itemClass =
    "block w-full px-3 py-2 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-50";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={TRIGGER_CLASS}
        aria-label="Export PDF"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Export PDF"
      >
        <PrinterIcon className="h-4 w-4" />
      </button>

      {open && (
        <>
          {/* Click-away layer, matching AddMenu's pattern in browser.tsx. */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          {/* right-0: the trigger sits at the right end of the header at
              every width, so the menu opens leftward into the page. */}
          <div
            role="menu"
            className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
          >
            <Link
              role="menuitem"
              href={`${base}?tab=${activeTabId}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className={itemClass}
            >
              Export current tab
            </Link>
            <Link
              role="menuitem"
              href={base}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className={itemClass}
            >
              Export whole project
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
