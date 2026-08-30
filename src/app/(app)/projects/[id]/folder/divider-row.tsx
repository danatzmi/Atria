"use client";

import type { DragEvent, ReactNode } from "react";
import { ChevronIcon, GripIcon } from "./item-icon";
import { readDragPayload, type DragPayload } from "@/lib/drag-payload";

// A closed tab/sub-tab reads as a physical divider card: warm neutral tone,
// numbered index (a plain "01" at the top level, dotted like "01.1" or
// "01.1.2" at nested depths), soft shadow. Opening it removes the header's
// bottom rounding so it visually joins the notebook page rendered right
// beneath it. Used at every recursion depth — a nested sub-tab looks
// identical to a top-level tab, just indented by its container.
export function DividerRow({
  index,
  name,
  count,
  isOpen,
  dashed,
  onToggle,
  grip,
  actions,
}: {
  index: string;
  name: string;
  count: number;
  isOpen: boolean;
  dashed?: boolean;
  onToggle: () => void;
  grip?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div
      className={`flex items-center gap-2 border px-4 py-3.5 shadow-sm transition-colors ${
        dashed
          ? "border-dashed border-stone-300 bg-stone-50/70"
          : "border-stone-200 bg-stone-50"
      } ${isOpen ? "rounded-t-xl border-b-0" : "rounded-xl"}`}
    >
      {grip}
      <button
        type="button"
        onClick={onToggle}
        className="flex flex-1 items-center gap-3 text-left"
      >
        <ChevronIcon
          className={`h-4 w-4 shrink-0 text-stone-400 transition-transform duration-200 ${
            isOpen ? "rotate-90" : ""
          }`}
        />
        <span className="shrink-0 font-mono text-xs tracking-wider text-stone-400">
          {index}
        </span>
        <span
          className={`truncate text-sm font-medium ${
            dashed ? "text-stone-500" : "text-stone-900"
          }`}
        >
          {name}
        </span>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs text-stone-500 shadow-sm">
          {count}
        </span>
      </button>
      {actions && <div className="flex shrink-0 gap-1">{actions}</div>}
    </div>
  );
}

// Pure-CSS smooth expand/collapse — no measuring, no animation library. The
// open state renders as the "notebook page": clean white sheet joined to the
// divider card above it.
export function AnimatedPanel({
  isOpen,
  dashed,
  children,
}: {
  isOpen: boolean;
  dashed?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className="grid transition-[grid-template-rows] duration-300 ease-out"
      style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
    >
      <div className="overflow-hidden">
        {isOpen && (
          <div
            className={`rounded-b-xl border border-t-0 bg-white p-5 shadow-sm ${
              dashed ? "border-dashed border-stone-300" : "border-stone-200"
            }`}
          >
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

// The drag source for reordering a tab/sub-tab among its siblings. Unlike a
// block's grip (always visible), this one only needs to exist — there's no
// separate insert-bar affordance for tabs, only reordering.
export function DividerGripHandle({
  onDragStart,
  onDragEnd,
}: {
  // Builds the actual drag payload (kind/id) itself — see drag-payload.ts —
  // since it knows which folder it belongs to and this component doesn't.
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
}) {
  return (
    // A div, not a button — native buttons intercept mousedown for their
    // own press-state handling in WebKit/Chromium, which can swallow the
    // event before a real (non-synthetic) mouse drag ever starts.
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      aria-label="Drag to reorder"
      title="Drag to reorder"
      className="flex w-8 shrink-0 cursor-grab select-none items-center justify-center self-stretch rounded-md bg-stone-100/50 text-stone-400 transition-colors hover:bg-stone-200/60 hover:text-stone-700 active:cursor-grabbing"
    >
      <GripIcon className="h-4 w-4" />
    </div>
  );
}

// A drop target between two divider cards (and before the first / after the
// last) — appears only while a card is actively being dragged, since
// there's nothing to insert here, only a place to drop.
export function DividerDropZone({
  active,
  isOver,
  onDragOverZone,
  onDragLeaveZone,
  onDrop,
}: {
  active: boolean;
  isOver: boolean;
  onDragOverZone: () => void;
  onDragLeaveZone: () => void;
  onDrop: (payload: DragPayload) => void;
}) {
  return (
    <div
      // Generous hitbox while a card is actively being dragged (h-5 ≈ 20px,
      // versus the collapsed h-0 the rest of the time) — easy to hit without
      // permanently taking up space in the list.
      className={`flex items-center overflow-hidden rounded-md transition-all ${
        active ? `h-5 ${isOver ? "bg-stone-100" : ""}` : "h-0"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onDragOverZone();
      }}
      onDragLeave={(e) => {
        // dragleave fires when the cursor crosses onto a child element too,
        // not just when it truly exits the zone — without this guard the
        // indicator flickers off mid-hover.
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        onDragLeaveZone();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDragLeaveZone();
        const payload = readDragPayload(e);
        if (payload) onDrop(payload);
      }}
    >
      {active && (
        <div
          className={`mx-1 w-full rounded-full transition-all ${
            isOver ? "h-0.5 bg-stone-600" : "h-1 bg-stone-200"
          }`}
        />
      )}
    </div>
  );
}
