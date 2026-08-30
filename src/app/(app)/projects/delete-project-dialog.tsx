"use client";

import { useActionState, useRef } from "react";
import { deleteProject, type ProjectActionState } from "./actions";

const initialState: ProjectActionState = { error: null };

export function DeleteProjectDialog({
  projectId,
  projectName,
  variant = "icon",
}: {
  projectId: string;
  projectName: string;
  variant?: "icon" | "button";
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState(deleteProject, initialState);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className={
          variant === "icon"
            ? "rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-600"
            : "rounded-md px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
        }
        aria-label={variant === "icon" ? "Delete project" : undefined}
      >
        {variant === "icon" ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
          >
            <path
              fillRule="evenodd"
              d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4Z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          "Delete project"
        )}
      </button>

      <dialog
        ref={dialogRef}
        className="m-auto w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-0 shadow-xl backdrop:bg-zinc-900/40 backdrop:backdrop-blur-sm"
      >
        <form action={formAction} className="p-6">
          <input type="hidden" name="project_id" value={projectId} />

          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
            Delete &ldquo;{projectName}&rdquo;?
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            This permanently deletes the project and everything inside it.
            This can&apos;t be undone.
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
