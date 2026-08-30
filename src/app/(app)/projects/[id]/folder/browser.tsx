"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type DragEvent,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import {
  buildStorageKey,
  MAX_FILE_SIZE_BYTES,
  PROJECT_FILES_BUCKET,
} from "@/lib/supabase/storage";
import { formatBytes, getFormatLabel } from "@/lib/files";
import { renderBlockContent, tryParseDocJSON } from "@/lib/doc-content";
import { midpointSortOrder } from "@/lib/sort-order";
import { readDragPayload, setDragPayload, type DragPayload } from "@/lib/drag-payload";
import { blockMatchesQuery, type BlockRow, type FileRow, type FolderRow } from "./data";
import {
  createFileRecord,
  getFileDownloadUrl,
  getTabContents,
  getTabCounts,
  moveBlockToPosition,
  moveFolderToPosition,
  searchTabSubtree,
} from "./actions";
import { DocumentIcon, GripIcon, PlayIcon, UploadIcon } from "./item-icon";
import { RenameDialog } from "./rename-dialog";
import { MoveDialog } from "./move-dialog";
import { DeleteItemDialog } from "./delete-item-dialog";
import { FolderFormDialog } from "./folder-form-dialog";
import { BlockFormDialog } from "./block-form-dialog";
import { AnimatedPanel, DividerGripHandle, DividerRow } from "./divider-row";

// A sub-tab is fully interleaved with this level's own blocks in one
// ordered stream — both folders.sort_order and blocks.sort_order are the
// same fractional-index space (src/lib/sort-order.ts), so a dragged item
// slots in by comparing sort_order directly regardless of which table it
// came from. Consecutive image blocks (2+) still collapse into one photo
// grid; a sub-tab breaks a run of images the same way any other non-image
// block always did.
type StreamItem =
  | { kind: "folder"; folder: FolderRow }
  | { kind: "block"; block: BlockRow }
  | { kind: "images"; blocks: BlockRow[] };

function buildStream(folders: FolderRow[], blocks: BlockRow[]): StreamItem[] {
  const tagged: (
    | { sortOrder: number; folder: FolderRow; block?: undefined }
    | { sortOrder: number; block: BlockRow; folder?: undefined }
  )[] = [
    ...folders.map((folder) => ({ sortOrder: folder.sort_order, folder }) as const),
    ...blocks.map((block) => ({ sortOrder: block.sort_order, block }) as const),
  ].sort((a, b) => a.sortOrder - b.sortOrder);

  const items: StreamItem[] = [];
  let i = 0;
  while (i < tagged.length) {
    const entry = tagged[i];
    if (entry.folder) {
      items.push({ kind: "folder", folder: entry.folder });
      i++;
      continue;
    }
    if (entry.block.type === "image") {
      const run: BlockRow[] = [];
      while (i < tagged.length && tagged[i].block?.type === "image") {
        run.push(tagged[i].block!);
        i++;
      }
      items.push(run.length >= 2 ? { kind: "images", blocks: run } : { kind: "block", block: run[0] });
      continue;
    }
    items.push({ kind: "block", block: entry.block });
    i++;
  }
  return items;
}

function firstSortOrder(item: StreamItem): number {
  if (item.kind === "folder") return item.folder.sort_order;
  if (item.kind === "block") return item.block.sort_order;
  return item.blocks[0].sort_order;
}
function lastSortOrder(item: StreamItem): number {
  if (item.kind === "folder") return item.folder.sort_order;
  if (item.kind === "block") return item.block.sort_order;
  return item.blocks[item.blocks.length - 1].sort_order;
}
function streamKey(item: StreamItem): string {
  if (item.kind === "folder") return `folder-${item.folder.id}`;
  if (item.kind === "block") return item.block.id;
  return `images-${item.blocks[0].id}`;
}

// The result of a recursive "search this tab" — computed once, at whichever
// FolderBrowser instance currently owns a non-empty query, then threaded
// unchanged down through every nested instance via inheritedMatches so a
// match anywhere in the subtree stays visible without each level re-fetching.
type SearchMatches = {
  visibleFolderIds: Set<string>;
  openFolderIds: Set<string>;
  blockIds: Set<string>;
};

type UploadItem = {
  id: string;
  name: string;
  status: "uploading" | "done" | "error";
  error: string | null;
};

// The open notebook page for one Tab or Sub-tab: search, sub-tabs (rendered
// as nested vertical divider cards, expanding in place — sub-tabs are fully
// optional and recursive, so this component just renders another instance
// of itself for whichever child is open), and this level's own block
// stream — text and file blocks, freely interleaved in the user's own
// order — with a Jupyter-style hover insert-bar between blocks and
// drag-and-drop reordering via each block's grip handle.
//
// Self-fetching rather than receiving content as props: every level (the
// project root's Unsorted view, a top-level Tab, or any depth of Sub-tab)
// fetches its own {folders, blocks} via getTabContents, so recursion is
// just this component rendering itself again — no centralized multi-level
// cache needed.
export function FolderBrowser({
  projectId,
  userId,
  folderId,
  indexPath,
  onItemsChanged,
  inheritedMatches = null,
  editable,
}: {
  projectId: string;
  userId: string;
  // null only for the virtual "Unsorted" view (the project root's own
  // blocks, no real folder to hold sub-tabs) — every real Tab/Sub-tab has a
  // real id.
  folderId: string | null;
  // This level's own displayed index ("01", "01.1", "01.1.2", ...) — the
  // prefix used when numbering this level's children.
  indexPath: string;
  // Called after any mutation at this level, so the parent can refresh the
  // count badge it shows for this folder. Never needs to bubble further
  // than one level: counts are direct-children-only, so a change inside a
  // sub-tab never affects its grandparent's badge.
  onItemsChanged?: () => void;
  // Set by a parent that's currently searching (its own local query is
  // non-empty) and found this folder is on the path to a match — this
  // level then uses the SAME match set for its own filtering/force-open
  // instead of running its own search, and passes it on unchanged to its
  // own children. null everywhere outside an active ancestor search.
  inheritedMatches?: SearchMatches | null;
  // View Mode vs Edit Mode (project-page-level toggle, threaded straight
  // down): false hides every insert bar, drag handle, and edit/rename/
  // move/delete affordance at every level, leaving a clean read-only
  // presentation view. Everything stays fully readable/navigable either way.
  editable: boolean;
}) {
  const isUnsorted = folderId === null;

  const [data, setData] = useState<{
    folders: FolderRow[];
    blocks: BlockRow[];
    imageUrls: Record<string, string>;
  } | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [isLoading, startTransition] = useTransition();
  const [openChildIds, setOpenChildIds] = useState<Set<string>>(new Set());

  const [query, setQuery] = useState("");
  const [ownMatches, setOwnMatches] = useState<SearchMatches | null>(null);
  const [queue, setQueue] = useState<UploadItem[]>([]);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [draggingItem, setDraggingItem] = useState<DragPayload | null>(null);
  const [dragOverGap, setDragOverGap] = useState<number | null>(null);
  const [dragOverBlockId, setDragOverBlockId] = useState<string | null>(null);

  const fetchSelf = useCallback(() => {
    startTransition(async () => {
      const [result, countsResult] = await Promise.all([
        getTabContents(projectId, folderId),
        getTabCounts(projectId),
      ]);
      setData(result);
      setCounts(countsResult);
      // A deleted-or-renamed-away child shouldn't stay "open".
      setOpenChildIds((ids) => {
        const next = new Set([...ids].filter((id) => result.folders.some((f) => f.id === id)));
        return next.size === ids.size ? ids : next;
      });
    });
  }, [projectId, folderId]);

  useEffect(() => {
    fetchSelf();
  }, [fetchSelf]);

  function refresh() {
    fetchSelf();
    onItemsChanged?.();
  }

  function toggleChild(id: string) {
    setOpenChildIds((ids) => {
      const next = new Set(ids);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Unsorted has no sub-tab concept of its own — getTabContents(null)
  // returns the top-level Tabs as "folders" (used elsewhere to render/
  // refresh the tab strip), which would be nonsensical rendered here too.
  const folders = useMemo(
    () => (isUnsorted ? [] : (data?.folders ?? [])),
    [isUnsorted, data]
  );
  const blocks = useMemo(() => data?.blocks ?? [], [data]);
  const imageUrls = data?.imageUrls ?? {};

  const trimmedQuery = query.trim();
  // Unsorted can never hold sub-tabs, so its own search box only ever needs
  // a plain, instant, direct-children substring filter — no recursion, no
  // server round trip.
  const usingOwnSearch = trimmedQuery !== "" && !isUnsorted;
  const isFiltering = isUnsorted ? trimmedQuery !== "" : usingOwnSearch || inheritedMatches !== null;
  const activeMatches = usingOwnSearch ? ownMatches : inheritedMatches;
  const isSearchPending = usingOwnSearch && ownMatches === null;

  // Recursive subtree search — debounced, and only for the level currently
  // owning a non-empty local query (a level receiving inheritedMatches just
  // reuses that, no fetch of its own). Re-runs after any refetch of this
  // level's own content too, so a rename/delete made mid-search doesn't
  // leave stale match ids behind.
  useEffect(() => {
    if (!usingOwnSearch) return;
    let cancelled = false;
    const handle = setTimeout(() => {
      searchTabSubtree(projectId, folderId as string, trimmedQuery).then((result) => {
        if (cancelled) return;
        setOwnMatches({
          visibleFolderIds: new Set(result.visibleFolderIds),
          openFolderIds: new Set(result.openFolderIds),
          blockIds: new Set(result.blockIds),
        });
      });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [usingOwnSearch, trimmedQuery, projectId, folderId, data]);

  const visibleFolders = useMemo(() => {
    if (isUnsorted) return [];
    if (!isFiltering) return folders;
    if (!activeMatches) return [];
    return folders.filter((f) => activeMatches.visibleFolderIds.has(f.id));
  }, [isUnsorted, isFiltering, activeMatches, folders]);
  // blocks arrives pre-ordered by sort_order. The insert-bar and
  // drag-reorder both target real positions in that order, so they're only
  // offered with no filter active — where visibleBlocks and blocks are the
  // same list and gap math stays meaningful.
  const visibleBlocks = useMemo(() => {
    if (isUnsorted) return blocks.filter((b) => blockMatchesQuery(b, query));
    if (!isFiltering) return blocks;
    if (!activeMatches) return [];
    return blocks.filter((b) => activeMatches.blockIds.has(b.id));
  }, [isUnsorted, blocks, query, isFiltering, activeMatches]);
  const canReorder = editable && !isFiltering;
  const items = useMemo(() => buildStream(visibleFolders, visibleBlocks), [visibleFolders, visibleBlocks]);
  // "01.1", "01.2", ... count only sub-tabs in stream order — blocks don't
  // carry a number, so a sub-tab's dotted index is unaffected by which
  // blocks happen to sit before/after it.
  const folderIndex = useMemo(() => {
    const map = new Map<string, number>();
    let n = 0;
    for (const item of items) if (item.kind === "folder") map.set(item.folder.id, ++n);
    return map;
  }, [items]);

  const isEmpty = folders.length === 0 && blocks.length === 0;
  const hasResults = visibleFolders.length + visibleBlocks.length > 0;

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

  // The payload comes from the drop event's own dataTransfer (see
  // drag-payload.ts), never from `draggingItem` state — dragend can clear
  // that state before or during this handler, and it's only reliable on the
  // drag's source element anyway, not the drop target.
  async function handleDrop(payload: DragPayload, sortOrder: number) {
    setDraggingItem(null);
    if (payload.kind === "block") await moveBlockToPosition(payload.id, projectId, sortOrder);
    else await moveFolderToPosition(payload.id, projectId, sortOrder);
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
      <input
        type="search"
        value={query}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          // Clearing the box drops stale matches immediately rather than
          // waiting on the debounced effect, which only fires while a
          // query is actually non-empty.
          if (next.trim() === "") setOwnMatches(null);
        }}
        placeholder="Search this tab"
        className="block w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm shadow-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500 sm:max-w-xs"
      />

      {isSearchPending ? (
        <p className="py-12 text-center text-sm text-stone-400">Searching…</p>
      ) : !hasResults ? (
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
                {!isUnsorted && (
                  <FolderFormDialog
                    projectId={projectId}
                    parentFolderId={folderId}
                    triggerLabel="+ Sub-tab"
                    triggerClassName="flex items-center gap-1.5 rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
                    dialogTitle="New sub-tab"
                    namePlaceholder="Hardware"
                    submitLabel="Add sub-tab"
                    onSuccess={refresh}
                  />
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="py-12 text-center text-sm text-stone-400">
            No results for &ldquo;{query}&rdquo;.
          </p>
        )
      ) : (
        <div className="mt-6">
          {canReorder && items.length > 0 && (
            <BlockGap
              projectId={projectId}
              sectionId={folderId}
              allowSubtabs={!isUnsorted}
              before={undefined}
              after={firstSortOrder(items[0])}
              isDragging={draggingItem !== null}
              isDragOver={dragOverGap === 0}
              onDragOverGap={() => setDragOverGap(0)}
              onDragLeaveGap={() => setDragOverGap((g) => (g === 0 ? null : g))}
              onDrop={handleDrop}
              onUploadFiles={uploadFiles}
              onItemsChanged={refresh}
            />
          )}
          {/* Cards themselves are drag *sources* only (onDragStart/onDragEnd)
              — not also onDragOver drop targets. A card wrapper that listens
              for onDragOver fires it on itself in the first pixel of its own
              drag gesture (the pointer is still over the card it just
              started dragging), and the resulting setState/re-render can
              abort the native drag entirely in Chrome/Safari. Reordering
              lives entirely in the BlockGap/DividerDropZone strip between
              items instead — the same pattern the top-level tab list in
              binder-workspace.tsx already used, and the reason it never had
              this problem. */}
          {items.map((item, i) => (
            <Fragment key={streamKey(item)}>
              {item.kind === "folder" ? (
                (() => {
                  const folder = item.folder;
                  const isOpen =
                    openChildIds.has(folder.id) || (activeMatches?.openFolderIds.has(folder.id) ?? false);
                  return (
                    <div>
                      <DividerRow
                        index={`${indexPath}.${folderIndex.get(folder.id)}`}
                        name={folder.name}
                        count={counts[folder.id] ?? 0}
                        isOpen={isOpen}
                        onToggle={() => toggleChild(folder.id)}
                        grip={
                          canReorder ? (
                            <DividerGripHandle
                              onDragStart={(e) => {
                                setDragPayload(e, { kind: "folder", id: folder.id });
                                setDraggingItem({ kind: "folder", id: folder.id });
                              }}
                              onDragEnd={() => setDraggingItem(null)}
                            />
                          ) : undefined
                        }
                        actions={
                          editable ? (
                            <>
                              <RenameDialog
                                kind="folder"
                                itemId={folder.id}
                                projectId={projectId}
                                currentName={folder.name}
                                onSuccess={refresh}
                              />
                              <DeleteItemDialog
                                kind="folder"
                                itemId={folder.id}
                                projectId={projectId}
                                itemName={folder.name}
                                onSuccess={refresh}
                              />
                            </>
                          ) : undefined
                        }
                      />
                      <AnimatedPanel isOpen={isOpen}>
                        {isOpen && (
                          <FolderBrowser
                            projectId={projectId}
                            userId={userId}
                            folderId={folder.id}
                            indexPath={`${indexPath}.${folderIndex.get(folder.id)}`}
                            onItemsChanged={refresh}
                            inheritedMatches={activeMatches}
                            editable={editable}
                          />
                        )}
                      </AnimatedPanel>
                    </div>
                  );
                })()
              ) : item.kind === "block" ? (
                <BlockItem
                  projectId={projectId}
                  block={item.block}
                  imageUrl={item.block.file ? imageUrls[item.block.file.storage_key] : undefined}
                  draggable={canReorder}
                  editable={editable}
                  isDragging={draggingItem?.kind === "block" && draggingItem.id === item.block.id}
                  onDragStartBlock={() => setDraggingItem({ kind: "block", id: item.block.id })}
                  onDragEndBlock={() => setDraggingItem(null)}
                  onChanged={refresh}
                />
              ) : (
                <PhotoGrid
                  projectId={projectId}
                  blocks={item.blocks}
                  beforeSortOrder={i === 0 ? undefined : lastSortOrder(items[i - 1])}
                  imageUrls={imageUrls}
                  draggable={canReorder}
                  editable={editable}
                  draggingBlockId={draggingItem?.kind === "block" ? draggingItem.id : null}
                  dragOverBlockId={dragOverBlockId}
                  onDragStartBlock={(id) => setDraggingItem({ kind: "block", id })}
                  onDragEndBlock={() => setDraggingItem(null)}
                  onDragOverBlock={setDragOverBlockId}
                  onDragLeaveBlock={() => setDragOverBlockId(null)}
                  onDropBlock={handleDrop}
                  onChanged={refresh}
                />
              )}
              {canReorder && (
                <BlockGap
                  projectId={projectId}
                  sectionId={folderId}
                  allowSubtabs={!isUnsorted}
                  before={lastSortOrder(item)}
                  after={items[i + 1] ? firstSortOrder(items[i + 1]) : undefined}
                  isDragging={draggingItem !== null}
                  isDragOver={dragOverGap === i + 1}
                  onDragOverGap={() => setDragOverGap(i + 1)}
                  onDragLeaveGap={() => setDragOverGap((g) => (g === i + 1 ? null : g))}
                  onDrop={handleDrop}
                  onUploadFiles={uploadFiles}
                  onItemsChanged={refresh}
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

// The hover insert-bar between two blocks (and before the first / after the
// last, which doubles as "the bottom of the page"). Also a drop target: OS
// files land here as new File blocks at exactly this position, and a block
// being dragged by its grip handle reorders to here.
function BlockGap({
  projectId,
  sectionId,
  allowSubtabs,
  before,
  after,
  isDragging,
  isDragOver,
  onDragOverGap,
  onDragLeaveGap,
  onDrop,
  onUploadFiles,
  onItemsChanged,
}: {
  projectId: string;
  sectionId: string | null;
  // Sub-tabs can't be created under the virtual Unsorted view (no real
  // folder to hold them), so its gaps offer just Text/Upload File.
  allowSubtabs: boolean;
  // The stream neighbors' sort_order — a plain number rather than a
  // BlockRow, since a gap's neighbor may just as well be a sub-tab now.
  before?: number;
  after?: number;
  isDragging: boolean;
  isDragOver: boolean;
  onDragOverGap: () => void;
  onDragLeaveGap: () => void;
  onDrop: (payload: DragPayload, sortOrder: number) => void;
  onUploadFiles: (files: FileList, sortOrder: number) => void;
  onItemsChanged: () => void;
}) {
  const sortOrder = midpointSortOrder(before, after);

  return (
    <div
      // Generous vertical hitbox — a drop target only 4px tall (py-1) is
      // easy to overshoot; py-3 gives roughly 3x the catchable area without
      // visibly disrupting the stream's spacing normally. While a drag is
      // actually in progress, this is the *only* drop target in the stream
      // (cards themselves aren't — see FolderBrowser's comment on why), so
      // it grows further still to a fixed, generous h-6 to stay easy to hit.
      className={`group/gap relative flex items-center overflow-hidden rounded-md transition-all ${
        isDragging ? "h-6" : "py-3"
      } ${isDragOver ? "bg-stone-100" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onDragOverGap();
      }}
      onDragLeave={(e) => {
        // dragleave fires when the cursor crosses onto a CHILD element too
        // (the insert-bar buttons) — not just when it truly exits the gap —
        // so without this guard the indicator flickers off mid-hover.
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        onDragLeaveGap();
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDragLeaveGap();
        if (e.dataTransfer.files.length > 0) {
          onUploadFiles(e.dataTransfer.files, sortOrder);
          return;
        }
        const payload = readDragPayload(e);
        if (payload) onDrop(payload, sortOrder);
      }}
    >
      <div
        className={`absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-full transition-all ${
          isDragOver ? "h-1 bg-stone-500" : "h-0.5 bg-transparent group-hover/gap:bg-stone-200"
        }`}
      />
      {!isDragging && (
        <div className="relative mx-auto flex items-center gap-2 opacity-0 transition-opacity group-hover/gap:opacity-100">
          <BlockFormDialog
            projectId={projectId}
            sectionId={sectionId}
            sortOrder={sortOrder}
            mode="create"
            kind="text"
            dialogTitle="New text block"
            placeholder="Write anything worth remembering about this tab…"
            submitLabel="Add block"
            triggerLabel="+ Text"
            triggerClassName="rounded-full border border-stone-300 bg-white px-2.5 py-0.5 text-xs font-medium text-stone-500 shadow-sm transition-colors hover:bg-stone-50"
            onSuccess={onItemsChanged}
          />
          <GapUploadButton onUploadFiles={onUploadFiles} sortOrder={sortOrder} />
          {allowSubtabs && (
            <FolderFormDialog
              projectId={projectId}
              parentFolderId={sectionId}
              sortOrder={sortOrder}
              triggerLabel="+ Sub-tab"
              triggerClassName="rounded-full border border-stone-300 bg-white px-2.5 py-0.5 text-xs font-medium text-stone-500 shadow-sm transition-colors hover:bg-stone-50"
              dialogTitle="New sub-tab"
              namePlaceholder="Hardware"
              submitLabel="Add sub-tab"
              onSuccess={onItemsChanged}
            />
          )}
        </div>
      )}
    </div>
  );
}

function GapUploadButton({
  onUploadFiles,
  sortOrder,
}: {
  onUploadFiles: (files: FileList, sortOrder: number) => void;
  sortOrder: number;
}) {
  return (
    <button
      type="button"
      onClick={() => pickFiles((files) => onUploadFiles(files, sortOrder))}
      className="rounded-full border border-stone-300 bg-white px-2.5 py-0.5 text-xs font-medium text-stone-500 shadow-sm transition-colors hover:bg-stone-50"
    >
      + Upload File
    </button>
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

// Shared full-height grab handle for every stream row (text/photo/video/
// document blocks). A narrow icon-only target is easy to miss — this gives
// it real width and a persistent tinted background so it reads as
// "grabbable" even before the pointer is over it.
function GripHandle({
  draggable,
  onDragStart,
  onDragEnd,
}: {
  draggable: boolean;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
}) {
  if (!draggable) return <div className="w-8 shrink-0" />;
  return (
    // A <button> here would be correct semantically, but WebKit/Chromium
    // both intercept mousedown on native button/form elements for their
    // press-state handling, which can swallow the mousedown before the
    // browser ever starts the HTML5 drag gesture — a real (non-synthetic)
    // mouse drag on a <button draggable> is unreliable in practice. A div
    // with role="button" keeps the same a11y semantics without that
    // interception.
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      aria-label="Drag to reorder"
      title="Drag to reorder"
      className="flex w-8 shrink-0 cursor-grab select-none items-center justify-center self-stretch rounded-md bg-stone-100/50 text-stone-400 transition-colors hover:bg-stone-200/60 hover:text-stone-700 active:cursor-grabbing"
    >
      <GripIcon className="h-4 w-4" />
    </div>
  );
}

function BlockItem({
  projectId,
  block,
  imageUrl,
  draggable,
  editable,
  isDragging,
  onDragStartBlock,
  onDragEndBlock,
  onChanged,
}: {
  projectId: string;
  block: BlockRow;
  imageUrl?: string;
  draggable: boolean;
  editable: boolean;
  isDragging: boolean;
  onDragStartBlock: () => void;
  onDragEndBlock: () => void;
  onChanged: () => void;
}) {
  const handleDragStart = (e: DragEvent) => {
    setDragPayload(e, { kind: "block", id: block.id });
    onDragStartBlock();
  };

  const opacity = isDragging ? "opacity-40" : "";

  switch (block.type) {
    case "text":
      return (
        <TextBlockRow
          projectId={projectId}
          block={block}
          draggable={draggable}
          onDragStart={handleDragStart}
          onDragEnd={onDragEndBlock}
          className={opacity}
          editable={editable}
          onChanged={onChanged}
        />
      );
    case "image":
      return (
        <PhotoBlockRow
          projectId={projectId}
          block={block}
          imageUrl={imageUrl}
          draggable={draggable}
          onDragStart={handleDragStart}
          onDragEnd={onDragEndBlock}
          className={opacity}
          editable={editable}
          onChanged={onChanged}
        />
      );
    case "video":
      return (
        <VideoBlockRow
          projectId={projectId}
          block={block}
          draggable={draggable}
          onDragStart={handleDragStart}
          onDragEnd={onDragEndBlock}
          className={opacity}
          editable={editable}
          onChanged={onChanged}
        />
      );
    case "file":
      return (
        <DocumentBlockRow
          projectId={projectId}
          block={block}
          draggable={draggable}
          onDragStart={handleDragStart}
          onDragEnd={onDragEndBlock}
          className={opacity}
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
  draggable,
  onDragStart,
  onDragEnd,
  className,
  editable,
  onChanged,
}: {
  projectId: string;
  block: BlockRow;
  draggable: boolean;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
  className?: string;
  editable: boolean;
  onChanged: () => void;
}) {
  return (
    <div className={`group flex items-start gap-1 ${className ?? ""}`}>
      {/* Grip only, not a draggable card body — a text block's card is where
          the user selects and edits prose, so it stays a plain click/type
          target rather than also being a drag source. */}
      <GripHandle draggable={draggable} onDragStart={onDragStart} onDragEnd={onDragEnd} />
      <div className="relative flex-1 rounded-lg border border-stone-200 bg-amber-50/40 p-4 shadow-sm">
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
          <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <BlockFormDialog
              projectId={projectId}
              mode="edit"
              kind="text"
              blockId={block.id}
              initialContent={block.content ?? ""}
              dialogTitle="Edit text block"
              submitLabel="Save"
              triggerLabel="Edit"
              triggerClassName="rounded-md bg-white/90 px-2 py-1 text-xs font-medium text-stone-600 shadow-sm backdrop-blur-sm transition-colors hover:bg-white"
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
  draggable,
  onDragStart,
  onDragEnd,
  className,
  editable,
  onChanged,
}: {
  projectId: string;
  block: BlockRow;
  imageUrl?: string;
  draggable: boolean;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
  className?: string;
  editable: boolean;
  onChanged: () => void;
}) {
  const file = block.file;
  if (!file) return null;

  return (
    <div className={`group flex items-start gap-1 ${className ?? ""}`}>
      <GripHandle draggable={draggable} onDragStart={onDragStart} onDragEnd={onDragEnd} />
      {/* The card itself is also a drag source. select-none matters here —
          without it, a mousedown that lands on the caption text starts a
          native text-selection gesture instead of (or racing) the drag,
          which cancels it in Chrome and Safari. Nested buttons (Rename/
          Move/Delete/View) stay clickable: a plain click never starts an
          HTML5 drag, only a click-and-move gesture. */}
      <div
        className={`w-full max-w-xs flex-1 ${draggable ? "cursor-grab select-none active:cursor-grabbing" : ""}`}
        draggable={draggable}
        onDragStart={draggable ? onDragStart : undefined}
        onDragEnd={draggable ? onDragEnd : undefined}
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
          <div className="aspect-square w-full overflow-hidden rounded-sm bg-stone-50">
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt={file.name}
                loading="lazy"
                draggable={false}
                className="pointer-events-none h-full w-full select-none object-cover transition-transform duration-300 group-hover/photo:scale-105"
              />
            )}
          </div>
        </FileOpenButton>
        {editable && (
          <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover/photo:opacity-100">
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
// grid instead of one-per-row. Each card keeps its own grip (an overlay
// badge here, since there's no per-row column to put it in) and is itself a
// drop target: dropping onto a card inserts before it, using the same
// fractional sort_order math as the gaps around the grid — the only way to
// reorder within a grid, since a between-cell zone doesn't fit a CSS grid.
function PhotoGrid({
  projectId,
  blocks,
  beforeSortOrder,
  imageUrls,
  draggable,
  editable,
  draggingBlockId,
  dragOverBlockId,
  onDragStartBlock,
  onDragEndBlock,
  onDragOverBlock,
  onDragLeaveBlock,
  onDropBlock,
  onChanged,
}: {
  projectId: string;
  blocks: BlockRow[];
  // The stream's preceding neighbor's sort_order — a plain number, since
  // that neighbor may be a sub-tab, not another block.
  beforeSortOrder?: number;
  imageUrls: Record<string, string>;
  draggable: boolean;
  editable: boolean;
  draggingBlockId: string | null;
  dragOverBlockId: string | null;
  onDragStartBlock: (id: string) => void;
  onDragEndBlock: () => void;
  onDragOverBlock: (id: string) => void;
  onDragLeaveBlock: () => void;
  onDropBlock: (payload: DragPayload, sortOrder: number) => void;
  onChanged: () => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {blocks.map((block, i) => {
        const predecessorSortOrder = i === 0 ? beforeSortOrder : blocks[i - 1].sort_order;
        const sortOrder = midpointSortOrder(predecessorSortOrder, block.sort_order);
        return (
          <PhotoGridItem
            key={block.id}
            projectId={projectId}
            block={block}
            imageUrl={block.file ? imageUrls[block.file.storage_key] : undefined}
            draggable={draggable}
            editable={editable}
            isDragging={draggingBlockId === block.id}
            isDragOver={dragOverBlockId === block.id}
            onDragStartBlock={() => onDragStartBlock(block.id)}
            onDragEndBlock={onDragEndBlock}
            onDragOverBlock={() => onDragOverBlock(block.id)}
            onDragLeaveBlock={onDragLeaveBlock}
            onDropOnBlock={(payload) => onDropBlock(payload, sortOrder)}
            onChanged={onChanged}
          />
        );
      })}
    </div>
  );
}

function PhotoGridItem({
  projectId,
  block,
  imageUrl,
  draggable,
  editable,
  isDragging,
  isDragOver,
  onDragStartBlock,
  onDragEndBlock,
  onDragOverBlock,
  onDragLeaveBlock,
  onDropOnBlock,
  onChanged,
}: {
  projectId: string;
  block: BlockRow;
  imageUrl?: string;
  draggable: boolean;
  editable: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStartBlock: () => void;
  onDragEndBlock: () => void;
  onDragOverBlock: () => void;
  onDragLeaveBlock: () => void;
  onDropOnBlock: (payload: DragPayload) => void;
  onChanged: () => void;
}) {
  const file = block.file;
  if (!file) return null;

  const handleDragStart = (e: DragEvent) => {
    setDragPayload(e, { kind: "block", id: block.id });
    onDragStartBlock();
  };

  return (
    <div
      className={`group/griditem relative ${isDragging ? "opacity-40" : ""} ${
        isDragOver ? "rounded-md ring-2 ring-stone-400" : ""
      } ${draggable ? "cursor-grab select-none active:cursor-grabbing" : ""}`}
      // The whole tile is a drag source too, not just the overlay badge — a
      // small icon-only target on a photo grid is easy to miss.
      draggable={draggable}
      onDragStart={draggable ? handleDragStart : undefined}
      onDragEnd={draggable ? onDragEndBlock : undefined}
      onDragOver={(e) => {
        if (draggable) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          onDragOverBlock();
        }
      }}
      onDragLeave={(e) => {
        // dragleave fires when the cursor crosses onto a child element too
        // (the caption or edit buttons) — not just when it truly exits the
        // tile — so without this guard the ring flickers off mid-hover.
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        onDragLeaveBlock();
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDragLeaveBlock();
        const payload = readDragPayload(e);
        if (payload) onDropOnBlock(payload);
      }}
    >
      {draggable && (
        // A div, not a button — see BlockItem's grip comment: native
        // buttons can swallow the mousedown that starts a real drag in
        // WebKit/Chromium before dragstart ever fires. The tile itself is
        // now also draggable (above); this overlay badge stays as an
        // explicit, always-discoverable affordance on top of the image.
        <div
          role="button"
          tabIndex={0}
          draggable
          onDragStart={handleDragStart}
          onDragEnd={onDragEndBlock}
          aria-label="Drag to reorder"
          title="Drag to reorder"
          className="absolute left-1.5 top-1.5 z-10 flex h-7 w-7 cursor-grab select-none items-center justify-center rounded bg-white/90 text-stone-500 opacity-0 shadow-sm backdrop-blur-sm transition-opacity hover:text-stone-700 active:cursor-grabbing group-hover/griditem:opacity-100"
        >
          <GripIcon className="h-3.5 w-3.5" />
        </div>
      )}
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
  draggable,
  onDragStart,
  onDragEnd,
  className,
  editable,
  onChanged,
}: {
  projectId: string;
  block: BlockRow;
  draggable: boolean;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
  className?: string;
  editable: boolean;
  onChanged: () => void;
}) {
  const file = block.file;
  if (!file) return null;

  return (
    <div className={`group flex items-start gap-1 ${className ?? ""}`}>
      <GripHandle draggable={draggable} onDragStart={onDragStart} onDragEnd={onDragEnd} />
      <div
        className={`group/video relative w-full max-w-xs flex-1 ${draggable ? "cursor-grab select-none active:cursor-grabbing" : ""}`}
        draggable={draggable}
        onDragStart={draggable ? onDragStart : undefined}
        onDragEnd={draggable ? onDragEnd : undefined}
      >
        <FileOpenButton
          fileId={file.id}
          className="flex w-full flex-col overflow-hidden rounded-lg border border-stone-200 bg-white text-left shadow-sm transition-shadow hover:shadow-md disabled:opacity-60"
        >
          <div className="relative flex aspect-video w-full items-center justify-center bg-stone-100">
            <PlayIcon className="h-9 w-9 text-stone-400" />
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
          <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover/video:opacity-100">
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

// A horizontal attachment strip — format badge, name, size, an open action —
// reads as a stack of plans/specs rather than a grid of icons.
function DocumentBlockRow({
  projectId,
  block,
  draggable,
  onDragStart,
  onDragEnd,
  className,
  editable,
  onChanged,
}: {
  projectId: string;
  block: BlockRow;
  draggable: boolean;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
  className?: string;
  editable: boolean;
  onChanged: () => void;
}) {
  const file = block.file;
  if (!file) return null;

  return (
    <div className={`group flex items-center gap-1 ${className ?? ""}`}>
      <GripHandle draggable={draggable} onDragStart={onDragStart} onDragEnd={onDragEnd} />
      <div
        className={`flex flex-1 flex-wrap items-center gap-3 rounded-lg border border-stone-200 bg-white px-3 py-2.5 shadow-sm ${draggable ? "cursor-grab select-none active:cursor-grabbing" : ""}`}
        draggable={draggable}
        onDragStart={draggable ? onDragStart : undefined}
        onDragEnd={draggable ? onDragEnd : undefined}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-stone-100">
          <DocumentIcon className="h-4 w-4 text-stone-400" />
        </span>
        {/* Format badge and byte size are supplementary — hidden below sm so
            the row never has to squeeze the filename to near-nothing (or
            overflow) to fit them alongside the View/action buttons. */}
        <span className="hidden shrink-0 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-500 sm:inline-block">
          {getFormatLabel(file.mime_type, file.name)}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-stone-900">{file.name}</span>
        <span className="hidden shrink-0 text-xs text-stone-400 sm:inline">{formatBytes(file.size_bytes)}</span>
        <FileOpenButton
          fileId={file.id}
          className="shrink-0 rounded-md border border-stone-300 px-2.5 py-1 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50"
        >
          View
        </FileOpenButton>
        {editable && (
          <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <RenameDialog kind="file" itemId={file.id} projectId={projectId} currentName={file.name} onSuccess={onChanged} />
            <MoveDialog kind="file" itemId={file.id} projectId={projectId} itemName={file.name} onSuccess={onChanged} />
            <DeleteItemDialog kind="file" itemId={file.id} projectId={projectId} itemName={file.name} onSuccess={onChanged} />
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
