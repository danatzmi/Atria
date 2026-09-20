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
// Cover and name only, which is all project-card.tsx renders — the file
// count the mock used to show doesn't exist in the product.
const PROJECTS = [
  { name: "New York Loft", src: "/hero/loft_cover.jpg" },
  { name: "London Townhouse", src: "/hero/townhouse.jpg" },
  { name: "Studio Rebuild", src: "/hero/materials.jpg" },
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

// One document, not two: files and photos share a single grid in the real
// app, and one row of four is what the canvas has vertical room for.
const DOCUMENTS = [{ name: "Cabinetry quote v3", format: "PDF", meta: "2.4 MB" }];

// Real sentences rather than grey bars: at this scale the bars read as a
// loading skeleton, which is the opposite of the point — the note is there
// to show that a binder holds writing, not just files.
const TEXT_BLOCK_TITLE = "Cabinetry \u2014 open questions";
const TEXT_BLOCK_LINES = [
  "Confirm handle finish, brushed or matte, with the client.",
  "Verify the run clears the radiator by 40mm.",
  "Lead time on the oven housing is six weeks.",
];

const NOTE_TITLE = "Site visit \u2014 14 March";
const NOTE_BODY =
  "Steel sink arrives w/c 21st. Confirm splashback height with Mara before the cabinetry run is fixed.";

const STYLES = `
/* One 9s loop, walking the hierarchy in the order a real visit takes it.
   Every act gets its own beat, and no two beats overlap:

     Act 1   0–23%   Projects dashboard; the cursor clicks New York Loft
     Act 2  23–37%   the Loft's Overview, at rest. The sidebar shows the
                     root tabs closed; the cursor waits, then crosses
     Act 3  37–40%   the cursor clicks the Kitchen tab
     Act 4  40–66%   the reveal: canvas and sidebar move together, then
                     hold, still, for 1.6s
     Act 5  66–83%   the cursor clicks "← Projects", the dashboard returns,
                     and the cursor fades out where it stands
           83–100%  nothing visible moves; 100% is identical to 0%

   Act 2 is the step the sequence used to skip. Clicking a project does not
   land you in a tab; it lands you on the project's home page, and showing
   the workspace appear already-drilled-into misrepresented a whole level of
   the product.

   Act 5 is what closes the loop. The reset used to be a cut the viewer had
   no reason for; now the cursor walks back to "← Projects" and clicks it,
   so returning to the dashboard is something the user in the mock does,
   not something that happens to the frame. The state at 100% is identical
   to the state at 0%, which is what makes the seam invisible.

   Two rules the timings exist to enforce:

   1. The cursor never moves during a transition. It holds on what it just
      clicked until the new screen has fully arrived, so the viewer reads
      "click, then the screen changed" rather than watching a drift that
      happens to coincide with a crossfade.

   2. Act 4's two halves start and settle on the same frames — the canvas
      crossfade and the sidebar expansion are one event with two visible
      consequences, which is the point being made about the hierarchy.

   Four cursor stops, declared as custom properties so the keyframes stay
   single-source and only the aim changes per breakpoint (the mock's header
   takes proportionally more of the shorter mobile frame, so the same
   element sits at a different percentage there). */
.atria-anim-scene {
  --rest-left: 66%;  --rest-top: 88%;
  --aim1-left: 22%;  --aim1-top: 47%;
  --aim2-left: 13%;  --aim2-top: 48%;
  --aim3-left: 5%;   --aim3-top: 25%;
}
@media (min-width: 640px) {
  .atria-anim-scene {
    --aim1-left: 24%; --aim1-top: 42%;
    --aim2-left: 11%; --aim2-top: 27%;
    --aim3-left: 3%;  --aim3-top: 14.5%;
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
  /* Act 1: to the project card, and stay put through the crossfade. */
  13%       { transform: translate(var(--aim1-left), var(--aim1-top)); }
  30%       { transform: translate(var(--aim1-left), var(--aim1-top)); }
  /* Act 2 has been on screen and still since 23%; now cross to the tab. */
  37%       { transform: translate(var(--aim2-left), var(--aim2-top)); }
  /* Act 4: hold on the tab through the reveal and the whole hold. */
  66%       { transform: translate(var(--aim2-left), var(--aim2-top)); }
  /* Act 5: up to the back link, click, then fade out where it stands.

     The reset is a cut, not a move. The cursor fades to nothing at the
     back link, and only once it is fully invisible does it jump back to
     the rest position — the two keyframes 0.01% apart below. Interpolating
     that jump instead (which is what a single keyframe at 100% does) drags
     the cursor the full width of the scene on every loop, which is exactly
     the tell that gives away that this is a loop rather than a session. */
  73%       { transform: translate(var(--aim3-left), var(--aim3-top)); }
  78%       { transform: translate(var(--aim3-left), var(--aim3-top)); opacity: 1; }
  83%       { transform: translate(var(--aim3-left), var(--aim3-top)); opacity: 0; }
  83.01%    { transform: translate(var(--rest-left), var(--rest-top)); opacity: 0; }
  100%      { transform: translate(var(--rest-left), var(--rest-top)); opacity: 0; }
}

/* Three presses, landing on the same frames the ripples fire. */
@keyframes atria-cursor-click {
  0%, 13%   { transform: scale(1); }
  14.5%     { transform: scale(0.82); }
  16%, 37%  { transform: scale(1); }
  38.5%     { transform: scale(0.82); }
  40%, 73%  { transform: scale(1); }
  74.5%     { transform: scale(0.82); }
  76%, 100% { transform: scale(1); }
}

@keyframes atria-ripple-1 {
  0%, 13%   { transform: scale(0.4); opacity: 0; }
  15.5%     { transform: scale(1); opacity: 0.35; }
  24%, 100% { transform: scale(1.6); opacity: 0; }
}
@keyframes atria-ripple-2 {
  0%, 37%   { transform: scale(0.4); opacity: 0; }
  39.5%     { transform: scale(1); opacity: 0.35; }
  48%, 100% { transform: scale(1.6); opacity: 0; }
}
@keyframes atria-ripple-3 {
  0%, 73%   { transform: scale(0.4); opacity: 0; }
  75.5%     { transform: scale(1); opacity: 0.35; }
  84%, 100% { transform: scale(1.6); opacity: 0; }
}

/* The dashboard hands over to the binder the moment the first click lands.
   Stacked layers crossfading, so the tree stays flat and nothing reflows. */
@keyframes atria-dashboard {
  0%, 17%   { opacity: 1; transform: scale(1); }
  23%, 76%  { opacity: 0; transform: scale(1.02); }
  82%, 100% { opacity: 1; transform: scale(1); }
}
@keyframes atria-binder {
  0%, 18%   { opacity: 0; transform: scale(0.99); }
  24%, 75%  { opacity: 1; transform: scale(1); }
  81%, 100% { opacity: 0; transform: scale(0.99); }
}

/* Inside the binder, the canvas swaps Overview for the tab's contents on
   the second click. Same crossfade technique one level down: both are
   absolutely positioned siblings, so neither can push the other around. */
@keyframes atria-overview {
  0%, 40%   { opacity: 1; transform: translateY(0); }
  47%, 82%  { opacity: 0; transform: translateY(-4px); }
  88%, 100% { opacity: 1; transform: translateY(0); }
}
@keyframes atria-canvas {
  0%, 40%   { opacity: 0; transform: translateY(6px); }
  48%, 80%  { opacity: 1; transform: translateY(0); }
  86%, 100% { opacity: 0; transform: translateY(6px); }
}

/* The tab's highlight is its own absolutely-positioned layer fading in,
   not an animated background-color: paint properties are re-rasterized
   every frame, opacity is handed to the compositor. */
@keyframes atria-tab-fill {
  0%, 39%   { opacity: 0; }
  44%, 78%  { opacity: 1; }
  84%, 100% { opacity: 0; }
}

/* Sub-tabs unfold. max-height rather than height so the content can size
   itself; the value only needs to exceed the real height. */
/* Deliberately the same 40%→48% window as atria-canvas: the tab opening
   and the files appearing are one event with two visible halves. */
@keyframes atria-subtabs {
  0%, 40%   { max-height: 0; opacity: 0; }
  48%, 78%  { max-height: 120px; opacity: 1; }
  84%, 100% { max-height: 0; opacity: 0; }
}

@keyframes atria-subtab-row {
  0%, 41%   { opacity: 0; transform: translateX(-4px); }
  47%, 78%  { opacity: 1; transform: translateX(0); }
  84%, 100% { opacity: 0; transform: translateX(-4px); }
}

.atria-anim-cursor    { animation: atria-cursor 9s cubic-bezier(.3,0,.2,1) infinite; }
.atria-anim-click     { animation: atria-cursor-click 9s ease-out infinite; }
.atria-anim-ripple-1  { animation: atria-ripple-1 9s ease-out infinite; }
.atria-anim-ripple-2  { animation: atria-ripple-2 9s ease-out infinite; }
.atria-anim-ripple-3  { animation: atria-ripple-3 9s ease-out infinite; }
.atria-anim-dashboard { animation: atria-dashboard 9s ease-out infinite; }
.atria-anim-binder    { animation: atria-binder 9s ease-out infinite; }
.atria-anim-overview  { animation: atria-overview 9s ease-out infinite; }
.atria-anim-canvas    { animation: atria-canvas 9s ease-out infinite; }
.atria-anim-tab       { animation: atria-tab-fill 9s ease-out infinite; }
.atria-anim-subtabs   { animation: atria-subtabs 9s cubic-bezier(.22,1,.36,1) infinite; }
.atria-anim-row       { animation: atria-subtab-row 9s ease-out infinite; }

/* Reduced motion gets the end state — the populated tab — held still. */
@media (prefers-reduced-motion: reduce) {
  .atria-anim-cursor,
  .atria-anim-click,
  .atria-anim-ripple-1,
  .atria-anim-ripple-2,
  .atria-anim-ripple-3 { display: none; }
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

        {/* The app's global header. It lives outside both acts because it
            lives outside every page in the real app — (app)/layout.tsx
            renders it once and the dashboard and a project both sit under
            it. Having it here rather than inside Act 1 is what stops it
            blinking out when the acts crossfade. */}
        <div className="flex h-5 items-center justify-between bg-zinc-950 px-2 sm:h-8 sm:px-3">
          <span className="text-[8px] font-semibold tracking-tight text-white sm:text-[11px]">
            Atria
          </span>
          <span className="flex h-3 w-3 items-center justify-center rounded-full bg-white/15 text-[5px] font-medium text-white sm:h-4 sm:w-4 sm:text-[7px]">
            D
          </span>
        </div>

        {/* Dashboard and binder, stacked and crossfaded. Absolute rather
            than conditional, so neither reflows the other and the cursor's
            coordinates mean the same thing throughout. */}
        <div className="relative h-[calc(100%-2.5rem)] sm:h-[calc(100%-3.5rem)]">
          {/* ---------- Act 1: the projects dashboard ---------- */}
          <div className="atria-anim-dashboard absolute inset-0 z-10 bg-white">
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
                {/* ---------- Act 2: the Project Overview ----------

                    Cover banner and description, and deliberately nothing
                    else: the real overview lists the project's tabs only
                    below md, where the sidebar is a drawer. Here the
                    sidebar is right there, so a second list would be a
                    duplicate the product doesn't have. */}
                <div className="atria-anim-overview absolute inset-0 overflow-hidden p-2 sm:p-4">
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
                  <p className="mt-0.5 line-clamp-1 text-[6px] leading-relaxed text-zinc-600 sm:mt-1 sm:line-clamp-2 sm:text-[8px]">
                    {PROJECT_DESCRIPTION}
                  </p>
                </div>

                {/* ---------- Act 3: the Kitchen tab's contents ---------- */}
                <div className="atria-anim-canvas absolute inset-0 overflow-hidden p-2 sm:p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[9px] font-semibold tracking-tight text-zinc-900 sm:text-xs">
                      Kitchen
                    </p>
                    <span className="rounded bg-zinc-900 px-1 py-px text-[6px] font-medium text-white sm:text-[8px]">
                      + Add
                    </span>
                  </div>

                  {/* Photos and files in one grid, as the real browser has
                      them. The two card shapes genuinely differ in the
                      product and are mirrored here: a photo is a padded
                      card around a square image with its caption in italic
                      underneath, a document is a flush card whose preview
                      bleeds to the top edge over an internal name/size
                      footer. Four columns matches the real lg grid and
                      keeps the whole row to one line. */}
                  <div className="mt-1.5 grid grid-cols-3 gap-1 sm:mt-3 sm:grid-cols-4 sm:gap-2">
                    {PHOTOS.map((photo) => (
                      <div key={photo.caption}>
                        <div className="overflow-hidden rounded-md border border-zinc-200 bg-white p-[2px] shadow-sm sm:p-1">
                          <div className="relative aspect-square w-full overflow-hidden rounded-sm bg-zinc-50">
                            <Image
                              src={photo.src}
                              alt=""
                              fill
                              sizes="(min-width: 640px) 130px, 45px"
                              className="object-cover"
                            />
                          </div>
                        </div>
                        <p className="mt-0.5 truncate px-px text-[5px] italic text-zinc-400 sm:mt-1 sm:text-[7px]">
                          {photo.caption}
                        </p>
                      </div>
                    ))}

                    {DOCUMENTS.map((doc) => (
                      <div key={doc.name} className="hidden sm:block">
                        <div className="overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm">
                          {/* Stands in for the page react-pdf renders:
                              the top of page 1, bled to the card's edges,
                              first line short like a heading. */}
                          <div className="relative aspect-[4/3] w-full overflow-hidden bg-white">
                            <div className="flex flex-col gap-[1.5px] p-[3px] pt-[7px] sm:gap-[2px] sm:p-1.5 sm:pt-3">
                              <div className="h-px w-3/5 rounded-full bg-zinc-400" />
                              <div className="h-px w-full rounded-full bg-zinc-200" />
                              <div className="h-px w-full rounded-full bg-zinc-200" />
                              <div className="h-px w-4/5 rounded-full bg-zinc-200" />
                            </div>
                            <span className="absolute left-[2px] top-[2px] rounded bg-zinc-900/80 px-[2px] text-[3px] font-semibold uppercase tracking-wider text-white sm:left-1 sm:top-1 sm:px-1 sm:text-[5px]">
                              {doc.format}
                            </span>
                          </div>
                          <div className="border-t border-zinc-100 px-1 py-[2px] sm:px-1.5 sm:py-1">
                            <p className="truncate text-[5px] font-medium text-zinc-800 sm:text-[7px]">
                              {doc.name}
                            </p>
                            <p className="truncate text-[4px] text-zinc-400 sm:text-[6px]">
                              {doc.meta}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* A text block, paper-styled like the real TextBlockRow
                      — the binder holds writing as well as files, and the
                      tab looked thin without it. Only from lg: below that
                      the canvas genuinely has no room for it. */}
                  <div className="mt-1.5 hidden rounded-md border border-zinc-200 bg-amber-50/40 p-1.5 shadow-sm lg:mt-2 lg:block lg:p-2">
                    <p className="text-[8px] font-semibold text-zinc-800">
                      {TEXT_BLOCK_TITLE}
                    </p>
                    <div className="mt-0.5 space-y-px">
                      {TEXT_BLOCK_LINES.map((line) => (
                        <p key={line} className="truncate text-[7px] leading-relaxed text-zinc-600">
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>

                  {/* The Note callout, built to match the real one in
                      markdown.tsx: amber-200 border, amber-50 fill, the
                      info glyph in amber-500, amber-900 text. */}
                  <div className="mt-1.5 hidden items-start gap-1 rounded-md border border-amber-200 bg-amber-50 p-[3px] sm:mt-3 sm:flex sm:gap-1.5 sm:p-1.5">
                    <svg
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="mt-px h-1.5 w-1.5 shrink-0 text-amber-500 sm:h-2 sm:w-2"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.25v3.25H9a.75.75 0 0 0 0 1.5h2.5a.75.75 0 0 0 0-1.5h-.25V9.75A.75.75 0 0 0 10.5 9H9Z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <div className="min-w-0">
                      <p className="text-[5px] font-medium leading-relaxed text-amber-900 sm:text-[7px]">
                        {NOTE_TITLE}
                      </p>
                      <p className="line-clamp-1 text-[5px] leading-relaxed text-amber-900/80 sm:line-clamp-2 sm:text-[7px]">
                        {NOTE_BODY}
                      </p>
                    </div>
                  </div>

                  {/* The frame is a fixed aspect ratio, so mobile has far
                      less canvas; the document rows are what doesn't fit. */}                </div>
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
        <span
          className="pointer-events-none absolute z-20 h-4 w-4 sm:h-5 sm:w-5"
          style={{ left: "var(--aim3-left)", top: "var(--aim3-top)", transform: "translate(-30%, -40%)" }}
        >
          <span className="atria-anim-ripple-3 block h-full w-full rounded-full bg-zinc-400" />
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
