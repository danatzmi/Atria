"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  listChildFolders,
  moveFile,
  moveFolder,
  type FolderActionState,
} from "./actions";
import { FolderIcon, MoveIcon } from "./item-icon";

const initialState: FolderActionState = { error: null };

type Crumb = { id: string | null; name: string };

export function MoveDialog({
  kind,
  itemId,
  projectId,
  itemName,
  onSuccess,
}: {
  kind: "file" | "folder";
  itemId: string;
  projectId: string;
  itemName: string;
  onSuccess?: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const action = kind === "file" ? moveFile : moveFolder;
  const [state, formAction, pending] = useActionState(action, initialState);
  const wasPendingRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [trail, setTrail] = useState<Crumb[]>([{ id: null, name: "Project root" }]);
  const [children, setChildren] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, startTransition] = useTransition();

  const current = trail[trail.length - 1];

  useEffect(() => {
    if (!open) return;
    startTransition(async () => {
      const folders = await listChildFolders(projectId, current.id);
      setChildren(
        kind === "folder" ? folders.filter((f) => f.id !== itemId) : folders
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, trail]);

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
          setTrail([{ id: null, name: "Project root" }]);
          dialogRef.current?.showModal();
          setOpen(true);
        }}
        className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
        aria-label="Move"
      >
        <MoveIcon className="h-4 w-4" />
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        className="m-auto w-full max-w-md rounded-xl border border-zinc-200 bg-white p-0 shadow-xl backdrop:bg-zinc-900/40 backdrop:backdrop-blur-sm"
      >
        {open && (
          <div className="p-6">
            <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
              Move &ldquo;{itemName}&rdquo;
            </h2>

            <div className="mt-3 flex flex-wrap items-center gap-1 text-sm text-zinc-500">
              {trail.map((crumb, i) => (
                <span key={crumb.id ?? "root"} className="flex items-center gap-1">
                  {i > 0 && <span>/</span>}
                  <button
                    type="button"
                    onClick={() => setTrail(trail.slice(0, i + 1))}
                    className={
                      i === trail.length - 1
                        ? "font-medium text-zinc-900"
                        : "hover:text-zinc-900"
                    }
                  >
                    {crumb.name}
                  </button>
                </span>
              ))}
            </div>

            <div className="mt-3 h-64 overflow-y-auto rounded-md border border-zinc-200">
              {isLoading ? (
                <p className="p-4 text-sm text-zinc-400">Loading…</p>
              ) : children.length === 0 ? (
                <p className="p-4 text-sm text-zinc-400">No tabs here.</p>
              ) : (
                children.map((folder) => (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() =>
                      setTrail([...trail, { id: folder.id, name: folder.name }])
                    }
                    className="flex w-full items-center gap-2 border-b border-zinc-100 px-4 py-2 text-left text-sm text-zinc-700 last:border-b-0 hover:bg-zinc-50"
                  >
                    <FolderIcon className="h-4 w-4 shrink-0 text-zinc-400" />
                    {folder.name}
                  </button>
                ))
              )}
            </div>

            {state.error && (
              <p className="mt-3 text-sm text-red-600">{state.error}</p>
            )}

            <form action={formAction} className="mt-6 flex justify-end gap-2">
              <input type="hidden" name="project_id" value={projectId} />
              <input
                type="hidden"
                name={kind === "file" ? "file_id" : "folder_id"}
                value={itemId}
              />
              <input
                type="hidden"
                name="target_folder_id"
                value={current.id ?? ""}
              />
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
                {pending ? "Moving…" : "Move here"}
              </button>
            </form>
          </div>
        )}
      </dialog>
    </>
  );
}
