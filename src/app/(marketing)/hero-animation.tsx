// A stylized, looping miniature of the Atria workspace: a cursor crosses
// the sidebar, clicks a tab, and the tab opens to reveal what's nested
// inside it.
//
// Pure CSS keyframes rather than Framer Motion — the spec allowed either,
// and this is a static marketing page where the whole animation should cost
// nothing at runtime. A motion library would ship a client component and a
// sizeable bundle to move one arrow across a box; keyframes let this stay a
// server component with no JS at all.
//
// Everything is proportional (%) inside a fixed aspect ratio, so the scene
// scales cleanly from phone to desktop without a second set of timings.

const TABS = [
  { name: "Kitchen", active: true },
  { name: "Bathroom", active: false },
  { name: "Contracts", active: false },
];

const SUBTABS = ["Cabinetry", "Worktop", "Hardware"];

const STYLES = `
/* One 9s loop: approach, click, open, hold, reset. The percentages below
   are shared across every animation so the pieces stay in step — changing
   the duration alone rescales the whole sequence. */
/* left/top rather than transform: a percentage translate resolves against
   the ELEMENT's own box (here a ~20px icon), so translate(78%) moved the
   cursor about 15px instead of across the scene. left/top percentages
   resolve against the positioned container, which is what's wanted. */
@keyframes atria-cursor {
  0%              { left: 62%; top: 86%; opacity: 0; transform: scale(1); }
  6%              { opacity: 1; }
  26%             { left: 11%; top: 27%; transform: scale(1); }
  30%             { left: 11%; top: 27%; transform: scale(0.85); }
  34%             { left: 11%; top: 27%; transform: scale(1); }
  82%             { left: 11%; top: 27%; opacity: 1; }
  92%, 100%       { left: 62%; top: 86%; opacity: 0; }
}

/* The click ripple, timed to the cursor's dip at 30%. */
@keyframes atria-ripple {
  0%, 28%   { transform: scale(0.4); opacity: 0; }
  32%       { transform: scale(1); opacity: 0.35; }
  44%, 100% { transform: scale(1.6); opacity: 0; }
}

/* The tab fills in as the click lands. */
@keyframes atria-tab-active {
  0%, 31%   { background-color: rgba(0,0,0,0); }
  36%, 86%  { background-color: rgb(244 244 245); }
  94%, 100% { background-color: rgba(0,0,0,0); }
}

/* Sub-tabs unfold. max-height is animated rather than height so the
   content can size itself; the value only needs to exceed the real
   height. */
@keyframes atria-subtabs {
  0%, 33%   { max-height: 0; opacity: 0; }
  46%, 86%  { max-height: 120px; opacity: 1; }
  94%, 100% { max-height: 0; opacity: 0; }
}

/* Each sub-tab arrives just after the one above it. */
@keyframes atria-subtab-row {
  0%, 36%   { opacity: 0; transform: translateX(-4px); }
  50%, 86%  { opacity: 1; transform: translateX(0); }
  94%, 100% { opacity: 0; transform: translateX(-4px); }
}

/* The canvas swaps to the opened tab's content. */
@keyframes atria-canvas {
  0%, 34%   { opacity: 0; transform: translateY(6px); }
  52%, 86%  { opacity: 1; transform: translateY(0); }
  94%, 100% { opacity: 0; transform: translateY(6px); }
}

.atria-anim-cursor   { animation: atria-cursor 9s cubic-bezier(.4,0,.2,1) infinite; }
.atria-anim-ripple   { animation: atria-ripple 9s ease-out infinite; }
.atria-anim-tab      { animation: atria-tab-active 9s ease-in-out infinite; }
.atria-anim-subtabs  { animation: atria-subtabs 9s cubic-bezier(.4,0,.2,1) infinite; }
.atria-anim-row      { animation: atria-subtab-row 9s ease-out infinite; }
.atria-anim-canvas   { animation: atria-canvas 9s ease-out infinite; }

/* Anyone who has asked for less motion gets the finished state, held
   still — the scene still shows what Atria looks like. */
@media (prefers-reduced-motion: reduce) {
  .atria-anim-cursor { display: none; }
  .atria-anim-ripple { display: none; }
  .atria-anim-tab    { animation: none; background-color: rgb(244 244 245); }
  .atria-anim-subtabs{ animation: none; max-height: 120px; opacity: 1; }
  .atria-anim-row    { animation: none; opacity: 1; transform: none; }
  .atria-anim-canvas { animation: none; opacity: 1; transform: none; }
}
`;

export function HeroAnimation() {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <style>{STYLES}</style>

      <div
        // aria-hidden: it's a decorative illustration of the product, and
        // the hero text above already says what Atria is. Announcing a
        // fake sidebar would only add noise for a screen reader.
        aria-hidden
        className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm sm:aspect-[16/9]"
      >
        {/* Window chrome */}
        <div className="flex h-7 items-center gap-1.5 border-b border-zinc-100 bg-zinc-50/60 px-3">
          <span className="h-2 w-2 rounded-full bg-zinc-200" />
          <span className="h-2 w-2 rounded-full bg-zinc-200" />
          <span className="h-2 w-2 rounded-full bg-zinc-200" />
        </div>

        <div className="flex h-[calc(100%-1.75rem)]">
          {/* Sidebar */}
          <div className="w-[34%] shrink-0 border-r border-zinc-100 bg-zinc-50/40 p-2.5 sm:w-[30%] sm:p-3">
            <p className="px-1.5 pb-2 text-[7px] font-semibold uppercase tracking-wider text-zinc-400 sm:text-[9px]">
              Tabs
            </p>

            {TABS.map((tab) => (
              <div key={tab.name}>
                <div
                  className={`rounded-md px-1.5 py-1 text-[8px] text-zinc-700 sm:py-1.5 sm:text-[11px] ${
                    tab.active ? "atria-anim-tab" : ""
                  }`}
                >
                  {tab.name}
                </div>

                {tab.active && (
                  <div className="atria-anim-subtabs ml-2 overflow-hidden border-l border-zinc-200 pl-2">
                    {SUBTABS.map((sub, i) => (
                      <div
                        key={sub}
                        className="atria-anim-row py-0.5 text-[7px] text-zinc-400 sm:py-1 sm:text-[10px]"
                        style={{ animationDelay: `${i * 90}ms` }}
                      >
                        {sub}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Canvas */}
          <div className="atria-anim-canvas flex-1 p-3 sm:p-5">
            <div className="h-2 w-20 rounded bg-zinc-200 sm:h-3 sm:w-28" />
            <div className="mt-3 grid grid-cols-3 gap-2 sm:mt-5 sm:gap-3">
              <div className="aspect-square rounded-md bg-zinc-100" />
              <div className="aspect-square rounded-md bg-zinc-100" />
              <div className="aspect-square rounded-md bg-zinc-100" />
            </div>
            <div className="mt-3 space-y-1.5 sm:mt-5 sm:space-y-2">
              <div className="h-1.5 w-full rounded bg-zinc-100" />
              <div className="h-1.5 w-4/5 rounded bg-zinc-100" />
            </div>
          </div>
        </div>

        {/* Click ripple, anchored over the tab the cursor lands on */}
        <span className="pointer-events-none absolute left-[9%] top-[24%] h-5 w-5">
          <span className="atria-anim-ripple block h-full w-full rounded-full bg-zinc-400" />
        </span>

        {/* The cursor */}
        <svg
          viewBox="0 0 12 12"
          className="atria-anim-cursor pointer-events-none absolute h-4 w-4 drop-shadow-sm sm:h-5 sm:w-5"
        >
          <path
            d="M1 1 L1 10 L3.6 7.4 L5.4 11 L7 10.2 L5.2 6.7 L9 6.6 Z"
            fill="white"
            stroke="rgb(39 39 42)"
            strokeWidth="0.9"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}
