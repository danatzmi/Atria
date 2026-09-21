// Brings a just-created block into view.
//
// The problem this solves: "+ Add" and uploads append to the end of the
// stream. In a tab with any real content that lands below the fold, so the
// only feedback for a successful action is a scrollbar getting shorter —
// people re-click, or assume it failed.
//
// Why this is not a one-line scrollIntoView: the block does not exist in
// the DOM when the action resolves. The server action returns, the client
// refetches the tab, React re-renders, and only then is there a node to
// scroll to. A fixed setTimeout is a guess at how long that takes — too
// short on a slow network and it silently does nothing, too long and the
// page sits still after the user acted. So poll for the node instead, on
// animation frames, and give up rather than run at some arbitrary later
// moment when the user has moved on.
const GIVE_UP_AFTER_MS = 3000;

export function scrollToBlock(blockId: string | undefined) {
  if (!blockId || typeof window === "undefined") return;

  const start = performance.now();

  const tick = () => {
    const el = document.getElementById(blockId);
    if (el) {
      el.scrollIntoView({
        // Someone who asked their system to reduce motion means it here
        // too: a long smooth scroll is exactly the kind of movement that
        // setting exists to stop. They still get taken to the block.
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "center",
      });
      return;
    }
    if (performance.now() - start < GIVE_UP_AFTER_MS) {
      requestAnimationFrame(tick);
    }
  };

  requestAnimationFrame(tick);
}
