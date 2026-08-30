"use client";

import { useEffect, useRef, useState } from "react";
import { createTextBlock, updateBlockContent } from "./actions";
import { RichTextEditorSurface, RichTextToolbar, useRichTextEditor } from "./rich-text-editor";

// Owns the TipTap editor instance — mounted only for kind: "text" (never
// for a caption's plain input), so a photo caption dialog never pays for an
// editor it doesn't use. Font family/size/color are now in-document marks
// set from the ribbon itself (Word-style, per-selection), not a whole-block
// toggle, so this has nothing to manage beyond the editor's own content.
function TextBlockFields({
  fieldsRef,
  initialContent,
}: {
  fieldsRef: React.RefObject<{ getContent: () => string } | null>;
  initialContent: string;
}) {
  const [content, setContent] = useState(initialContent);

  const editor = useRichTextEditor({
    content: initialContent,
    onChange: setContent,
    autofocus: true,
  });

  useEffect(() => {
    fieldsRef.current = { getContent: () => content };
  });

  return (
    <div>
      <RichTextToolbar editor={editor} />
      <RichTextEditorSurface editor={editor} />
    </div>
  );
}

// Covers two block-content edits with one dialog: a text block's rich body
// (a true WYSIWYG editor — see rich-text-editor.tsx) and a photo's caption
// (a short plain-text label, no formatting needed).
export function BlockFormDialog({
  projectId,
  sectionId = null,
  sortOrder,
  mode,
  kind,
  blockId,
  initialContent = "",
  dialogTitle,
  placeholder,
  submitLabel = "Save",
  triggerLabel,
  triggerClassName,
  onSuccess,
}: {
  projectId: string;
  // Where a new block lands — only used when mode === "create". Omitted
  // sortOrder appends to the end; a specific insert-bar gap passes its own
  // computed midpoint instead.
  sectionId?: string | null;
  sortOrder?: number;
  mode: "create" | "edit";
  kind: "text" | "caption";
  blockId?: string;
  initialContent?: string;
  dialogTitle: string;
  placeholder?: string;
  submitLabel?: string;
  triggerLabel: string;
  triggerClassName?: string;
  onSuccess?: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [captionContent, setCaptionContent] = useState(initialContent);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const multiline = kind === "text";
  const fieldsRef = useRef<{ getContent: () => string } | null>(null);

  function openDialog() {
    setCaptionContent(initialContent);
    setError(null);
    dialogRef.current?.showModal();
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const content = multiline ? (fieldsRef.current?.getContent() ?? "") : captionContent;

    const result =
      mode === "edit"
        ? await updateBlockContent(blockId!, projectId, content)
        : await createTextBlock(projectId, sectionId, content, sortOrder);

    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    dialogRef.current?.close();
    setOpen(false);
    onSuccess?.();
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
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
        className={`m-auto w-full rounded-xl border border-zinc-200 bg-white p-0 shadow-xl backdrop:bg-zinc-900/40 backdrop:backdrop-blur-sm ${
          multiline ? "max-w-3xl" : "max-w-lg"
        }`}
      >
        {open && (
          <form onSubmit={handleSubmit} className="p-6">
            <h2 className="text-lg font-semibold tracking-tight text-zinc-900">{dialogTitle}</h2>

            <div className="mt-4">
              {multiline ? (
                <TextBlockFields fieldsRef={fieldsRef} initialContent={initialContent} />
              ) : (
                <input
                  type="text"
                  autoFocus
                  value={captionContent}
                  onChange={(e) => setCaptionContent(e.target.value)}
                  placeholder={placeholder}
                  className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                />
              )}
            </div>

            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

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
                {pending ? "Saving…" : submitLabel}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
