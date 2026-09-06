"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import {
  buildStorageKey,
  MAX_FILE_SIZE_BYTES,
  PROJECT_FILES_BUCKET,
} from "@/lib/supabase/storage";
import { formatBytes, getFormatLabel, isPdfFile } from "@/lib/files";
import { renderBlockContent, tryParseDocJSON } from "@/lib/doc-content";
import { midpointSortOrder } from "@/lib/sort-order";
import { blockMatchesQuery, type BlockRow, type FileRow, type FolderRow } from "./data";
import {
  createFileRecord,
  getFileDownloadUrl,
  getTabContents,
  moveBlockToPosition,
} from "./actions";
import { ChevronIcon, DocumentIcon, PlayIcon, UploadIcon } from "./item-icon";
import { RenameDialog } from "./rename-dialog";
import { MoveDialog } from "./move-dialog";
import { DeleteItemDialog } from "./delete-item-dialog";
import { FolderFormDialog } from "./folder-form-dialog";
import { BlockFormDialog } from "./block-form-dialog";

// This level's own block stream — Sub-tabs no longer render inline here
// (they live exclusively in the persistent left sidebar; see
// project-sidebar.tsx), so a stream item is always either a single block or
// a run of 2+ consecutive image blocks collapsed into one photo grid.
type StreamItem =
  | { kind: "block"; block: BlockRow }
  | { kind: "images"; blocks: BlockRow[] };

// blocks arrives pre-ordered by sort_order, so this only needs to walk it
// once, grouping consecutive image runs — no merge/sort step needed now
// that Sub-tabs aren't part of the stream.
function buildStream(blocks: BlockRow[]): StreamItem[] {
  const items: StreamItem[] = [];
  let i = 0;
  while (i < blocks.length) {
    if (blocks[i].type === "image") {
      const run: BlockRow[] = [];
      while (i < blocks.length && blocks[i].type === "image") {
        run.push(blocks[i]);
        i++;
      }
      items.push(run.length >= 2 ? { kind: "images", blocks: run } : { kind: "block", block: run[0] });
      continue;
    }
    items.push({ kind: "block", block: blocks[i] });
    i++;
  }
  return items;
}

function firstSortOrder(item: StreamItem): number {
  if (item.kind === "block") return item.block.sort_order;
  return item.blocks[0].sort_order;
}
function lastSortOrder(item: StreamItem): number {
  if (item.kind === "block") return item.block.sort_order;
  return item.blocks[item.blocks.length - 1].sort_order;
}
function streamKey(item: StreamItem): string {
  if (item.kind === "block") return item.block.id;
  return `images-${item.blocks[0].id}`;
}

// The rendered page's pixel width. The card is max-w-xs (320px), so this is
// 2x for retina — pdf.js rasterises at whatever width it's given, and a
// page rendered at CSS size looks visibly soft.
const PDF_THUMBNAIL_WIDTH = 640;

// pdf.js is well over a megabyte and most tabs contain no PDF at all, so it
// is loaded on demand rather than bundled into the canvas. ssr:false because
// it needs canvas and a web worker, neither of which exists on the server.
const PdfThumbnail = dynamic(
  () => import("./pdf-thumbnail").then((m) => m.PdfThumbnail),
  { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-stone-100" /> }
);

type UploadItem = {
  id: string;
  name: string;
  status: "uploading" | "done" | "error";
  error: string | null;
};

// The Main Canvas's content for one Tab, Sub-tab, or the virtual Unsorted
// view: a compact header (name/index/search/"+ Add"/rename/delete), then
// this level's own block stream — text and file blocks, in the user's own
// order. Content is appended via the header's "+ Add"; order is changed
// with each card's Up/Down controls. Always the canvas
// ROOT (the only caller is binder-workspace.tsx): Tab/Sub-tab structure and
// navigation live entirely in the persistent left sidebar
// (project-sidebar.tsx), not here, so this component never renders another
// instance of itself.
//
// Self-fetching rather than receiving content as props: reuses the same
// getTabContents RPC the sidebar's own lazy-expand and binder-workspace's
// top-level list already call, ignoring its `folders` field — this level
// only cares about its own blocks.
export function FolderBrowser({
  projectId,
  userId,
  folderId,
  name,
  onItemsChanged,
  editable,
}: {
  projectId: string;
  userId: string;
  // null only for the virtual "Unsorted" view (the project root's own
  // blocks, no real folder to hold sub-tabs) — every real Tab/Sub-tab has a
  // real id.
  folderId: string | null;
  // This level's own name for the header — null only when binder-workspace
  // hasn't been able to resolve it yet (a hard reload straight into a
  // deep-linked Sub-tab); the header falls back to a placeholder then.
  name: string | null;
  // Called after any mutation at this level, so the parent can refresh the
  // count badge it shows for this folder. Never needs to bubble further
  // than one level: counts are direct-children-only, so a change inside a
  // sub-tab never affects its grandparent's badge.
  onItemsChanged?: () => void;
  // View Mode vs Edit Mode (project-page-level toggle, threaded straight
  // down): false hides the reorder controls and every edit/rename/move/
  // delete affordance, leaving a clean read-only presentation view.
  // Everything stays fully readable/navigable either way.
  editable: boolean;
}) {
  const isUnsorted = folderId === null;

  const [data, setData] = useState<{
    folders: FolderRow[];
    blocks: BlockRow[];
    previewUrls: Record<string, string>;
  } | null>(null);
  const [isLoading, startTransition] = useTransition();

  const [query, setQuery] = useState("");
  const [queue, setQueue] = useState<UploadItem[]>([]);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const fetchSelf = useCallback(() => {
    startTransition(async () => {
      const result = await getTabContents(projectId, folderId);
      setData(result);
    });
  }, [projectId, folderId]);

  useEffect(() => {
    fetchSelf();
  }, [fetchSelf]);

  function refresh() {
    fetchSelf();
    onItemsChanged?.();
  }

  function handleQueryChange(next: string) {
    setQuery(next);
  }

  const blocks = useMemo(() => data?.blocks ?? [], [data]);
  const previewUrls = data?.previewUrls ?? {};

  const trimmedQuery = query.trim();
  const isFiltering = trimmedQuery !== "";
  // A plain, instant, direct-children substring filter — no recursion, no
  // server round trip, since a Sub-tab's own content never shows here.
  const visibleBlocks = useMemo(
    () => (isFiltering ? blocks.filter((b) => blockMatchesQuery(b, trimmedQuery)) : blocks),
    [blocks, trimmedQuery, isFiltering]
  );
  const canReorder = editable && !isFiltering;
  const items = useMemo(() => buildStream(visibleBlocks), [visibleBlocks]);

  const isEmpty = blocks.length === 0;
  const hasResults = visibleBlocks.length > 0;

  function updateItem(id: string, patch: Partial<UploadItem>) {
    setQueue((q) => q.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function removeItem(id: string) {
    setQueue((q) => q.filter((it) => it.id !== id));
  }

  async function uploadOne(file: File, sortOrder?: number) {
    const itemId = crypto.randomUUID();
    setQueue((q) => [...q, { id: itemId, name: file.name, status: "uploading", error: null }]);

    if (file.size > MAX_FILE_SIZE_BYTES) {
      updateItem(itemId, { status: "error", error: `Over the ${formatBytes(MAX_FILE_SIZE_BYTES)} limit.` });
      return;
    }

    const mimeType = file.type || "application/octet-stream";
    const storageKey = buildStorageKey(userId, projectId, itemId, file.name);
    const supabase = createClient();

    const { error: uploadError } = await supabase.storage
      .from(PROJECT_FILES_BUCKET)
      .upload(storageKey, file, { contentType: mimeType });

    if (uploadError) {
      updateItem(itemId, { status: "error", error: "Upload failed." });
      return;
    }

    const { error: recordError } = await createFileRecord({
      projectId,
      folderId,
      name: file.name,
      mimeType,
      sizeBytes: file.size,
      storageKey,
      sortOrder,
    });

    if (recordError) {
      await supabase.storage.from(PROJECT_FILES_BUCKET).remove([storageKey]);
      updateItem(itemId, { status: "error", error: recordError });
      return;
    }

    updateItem(itemId, { status: "done", error: null });
    setTimeout(() => removeItem(itemId), 3500);
  }

  async function uploadFiles(files: FileList | File[], sortOrder?: number) {
    // A tiny per-file offset keeps a multi-file drop/selection in its
    // original order without any of them colliding with the neighbor just
    // past this gap.
    await Promise.all(
      Array.from(files).map((file, i) =>
        uploadOne(file, sortOrder === undefined ? undefined : sortOrder + i * 1e-6)
      )
    );
    refresh();
  }

  function pickAndUploadFiles(sortOrder?: number) {
    pickFiles((files) => uploadFiles(files, sortOrder));
  }

  // Touch fallback for reordering. HTML5 drag-and-drop is unreliable on
  // iOS/Android and fights the scroll gesture, so on mobile each item also
  // gets Up/Down controls. Moves a whole stream item, so a run of photos
  // rendered as one grid travels together rather than breaking apart:
  // every block in the run is rewritten to consecutive fractional positions
  // in the gap on the far side of the neighbor being stepped over.
  async function moveStreamItem(index: number, direction: -1 | 1) {
    if (!items[index + direction]) return;

    const moving = items[index];
    const movingBlocks = moving.kind === "block" ? [moving.block] : moving.blocks;

    // The gap the item is landing in — beyond the neighbor it steps over.
    let low: number | undefined;
    let high: number | undefined;
    if (direction === -1) {
      low = items[index - 2] ? lastSortOrder(items[index - 2]) : undefined;
      high = firstSortOrder(items[index - 1]);
    } else {
      low = lastSortOrder(items[index + 1]);
      high = items[index + 2] ? firstSortOrder(items[index + 2]) : undefined;
    }

    for (const block of movingBlocks) {
      const target = midpointSortOrder(low, high);
      await moveBlockToPosition(block.id, projectId, target);
      // Next block in the run goes after the one just placed, keeping the
      // run's internal order intact.
      low = target;
    }
    refresh();
  }

  if (!data) {
    return <p className="py-8 text-center text-sm text-stone-400">Loading…</p>;
  }

  return (
    <div
      onDragOver={(e) => {
        if (editable && e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setIsDraggingFile(true);
        }
      }}
      onDragLeave={() => setIsDraggingFile(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDraggingFile(false);
        if (editable && e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files);
      }}
      className={`rounded-lg border-2 border-dashed transition-colors ${
        isDraggingFile ? "border-stone-300 bg-stone-50" : "border-transparent"
      }`}
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <h2 className="truncate text-lg font-semibold tracking-tight text-stone-900">
            {name ?? "Untitled tab"}
          </h2>
        </div>
        <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto">
          <SearchBox
            query={query}
            onQueryChange={handleQueryChange}
            className="block w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm shadow-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500 sm:w-40"
          />
          {editable && (
            <>
              <AddMenu
                projectId={projectId}
                folderId={folderId}
                isUnsorted={isUnsorted}
                onUploadFiles={() => pickAndUploadFiles()}
                onSuccess={refresh}
              />
              {/* Renaming a tab lives only in the sidebar row now, so the
                  tab's name has exactly one edit affordance. */}
            </>
          )}
        </div>
      </div>

      {!hasResults ? (
        isEmpty ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div>
              <h2 className="text-sm font-medium text-stone-700">This tab is empty</h2>
              <p className="mt-1 max-w-xs text-sm text-stone-400">
                Start writing, drop in photos or plans, or add a heading with
                the text toolbar.
              </p>
            </div>
            {editable && (
              <div className="flex flex-wrap justify-center gap-2">
                <BlockFormDialog
                  projectId={projectId}
                  sectionId={folderId}
                  mode="create"
                  kind="text"
                  dialogTitle="New text block"
                  placeholder="Write anything worth remembering about this tab…"
                  submitLabel="Add block"
                  triggerLabel="+ Text"
                  onSuccess={refresh}
                />
                <button
                  type="button"
                  onClick={() => pickAndUploadFiles()}
                  className="flex items-center gap-1.5 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
                >
                  <UploadIcon className="h-4 w-4" />
                  Upload File
                </button>
              </div>
            )}
          </div>
        ) : (
          <p className="py-12 text-center text-sm text-stone-400">
            No results for &ldquo;{query}&rdquo;.
          </p>
        )
      ) : (
        // A plain top-to-bottom pile. New content is appended by "+ Add" in
        // the header; existing content is rearranged with each card's own
        // Up/Down controls. There is no insert-between affordance and no
        // drag-reordering — see MoveItemButtons for why.
        <div className="mt-6 space-y-4">
          {items.map((item, i) => (
            <Fragment key={streamKey(item)}>
              {canReorder && items.length > 1 && (
                <MoveItemButtons
                  canMoveUp={i > 0}
                  canMoveDown={i < items.length - 1}
                  onMoveUp={() => moveStreamItem(i, -1)}
                  onMoveDown={() => moveStreamItem(i, 1)}
                />
              )}
              {item.kind === "block" ? (
                <BlockItem
                  projectId={projectId}
                  block={item.block}
                  previewUrl={item.block.file ? previewUrls[item.block.file.storage_key] : undefined}
                  editable={editable}
                  onChanged={refresh}
                />
              ) : (
                <PhotoGrid
                  projectId={projectId}
                  blocks={item.blocks}
                  imageUrls={previewUrls}
                  editable={editable}
                  onChanged={refresh}
                />
              )}
            </Fragment>
          ))}
        </div>
      )}

      {isLoading && (
        <p className="mt-2 text-center text-xs text-stone-400">Refreshing…</p>
      )}

      {queue.length > 0 && (
        <ul className="mt-4 space-y-1">
          {queue.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-md border border-stone-200 px-3 py-2 text-sm"
            >
              <span className="truncate text-stone-700">{item.name}</span>
              <span className="flex shrink-0 items-center gap-2">
                <span
                  className={
                    item.status === "error"
                      ? "text-red-600"
                      : item.status === "done"
                        ? "text-emerald-600"
                        : "text-stone-400"
                  }
                >
                  {item.status === "uploading"
                    ? "Uploading…"
                    : item.status === "done"
                      ? "Uploaded"
                      : item.error}
                </span>
                {item.status !== "uploading" && (
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    aria-label="Dismiss"
                    className="text-stone-400 transition-colors hover:text-stone-700"
                  >
                    ×
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SearchBox({
  query,
  onQueryChange,
  className,
}: {
  query: string;
  onQueryChange: (next: string) => void;
  className?: string;
}) {
  return (
    <input
      type="search"
      value={query}
      onChange={(e) => onQueryChange(e.target.value)}
      placeholder="Search this tab"
      className={
        className ??
        "block rounded-md border border-stone-300 px-3 py-1.5 text-sm shadow-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
      }
    />
  );
}

// The canvas header's "+ Add" control — a compact menu instead of three
// always-visible buttons, so the header stays a single tidy row. Each item
// reuses the exact same trigger components as the hover insert-bar
// the empty-state actions below, just restyled as menu rows. Since the
// insert-bars are gone, this is the only way to add content — everything it
// creates is appended to the end of the section.
function AddMenu({
  projectId,
  folderId,
  isUnsorted,
  onUploadFiles,
  onSuccess,
}: {
  projectId: string;
  folderId: string | null;
  isUnsorted: boolean;
  onUploadFiles: () => void;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const itemClassName =
    "block w-full px-3 py-2 text-left text-sm text-stone-700 transition-colors hover:bg-stone-50";

  // Closing the menu the instant a trigger is clicked would unmount
  // BlockFormDialog/FolderFormDialog before their own native <dialog> ever
  // gets a chance to render — the menu only closes once whichever dialog
  // actually succeeds (its own Cancel/backdrop-click close the *dialog*
  // without touching this menu, which is a harmless, rare rough edge: it
  // can be left open behind a since-cancelled dialog until the next click).
  function handleSuccess() {
    setOpen(false);
    onSuccess();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
      >
        + Add
      </button>
      {open && (
        <>
          {/* Full-screen invisible backdrop, behind the panel — the only
              purpose is closing the menu on an outside click. */}
          <button
            type="button"
            aria-label="Close menu"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          {/* Anchored to whichever side keeps the menu on screen, switching
              at the same `sm` breakpoint the header row itself does. Below
              sm the search box takes a full row, so "+ Add" wraps to the
              LEFT edge — anchoring the menu's right edge there would hang
              most of its 11rem off the left of the screen. From sm up the
              controls sit at the right, where the opposite is true. */}
          <div className="absolute left-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-stone-200 bg-white py-1 shadow-lg sm:left-auto sm:right-0">
            <BlockFormDialog
              projectId={projectId}
              sectionId={folderId}
              mode="create"
              kind="text"
              dialogTitle="New text block"
              placeholder="Write anything worth remembering about this tab…"
              submitLabel="Add block"
              triggerLabel="Text"
              triggerClassName={itemClassName}
              onSuccess={handleSuccess}
            />
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onUploadFiles();
              }}
              className={itemClassName}
            >
              Upload File
            </button>
            {!isUnsorted && (
              <FolderFormDialog
                projectId={projectId}
                parentFolderId={folderId}
                triggerLabel="Sub-tab"
                triggerClassName={itemClassName}
                dialogTitle="New sub-tab"
                namePlaceholder="Hardware"
                submitLabel="Add sub-tab"
                onSuccess={handleSuccess}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

// The only way to reorder, on every viewport. Native HTML5 drag used to do
// this on desktop via a drop strip between cards, but that strip was also
// the insert-between affordance this product deliberately dropped, and
// cards can't safely become drop targets themselves — a card that listens
// for its own dragover aborts the drag in Chrome/Safari. Explicit Up/Down
// is dull, reliable, works identically under a finger and a mouse, and
// suits a "pile of things you nudge into order" far better than a block
// editor's drag choreography.
function MoveItemButtons({
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
}: {
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const base =
    "flex h-8 w-8 items-center justify-center rounded-md border border-stone-200 bg-white text-stone-500 shadow-sm transition-colors disabled:opacity-30";

  return (
    <div className="mb-1 flex justify-end gap-1">
      <button
        type="button"
        onClick={onMoveUp}
        disabled={!canMoveUp}
        aria-label="Move up"
        className={base}
      >
        <ChevronIcon className="h-4 w-4 -rotate-90" />
      </button>
      <button
        type="button"
        onClick={onMoveDown}
        disabled={!canMoveDown}
        aria-label="Move down"
        className={base}
      >
        <ChevronIcon className="h-4 w-4 rotate-90" />
      </button>
    </div>
  );
}

// Created on demand rather than kept as a persistent ref (there can be any
// number of upload triggers, one per insert-bar gap) — attached to the DOM
// so the native picker behaves reliably, then removed once the browser
// regains focus (fires whether a file was chosen or the dialog was
// cancelled).
function pickFiles(onFiles: (files: FileList) => void) {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.className = "hidden";
  input.onchange = () => {
    if (input.files && input.files.length > 0) onFiles(input.files);
  };
  document.body.appendChild(input);
  window.addEventListener("focus", () => setTimeout(() => input.remove(), 300), {
    once: true,
  });
  input.click();
}

function BlockItem({
  projectId,
  block,
  previewUrl,
  editable,
  onChanged,
}: {
  projectId: string;
  block: BlockRow;
  // Signed URL for a previewable file — an image, a video, or a PDF.
  // Undefined for file types we show a badge for instead.
  previewUrl?: string;
  editable: boolean;
  onChanged: () => void;
}) {
  switch (block.type) {
    case "text":
      return (
        <TextBlockRow
          projectId={projectId}
          block={block}
          editable={editable}
          onChanged={onChanged}
        />
      );
    case "image":
      return (
        <PhotoBlockRow
          projectId={projectId}
          block={block}
          imageUrl={previewUrl}
          editable={editable}
          onChanged={onChanged}
        />
      );
    case "video":
      return (
        <VideoBlockRow
          projectId={projectId}
          block={block}
          previewUrl={previewUrl}
          editable={editable}
          onChanged={onChanged}
        />
      );
    case "file":
      return (
        <DocumentBlockRow
          projectId={projectId}
          block={block}
          previewUrl={previewUrl}
          editable={editable}
          onChanged={onChanged}
        />
      );
  }
}

// Paper-styled note card, rendering its content as markdown — headings,
// bold/italic/underline/code, lists, and tables all read as clean editorial
// typography rather than raw syntax.
function TextBlockRow({
  projectId,
  block,
  editable,
  onChanged,
}: {
  projectId: string;
  block: BlockRow;
  editable: boolean;
  onChanged: () => void;
}) {
  return (
    <div className="group flex items-start">
      {/* The card body IS the drag source — there's no separate grip.
          select-none matters here specifically: a mousedown landing on the
          prose would otherwise start a native text-selection gesture that
          races (and in Chrome/Safari cancels) the drag. The trade-off is
          that a note's text can no longer be selected/copied straight off
          the card — the Edit dialog is where its text is reachable. */}
      <div
        className="relative flex-1 rounded-lg border border-stone-200 bg-amber-50/40 p-4 shadow-sm"
      >
        <div
          className={
            // Whole-block font/size only ever applies to legacy (markdown)
            // content — new content carries its own per-span font marks
            // from the ribbon, applied directly by renderBlockContent.
            tryParseDocJSON(block.content)
              ? "pr-14"
              : `pr-14 ${block.font_family === "serif" ? "font-serif" : ""} ${
                  block.font_size === "large" ? "text-base" : "text-sm"
                }`
          }
        >
          {renderBlockContent(block.content)}
        </div>
        {editable && (
          // draggable={false} so a press on Edit/Delete never starts the
          // card's drag instead of the click, and cursor-pointer so they
          // don't inherit the card's grab cursor.
          <div
            draggable={false}
            className="absolute right-3 top-3 flex cursor-pointer gap-1 opacity-0 transition-opacity max-md:opacity-100 group-hover:opacity-100"
          >
            <BlockFormDialog
              projectId={projectId}
              mode="edit"
              kind="text"
              blockId={block.id}
              initialContent={block.content ?? ""}
              dialogTitle="Edit text block"
              submitLabel="Save"
              triggerLabel="Edit"
              triggerClassName="cursor-pointer rounded-md bg-white/90 px-2 py-1 text-xs font-medium text-stone-600 shadow-sm backdrop-blur-sm transition-colors hover:bg-white"
              onSuccess={onChanged}
            />
            <div className="rounded-md bg-white/90 shadow-sm backdrop-blur-sm">
              <DeleteItemDialog
                kind="block"
                itemId={block.id}
                projectId={projectId}
                itemName="text block"
                onSuccess={onChanged}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// A pinned print with a soft paper border and an optional caption — reads
// as a photo on a page, not a file-manager thumbnail. Standalone (a lone
// image with no image neighbor) — a run of 2+ consecutive images renders as
// a PhotoGrid instead (below), sharing this same inner markup via
// PhotoCardBody.
function PhotoBlockRow({
  projectId,
  block,
  imageUrl,
  editable,
  onChanged,
}: {
  projectId: string;
  block: BlockRow;
  imageUrl?: string;
  editable: boolean;
  onChanged: () => void;
}) {
  const file = block.file;
  if (!file) return null;

  return (
    <div className="group flex items-start">
      {/* The card itself is the drag source. select-none matters here —
          without it, a mousedown that lands on the caption text starts a
          native text-selection gesture instead of (or racing) the drag,
          which cancels it in Chrome and Safari. Nested buttons (Rename/
          Move/Delete/View) stay clickable: a plain click never starts an
          HTML5 drag, only a click-and-move gesture. */}
      <div
        className="w-full max-w-xs flex-1"
      >
        <PhotoCardBody
          projectId={projectId}
          file={file}
          imageUrl={imageUrl}
          caption={block.content}
          blockId={block.id}
          editable={editable}
          onChanged={onChanged}
        />
      </div>
    </div>
  );
}

// Shared by PhotoBlockRow (standalone) and PhotoGridItem (inside a photo
// grid) — the image preview, hover actions, and caption row are identical;
// only the outer wrapper (grip placement, sizing) differs between the two.
function PhotoCardBody({
  projectId,
  file,
  imageUrl,
  caption,
  blockId,
  editable,
  onChanged,
}: {
  projectId: string;
  file: FileRow;
  imageUrl?: string;
  caption: string | null;
  blockId: string;
  editable: boolean;
  onChanged: () => void;
}) {
  return (
    <>
      <div className="group/photo relative">
        <FileOpenButton
          fileId={file.id}
          className="flex w-full flex-col overflow-hidden rounded-md border border-stone-200 bg-white p-1.5 text-left shadow-sm transition-shadow hover:shadow-md disabled:opacity-60"
        >
          <div className="relative aspect-square w-full overflow-hidden rounded-sm bg-stone-50">
            {imageUrl && (
              // The payload that actually hurt: a tab of ten 4MB phone photos
              // used to ship ~40MB to draw ten small squares. next/image has
              // the server fetch the original and hand the browser a resized
              // WebP instead. Still lazy by default, so photos below the fold
              // cost nothing until scrolled to.
              <Image
                src={imageUrl}
                alt={file.name}
                fill
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 100vw"
                draggable={false}
                className="pointer-events-none select-none object-cover transition-transform duration-300 group-hover/photo:scale-105"
              />
            )}
          </div>
        </FileOpenButton>
        {editable && (
          <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity max-md:opacity-100 group-hover/photo:opacity-100">
            <div className="rounded-md bg-white/90 shadow-sm backdrop-blur-sm">
              <RenameDialog kind="file" itemId={file.id} projectId={projectId} currentName={file.name} onSuccess={onChanged} />
            </div>
            <div className="rounded-md bg-white/90 shadow-sm backdrop-blur-sm">
              <MoveDialog kind="file" itemId={file.id} projectId={projectId} itemName={file.name} onSuccess={onChanged} />
            </div>
            <div className="rounded-md bg-white/90 shadow-sm backdrop-blur-sm">
              <DeleteItemDialog kind="file" itemId={file.id} projectId={projectId} itemName={file.name} onSuccess={onChanged} />
            </div>
          </div>
        )}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 px-0.5">
        <p className="min-w-0 flex-1 truncate text-xs italic text-stone-500">
          {caption || <span className="text-stone-300">No caption</span>}
        </p>
        {editable && (
          <BlockFormDialog
            projectId={projectId}
            mode="edit"
            kind="caption"
            blockId={blockId}
            initialContent={caption ?? ""}
            dialogTitle="Edit caption"
            placeholder="Add a caption"
            submitLabel="Save"
            triggerLabel={caption ? "Edit" : "+ Caption"}
            triggerClassName="shrink-0 text-xs font-medium text-stone-400 transition-colors hover:text-stone-700"
            onSuccess={onChanged}
          />
        )}
      </div>
    </>
  );
}

// A run of 2+ consecutive Photo blocks — flows side-by-side as a gallery
// grid instead of one-per-row. The whole run moves as a single unit via the
// stream's Up/Down controls; there's no reordering *within* a run, which is
// the one capability the drag removal gave up.
function PhotoGrid({
  projectId,
  blocks,
  imageUrls,
  editable,
  onChanged,
}: {
  projectId: string;
  blocks: BlockRow[];
  imageUrls: Record<string, string>;
  editable: boolean;
  onChanged: () => void;
}) {
  return (
    // One column below sm so a photo reads as a photo rather than a
    // thumbnail; sm/lg are untouched, so nothing changes on desktop.
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {blocks.map((block) => (
        <PhotoGridItem
          key={block.id}
          projectId={projectId}
          block={block}
          imageUrl={block.file ? imageUrls[block.file.storage_key] : undefined}
          editable={editable}
          onChanged={onChanged}
        />
      ))}
    </div>
  );
}

function PhotoGridItem({
  projectId,
  block,
  imageUrl,
  editable,
  onChanged,
}: {
  projectId: string;
  block: BlockRow;
  imageUrl?: string;
  editable: boolean;
  onChanged: () => void;
}) {
  const file = block.file;
  if (!file) return null;

  return (
    <div className="group/griditem relative">
      <PhotoCardBody
        projectId={projectId}
        file={file}
        imageUrl={imageUrl}
        caption={block.content}
        blockId={block.id}
        editable={editable}
        onChanged={onChanged}
      />
    </div>
  );
}

function VideoBlockRow({
  projectId,
  block,
  previewUrl,
  editable,
  onChanged,
}: {
  projectId: string;
  block: BlockRow;
  previewUrl?: string;
  editable: boolean;
  onChanged: () => void;
}) {
  const file = block.file;
  if (!file) return null;

  return (
    <div className="group flex items-start">
      <div
        className="group/video relative w-full max-w-xs flex-1"
      >
        <FileOpenButton
          fileId={file.id}
          className="flex w-full flex-col overflow-hidden rounded-lg border border-stone-200 bg-white text-left shadow-sm transition-shadow hover:shadow-md disabled:opacity-60"
        >
          <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden bg-stone-100">
            {previewUrl ? (
              // #t=0.1 asks the browser to seek just past the start, so the
              // element paints a real frame instead of a black rectangle —
              // no JS, and it works where the `poster` attribute can't
              // because we have no separately generated thumbnail.
              // preload="metadata" keeps this to a few KB of header, not the
              // whole clip. pointer-events-none so a tap still reaches the
              // FileOpenButton wrapping this.
              <video
                src={`${previewUrl}#t=0.1`}
                preload="metadata"
                muted
                playsInline
                className="pointer-events-none h-full w-full object-cover"
              />
            ) : (
              <PlayIcon className="h-9 w-9 text-stone-400" />
            )}
            {/* Kept over the frame so a still frame still reads as a video. */}
            {previewUrl && (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-900/45 backdrop-blur-sm">
                  <PlayIcon className="h-5 w-5 text-white" />
                </span>
              </span>
            )}
            <span className="absolute left-2 top-2 rounded bg-stone-900/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              Video
            </span>
          </div>
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium text-stone-900">{file.name}</p>
            <p className="text-xs text-stone-400">{formatBytes(file.size_bytes)}</p>
          </div>
        </FileOpenButton>
        {editable && (
          <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity max-md:opacity-100 group-hover/video:opacity-100">
            <div className="rounded-md bg-white/90 shadow-sm backdrop-blur-sm">
              <RenameDialog kind="file" itemId={file.id} projectId={projectId} currentName={file.name} onSuccess={onChanged} />
            </div>
            <div className="rounded-md bg-white/90 shadow-sm backdrop-blur-sm">
              <MoveDialog kind="file" itemId={file.id} projectId={projectId} itemName={file.name} onSuccess={onChanged} />
            </div>
            <div className="rounded-md bg-white/90 shadow-sm backdrop-blur-sm">
              <DeleteItemDialog kind="file" itemId={file.id} projectId={projectId} itemName={file.name} onSuccess={onChanged} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// A document reads as a card on the page — paper preview, format badge, and
// a filename/size footer — matching the Photo and Video cards rather than a
// horizontal list strip. The open affordance is a div with role="button"
// rather than a native <button>: WebKit/Chromium intercept mousedown on
// native buttons for their own press-state handling, which can swallow the
// event before an HTML5 drag ever starts (the same reason the old grip
// handles were divs). A plain click never begins a drag, so click-to-open
// and drag-to-reorder coexist on the same surface.
function DocumentBlockRow({
  projectId,
  block,
  previewUrl,
  editable,
  onChanged,
}: {
  projectId: string;
  block: BlockRow;
  previewUrl?: string;
  editable: boolean;
  onChanged: () => void;
}) {
  const file = block.file;
  const [opening, setOpening] = useState(false);
  if (!file) return null;

  // Only PDFs get a real preview. Everything else — Word, Excel, ZIP —
  // would need an external conversion service, so they keep the badge.
  const showPdfPreview = !!previewUrl && isPdfFile(file.mime_type, file.name);

  async function handleOpen() {
    if (opening) return;
    setOpening(true);
    const { url } = await getFileDownloadUrl(file!.id);
    setOpening(false);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="group/file relative flex items-start">
      {/* `relative` here, not only on the wrapper — the hover actions below
          are absolutely positioned and must anchor to this max-w-xs card,
          not to the full-width row around it. */}
      <div
        className="relative w-full max-w-xs flex-1 rounded-lg border border-stone-200 bg-white shadow-sm transition-all hover:shadow-md"
      >
        <div
          role="button"
          tabIndex={0}
          onClick={handleOpen}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleOpen();
            }
          }}
          className="relative flex aspect-[4/3] w-full flex-col items-center justify-center overflow-hidden rounded-t-lg bg-stone-50/80 transition-colors hover:bg-stone-100/60"
        >
          <span className="absolute left-2.5 top-2.5 rounded bg-stone-900/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
            {getFormatLabel(file.mime_type, file.name)}
          </span>

          {showPdfPreview ? (
            // The page itself, bled to the card's top edge — a plan or
            // moodboard is recognisable at a glance, which an icon never is.
            // object-top because the useful part of a document page is its
            // head, not its middle.
            <div className="absolute inset-0 overflow-hidden bg-white">
              <PdfThumbnail url={previewUrl!} width={PDF_THUMBNAIL_WIDTH} />
            </div>
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-stone-200/60">
              <DocumentIcon className="h-8 w-8 text-stone-500" />
            </div>
          )}

          {/* With a page rendered behind it, "Click to view" would sit on
              top of the document. The badge above already marks the card as
              a file, so the hint only earns its place on the icon fallback —
              except while opening, which always needs feedback. */}
          {(!showPdfPreview || opening) && (
            <span
              className={`text-[11px] font-medium ${
                showPdfPreview
                  ? "absolute inset-x-0 bottom-0 bg-white/85 py-1 text-center text-stone-500 backdrop-blur-sm"
                  : "mt-3 text-stone-400"
              }`}
            >
              {opening ? "Opening…" : "Click to view"}
            </span>
          )}
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={handleOpen}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleOpen();
            }
          }}
          className="border-t border-stone-100 px-3 py-2.5 text-left"
        >
          <p className="truncate text-sm font-medium text-stone-900" title={file.name}>
            {file.name}
          </p>
          <p className="mt-0.5 text-xs text-stone-400">{formatBytes(file.size_bytes)}</p>
        </div>

        {editable && (
          <div
            draggable={false}
            onClick={(e) => e.stopPropagation()}
            className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity max-md:opacity-100 group-hover/file:opacity-100"
          >
            <div className="rounded-md bg-white/90 shadow-sm backdrop-blur-sm">
              <RenameDialog kind="file" itemId={file.id} projectId={projectId} currentName={file.name} onSuccess={onChanged} />
            </div>
            <div className="rounded-md bg-white/90 shadow-sm backdrop-blur-sm">
              <MoveDialog kind="file" itemId={file.id} projectId={projectId} itemName={file.name} onSuccess={onChanged} />
            </div>
            <div className="rounded-md bg-white/90 shadow-sm backdrop-blur-sm">
              <DeleteItemDialog kind="file" itemId={file.id} projectId={projectId} itemName={file.name} onSuccess={onChanged} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Fetches a signed URL on demand (not eagerly) and opens it in a new tab.
export function FileOpenButton({
  fileId,
  className,
  children,
}: {
  fileId: string;
  className?: string;
  children: ReactNode;
}) {
  const [opening, setOpening] = useState(false);

  async function open() {
    setOpening(true);
    const { url } = await getFileDownloadUrl(fileId);
    setOpening(false);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <button type="button" onClick={open} disabled={opening} className={className}>
      {children}
    </button>
  );
}
