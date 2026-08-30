import type { DragEvent } from "react";

// The single source of truth for "what is being dragged" during a reorder —
// read directly from the native dataTransfer at drop time, never from React
// state. State set in onDragStart and cleared in onDragEnd is only reliable
// for the drag's *source* element; onDrop fires on a different element (the
// target) and has no guaranteed ordering against a same-render state update,
// so a drop handler that reads component state for "what's being dragged"
// can silently see a stale or already-cleared value. dataTransfer is the
// browser's own authoritative channel for this and is always populated by
// the time drop fires.
export type DragPayload = { kind: "block" | "folder"; id: string };

export function setDragPayload(e: DragEvent, payload: DragPayload) {
  e.dataTransfer.setData("application/json", JSON.stringify(payload));
  e.dataTransfer.setData("text/plain", payload.id);
  e.dataTransfer.effectAllowed = "move";
}

export function readDragPayload(e: DragEvent): DragPayload | null {
  const json = e.dataTransfer.getData("application/json");
  if (!json) return null;
  try {
    return JSON.parse(json) as DragPayload;
  } catch {
    return null;
  }
}
