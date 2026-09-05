import type { SupabaseClient } from "@supabase/supabase-js";
import { createSignedUrls } from "@/lib/supabase/storage";
import { blockContentHasNoteCallout } from "@/lib/doc-content";

export type FolderRow = {
  id: string;
  name: string;
  parent_folder_id: string | null;
  sort_order: number;
  created_at: string;
};
export type FileRow = {
  id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  storage_key: string;
  thumbnail_key: string | null;
  folder_id: string | null;
  created_at: string;
};

export type BlockType = "text" | "image" | "file" | "video";
export type BlockFontFamily = "serif" | null;
export type BlockFontSize = "large" | null;
export type BlockRow = {
  id: string;
  type: BlockType;
  content: string | null;
  sort_order: number;
  file: FileRow | null;
  // Whole-block typography set via the text editor's Font/Size toolbar —
  // null means the default clean-sans, normal-size look. Only meaningful
  // for type: "text"; always null on image/file/video blocks.
  font_family: BlockFontFamily;
  font_size: BlockFontSize;
};

export async function getFolderContents(
  supabase: SupabaseClient,
  projectId: string,
  folderId: string | null
): Promise<{ folders: FolderRow[]; files: FileRow[] }> {
  let foldersQuery = supabase
    .from("folders")
    .select("id, name, parent_folder_id, sort_order, created_at")
    .eq("project_id", projectId)
    .order("sort_order");
  let filesQuery = supabase
    .from("files")
    .select(
      "id, name, mime_type, size_bytes, storage_key, thumbnail_key, folder_id, created_at"
    )
    .eq("project_id", projectId)
    .order("name");

  foldersQuery = folderId
    ? foldersQuery.eq("parent_folder_id", folderId)
    : foldersQuery.is("parent_folder_id", null);
  filesQuery = folderId
    ? filesQuery.eq("folder_id", folderId)
    : filesQuery.is("folder_id", null);

  const [{ data: folders }, { data: files }] = await Promise.all([
    foldersQuery,
    filesQuery,
  ]);

  return { folders: folders ?? [], files: files ?? [] };
}

// Direct-children item count (folders + blocks) for every top-level folder
// (tab) in the project, keyed by tab id — backs each divider row's count
// badge. Counts direct children only, matching how the rest of the browser
// never aggregates recursively.
export async function getTabItemCounts(
  supabase: SupabaseClient,
  projectId: string
): Promise<Record<string, number>> {
  const [{ data: folders }, { data: blocks }] = await Promise.all([
    supabase
      .from("folders")
      .select("parent_folder_id")
      .eq("project_id", projectId)
      .not("parent_folder_id", "is", null),
    supabase
      .from("blocks")
      .select("section_id")
      .eq("project_id", projectId)
      .not("section_id", "is", null),
  ]);

  const counts: Record<string, number> = {};
  for (const f of folders ?? []) {
    if (f.parent_folder_id) {
      counts[f.parent_folder_id] = (counts[f.parent_folder_id] ?? 0) + 1;
    }
  }
  for (const b of blocks ?? []) {
    if (b.section_id) {
      counts[b.section_id] = (counts[b.section_id] ?? 0) + 1;
    }
  }
  return counts;
}

// A section's ordered block stream. Joins each block to its underlying file
// (image/file/video blocks only — heading/text blocks carry their content
// inline and have no file_id).
export async function getSectionBlocks(
  supabase: SupabaseClient,
  projectId: string,
  sectionId: string | null
): Promise<BlockRow[]> {
  let query = supabase
    .from("blocks")
    .select(
      "id, type, content, sort_order, font_family, font_size, file:files(id, name, mime_type, size_bytes, storage_key, thumbnail_key, folder_id, created_at)"
    )
    .eq("project_id", projectId)
    .order("sort_order");

  query = sectionId ? query.eq("section_id", sectionId) : query.is("section_id", null);

  const { data } = await query;
  return (data ?? []) as unknown as BlockRow[];
}

// All descendant folder ids of folderId (not including folderId itself).
// Used to purge storage on delete and to reject move-into-own-descendant.
export async function getFolderDescendantIds(
  supabase: SupabaseClient,
  folderId: string
): Promise<Set<string>> {
  const descendants = new Set<string>();
  let frontier = [folderId];

  while (frontier.length > 0) {
    const { data: children } = await supabase
      .from("folders")
      .select("id")
      .in("parent_folder_id", frontier);

    const childIds = (children ?? []).map((f) => f.id);
    childIds.forEach((id) => descendants.add(id));
    frontier = childIds;
  }

  return descendants;
}

// Sub-tabs only, keyed by parent folder id — deliberately separate from
// getTabItemCounts above, which merges child folders AND blocks into one
// number. The sidebar needs to know whether a tab has any *sub-tabs* before
// it's ever expanded (chevron vs. dot), and a merged count can't answer
// that: a tab holding only photos would wrongly look expandable.
export async function getSubtabItemCounts(
  supabase: SupabaseClient,
  projectId: string
): Promise<Record<string, number>> {
  const { data: folders } = await supabase
    .from("folders")
    .select("parent_folder_id")
    .eq("project_id", projectId)
    .not("parent_folder_id", "is", null);

  const counts: Record<string, number> = {};
  for (const f of folders ?? []) {
    if (f.parent_folder_id) {
      counts[f.parent_folder_id] = (counts[f.parent_folder_id] ?? 0) + 1;
    }
  }
  return counts;
}

// Shared by the direct (non-recursive) client-side filter in browser.tsx and
// the recursive subtree search below — one substring-match definition so
// the two can't drift apart. Plain function, no client-only APIs, safe to
// call from a server action too.
export function blockMatchesQuery(block: BlockRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (block.content && block.content.toLowerCase().includes(q)) return true;
  if (block.file && block.file.name.toLowerCase().includes(q)) return true;
  return false;
}

export type SubtreeSearchResult = {
  // Folder ids (at any depth within the searched subtree) that should stay
  // in the filtered list — either the folder's own name matches, or one of
  // its descendants (a block or a nested sub-tab's name) does.
  visibleFolderIds: string[];
  // Folder ids (at any depth) that should auto-expand because a descendant
  // of theirs matches — a folder whose own name matches but has no further
  // nested match stays collapsed, same as today's plain name-filter.
  openFolderIds: string[];
  // Block ids (at any depth) whose content or filename matches.
  blockIds: string[];
};

// Recursive "search this tab" — walks the whole subtree under rootFolderId
// (not just direct children) in two flat queries, mirroring getExportTree's
// approach, then works out in memory which folders need to stay visible/
// force-open so a match anywhere inside a nested sub-tab is still reachable
// from the level where the user typed the query.
export async function searchSubtree(
  supabase: SupabaseClient,
  projectId: string,
  rootFolderId: string,
  query: string
): Promise<SubtreeSearchResult> {
  const q = query.trim().toLowerCase();
  if (!q) return { visibleFolderIds: [], openFolderIds: [], blockIds: [] };

  const descendantIds = Array.from(await getFolderDescendantIds(supabase, rootFolderId));
  const sectionIds = [rootFolderId, ...descendantIds];

  const [{ data: folders }, { data: blocks }] = await Promise.all([
    descendantIds.length > 0
      ? supabase
          .from("folders")
          .select("id, name, parent_folder_id")
          .in("id", descendantIds)
      : Promise.resolve({
          data: [] as { id: string; name: string; parent_folder_id: string | null }[],
        }),
    supabase
      .from("blocks")
      .select("id, content, section_id, file:files(name)")
      .eq("project_id", projectId)
      .in("section_id", sectionIds),
  ]);

  const folderList = folders ?? [];
  const blockList = (blocks ?? []) as unknown as {
    id: string;
    content: string | null;
    section_id: string | null;
    file: { name: string } | null;
  }[];

  const parentOf = new Map<string, string | null>();
  for (const f of folderList) parentOf.set(f.id, f.parent_folder_id);

  function ancestorsWithinSubtree(folderId: string): string[] {
    const chain: string[] = [];
    let current = parentOf.get(folderId) ?? null;
    while (current && current !== rootFolderId) {
      chain.push(current);
      current = parentOf.get(current) ?? null;
    }
    return chain;
  }

  const matchingBlocks = blockList.filter((b) => {
    if (b.content && b.content.toLowerCase().includes(q)) return true;
    if (b.file && b.file.name.toLowerCase().includes(q)) return true;
    return false;
  });
  const matchingFolderIds = folderList
    .filter((f) => f.name.toLowerCase().includes(q))
    .map((f) => f.id);

  const visibleFolderIds = new Set<string>(matchingFolderIds);
  const openFolderIds = new Set<string>();

  for (const block of matchingBlocks) {
    if (block.section_id && block.section_id !== rootFolderId) {
      visibleFolderIds.add(block.section_id);
      openFolderIds.add(block.section_id);
      for (const ancestor of ancestorsWithinSubtree(block.section_id)) {
        visibleFolderIds.add(ancestor);
        openFolderIds.add(ancestor);
      }
    }
  }
  for (const folderId of matchingFolderIds) {
    for (const ancestor of ancestorsWithinSubtree(folderId)) {
      visibleFolderIds.add(ancestor);
      openFolderIds.add(ancestor);
    }
  }

  return {
    visibleFolderIds: Array.from(visibleFolderIds),
    openFolderIds: Array.from(openFolderIds),
    blockIds: matchingBlocks.map((b) => b.id),
  };
}

// Used by the PDF export to keep internal Notes out of the exported
// document. Whole-block exclusion, not line-stripping: if a text block
// contains a Note callout anywhere in it, the entire block is dropped —
// never leaks partial note content into the export.
export function filterNoteBlocks(blocks: BlockRow[]): BlockRow[] {
  return blocks.filter((b) => {
    if (b.type !== "text" || !b.content) return true;
    return !blockContentHasNoteCallout(b.content);
  });
}

export type ExportNode = {
  id: string;
  name: string;
  blocks: BlockRow[];
  children: ExportNode[];
};

// The full project tree in one pass — two flat queries (not a recursive
// per-folder walk, which would be an N+1 problem for a deep binder), then
// grouped in memory by parent_folder_id / section_id. Used only by the PDF
// export, which — unlike the interactive UI's single-open-path accordion —
// needs the entire tree at once.
export async function getExportTree(
  supabase: SupabaseClient,
  projectId: string
): Promise<{
  tree: ExportNode[];
  unsortedBlocks: BlockRow[];
  imageUrls: Record<string, string>;
  // Signed URLs for document/video attachments, so the export's attachment
  // register can link straight to the file — separate from imageUrls since
  // those back inline <img> previews, not click-through links.
  fileUrls: Record<string, string>;
}> {
  const [{ data: folders }, { data: blocks }] = await Promise.all([
    supabase
      .from("folders")
      .select("id, name, parent_folder_id, sort_order")
      .eq("project_id", projectId)
      .order("sort_order"),
    supabase
      .from("blocks")
      .select(
        "id, type, content, sort_order, font_family, font_size, section_id, file:files(id, name, mime_type, size_bytes, storage_key, thumbnail_key, folder_id, created_at)"
      )
      .eq("project_id", projectId)
      .order("sort_order"),
  ]);

  const allBlocks = (blocks ?? []) as unknown as (BlockRow & { section_id: string | null })[];
  const imageKeys = allBlocks
    .filter((b) => b.type === "image" && b.file)
    .map((b) => b.file!.storage_key);
  const attachmentKeys = allBlocks
    .filter((b) => (b.type === "file" || b.type === "video") && b.file)
    .map((b) => b.file!.storage_key);
  const [imageUrls, fileUrls] = await Promise.all([
    createSignedUrls(supabase, imageKeys).then((m) => Object.fromEntries(m)),
    createSignedUrls(supabase, attachmentKeys).then((m) => Object.fromEntries(m)),
  ]);

  const blocksBySection = new Map<string | null, BlockRow[]>();
  for (const b of allBlocks) {
    const key = b.section_id;
    const existing = blocksBySection.get(key) ?? [];
    existing.push(b);
    blocksBySection.set(key, existing);
  }

  const childrenByParent = new Map<string | null, FolderRow[]>();
  for (const f of (folders ?? []) as FolderRow[]) {
    const key = f.parent_folder_id;
    const existing = childrenByParent.get(key) ?? [];
    existing.push(f);
    childrenByParent.set(key, existing);
  }

  function buildNode(folder: FolderRow): ExportNode {
    return {
      id: folder.id,
      name: folder.name,
      blocks: blocksBySection.get(folder.id) ?? [],
      children: (childrenByParent.get(folder.id) ?? []).map(buildNode),
    };
  }

  return {
    tree: (childrenByParent.get(null) ?? []).map(buildNode),
    unsortedBlocks: blocksBySection.get(null) ?? [],
    imageUrls,
    fileUrls,
  };
}
