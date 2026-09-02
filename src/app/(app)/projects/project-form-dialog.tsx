"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createProject, renameProject, type ProjectActionState } from "./actions";

const initialState: ProjectActionState = { error: null };

type ProjectFormDialogProps =
  | { mode: "create" }
  | {
      mode: "edit";
      project: { id: string; name: string; description: string | null };
      // Lets a caller other than the top nav's bare pencil icon reuse this
      // same dialog with its own trigger — e.g. Project Overview's
      // prominent "+ Add Overview" button when there's no description yet.
      // Omitted keeps the existing subtle icon-only trigger.
      triggerLabel?: string;
      triggerClassName?: string;
    };

export function ProjectFormDialog(props: ProjectFormDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const action = props.mode === "create" ? createProject : renameProject;
  const [state, formAction, pending] = useActionState(action, initialState);
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
        className={
          props.mode === "create"
            ? "rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
            : (props.triggerClassName ??
              "rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900")
        }
        aria-label={
          props.mode === "create" || props.triggerLabel ? undefined : "Edit project"
        }
      >
        {props.mode === "create" ? (
          "New project"
        ) : props.triggerLabel ? (
          props.triggerLabel
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
          >
            <path d="M13.586 3.586a2 2 0 1 1 2.828 2.828l-8.5 8.5a2 2 0 0 1-.878.507l-3 .8a.5.5 0 0 1-.612-.613l.8-3a2 2 0 0 1 .506-.878l8.5-8.5a2 2 0 0 1 .356-.244Z" />
          </svg>
        )}
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        className="m-auto w-full max-w-md rounded-xl border border-zinc-200 bg-white p-0 shadow-xl backdrop:bg-zinc-900/40 backdrop:backdrop-blur-sm"
      >
        {open && (
          <form action={formAction} className="p-6">
            {props.mode === "edit" && (
              <input type="hidden" name="project_id" value={props.project.id} />
            )}

            <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
              {props.mode === "create" ? "New project" : "Edit project"}
            </h2>

            <div className="mt-5 space-y-4">
              <div>
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
                  defaultValue={props.mode === "edit" ? props.project.name : ""}
                  placeholder="Sarah & David — Wedding"
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                />
              </div>

              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-zinc-700"
                >
                  Description{" "}
                  <span className="font-normal text-zinc-400">(optional)</span>
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={2}
                  defaultValue={
                    props.mode === "edit" ? (props.project.description ?? "") : ""
                  }
                  className="mt-1 block w-full resize-none rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                />
              </div>

              {props.mode === "create" && (
                <div>
                  <label
                    htmlFor="cover_image"
                    className="block text-sm font-medium text-zinc-700"
                  >
                    Cover image{" "}
                    <span className="font-normal text-zinc-400">(optional)</span>
                  </label>
                  <input
                    id="cover_image"
                    name="cover_image"
                    type="file"
                    accept="image/*"
                    className="mt-1 block w-full text-sm text-zinc-600 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200"
                  />
                </div>
              )}
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
                {pending
                  ? "Saving…"
                  : props.mode === "create"
                    ? "Create project"
                    : "Save changes"}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
