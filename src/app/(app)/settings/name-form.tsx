"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updateName, type SettingsActionState } from "./actions";
import { PencilIcon } from "../projects/[id]/folder/item-icon";

const initialState: SettingsActionState = { error: null };

// View by default, edit on demand.
//
// A permanently-open input makes a settings page read as a form to fill in
// rather than information to look at — and most visits are to read, not to
// change. The pencil matches the rename affordance used on projects and
// tabs, so the gesture is already familiar.
export function NameForm({ initialName }: { initialName: string }) {
  const [state, formAction, pending] = useActionState(updateName, initialState);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // The server value is the source of truth; this only holds what's shown
  // while the form is open, so Cancel can discard it.
  const [draft, setDraft] = useState(initialName);

  // A successful save closes the editor — reacting to the action's real
  // outcome rather than to the click, so a rejected name keeps the form
  // open with its message.
  //
  // Adjusted during render rather than in an effect: setState inside an
  // effect body cascades an extra render and trips
  // react-hooks/set-state-in-effect. Comparing against the previous value
  // is React's own sanctioned pattern for "adjust state when a prop
  // changes", and can't loop because the condition is false next render.
  const [lastSaved, setLastSaved] = useState(state.saved);
  if (state.saved !== lastSaved) {
    setLastSaved(state.saved);
    if (state.saved && !state.error) setEditing(false);
  }

  // Focus follows the mode change, so the cursor is where the user is
  // looking after clicking the pencil.
  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  if (!editing) {
    return (
      <div className="mt-1 flex items-center gap-1.5">
        <p className="min-w-0 truncate text-sm text-zinc-900">
          {initialName || <span className="text-zinc-400">Not set</span>}
        </p>
        <button
          type="button"
          onClick={() => {
            setDraft(initialName);
            setEditing(true);
          }}
          aria-label="Edit your name"
          className="shrink-0 rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
        >
          <PencilIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-1">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          name="name"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          // Escape cancels, which is what the key is for in an inline
          // editor — otherwise the only way out is the mouse.
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              setEditing(false);
            }
          }}
          aria-label="Your name"
          maxLength={80}
          autoFocus
          className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 touch-manipulation rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="shrink-0 touch-manipulation rounded-md px-2 py-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900"
        >
          Cancel
        </button>
      </div>

      {state.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
