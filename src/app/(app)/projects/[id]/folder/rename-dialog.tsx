"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { renameFile, renameFolder, type FolderActionState } from "./actions";
import { PencilIcon } from "./item-icon";

const initialState: FolderActionState = { error: null };

export function RenameDialog({
  kind,
  itemId,
  projectId,
  currentName,
  onSuccess,
}: {
  kind: "file" | "folder";
  itemId: string;
  projectId: string;
  currentName: string;
  // Called after a successful rename. The old page-based routing relied on
  // Next re-rendering the server tree after any form action; the binder
  // workspace holds its own client state, so it needs an explicit nudge.
  onSuccess?: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const action = kind === "file" ? renameFile : renameFolder;
  const [state, formAction, pending] = useActionState(action, initialState);
  const wasPendingRef = useRef(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (wasPendingRef.current && !pending && !state.error) {
      dialogRef.current?.close();
      setOpen(false);
      onSuccess?.();
    }
    wasPendingRef.current = pending;
  }, [pending, state.error, onSuccess]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          dialogRef.current?.showModal();
          setOpen(true);
        }}
        className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
        aria-label="Rename"
      >
        <PencilIcon className="h-4 w-4" />
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        className="m-auto w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-0 shadow-xl backdrop:bg-zinc-900/40 backdrop:backdrop-blur-sm"
      >
        {open && (
          <form action={formAction} className="p-6">
            <input type="hidden" name="project_id" value={projectId} />
            <input
              type="hidden"
              name={kind === "file" ? "file_id" : "folder_id"}
              value={itemId}
            />

            <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
              Rename {kind === "file" ? "item" : "tab"}
            </h2>

            <div className="mt-4">
              <label
                htmlFor="name"
                className="block text-sm font-medium text-zinc-700"
              >
                Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                autoFocus
                defaultValue={currentName}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
            </div>

            {state.error && (
              <p className="mt-4 text-sm text-red-600">{state.error}</p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="rounded-md px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60"
              >
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
