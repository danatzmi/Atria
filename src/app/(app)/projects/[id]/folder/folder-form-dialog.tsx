"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createFolder, type FolderActionState } from "./actions";

const initialState: FolderActionState = { error: null };

export function FolderFormDialog({
  projectId,
  parentFolderId,
  sortOrder,
  triggerLabel = "New tab",
  triggerClassName,
  dialogTitle = "New tab",
  namePlaceholder = "Suppliers",
  submitLabel = "Create tab",
  onSuccess,
}: {
  projectId: string;
  parentFolderId: string | null;
  // Explicit position for a specific notebook-stream gap — omitted appends
  // to the end, same as the "+ Add Sub-tab" trigger's default.
  sortOrder?: number;
  triggerLabel?: string;
  triggerClassName?: string;
  dialogTitle?: string;
  namePlaceholder?: string;
  submitLabel?: string;
  // The newly created tab's id, when the caller wants to navigate straight
  // to it (e.g. the sidebar's top-level "+ Tab" trigger) — undefined for
  // callers that just want the list refreshed in place (e.g. "+ Sub-tab",
  // which stays on the current tab so the new one appears inline).
  onSuccess?: (id?: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState(createFolder, initialState);
  const wasPendingRef = useRef(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (wasPendingRef.current && !pending && !state.error) {
      dialogRef.current?.close();
      setOpen(false);
      onSuccess?.(state.id);
    }
    wasPendingRef.current = pending;
  }, [pending, state.error, state.id, onSuccess]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          dialogRef.current?.showModal();
          setOpen(true);
        }}
        className={
          triggerClassName ??
          "rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
        }
      >
        {triggerLabel}
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
              name="parent_folder_id"
              value={parentFolderId ?? ""}
            />
            {sortOrder !== undefined && (
              <input type="hidden" name="sort_order" value={sortOrder} />
            )}

            <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
              {dialogTitle}
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
                placeholder={namePlaceholder}
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
                {pending ? "Creating…" : submitLabel}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
