"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { duplicateProject, type DuplicateMode } from "./actions";
import { Tooltip } from "@/components/tooltip";

// Template first, and selected by default. It is the common case — the same
// binder structure reused for the next client — and it is also the cheap
// one: nothing copied in storage, no plan ceiling to hit. Defaulting to the
// heavier option made the frequent path a correction every time, and an
// accidental Return could copy gigabytes.
const OPTIONS: { value: DuplicateMode; title: string; detail: string }[] = [
  {
    value: "template",
    title: "Template copy",
    detail:
      "Copies the folder structure only. Leaves out all notes and files so you can start fresh.",
  },
  {
    value: "full",
    title: "Full copy",
    detail: "Includes all folders, text notes, photos, and files.",
  },
];

// One definition for both the initial value and the reset in close(). Two
// separate literals is exactly how a dialog ends up opening on a different
// option the second time it is used.
const DEFAULT_MODE: DuplicateMode = "template";

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h6A1.5 1.5 0 0 1 16 3.5v8a1.5 1.5 0 0 1-1.5 1.5h-6A1.5 1.5 0 0 1 7 11.5v-8Z" />
      <path d="M4 6.5A1.5 1.5 0 0 1 5.5 5v8A1.5 1.5 0 0 0 7 14.5h5.5A1.5 1.5 0 0 1 11 16h-5A2.5 2.5 0 0 1 3.5 13.5v-6A1.5 1.5 0 0 1 4 6.5Z" />
    </svg>
  );
}

export function DuplicateProjectDialog({
  projectId,
  projectName,
  triggerLabel,
  triggerClassName,
}: {
  projectId: string;
  projectName: string;
  // As above: supplied when this is a row in a menu instead of an icon.
  triggerLabel?: string;
  triggerClassName?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<DuplicateMode>(DEFAULT_MODE);
  const [error, setError] = useState<string | null>(null);
  const [atPlanLimit, setAtPlanLimit] = useState(false);
  const [pending, startTransition] = useTransition();

  function close() {
    dialogRef.current?.close();
    setOpen(false);
    setMode(DEFAULT_MODE);
    setError(null);
    setAtPlanLimit(false);
  }

  function handleDuplicate() {
    setError(null);
    setAtPlanLimit(false);
    startTransition(async () => {
      const result = await duplicateProject(projectId, mode);
      if (result.error) {
        setError(result.error);
        setAtPlanLimit(!!result.atPlanLimit);
        return;
      }
      close();
      // Straight into the copy: the point of duplicating is to work on the
      // new one, and a full copy of a large binder is long enough that
      // landing back on the list leaves you hunting for what just appeared.
      if (result.newProjectId) router.push(`/projects/${result.newProjectId}`);
      else router.refresh();
    });
  }

  return (
    <>
      <Tooltip label={triggerLabel ? undefined : "Duplicate project"}>
        <button
          type="button"
          onClick={() => {
            dialogRef.current?.showModal();
            setOpen(true);
          }}
          aria-label={triggerLabel ? undefined : "Duplicate project"}
          className={
            triggerClassName ??
            "rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
          }
        >
          {triggerLabel ?? <CopyIcon className="h-4 w-4" />}
        </button>
      </Tooltip>

      <dialog
        ref={dialogRef}
        onClose={close}
        className="m-auto w-full max-w-md rounded-xl border border-zinc-200 bg-white p-0 shadow-xl backdrop:bg-zinc-900/40 backdrop:backdrop-blur-sm"
      >
        {open && (
          <div className="p-6">
            <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
              Duplicate project
            </h2>
            <p className="mt-2 truncate text-sm text-zinc-500">{projectName}</p>

            {/* A radiogroup rather than two buttons: these are two readings
                of one action, and the difference between them is the body
                text, which a button can't carry legibly. */}
            <div role="radiogroup" aria-label="What to copy" className="mt-5 space-y-2">
              {OPTIONS.map((option) => {
                const selected = mode === option.value;
                return (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${
                      selected
                        ? "border-zinc-900 bg-zinc-50"
                        : "border-zinc-200 hover:bg-zinc-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="duplicate-mode"
                      value={option.value}
                      checked={selected}
                      onChange={() => setMode(option.value)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-zinc-900"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-zinc-900">
                        {option.title}
                      </span>
                      <span className="mt-0.5 block text-sm text-zinc-500">
                        {option.detail}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>

            {error && (
              // A plan ceiling is not a mistake to correct, so it gets the
              // same calm panel and route forward the create dialog uses
              // rather than red validation text.
              <div
                className={
                  atPlanLimit
                    ? "mt-4 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-3"
                    : "mt-4"
                }
              >
                <p className={atPlanLimit ? "text-sm text-zinc-700" : "text-sm text-red-600"}>
                  {error}
                </p>
                {atPlanLimit && (
                  <a
                    href="/settings/billing"
                    className="mt-2 inline-block text-sm font-medium text-zinc-900 underline underline-offset-2 transition-colors hover:text-zinc-600"
                  >
                    See plans
                  </a>
                )}
              </div>
            )}

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
                onClick={handleDuplicate}
                disabled={pending}
                className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60"
              >
                {pending ? "Duplicating…" : "Duplicate"}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
