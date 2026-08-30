"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  deleteBlockRow,
  deleteFile,
  deleteFolder,
  type FolderActionState,
} from "./actions";
import { TrashIcon } from "./item-icon";

const initialState: FolderActionState = { error: null };

export function DeleteItemDialog({
  kind,
  itemId,
  projectId,
  itemName,
  onSuccess,
}: {
  kind: "file" | "folder" | "block";
  itemId: string;
  projectId: string;
  itemName: string;
  onSuccess?: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const action =
    kind === "file" ? deleteFile : kind === "folder" ? deleteFolder : deleteBlockRow;
  const [state, formAction, pending] = useActionState(action, initialState);
  const wasPendingRef = useRef(false);

  useEffect(() => {
    if (wasPendingRef.current && !pending && !state.error) {
      dialogRef.current?.close();
      onSuccess?.();
    }
    wasPendingRef.current = pending;
  }, [pending, state.error, onSuccess]);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-600"
        aria-label="Delete"
      >
        <TrashIcon className="h-4 w-4" />
      </button>

      <dialog
        ref={dialogRef}
        className="m-auto w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-0 shadow-xl backdrop:bg-zinc-900/40 backdrop:backdrop-blur-sm"
      >
        <form action={formAction} className="p-6">
          <input type="hidden" name="project_id" value={projectId} />
          <input
            type="hidden"
            name={
              kind === "file" ? "file_id" : kind === "folder" ? "folder_id" : "block_id"
            }
            value={itemId}
          />

          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
            Delete &ldquo;{itemName}&rdquo;?
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            {kind === "folder"
              ? "This permanently deletes the tab and everything inside it. This can't be undone."
              : "This permanently deletes it. This can't be undone."}
          </p>

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
              className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60"
            >
              {pending ? "Deleting…" : "Delete"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
