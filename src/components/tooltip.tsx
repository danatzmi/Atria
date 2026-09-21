"use client";

import type { ReactNode } from "react";
import * as RadixTooltip from "@radix-ui/react-tooltip";

// Tooltips for icon-only controls.
//
// These replaced the native `title` attribute, whose delay is ~1s, is not
// configurable, and differs between browsers and platforms — long enough
// that someone hovering a bare trash glyph gives up before it explains
// itself, which defeats the point of having it.
//
// Radix rather than hand-rolling, unusually for this codebase: a tooltip
// that behaves correctly is mostly edge cases (focus vs hover, touch, the
// Escape key, aria-describedby wiring, collision flipping near a viewport
// edge), and those are the parts that get quietly skipped in a bespoke one.
// The sibling Dropdown component is hand-rolled because its positioning
// needs were specific; this has no such excuse.

// Hover time before a tooltip opens. Short enough to feel like the UI
// answering a question, long enough that sweeping the cursor across a row
// of icons doesn't flash three of them.
const DELAY_MS = 200;

// Wraps the app once, at the root. `skipDelayDuration` is why it belongs
// high up rather than around each button: after one tooltip has opened,
// moving to a neighbouring icon within this window shows the next one
// immediately, so scanning a toolbar reads as one continuous gesture
// instead of a series of separate waits.
export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <RadixTooltip.Provider
      delayDuration={DELAY_MS}
      skipDelayDuration={300}
      // Radix otherwise keeps a tooltip open while the pointer travels
      // through a "grace area" between the trigger and the tooltip, so you
      // can move onto the tooltip itself. That is for tooltips containing
      // something worth reaching — a link, selectable text. Ours hold one
      // word, nothing is interactive inside them, and the cost of the grace
      // area is that leaving the trigger does not reliably close it: the
      // pointer has to keep moving for the polygon check to run again.
      // Measured in-browser, a single move away left the tooltip open
      // indefinitely. Disabling it makes leave mean leave.
      disableHoverableContent
    >
      {children}
    </RadixTooltip.Provider>
  );
}

export function Tooltip({
  label,
  children,
  side = "top",
}: {
  // Optional so a trigger that is icon-only in one variant and plain text
  // in another can pass the label conditionally, rather than every such
  // caller reinventing the same ternary around the whole element. An
  // absent label renders the child untouched — no trigger, no listeners.
  label?: string;
  // The control being described. Must be a single element that forwards
  // refs and spreads props — every caller here passes a <button>.
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}) {
  if (!label) return <>{children}</>;

  return (
    <RadixTooltip.Root>
      {/* asChild so the trigger *is* the button rather than a wrapper span
          around it. A wrapper would land inside flex rows and absolutely
          positioned hover groups and quietly change their layout. */}
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        {/* Portalled to the body: these icons live inside cards and
            sidebars with overflow-hidden, which would otherwise clip the
            tooltip to the container it is trying to escape. */}
        <RadixTooltip.Content
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className="z-50 select-none rounded bg-zinc-900 px-2 py-1 text-xs font-medium text-white shadow-sm"
        >
          {label}
          <RadixTooltip.Arrow className="fill-zinc-900" width={8} height={4} />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
