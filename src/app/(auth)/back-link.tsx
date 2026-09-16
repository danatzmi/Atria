import Link from "next/link";

// An explicit way out of the auth pages.
//
// The wordmark below already links home, but that's a convention people
// have to guess. It matters most when Atria is installed to a phone's home
// screen: a standalone PWA has no browser chrome, so there is no Back
// button and no address bar — without this, these pages are genuinely
// inescapable.
//
// Pinned to the page's top-left corner by the auth pages, away from the
// centered form — the same place a browser's own Back button would be.
//
// Lives in the (auth) group rather than reusing the app's ChevronLeftIcon,
// which sits under projects/[id]/folder/ — importing that here would tie
// sign-in to the project browser's internals for one arrow.
export function BackLink() {
  return (
    <Link
      href="/"
      // px-2 py-2 gives a ~36px tap target. This exists for phones — a bare
      // 20px line of text is an awkward tap, and in a standalone PWA this
      // is the only way off the screen. Positioning is the page's job, so
      // there's no margin here.
      className="group flex w-fit items-center gap-1 px-2 py-2 text-sm text-stone-500 transition-colors hover:text-stone-900"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden
        className="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
      >
        <path
          fillRule="evenodd"
          d="M12.79 14.77a.75.75 0 0 0-.02-1.06L8.832 10l3.938-3.71a.75.75 0 1 0-1.04-1.08l-4.5 4.25a.75.75 0 0 0 0 1.08l4.5 4.25a.75.75 0 0 0 1.06-.02Z"
          clipRule="evenodd"
        />
      </svg>
      Back
    </Link>
  );
}
