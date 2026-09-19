"use client";

import { useActionState } from "react";
import { updateName, type SettingsActionState } from "./actions";

const initialState: SettingsActionState = { error: null };

export function NameForm({ initialName }: { initialName: string }) {
  const [state, formAction, pending] = useActionState(updateName, initialState);

  return (
    <form action={formAction} className="mt-1 flex items-center gap-2">
      <input
        name="name"
        defaultValue={initialName}
        aria-label="Your name"
        maxLength={80}
        className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
      />
      <button
        type="submit"
        disabled={pending}
        className="shrink-0 touch-manipulation rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>

      {state.error && (
        <p className="w-full text-sm text-red-600">{state.error}</p>
      )}
      {/* aria-live so the confirmation is announced, not just shown. */}
      <p aria-live="polite" className="sr-only">
        {state.saved ? "Name saved" : ""}
      </p>
      {state.saved && !state.error && (
        <span className="shrink-0 text-xs text-zinc-400">Saved</span>
      )}
    </form>
  );
}
