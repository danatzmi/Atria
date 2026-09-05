"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    // Set by the inline auto-print script in export/page.tsx. Its presence
    // is how this component knows the primary trigger is live.
    __atriaAutoPrint?: () => void;
  }
}

export function PrintButton() {
  // Backup trigger only. The inline script in page.tsx normally opens the
  // dialog — it runs far earlier than hydration and already waits for
  // images to decode. This fires solely when that script never ran (blocked
  // by CSP, stripped by an extension), which is why it checks for
  // __atriaAutoPrint first: printing from both paths would queue a second
  // dialog behind the first.
  //
  // Like the inline script, it refuses to print while the document is still
  // loading — window.print() is modal and blocks the main thread, so firing
  // it early leaves a blank, "Untitled" tab under the preview.
  useEffect(() => {
    if (window.__atriaAutoPrint) return;

    let printed = false;
    let timer: ReturnType<typeof setTimeout>;
    const go = () => {
      if (printed) return;
      printed = true;
      window.print();
    };
    const schedule = () => {
      timer = setTimeout(go, 200);
    };

    if (document.readyState === "complete") {
      schedule();
    } else {
      window.addEventListener("load", schedule, { once: true });
    }

    return () => {
      clearTimeout(timer);
      window.removeEventListener("load", schedule);
    };
  }, []);

  // The visible fallback: the dialog can be dismissed, and some browsers
  // refuse a programmatic print until the page has been interacted with.
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="h-4 w-4"
      >
        <path
          fillRule="evenodd"
          d="M5 2.75C5 1.784 5.784 1 6.75 1h6.5c.966 0 1.75.784 1.75 1.75v3.552c.377.046.752.097 1.126.153A2.212 2.212 0 0 1 18 8.653v4.097A2.25 2.25 0 0 1 15.75 15h-.241l.305 1.984A1.75 1.75 0 0 1 14.084 19H5.916a1.75 1.75 0 0 1-1.73-2.016L4.492 15H4.25A2.25 2.25 0 0 1 2 12.75V8.653c0-1.082.775-2.034 1.874-2.198.374-.056.75-.107 1.126-.153V2.75Zm8.5 3.397a41.533 41.533 0 0 0-7 0V2.75a.25.25 0 0 1 .25-.25h6.5a.25.25 0 0 1 .25.25v3.397ZM6.608 12.5a.25.25 0 0 0-.247.212l-.693 4.5a.25.25 0 0 0 .247.288h8.17a.25.25 0 0 0 .246-.288l-.692-4.5a.25.25 0 0 0-.247-.212H6.608Z"
          clipRule="evenodd"
        />
        <path d="M14 7.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z" />
      </svg>
      <span>Print / Save as PDF</span>
    </button>
  );
}
