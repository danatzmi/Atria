import Image from "next/image";

// A stylized, looping miniature of Atria, walking the product's hierarchy
// in the order a real visit takes it: the projects dashboard, a project's
// overview, then one tab's contents.
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
  { name: "Lighting", active: false },
  { name: "Contracts & Permits", active: false },
  { name: "Suppliers", active: false },
];

const SUBTABS = ["Cabinetry", "Worktop", "Hardware"];

// Real photography, served from /public — local files, so next/image
// optimizes them without remotePatterns (which is scoped to the Supabase
// host) needing to know about them, and with no third-party CDN sitting in
// front of the most important page on the site.
//
// Two distinct sets, which is the point: Act 1 shows three whole projects
// at cover scale, Act 3 shows close-up details of the one that was clicked.
// Drilling from a wide shot into its own details is what makes the
// hierarchy legible — the same photo twice would read as a repeat.
const PROJECTS = [
  { name: "New York Loft", meta: "24 files", src: "/hero/loft_cover.jpg" },
  { name: "London Townhouse", meta: "18 files", src: "/hero/townhouse.jpg" },
  { name: "Studio Rebuild", meta: "9 files", src: "/hero/materials.jpg" },
];

const PROJECT_DESCRIPTION =
  "Full gut renovation of a 1920s warehouse conversion in Tribeca.";

// Inside New York Loft → Kitchen: the level of detail a real binder holds.
// These are details of the project whose cover is clicked in Act 1, so the
// industrial vibe has to carry across the acts for the drill-down to read
// as one place rather than two.
const PHOTOS = [
  { caption: "Steel Sink Basin", src: "/hero/loft_sink.jpg" },
  { caption: "Brick Wall Elev", src: "/hero/loft_brick.jpg" },
  { caption: "Pendant Lighting Spec", src: "/hero/loft_light.jpg" },
];

const DOCUMENTS = [
  { name: "Cabinetry quote v3", meta: "2.4 MB" },
  { name: "Appliance specs", meta: "860 KB" },
];

const STYLES = `
/* One 8s loop, walking the hierarchy in the order a real visit takes it:

     Act 1   0–22%   the projects dashboard; the cursor clicks a project
     Act 2  22–46%   that project's Overview — cover, description, its tabs
     Act 3  46–88%   the Kitchen tab's own contents
            88–100%  reset

   Act 2 is the step the sequence used to skip. Clicking a project does not
   land you in a tab; it lands you on the project's home page, and showing
   the workspace appear already-drilled-into misrepresented a whole level of
   the product.

   Each beat stays fast — the cursor crosses in well under a second and each
   click lands immediately. The two holds (overview, then contents) are the
   only slow parts, and only long enough to read what is on screen.

   Three cursor stops, declared as custom properties so the keyframes stay
   single-source and only the aim changes per breakpoint (the mock's header
   takes proportionally more of the shorter mobile frame, so the same
   element sits at a different percentage there). */
.atria-anim-scene {
  --rest-left: 66%;  --rest-top: 88%;
  --aim1-left: 26%;  --aim1-top: 44%;
  --aim2-left: 13%;  --aim2-top: 38%;
}
@media (min-width: 640px) {
  .atria-anim-scene {
    --aim1-left: 24%; --aim1-top: 42%;
    --aim2-left: 11%; --aim2-top: 19%;
  }
}

/* Travel is a translate on a scene-sized wrapper, not left/top. A
   percentage translate resolves against the element's own border box, and
   that box is the scene, so the numbers mean exactly what left/top meant —
   but they stay on the compositor instead of forcing layout every frame,
   and this is the one animation that runs the whole loop.

   The click's squash is a separate animation on the glyph inside, because
   both would otherwise be writing transform on the same element and the
   later one would simply win. */
@keyframes atria-cursor {
  0%        { transform: translate(var(--rest-left), var(--rest-top)); opacity: 0; }
  3%        { opacity: 1; }
  /* Act 1: to the project card. */
  14%       { transform: translate(var(--aim1-left), var(--aim1-top)); }
  20%       { transform: translate(var(--aim1-left), var(--aim1-top)); }
  /* Act 2 holds while the cursor crosses to the Kitchen tab. */
  40%       { transform: translate(var(--aim2-left), var(--aim2-top)); }
  88%       { transform: translate(var(--aim2-left), var(--aim2-top)); opacity: 1; }
  94%, 100% { transform: translate(var(--rest-left), var(--rest-top)); opacity: 0; }
}

/* Two presses, landing on the same frames the ripples fire. */
@keyframes atria-cursor-click {
  0%, 16%   { transform: scale(1); }
  18%       { transform: scale(0.82); }
  20%, 42%  { transform: scale(1); }
  44%       { transform: scale(0.82); }
  46%, 100% { transform: scale(1); }
}

@keyframes atria-ripple-1 {
  0%, 15%   { transform: scale(0.4); opacity: 0; }
  19%       { transform: scale(1); opacity: 0.35; }
  28%, 100% { transform: scale(1.6); opacity: 0; }
}
@keyframes atria-ripple-2 {
  0%, 41%   { transform: scale(0.4); opacity: 0; }
  45%       { transform: scale(1); opacity: 0.35; }
  54%, 100% { transform: scale(1.6); opacity: 0; }
}

/* The dashboard hands over to the binder the moment the first click lands.
   Stacked layers crossfading, so the tree stays flat and nothing reflows. */
@keyframes atria-dashboard {
  0%, 18%   { opacity: 1; transform: scale(1); }
  24%, 90%  { opacity: 0; transform: scale(1.02); }
  97%, 100% { opacity: 1; transform: scale(1); }
}
@keyframes atria-binder {
  0%, 19%   { opacity: 0; transform: scale(0.99); }
  26%, 90%  { opacity: 1; transform: scale(1); }
  97%, 100% { opacity: 0; transform: scale(0.99); }
}

/* Inside the binder, the canvas swaps Overview for the tab's contents on
   the second click. Same crossfade technique one level down: both are
   absolutely positioned siblings, so neither can push the other around. */
@keyframes atria-overview {
  0%, 44%   { opacity: 1; transform: translateY(0); }
  50%, 92%  { opacity: 0; transform: translateY(-4px); }
  97%, 100% { opacity: 1; transform: translateY(0); }
}
@keyframes atria-canvas {
  0%, 44%   { opacity: 0; transform: translateY(6px); }
  52%, 90%  { opacity: 1; transform: translateY(0); }
  96%, 100% { opacity: 0; transform: translateY(6px); }
}

/* The tab's highlight is its own absolutely-positioned layer fading in,
   not an animated background-color: paint properties are re-rasterized
   every frame, opacity is handed to the compositor. */
@keyframes atria-tab-fill {
  0%, 43%   { opacity: 0; }
  48%, 88%  { opacity: 1; }
  95%, 100% { opacity: 0; }
}

/* Sub-tabs unfold. max-height rather than height so the content can size
   itself; the value only needs to exceed the real height. */
@keyframes atria-subtabs {
  0%, 45%   { max-height: 0; opacity: 0; }
  56%, 88%  { max-height: 120px; opacity: 1; }
  95%, 100% { max-height: 0; opacity: 0; }
}

@keyframes atria-subtab-row {
  0%, 47%   { opacity: 0; transform: translateX(-4px); }
  58%, 88%  { opacity: 1; transform: translateX(0); }
  95%, 100% { opacity: 0; transform: translateX(-4px); }
}

.atria-anim-cursor    { animation: atria-cursor 8s cubic-bezier(.3,0,.2,1) infinite; }
.atria-anim-click     { animation: atria-cursor-click 8s ease-out infinite; }
.atria-anim-ripple-1  { animation: atria-ripple-1 8s ease-out infinite; }
.atria-anim-ripple-2  { animation: atria-ripple-2 8s ease-out infinite; }
.atria-anim-dashboard { animation: atria-dashboard 8s ease-out infinite; }
.atria-anim-binder    { animation: atria-binder 8s ease-out infinite; }
.atria-anim-overview  { animation: atria-overview 8s ease-out infinite; }
.atria-anim-canvas    { animation: atria-canvas 8s ease-out infinite; }
.atria-anim-tab       { animation: atria-tab-fill 8s ease-out infinite; }
.atria-anim-subtabs   { animation: atria-subtabs 8s cubic-bezier(.22,1,.36,1) infinite; }
.atria-anim-row       { animation: atria-subtab-row 8s ease-out infinite; }

/* Reduced motion gets the end state — the populated tab — held still. */
@media (prefers-reduced-motion: reduce) {
  .atria-anim-cursor,
  .atria-anim-click,
  .atria-anim-ripple-1,
  .atria-anim-ripple-2 { display: none; }
  .atria-anim-dashboard{ animation: none; opacity: 0; }
  .atria-anim-binder   { animation: none; opacity: 1; transform: none; }
  .atria-anim-overview { animation: none; opacity: 0; }
  .atria-anim-canvas   { animation: none; opacity: 1; transform: none; }
  .atria-anim-tab      { animation: none; opacity: 1; }
  .atria-anim-subtabs  { animation: none; max-height: 120px; opacity: 1; }
  .atria-anim-row      { animation: none; opacity: 1; transform: none; }
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
        className="atria-anim-scene relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm sm:aspect-[16/9]"
      >
        {/* Window chrome — shared by every act, so it never blinks. */}
        <div className="flex h-5 items-center gap-1 border-b border-zinc-100 bg-zinc-50/60 px-2 sm:h-6 sm:gap-1.5 sm:px-3">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-200 sm:h-2 sm:w-2" />
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-200 sm:h-2 sm:w-2" />
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-200 sm:h-2 sm:w-2" />
        </div>

        {/* Dashboard and binder, stacked and crossfaded. Absolute rather
            than conditional, so neither reflows the other and the cursor's
            coordinates mean the same thing throughout. */}
        <div className="relative h-[calc(100%-1.25rem)] sm:h-[calc(100%-1.5rem)]">
          {/* ---------- Act 1: the projects dashboard ---------- */}
          <div className="atria-anim-dashboard absolute inset-0 z-10 bg-white">
            <div className="flex h-7 items-center justify-between border-b border-zinc-100 px-2 sm:h-9 sm:px-3">
              <span className="text-[8px] font-semibold tracking-tight text-zinc-900 sm:text-[11px]">
                Atria
              </span>
              <span className="flex h-3 w-3 items-center justify-center rounded-full bg-zinc-700 text-[5px] font-medium text-white sm:h-4 sm:w-4 sm:text-[7px]">
                D
              </span>
            </div>

            <div className="p-2.5 sm:p-4">
              <div className="flex items-baseline justify-between">
                <p className="text-[9px] font-semibold tracking-tight text-zinc-900 sm:text-xs">
                  Projects
                </p>
                <span className="rounded bg-zinc-900 px-1 py-px text-[6px] font-medium text-white sm:text-[8px]">
                  New project
                </span>
              </div>

              <div className="mt-2 grid grid-cols-3 gap-2 sm:mt-3 sm:gap-3">
                {PROJECTS.map((project) => (
                  <div key={project.name}>
                    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md bg-zinc-100 ring-1 ring-black/5">
                      <Image
                        src={project.src}
                        alt=""
                        fill
                        // The tiles are a fraction of the 4xl frame, never
                        // the viewport, so an explicit size stops Next
                        // serving a 1024px variant for a ~280px slot.
                        sizes="(min-width: 640px) 280px, 120px"
                        // Act 1 is the first thing on screen and the hero
                        // sits near the top of the page, so these three
                        // are worth preloading; later acts are not.
                        priority
                        className="object-cover"
                      />
                    </div>
                    <p className="mt-1 truncate text-[6px] font-medium text-zinc-800 sm:text-[9px]">
                      {project.name}
                    </p>
                    <p className="truncate text-[5px] text-zinc-400 sm:text-[7px]">
                      {project.meta}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ---------- Acts 2 & 3: the binder workspace ---------- */}
          <div className="atria-anim-binder absolute inset-0 flex flex-col">
            {/* Project header: back link, name, global search, export. */}
            <div className="flex h-7 shrink-0 items-center justify-between gap-2 border-b border-zinc-100 px-2 sm:h-9 sm:gap-3 sm:px-3">
              <div className="flex min-w-0 items-center gap-1.5 sm:gap-2.5">
                <span className="shrink-0 text-[6px] text-zinc-400 sm:text-[9px]">
                  &larr; Projects
                </span>
                <span className="truncate text-[8px] font-semibold tracking-tight text-zinc-900 sm:text-[11px]">
                  New York Loft
                </span>
              </div>

              <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                <div className="flex h-3 w-16 items-center gap-1 rounded border border-zinc-200 px-1 sm:h-5 sm:w-28 sm:gap-1.5 sm:px-1.5">
                  <svg
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className="h-1.5 w-1.5 shrink-0 text-zinc-300 sm:h-2.5 sm:w-2.5"
                  >
                    <circle cx="8.5" cy="8.5" r="5.5" />
                    <path d="M12.8 12.8 17 17" strokeLinecap="round" />
                  </svg>
                  <span className="truncate text-[5px] text-zinc-300 sm:text-[8px]">
                    Search this project
                  </span>
                </div>

                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-2 w-2 shrink-0 text-zinc-300 sm:h-3 sm:w-3"
                >
                  <path
                    fillRule="evenodd"
                    d="M5 2.75C5 1.784 5.784 1 6.75 1h6.5c.966 0 1.75.784 1.75 1.75v3.552c.377.046.752.097 1.126.153A2.212 2.212 0 0 1 18 8.653v4.097A2.25 2.25 0 0 1 15.75 15h-.241l.305 1.984A1.75 1.75 0 0 1 14.084 19H5.916a1.75 1.75 0 0 1-1.73-2.016L4.492 15H4.25A2.25 2.25 0 0 1 2 12.75V8.653c0-1.082.775-2.034 1.874-2.198.374-.056.75-.107 1.126-.153V2.75Zm8.5 3.397a41.533 41.533 0 0 0-7 0V2.75a.25.25 0 0 1 .25-.25h6.5a.25.25 0 0 1 .25.25v3.397ZM6.608 12.5a.25.25 0 0 0-.247.212l-.693 4.5a.25.25 0 0 0 .247.288h8.17a.25.25 0 0 0 .246-.288l-.692-4.5a.25.25 0 0 0-.247-.212H6.608Z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>

            <div className="flex min-h-0 flex-1">
              {/* Sidebar — present from Act 2 onward, exactly as the real
                  workspace has it before any tab is opened. */}
              <div className="w-[34%] shrink-0 border-r border-zinc-100 bg-zinc-50/40 p-2.5 sm:w-[30%] sm:p-3">
                {/* No "Tabs" eyebrow and no per-tab counts — the real
                    sidebar has neither. Its header is the collapse toggle
                    and the "+" that adds a tab. */}
                <div className="flex items-center justify-between px-1 pb-1.5">
                  <svg
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="h-2 w-2 text-zinc-300 sm:h-3 sm:w-3"
                  >
                    <rect x="2.75" y="4.25" width="14.5" height="11.5" rx="2" />
                    <line x1="7.75" y1="4.25" x2="7.75" y2="15.75" />
                  </svg>
                  <span className="text-[7px] text-zinc-300 sm:text-[9px]">+</span>
                </div>

                {TABS.map((tab) => (
                  <div key={tab.name}>
                    <div className="relative flex items-center justify-between gap-1 rounded-md px-1.5 py-1 text-[8px] text-zinc-700 sm:py-1.5 sm:text-[11px]">
                      {tab.active && (
                        <span className="atria-anim-tab absolute inset-0 rounded-md bg-zinc-100" />
                      )}
                      <span className="relative truncate">{tab.name}</span>
                    </div>

                    {tab.active && (
                      <div className="atria-anim-subtabs ml-2 overflow-hidden border-l border-zinc-200 pl-2">
                        {SUBTABS.map((sub, i) => (
                          <div
                            key={sub}
                            className="atria-anim-row py-0.5 text-[7px] text-zinc-400 sm:py-1 sm:text-[10px]"
                            style={{ animationDelay: `${i * 45}ms` }}
                          >
                            {sub}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* The canvas holds both of the binder's states, stacked and
                  crossfaded on the second click. */}
              <div className="relative min-w-0 flex-1">
                {/* ---------- Act 2: the Project Overview ---------- */}
                <div className="atria-anim-overview absolute inset-0 overflow-hidden p-2.5 sm:p-4">
                  {/* Cover banner, 3:1 as the real overview has it. */}
                  <div className="relative aspect-[3/1] w-full overflow-hidden rounded-md bg-zinc-100 ring-1 ring-black/5 sm:rounded-lg">
                    <Image
                      src={PROJECTS[0].src}
                      alt=""
                      fill
                      sizes="(min-width: 640px) 580px, 200px"
                      className="object-cover"
                    />
                  </div>

                  <p className="mt-1.5 text-[5px] font-semibold uppercase tracking-wider text-zinc-400 sm:mt-3 sm:text-[7px]">
                    Overview
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[6px] leading-relaxed text-zinc-600 sm:mt-1 sm:text-[8px]">
                    {PROJECT_DESCRIPTION}
                  </p>

                  {/* The project's tabs, listed on its home page. The frame
                      is a fixed aspect ratio, so mobile has far less canvas
                      — this is what doesn't fit there. */}
                  <div className="mt-2 hidden sm:mt-3 sm:block">
                    <p className="text-[7px] font-semibold uppercase tracking-wider text-zinc-400">
                      Tabs
                    </p>
                    <div className="mt-1 border-t border-zinc-100">
                      {TABS.slice(0, 3).map((tab) => (
                        <div
                          key={tab.name}
                          className="truncate border-b border-zinc-100 py-1.5 text-[8px] text-zinc-700"
                        >
                          {tab.name}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ---------- Act 3: the Kitchen tab's contents ---------- */}
                <div className="atria-anim-canvas absolute inset-0 overflow-hidden p-2.5 sm:p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[9px] font-semibold tracking-tight text-zinc-900 sm:text-xs">
                      Kitchen
                    </p>
                    <span className="rounded bg-zinc-900 px-1 py-px text-[6px] font-medium text-white sm:text-[8px]">
                      + Add
                    </span>
                  </div>

                  <div className="mt-2 grid grid-cols-3 gap-1.5 sm:mt-3 sm:gap-2">
                    {PHOTOS.map((photo) => (
                      <div key={photo.caption}>
                        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md bg-zinc-100 ring-1 ring-black/5">
                          <Image
                            src={photo.src}
                            alt=""
                            fill
                            sizes="(min-width: 640px) 200px, 90px"
                            className="object-cover"
                          />
                        </div>
                        <p className="mt-0.5 truncate text-[5px] text-zinc-400 sm:text-[7px]">
                          {photo.caption}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 rounded-md border border-amber-100 bg-amber-50/50 px-1.5 py-1 sm:mt-3 sm:px-2 sm:py-1.5">
                    <p className="text-[6px] font-medium text-amber-900/80 sm:text-[8px]">
                      Site visit &mdash; 14 March
                    </p>
                    <div className="mt-1 space-y-[3px]">
                      <div className="h-[2px] w-full rounded-full bg-amber-200/70 sm:h-[3px]" />
                      <div className="h-[2px] w-[86%] rounded-full bg-amber-200/70 sm:h-[3px]" />
                      <div className="h-[2px] w-[62%] rounded-full bg-amber-200/70 sm:h-[3px]" />
                    </div>
                  </div>

                  {/* The frame is a fixed aspect ratio, so mobile has far
                      less canvas; the document rows are what doesn't fit. */}
                  <div className="mt-1.5 hidden space-y-1 sm:mt-2 sm:block sm:space-y-1.5">
                    {DOCUMENTS.map((doc) => (
                      <div
                        key={doc.name}
                        className="flex items-center gap-1.5 rounded-md border border-zinc-100 bg-white px-1.5 py-1 sm:gap-2 sm:px-2"
                      >
                        <span className="shrink-0 rounded bg-zinc-900 px-1 py-px text-[5px] font-semibold text-white sm:text-[7px]">
                          PDF
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[6px] text-zinc-700 sm:text-[8px]">
                          {doc.name}
                        </span>
                        <span className="shrink-0 text-[5px] text-zinc-400 sm:text-[7px]">
                          {doc.meta}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* One ripple per click, each anchored on its own target. */}
        <span
          className="pointer-events-none absolute z-20 h-4 w-4 sm:h-5 sm:w-5"
          style={{ left: "var(--aim1-left)", top: "var(--aim1-top)", transform: "translate(-30%, -40%)" }}
        >
          <span className="atria-anim-ripple-1 block h-full w-full rounded-full bg-zinc-400" />
        </span>
        <span
          className="pointer-events-none absolute z-20 h-4 w-4 sm:h-5 sm:w-5"
          style={{ left: "var(--aim2-left)", top: "var(--aim2-top)", transform: "translate(-30%, -40%)" }}
        >
          <span className="atria-anim-ripple-2 block h-full w-full rounded-full bg-zinc-400" />
        </span>

        {/* The cursor, above every act. The outer div is the positioner
            (scene-sized, so its percentage translate reads as a position in
            the scene); the glyph inside only ever scales. */}
        <div className="atria-anim-cursor pointer-events-none absolute inset-0 z-30">
          <svg
            viewBox="0 0 12 12"
            className="atria-anim-click absolute left-0 top-0 h-4 w-4 drop-shadow-sm sm:h-5 sm:w-5"
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
    </div>
  );
}
