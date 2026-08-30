"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  updateCoverImage,
  type ProjectActionState,
} from "../actions";

const initialState: ProjectActionState = { error: null };

export function CoverImageDialog({
  projectId,
  hasCoverImage,
}: {
  projectId: string;
  hasCoverImage: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState(
    updateCoverImage,
    initialState
  );
  const wasPendingRef = useRef(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (wasPendingRef.current && !pending && !state.error) {
      dialogRef.current?.close();
      setOpen(false);
    }
    wasPendingRef.current = pending;
  }, [pending, state.error]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          dialogRef.current?.showModal();
          setOpen(true);
        }}
        className="rounded-md bg-white/90 px-3 py-1.5 text-sm font-medium text-zinc-900 shadow-sm backdrop-blur-sm transition-colors hover:bg-white"
      >
        {hasCoverImage ? "Change cover" : "Add cover image"}
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        className="m-auto w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-0 shadow-xl backdrop:bg-zinc-900/40 backdrop:backdrop-blur-sm"
      >
        {open && (
          <form action={formAction} className="p-6">
            <input type="hidden" name="project_id" value={projectId} />

            <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
              {hasCoverImage ? "Change cover image" : "Add a cover image"}
            </h2>

            <div className="mt-4">
              <input
                id="cover_image"
                name="cover_image"
                type="file"
                accept="image/*"
                required
                autoFocus
                className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200"
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
                {pending ? "Uploading…" : "Upload"}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
