"use client";

import { useRef, useState, useTransition } from "react";
import { deleteAccount } from "./actions";

// Deleting is irreversible and cascades through everything the user owns,
// so it asks them to type the word rather than accept a single click on a
// red button.
const CONFIRM_WORD = "delete";

export function DeleteAccountDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    dialogRef.current?.close();
    setOpen(false);
    setConfirmation("");
    setError(null);
  }

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      // On success this redirects and never returns.
      const result = await deleteAccount();
      if (result?.error) setError(result.error);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          dialogRef.current?.showModal();
          setOpen(true);
        }}
        className="touch-manipulation rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
      >
        Delete account
      </button>

      <dialog
        ref={dialogRef}
        onClose={close}
        className="m-auto w-full max-w-md rounded-xl border border-zinc-200 bg-white p-0 shadow-xl backdrop:bg-zinc-900/40 backdrop:backdrop-blur-sm"
      >
        {/* Lazily mounted, matching the other dialogs in the app: the form
            state resets every time it opens. */}
        {open && (
          <div className="p-6">
            <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
              Delete your account?
            </h2>
            <p className="mt-3 text-sm text-zinc-600">
              This permanently deletes your projects, tabs, notes and every file
              you&rsquo;ve uploaded. It cannot be undone.
            </p>

            <label
              htmlFor="confirm-delete"
              className="mt-5 block text-sm text-zinc-700"
            >
              Type <span className="font-medium text-zinc-900">{CONFIRM_WORD}</span> to confirm
            </label>
            <input
              id="confirm-delete"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete="off"
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />

            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                className="rounded-md px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={pending || confirmation.trim().toLowerCase() !== CONFIRM_WORD}
                className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {pending ? "Deleting…" : "Delete account"}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
