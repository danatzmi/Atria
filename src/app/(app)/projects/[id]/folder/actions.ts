"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createSignedUrl,
  createSignedUrls,
  PROJECT_FILES_BUCKET,
} from "@/lib/supabase/storage";
import { classifyMimeType, isPdfFile } from "@/lib/files";
import { docJSONIsEmpty, tryParseDocJSON } from "@/lib/doc-content";
import {
  getFolderContents,
  getFolderDescendantIds,
  getSectionBlocks,
  getSubtabItemCounts,
  getTabItemCounts,
  searchSubtree,
  type SubtreeSearchResult,
} from "./data";
import type { BlockFontFamily, BlockFontSize, BlockRow, BlockType, FolderRow } from "./data";

export type FolderActionState = { error: string | null; id?: string };

// Shape of a PostgREST/Supabase error — declared locally rather than
// importing PostgrestError so this also accepts the narrower error objects
// the storage client returns.
type DbError = {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
};

// Surfaces the database's own message rather than a generic sentence.
//
// This trades a little polish for diagnosability, on purpose: wording like
// "Could not find the 'font_family' column of 'blocks' in the schema cache"
// or "new row violates row-level security policy" names the actual fault in
// a misconfigured database, where "Please try again" sends everyone
// guessing. The code (PGRST204, 42501, 23503…) is included because it's the
// fastest thing to search for.
//
// Also logged server-side, so the detail lands in the deployment logs even
// when nobody screenshots the toast. If these ever feel too raw for normal
// users, this is the single place to soften them again.
function dbError(action: string, error: DbError): { error: string } {
  console.error(`[atria] ${action} failed:`, {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
  });
  return { error: error.code ? `${error.message} (${error.code})` : error.message };
}

// Everything now lives on the project page (the binder workspace fetches
// its own content client-side via RPC calls like getTabContents below) —
// this just keeps the server-rendered tab strip fresh on a hard navigation.
function revalidateProjectFiles(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
}

// Folders (Tabs/Sub-tabs) are manually ordered the same way blocks are —
// every new one appends after the current highest sort_order among its
// siblings, so it lands at the bottom.
async function nextFolderSortOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  parentFolderId: string | null
): Promise<number> {
  let query = supabase
    .from("folders")
    .select("sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: false })
    .limit(1);
  query = parentFolderId
    ? query.eq("parent_folder_id", parentFolderId)
    : query.is("parent_folder_id", null);

  const { data } = await query;
  return (data?.[0]?.sort_order ?? -1) + 1;
}

export async function createFolder(
  _prevState: FolderActionState,
  formData: FormData
): Promise<FolderActionState> {
  const projectId = String(formData.get("project_id") ?? "");
  const parentFolderId = formData.get("parent_folder_id");
  const name = String(formData.get("name") ?? "").trim();

  if (!name) return { error: "Give the tab a name." };

  const resolvedParentId = parentFolderId ? String(parentFolderId) : null;
  const supabase = await createClient();
  // Explicit position from a specific stream gap (unified with blocks in
  // one ordered notebook — see browser.tsx's BlockGap) — omitted means
  // append to the end, same as before.
  const explicitSortOrderRaw = formData.get("sort_order");
  const sortOrder =
    explicitSortOrderRaw !== null && explicitSortOrderRaw !== ""
      ? Number(explicitSortOrderRaw)
      : await nextFolderSortOrder(supabase, projectId, resolvedParentId);

  const { data, error } = await supabase
    .from("folders")
    .insert({
      project_id: projectId,
      parent_folder_id: resolvedParentId,
      name,
      sort_order: sortOrder,
    })
    .select("id")
    .single();

  if (error) return dbError("createFolder", error);

  revalidateProjectFiles(projectId);
  return { error: null, id: data.id };
}

// Drag-and-drop reorder for Tabs/Sub-tabs — the client computes the target
// sort_order from the drop target's neighbors (fractional midpoint, see
// src/lib/sort-order.ts) and this just writes it.
export async function moveFolderToPosition(
  folderId: string,
  projectId: string,
  sortOrder: number
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("folders")
    .update({ sort_order: sortOrder })
    .eq("id", folderId);

  if (error) return dbError("reorder", error);
  revalidateProjectFiles(projectId);
  return { error: null };
}

export async function renameFolder(
  _prevState: FolderActionState,
  formData: FormData
): Promise<FolderActionState> {
  const folderId = String(formData.get("folder_id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!name) return { error: "Give the tab a name." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("folders")
    .update({ name })
    .eq("id", folderId);

  if (error) return dbError("renameFolder", error);

  revalidateProjectFiles(projectId);
  return { error: null };
}

export async function moveFolder(
  _prevState: FolderActionState,
  formData: FormData
): Promise<FolderActionState> {
  const folderId = String(formData.get("folder_id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  const targetFolderId = formData.get("target_folder_id");
  const destination = targetFolderId ? String(targetFolderId) : null;

  if (destination === folderId) {
    return { error: "Can't move a tab into itself." };
  }

  const supabase = await createClient();

  if (destination) {
    const descendantIds = await getFolderDescendantIds(supabase, folderId);
    if (descendantIds.has(destination)) {
      return { error: "Can't move a tab into one of its own sub-tabs." };
    }
  }

  const { error } = await supabase
    .from("folders")
    .update({ parent_folder_id: destination })
    .eq("id", folderId);

  if (error) return dbError("moveFolder", error);

  revalidateProjectFiles(projectId);
  return { error: null };
}

// Drag-and-drop reorder AND reparent for the sidebar's Tab/Sub-tab tree —
// unlike moveFolder (form-action, parent only) and moveFolderToPosition
// (RPC, position only), a sidebar drop target always needs both written
// atomically: dropping into a different list changes parent_folder_id, and
// its position within that list needs an exact fractional sort_order from
// the two neighbors either side of the drop. Same cycle-prevention as
// moveFolder above (self-drop, drop-into-own-descendant).
export async function moveFolderToParent(
  folderId: string,
  projectId: string,
  newParentFolderId: string | null,
  sortOrder: number
): Promise<{ error: string | null }> {
  if (newParentFolderId === folderId) {
    return { error: "Can't move a tab into itself." };
  }

  const supabase = await createClient();

  if (newParentFolderId) {
    const descendantIds = await getFolderDescendantIds(supabase, folderId);
    if (descendantIds.has(newParentFolderId)) {
      return { error: "Can't move a tab into one of its own sub-tabs." };
    }
  }

  const { error } = await supabase
    .from("folders")
    .update({ parent_folder_id: newParentFolderId, sort_order: sortOrder })
    .eq("id", folderId);

  if (error) return dbError("moveFolder", error);

  revalidateProjectFiles(projectId);
  return { error: null };
}

export async function deleteFolder(
  _prevState: FolderActionState,
  formData: FormData
): Promise<FolderActionState> {
  const folderId = String(formData.get("folder_id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");

  const supabase = await createClient();

  const descendantIds = await getFolderDescendantIds(supabase, folderId);
  const folderIds = [folderId, ...descendantIds];

  const { data: files } = await supabase
    .from("files")
    .select("id, storage_key, thumbnail_key")
    .in("folder_id", folderIds);

  // files.folder_id is ON DELETE SET NULL (a DB-level safety net against
  // silently destroying files via some other path), not CASCADE — so
  // deleting the folder row alone would orphan its files to the project
  // root instead of removing them. Delete the file rows explicitly to match
  // what the confirmation dialog promises ("everything inside it").
  const fileIds = (files ?? []).map((f) => f.id);
  if (fileIds.length > 0) {
    await supabase.from("files").delete().in("id", fileIds);
  }

  const { error } = await supabase.from("folders").delete().eq("id", folderId);

  if (error) {
    return dbError("deleteFolder", error);
  }

  const keys = (files ?? []).flatMap((f) =>
    [f.storage_key, f.thumbnail_key].filter((k): k is string => !!k)
  );
  if (keys.length > 0) {
    await supabase.storage.from(PROJECT_FILES_BUCKET).remove(keys);
  }

  revalidateProjectFiles(projectId);
  return { error: null };
}

// Blocks are manually ordered (sort_order), so every insert appends after
// the current highest value in its section — shared by every block-creating
// action below.
async function nextSortOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  sectionId: string | null
): Promise<number> {
  let query = supabase
    .from("blocks")
    .select("sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: false })
    .limit(1);
  query = sectionId ? query.eq("section_id", sectionId) : query.is("section_id", null);

  const { data } = await query;
  return (data?.[0]?.sort_order ?? -1) + 1;
}

// Called directly from the client after a successful direct-to-storage
// upload — not a <form action>, just an RPC-style server function. Every
// uploaded file gets a matching block so it shows up in the section's
// stream; "note" (legacy text-file) mime types land as generic file blocks —
// inline text blocks are now created directly via createTextBlock instead.
export async function createFileRecord(input: {
  projectId: string;
  folderId: string | null;
  name: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  // Explicit position for a specific insert-bar gap or drop target; omitted
  // means append to the end of the section (nextSortOrder below).
  sortOrder?: number;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: file, error } = await supabase
    .from("files")
    .insert({
      project_id: input.projectId,
      folder_id: input.folderId,
      name: input.name,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
      storage_key: input.storageKey,
    })
    .select()
    .single();

  if (error) return dbError("createFileRecord (files insert)", error);
  // No error but no row back means RLS filtered the returned row — the
  // insert's USING clause passed but SELECT couldn't read it back.
  if (!file) {
    return {
      error:
        "File row was created but could not be read back — check the files SELECT policy.",
    };
  }

  const kind = classifyMimeType(input.mimeType);
  const blockType: BlockType = kind === "image" ? "image" : kind === "video" ? "video" : "file";
  const sortOrder =
    input.sortOrder ?? (await nextSortOrder(supabase, input.projectId, input.folderId));

  const { error: blockError } = await supabase.from("blocks").insert({
    project_id: input.projectId,
    section_id: input.folderId,
    type: blockType,
    file_id: file.id,
    sort_order: sortOrder,
  });

  if (blockError) {
    // A file with no block would be invisible in the stream — safer to roll
    // back than leave it orphaned. The client-side caller (UploadZone)
    // already purges the storage object whenever createFileRecord errors.
    await supabase.from("files").delete().eq("id", file.id);
    return dbError("createFileRecord (blocks insert)", blockError);
  }

  revalidateProjectFiles(input.projectId);
  return { error: null };
}

export async function renameFile(
  _prevState: FolderActionState,
  formData: FormData
): Promise<FolderActionState> {
  const fileId = String(formData.get("file_id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!name) return { error: "Give the file a name." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("files")
    .update({ name })
    .eq("id", fileId);

  if (error) return dbError("renameFile", error);

  revalidateProjectFiles(projectId);
  return { error: null };
}

export async function moveFile(
  _prevState: FolderActionState,
  formData: FormData
): Promise<FolderActionState> {
  const fileId = String(formData.get("file_id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  const targetFolderId = formData.get("target_folder_id");
  const destination = targetFolderId ? String(targetFolderId) : null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("files")
    .update({ folder_id: destination })
    .eq("id", fileId);

  if (error) return dbError("moveFile", error);

  // Move the file's block along with it, appended to the end of the
  // destination section's stream (its old position has no meaning there).
  const sortOrder = await nextSortOrder(supabase, projectId, destination);
  await supabase
    .from("blocks")
    .update({ section_id: destination, sort_order: sortOrder })
    .eq("file_id", fileId);

  revalidateProjectFiles(projectId);
  return { error: null };
}

export async function deleteFile(
  _prevState: FolderActionState,
  formData: FormData
): Promise<FolderActionState> {
  const fileId = String(formData.get("file_id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");

  const supabase = await createClient();

  const { data: file } = await supabase
    .from("files")
    .select("storage_key, thumbnail_key")
    .eq("id", fileId)
    .single();

  const { error } = await supabase.from("files").delete().eq("id", fileId);

  if (error) return dbError("deleteFile", error);

  const keys = [file?.storage_key, file?.thumbnail_key].filter(
    (k): k is string => !!k
  );
  if (keys.length > 0) {
    await supabase.storage.from(PROJECT_FILES_BUCKET).remove(keys);
  }

  revalidateProjectFiles(projectId);
  return { error: null };
}

export async function createTextBlock(
  projectId: string,
  sectionId: string | null,
  content: string,
  sortOrder?: number,
  typography?: { fontFamily: BlockFontFamily; fontSize: BlockFontSize }
): Promise<{ error: string | null }> {
  const text = content.trim();
  const doc = tryParseDocJSON(text);
  if (!text || (doc && docJSONIsEmpty(doc))) return { error: "Write something first." };

  const supabase = await createClient();
  const resolvedSortOrder = sortOrder ?? (await nextSortOrder(supabase, projectId, sectionId));
  const { error } = await supabase.from("blocks").insert({
    project_id: projectId,
    section_id: sectionId,
    type: "text",
    content: text,
    sort_order: resolvedSortOrder,
    font_family: typography?.fontFamily ?? null,
    font_size: typography?.fontSize ?? null,
  });

  if (error) return dbError("createTextBlock", error);
  revalidateProjectFiles(projectId);
  return { error: null };
}

// Shared by text-block bodies and photo captions — both are just a block's
// content column. typography is omitted entirely for captions (undefined,
// not null), leaving those columns untouched — only a real text block's
// font/size can be edited.
export async function updateBlockContent(
  blockId: string,
  projectId: string,
  content: string,
  typography?: { fontFamily: BlockFontFamily; fontSize: BlockFontSize }
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("blocks")
    .update({
      content,
      ...(typography && { font_family: typography.fontFamily, font_size: typography.fontSize }),
    })
    .eq("id", blockId);

  if (error) return dbError("updateBlock", error);
  revalidateProjectFiles(projectId);
  return { error: null };
}

// Drag-and-drop reorder within a section's stream: the client computes the
// target sort_order from the drop gap's two neighbors (fractional midpoint —
// the reason sort_order is a double precision column) and this just writes it.
export async function moveBlockToPosition(
  blockId: string,
  projectId: string,
  sortOrder: number
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("blocks")
    .update({ sort_order: sortOrder })
    .eq("id", blockId);

  if (error) return dbError("reorder", error);
  revalidateProjectFiles(projectId);
  return { error: null };
}

// Only for content-only blocks (heading/text) — file-backed blocks (Photo/
// Document/Video) are deleted via deleteFile above so storage gets purged;
// their block row then disappears on its own via file_id's ON DELETE CASCADE.
export async function deleteBlockRow(
  _prevState: FolderActionState,
  formData: FormData
): Promise<FolderActionState> {
  const blockId = String(formData.get("block_id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.from("blocks").delete().eq("id", blockId);

  if (error) return dbError("deleteBlock", error);
  revalidateProjectFiles(projectId);
  return { error: null };
}

// Fetched on demand (not eagerly) when a user opens a file — avoids signing
// every file in a folder up front.
export async function getFileDownloadUrl(
  fileId: string
): Promise<{ url: string | null }> {
  const supabase = await createClient();
  const { data: file } = await supabase
    .from("files")
    .select("storage_key")
    .eq("id", fileId)
    .single();

  if (!file) return { url: null };
  const url = await createSignedUrl(supabase, file.storage_key);
  return { url };
}

export async function listChildFolders(
  projectId: string,
  parentFolderId: string | null
): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  let query = supabase
    .from("folders")
    .select("id, name")
    .eq("project_id", projectId)
    .order("name");

  query = parentFolderId
    ? query.eq("parent_folder_id", parentFolderId)
    : query.is("parent_folder_id", null);

  const { data } = await query;
  return data ?? [];
}

// Called directly from the client (RPC-style, same pattern as
// listChildFolders above) whenever a tab or sub-tab is expanded — every
// FolderBrowser instance calls this for itself, recursively, so nested
// sub-tabs are just more instances of the same fetch. Not tied to page
// navigation, so expanding one doesn't fight the expand/collapse animation.
//
// folderId === null fetches the project root: its "folders" are the
// top-level tabs themselves (used to render/refresh the tab strip), and its
// "blocks" are root-level blocks with no section (the virtual "Unsorted" tab).
export async function getTabContents(
  projectId: string,
  folderId: string | null
): Promise<{
  folders: FolderRow[];
  blocks: BlockRow[];
  // Keyed by storage_key. Only holds entries for previewable files.
  previewUrls: Record<string, string>;
}> {
  const supabase = await createClient();
  const [{ folders }, blocks] = await Promise.all([
    getFolderContents(supabase, projectId, folderId),
    getSectionBlocks(supabase, projectId, folderId),
  ]);

  // Signed URLs for everything we can actually show: images, videos (a
  // paused first frame) and PDFs (first page on a canvas). Word docs, ZIPs
  // and the like still render as a type badge, so signing them would be
  // wasted work.
  const previewKeys = blocks
    .filter(
      (b) =>
        b.file &&
        (b.type === "image" ||
          b.type === "video" ||
          isPdfFile(b.file.mime_type, b.file.name))
    )
    .map((b) => b.file!.storage_key);
  const previewUrlMap = await createSignedUrls(supabase, previewKeys);

  return { folders, blocks, previewUrls: Object.fromEntries(previewUrlMap) };
}

// Item-count badge for each divider row, keyed by tab id.
export async function getTabCounts(
  projectId: string
): Promise<Record<string, number>> {
  const supabase = await createClient();
  return getTabItemCounts(supabase, projectId);
}

// How many SUB-TABS each tab has — what the sidebar uses to decide between
// an expand chevron and a plain dot, without expanding anything first.
export async function getSubtabCounts(
  projectId: string
): Promise<Record<string, number>> {
  const supabase = await createClient();
  return getSubtabItemCounts(supabase, projectId);
}

// RPC-style, same pattern as getTabContents/getTabCounts above — called by
// whichever FolderBrowser instance currently owns a non-empty search box,
// searching its entire subtree in one round trip rather than one query per
// nesting level.
export async function searchTabSubtree(
  projectId: string,
  folderId: string,
  query: string
): Promise<SubtreeSearchResult> {
  const supabase = await createClient();
  return searchSubtree(supabase, projectId, folderId, query);
}
