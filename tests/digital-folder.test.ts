// Verifies the Digital Folder & file-operations layer: nested folder
// hierarchy, the descendant-collection logic that backs cycle-prevention on
// move and storage cleanup on delete, cross-project move rejection (the
// existing Phase 1 trigger), and cross-user authorization for the new
// surface area (folders/files).
//
// Server actions in folder/actions.ts depend on Next's request-scoped
// `cookies()` context and can't be called directly from Vitest — as in
// project-crud.test.ts, these tests exercise the same Supabase operations
// the actions perform. The one exception is getFolderDescendantIds(), a
// plain (non-"use server") helper in folder/data.ts that IS imported and
// called directly, since it's the actual logic moveFolder/deleteFolder rely
// on for correctness.

import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { getFolderDescendantIds } from "../src/app/(app)/projects/[id]/folder/data";
import {
  buildStorageKey,
  PROJECT_FILES_BUCKET,
} from "../src/lib/supabase/storage";
import { createAdminClient, createTestUser, requireEnv, signInAs } from "./helpers";

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

async function createProject(client: SupabaseClient, name: string) {
  const { data, error } = await client
    .from("projects")
    .insert({ name })
    .select()
    .single();
  if (error || !data) throw error ?? new Error("failed to create project");
  return data;
}

async function createFolder(
  client: SupabaseClient,
  projectId: string,
  name: string,
  parentFolderId: string | null = null
) {
  const { data, error } = await client
    .from("folders")
    .insert({ project_id: projectId, parent_folder_id: parentFolderId, name })
    .select()
    .single();
  if (error || !data) throw error ?? new Error("failed to create folder");
  return data;
}

async function createFile(
  client: SupabaseClient,
  userId: string,
  projectId: string,
  folderId: string | null,
  name: string
) {
  const storageKey = buildStorageKey(userId, projectId, crypto.randomUUID(), name);
  await client.storage
    .from(PROJECT_FILES_BUCKET)
    .upload(storageKey, PNG_BYTES, { contentType: "image/png" });

  const { data, error } = await client
    .from("files")
    .insert({
      project_id: projectId,
      folder_id: folderId,
      name,
      mime_type: "image/png",
      size_bytes: PNG_BYTES.length,
      storage_key: storageKey,
    })
    .select()
    .single();
  if (error || !data) throw error ?? new Error("failed to create file");
  return data;
}

describe("digital folder & file operations", () => {
  let userA: { id: string; email: string; password: string };
  let userB: { id: string; email: string; password: string };
  let clientA: SupabaseClient;
  let clientB: SupabaseClient;

  beforeAll(async () => {
    requireEnv();
    const admin = createAdminClient();
    userA = await createTestUser(admin, "df-a");
    userB = await createTestUser(admin, "df-b");
    clientA = await signInAs(userA.email, userA.password);
    clientB = await signInAs(userB.email, userB.password);
  });

  it("creates root and nested folders, and rename persists", async () => {
    const project = await createProject(clientA, "Renovation");
    const root = await createFolder(clientA, project.id, "Contracts");
    const nested = await createFolder(clientA, project.id, "Signed", root.id);

    expect(nested.parent_folder_id).toBe(root.id);

    const { data: renamed, error } = await clientA
      .from("folders")
      .update({ name: "Fully Signed" })
      .eq("id", nested.id)
      .select()
      .single();
    expect(error).toBeNull();
    expect(renamed?.name).toBe("Fully Signed");
  });

  it("getFolderDescendantIds finds nested descendants, backing cycle prevention", async () => {
    const project = await createProject(clientA, "Wedding");
    const root = await createFolder(clientA, project.id, "Suppliers");
    const child = await createFolder(clientA, project.id, "Kitchen", root.id);
    const grandchild = await createFolder(clientA, project.id, "Quotes", child.id);
    const unrelated = await createFolder(clientA, project.id, "Inspiration");

    const descendants = await getFolderDescendantIds(clientA, root.id);

    expect(descendants.has(child.id)).toBe(true);
    expect(descendants.has(grandchild.id)).toBe(true);
    expect(descendants.has(unrelated.id)).toBe(false);

    // This is exactly the check moveFolder performs before allowing a move.
    const wouldBeInvalidMove = descendants.has(grandchild.id);
    expect(wouldBeInvalidMove).toBe(true);
  });

  it("creates, renames, and moves a file between folders", async () => {
    const project = await createProject(clientA, "Herzliya Villa");
    const folderA = await createFolder(clientA, project.id, "Floor Plans");
    const folderB = await createFolder(clientA, project.id, "Final");
    const file = await createFile(clientA, userA.id, project.id, folderA.id, "plan-v1.png");

    const { data: renamed } = await clientA
      .from("files")
      .update({ name: "plan-final.png" })
      .eq("id", file.id)
      .select()
      .single();
    expect(renamed?.name).toBe("plan-final.png");

    const { data: moved, error } = await clientA
      .from("files")
      .update({ folder_id: folderB.id })
      .eq("id", file.id)
      .select()
      .single();
    expect(error).toBeNull();
    expect(moved?.folder_id).toBe(folderB.id);
  });

  it("rejects moving a file into a folder from a different project", async () => {
    const projectA = await createProject(clientA, "Project A");
    const projectB = await createProject(clientA, "Project B");
    const folderInB = await createFolder(clientA, projectB.id, "Somewhere");
    const file = await createFile(clientA, userA.id, projectA.id, null, "doc.png");

    const { error } = await clientA
      .from("files")
      .update({ folder_id: folderInB.id })
      .eq("id", file.id);

    expect(error).not.toBeNull();
  });

  it("deleting a folder removes its nested files' DB rows and storage objects", async () => {
    const project = await createProject(clientA, "To Clean Up");
    const folder = await createFolder(clientA, project.id, "Old Contracts");
    const file = await createFile(clientA, userA.id, project.id, folder.id, "lease.png");

    // Mirrors deleteFolder(): files.folder_id is ON DELETE SET NULL, not
    // CASCADE, so the file rows must be deleted explicitly before removing
    // the folder — otherwise they'd be orphaned to the project root with
    // storage objects that are about to be purged out from under them.
    const { data: filesToClean } = await clientA
      .from("files")
      .select("id, storage_key")
      .in("folder_id", [folder.id]);
    await clientA
      .from("files")
      .delete()
      .in("id", (filesToClean ?? []).map((f) => f.id));
    await clientA.from("folders").delete().eq("id", folder.id);
    await clientA.storage
      .from(PROJECT_FILES_BUCKET)
      .remove((filesToClean ?? []).map((f) => f.storage_key));

    const { data: remainingFile } = await clientA
      .from("files")
      .select()
      .eq("id", file.id);
    expect(remainingFile).toEqual([]);

    const { data: listing } = await clientA.storage
      .from(PROJECT_FILES_BUCKET)
      .list(`${userA.id}/${project.id}`);
    const names = listing?.map((f) => f.name) ?? [];
    expect(names).not.toContain(file.storage_key.split("/").pop());
  });

  it("deleting a project removes every file's storage object, not just the cover image", async () => {
    const project = await createProject(clientA, "Full Cleanup Project");
    const file = await createFile(clientA, userA.id, project.id, null, "contract.png");

    const { data: filesToClean } = await clientA
      .from("files")
      .select("storage_key")
      .eq("project_id", project.id);
    await clientA.from("projects").delete().eq("id", project.id);
    await clientA.storage
      .from(PROJECT_FILES_BUCKET)
      .remove((filesToClean ?? []).map((f) => f.storage_key));

    const { data: listing } = await clientA.storage
      .from(PROJECT_FILES_BUCKET)
      .list(`${userA.id}/${project.id}`);
    const names = listing?.map((f) => f.name) ?? [];
    expect(names).not.toContain(file.storage_key.split("/").pop());
  });

  it("cannot rename, move, or delete another user's folder or file", async () => {
    const project = await createProject(clientA, "User A Private Project");
    const folder = await createFolder(clientA, project.id, "Private Folder");
    const file = await createFile(clientA, userA.id, project.id, folder.id, "private.png");

    const { data: renamedFolder, error: renameFolderError } = await clientB
      .from("folders")
      .update({ name: "Hijacked" })
      .eq("id", folder.id)
      .select();
    expect(renameFolderError).toBeNull();
    expect(renamedFolder).toEqual([]);

    const { data: deletedFolder, error: deleteFolderError } = await clientB
      .from("folders")
      .delete()
      .eq("id", folder.id)
      .select();
    expect(deleteFolderError).toBeNull();
    expect(deletedFolder).toEqual([]);

    const { data: renamedFile, error: renameFileError } = await clientB
      .from("files")
      .update({ name: "hijacked.png" })
      .eq("id", file.id)
      .select();
    expect(renameFileError).toBeNull();
    expect(renamedFile).toEqual([]);

    const { data: deletedFile, error: deleteFileError } = await clientB
      .from("files")
      .delete()
      .eq("id", file.id)
      .select();
    expect(deleteFileError).toBeNull();
    expect(deletedFile).toEqual([]);
  });

  it("a new tab's sort_order lands after its siblings' max, mirroring createFolder's append-to-bottom", async () => {
    const project = await createProject(clientA, "Ordered Tabs Project");
    const first = await createFolder(clientA, project.id, "Kitchen");

    // Mirrors nextFolderSortOrder(): max(sort_order) among siblings + 1.
    const { data: siblings } = await clientA
      .from("folders")
      .select("sort_order")
      .eq("project_id", project.id)
      .is("parent_folder_id", null)
      .order("sort_order", { ascending: false })
      .limit(1);
    const nextSortOrder = (siblings?.[0]?.sort_order ?? -1) + 1;

    const { data: second, error } = await clientA
      .from("folders")
      .insert({ project_id: project.id, parent_folder_id: null, name: "Living Room", sort_order: nextSortOrder })
      .select()
      .single();

    expect(error).toBeNull();
    expect(second?.sort_order).toBeGreaterThan(first.sort_order);
  });

  it("reorders tabs via a fractional-midpoint sort_order, mirroring moveFolderToPosition", async () => {
    const project = await createProject(clientA, "Reorder Tabs Project");
    // The shared createFolder() helper doesn't assign sort_order (folders
    // default to 0), so give these two real, distinct starting values —
    // otherwise "swapping" two equal values would be a no-op.
    const first = await createFolder(clientA, project.id, "Kitchen");
    const second = await createFolder(clientA, project.id, "Bathroom");
    await clientA.from("folders").update({ sort_order: 0 }).eq("id", first.id);
    await clientA.from("folders").update({ sort_order: 1 }).eq("id", second.id);

    // Drag "Bathroom" (currently sort_order 1) to before "Kitchen" (0) —
    // the exact fractional-midpoint math the tab grip-handle drop uses
    // client-side: since there's no predecessor, target = 0 - 1 = -1.
    await clientA.from("folders").update({ sort_order: -1 }).eq("id", second.id);

    const { data: ordered } = await clientA
      .from("folders")
      .select("name")
      .eq("project_id", project.id)
      .is("parent_folder_id", null)
      .order("sort_order");

    expect((ordered ?? []).map((f) => f.name)).toEqual(["Bathroom", "Kitchen"]);
  });
});
