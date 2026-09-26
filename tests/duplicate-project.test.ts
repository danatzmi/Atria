// duplicate_project_hierarchy (supabase/migrations/0010_duplicate_project.sql).
//
// The folder clone is the part worth guarding. It rewrites a self-
// referencing tree to fresh ids in ONE statement, and it only works because
// the rows are produced parents-first: `folders` carries a BEFORE INSERT
// trigger that looks the parent up in the table, so a child produced before
// its parent is rejected outright. The `ORDER BY depth` that guarantees
// this is easy to mistake for tidiness and delete — and if it goes, shallow
// trees keep working while deep ones break, which is the worst shape a
// regression can have. The nested-chain test below is specifically that.
//
// The function is SECURITY INVOKER, so RLS is the authorization: a project
// the caller cannot see simply is not found.
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { buildStorageKey } from "../src/lib/supabase/storage";
import { createAdminClient, createTestUser, requireEnv, signInAs } from "./helpers";

type FileMapEntry = { old_id: string; new_id: string; storage_key: string };

describe("duplicate_project_hierarchy", () => {
  let admin: SupabaseClient;
  let clientA: SupabaseClient;
  let clientB: SupabaseClient;
  let userA: { id: string };

  beforeAll(async () => {
    requireEnv();
    admin = createAdminClient();
    const a = await createTestUser(admin, "dup-a");
    const b = await createTestUser(admin, "dup-b");
    userA = a;
    clientA = await signInAs(a.email, a.password);
    clientB = await signInAs(b.email, b.password);
  });

  async function newProject(client: SupabaseClient, name: string) {
    const { data, error } = await client
      .from("projects")
      .insert({ name, description: "source description" })
      .select()
      .single();
    if (error || !data) throw error ?? new Error("failed to create project");
    return data;
  }

  async function newFolder(
    client: SupabaseClient,
    projectId: string,
    name: string,
    parentFolderId: string | null,
    sortOrder: number
  ) {
    const { data, error } = await client
      .from("folders")
      .insert({ project_id: projectId, name, parent_folder_id: parentFolderId, sort_order: sortOrder })
      .select()
      .single();
    if (error || !data) throw error ?? new Error("failed to create folder");
    return data;
  }

  async function newFile(
    client: SupabaseClient,
    projectId: string,
    folderId: string | null,
    name: string,
    sizeBytes = 100
  ) {
    const id = crypto.randomUUID();
    const { data, error } = await client
      .from("files")
      .insert({
        id,
        project_id: projectId,
        folder_id: folderId,
        name,
        mime_type: "image/png",
        size_bytes: sizeBytes,
        storage_key: buildStorageKey(userA.id, projectId, id, name),
      })
      .select()
      .single();
    if (error || !data) throw error ?? new Error("failed to create file");
    return data;
  }

  async function newBlock(
    client: SupabaseClient,
    projectId: string,
    sectionId: string | null,
    type: string,
    opts: { content?: string | null; fileId?: string | null; sortOrder?: number } = {}
  ) {
    const { data, error } = await client
      .from("blocks")
      .insert({
        project_id: projectId,
        section_id: sectionId,
        type,
        content: opts.content ?? null,
        file_id: opts.fileId ?? null,
        sort_order: opts.sortOrder ?? 100,
      })
      .select()
      .single();
    if (error || !data) throw error ?? new Error("failed to create block");
    return data;
  }

  // Mirrors what duplicateProject does in the action: mint the ids up front
  // so the storage keys can be built before any row exists.
  function buildFileMap(
    newProjectId: string,
    files: { id: string; name: string }[]
  ): FileMapEntry[] {
    return files.map((f) => {
      const newId = crypto.randomUUID();
      return {
        old_id: f.id,
        new_id: newId,
        storage_key: buildStorageKey(userA.id, newProjectId, newId, f.name),
      };
    });
  }

  async function duplicate(
    client: SupabaseClient,
    sourceId: string,
    includeContent: boolean,
    fileMap: FileMapEntry[] = []
  ) {
    const newProjectId = crypto.randomUUID();
    const { data, error } = await client.rpc("duplicate_project_hierarchy", {
      p_source_project_id: sourceId,
      p_new_project_id: newProjectId,
      p_new_name: "Copy",
      p_new_cover_image: null,
      p_include_content: includeContent,
      p_file_map: fileMap,
    });
    return { newProjectId, data, error };
  }

  // Folder paths ("L1/L2/L3"), so the assertion is about the SHAPE of the
  // tree rather than ids that are expected to differ.
  async function folderPaths(client: SupabaseClient, projectId: string) {
    const { data } = await client
      .from("folders")
      .select("id, name, parent_folder_id")
      .eq("project_id", projectId);
    const byId = new Map((data ?? []).map((f) => [f.id, f]));
    return (data ?? [])
      .map((f) => {
        const parts: string[] = [];
        let cur: typeof f | undefined = f;
        while (cur) {
          parts.unshift(cur.name);
          cur = cur.parent_folder_id ? byId.get(cur.parent_folder_id) : undefined;
        }
        return parts.join("/");
      })
      .sort();
  }

  it("clones a deeply nested tree, which is what ORDER BY depth protects", async () => {
    const source = await newProject(clientA, "Deep Source");
    const l1 = await newFolder(clientA, source.id, "L1", null, 100);
    const l2 = await newFolder(clientA, source.id, "L2", l1.id, 100);
    const l3 = await newFolder(clientA, source.id, "L3", l2.id, 100);
    const l4 = await newFolder(clientA, source.id, "L4", l3.id, 100);
    await newFolder(clientA, source.id, "L5", l4.id, 100);
    await newFolder(clientA, source.id, "Sibling", null, 200);

    const { newProjectId, error } = await duplicate(clientA, source.id, false);
    expect(error).toBeNull();

    expect(await folderPaths(clientA, newProjectId)).toEqual(
      await folderPaths(clientA, source.id)
    );
    expect(await folderPaths(clientA, newProjectId)).toEqual([
      "L1",
      "L1/L2",
      "L1/L2/L3",
      "L1/L2/L3/L4",
      "L1/L2/L3/L4/L5",
      "Sibling",
    ]);
  });

  it("gives every cloned folder a new id, sharing none with the source", async () => {
    const source = await newProject(clientA, "Id Source");
    const root = await newFolder(clientA, source.id, "Root", null, 100);
    await newFolder(clientA, source.id, "Child", root.id, 100);

    const { newProjectId } = await duplicate(clientA, source.id, false);
    const { data: srcIds } = await clientA.from("folders").select("id").eq("project_id", source.id);
    const { data: copyIds } = await clientA.from("folders").select("id").eq("project_id", newProjectId);

    const overlap = (copyIds ?? []).filter((c) => (srcIds ?? []).some((s) => s.id === c.id));
    expect(overlap).toEqual([]);
    expect(copyIds).toHaveLength(2);
  });

  it("a template copy takes the structure and leaves the contents", async () => {
    const source = await newProject(clientA, "Template Source");
    const tab = await newFolder(clientA, source.id, "Kitchen", null, 100);
    const file = await newFile(clientA, source.id, tab.id, "photo.png");
    await newBlock(clientA, source.id, tab.id, "image", { fileId: file.id });
    await newBlock(clientA, source.id, tab.id, "text", { content: "a note" });

    const { newProjectId, error } = await duplicate(clientA, source.id, false);
    expect(error).toBeNull();

    const { data: folders } = await clientA.from("folders").select("id").eq("project_id", newProjectId);
    const { count: files } = await clientA
      .from("files").select("id", { count: "exact", head: true }).eq("project_id", newProjectId);
    const { count: blocks } = await clientA
      .from("blocks").select("id", { count: "exact", head: true }).eq("project_id", newProjectId);

    expect(folders).toHaveLength(1);
    expect(files).toBe(0);
    expect(blocks).toBe(0);
  });

  it("a full copy remaps folder_id, section_id and file_id onto the new rows", async () => {
    const source = await newProject(clientA, "Full Source");
    const tab = await newFolder(clientA, source.id, "Kitchen", null, 100);
    const sub = await newFolder(clientA, source.id, "Cabinetry", tab.id, 100);
    const inSub = await newFile(clientA, source.id, sub.id, "deep.png", 4242);
    const atRoot = await newFile(clientA, source.id, null, "loose.png", 11);
    await newBlock(clientA, source.id, sub.id, "image", { fileId: inSub.id, sortOrder: 10 });
    await newBlock(clientA, source.id, null, "text", { content: "unsorted note", sortOrder: 20 });

    // The ids are minted before the call, exactly as duplicateProject does,
    // because storage_key embeds both the new project id and the new file id.
    const newProjectId = crypto.randomUUID();
    const realMap = buildFileMap(newProjectId, [inSub, atRoot]);

    const { error } = await clientA.rpc("duplicate_project_hierarchy", {
      p_source_project_id: source.id,
      p_new_project_id: newProjectId,
      p_new_name: "Copy",
      p_new_cover_image: null,
      p_include_content: true,
      p_file_map: realMap,
    });
    expect(error).toBeNull();

    const { data: copiedFiles } = await clientA
      .from("files")
      .select("id, name, size_bytes, folder_id, storage_key")
      .eq("project_id", newProjectId);
    const { data: copiedFolders } = await clientA
      .from("folders").select("id, name").eq("project_id", newProjectId);
    const { data: copiedBlocks } = await clientA
      .from("blocks")
      .select("id, type, content, file_id, section_id")
      .eq("project_id", newProjectId);

    expect(copiedFiles).toHaveLength(2);
    expect(copiedBlocks).toHaveLength(2);

    // the deep file kept its size and landed under the CLONED sub-folder
    const deep = copiedFiles!.find((f) => f.name === "deep.png")!;
    const clonedSub = copiedFolders!.find((f) => f.name === "Cabinetry")!;
    expect(deep.size_bytes).toBe(4242);
    expect(deep.folder_id).toBe(clonedSub.id);
    expect(deep.storage_key).toContain(newProjectId);
    expect(deep.id).not.toBe(inSub.id);

    // a root-level file stays at the root rather than being adopted
    expect(copiedFiles!.find((f) => f.name === "loose.png")!.folder_id).toBeNull();

    // the image block points at the COPIED file, never the original
    const imageBlock = copiedBlocks!.find((b) => b.type === "image")!;
    expect(imageBlock.file_id).toBe(deep.id);
    expect(imageBlock.section_id).toBe(clonedSub.id);

    // an unsorted block keeps its null section rather than being reparented
    const textBlock = copiedBlocks!.find((b) => b.type === "text")!;
    expect(textBlock.section_id).toBeNull();
    expect(textBlock.content).toBe("unsorted note");
  });

  it("skips a file-backed block whose file is missing from the map", async () => {
    // The app omits files it could not copy in the bucket. Inserting the
    // block anyway with a null file_id would render as an empty card —
    // indistinguishable from data loss.
    const source = await newProject(clientA, "Partial Source");
    const tab = await newFolder(clientA, source.id, "Tab", null, 100);
    const kept = await newFile(clientA, source.id, tab.id, "kept.png");
    const dropped = await newFile(clientA, source.id, tab.id, "dropped.png");
    await newBlock(clientA, source.id, tab.id, "image", { fileId: kept.id, sortOrder: 10 });
    await newBlock(clientA, source.id, tab.id, "image", { fileId: dropped.id, sortOrder: 20 });
    await newBlock(clientA, source.id, tab.id, "text", { content: "survives", sortOrder: 30 });

    const newProjectId = crypto.randomUUID();
    const newId = crypto.randomUUID();
    const { error } = await clientA.rpc("duplicate_project_hierarchy", {
      p_source_project_id: source.id,
      p_new_project_id: newProjectId,
      p_new_name: "Copy",
      p_new_cover_image: null,
      p_include_content: true,
      p_file_map: [
        { old_id: kept.id, new_id: newId, storage_key: buildStorageKey(userA.id, newProjectId, newId, "kept.png") },
      ],
    });
    expect(error).toBeNull();

    const { data: blocks } = await clientA
      .from("blocks").select("type, content, file_id").eq("project_id", newProjectId);

    expect(blocks).toHaveLength(2);
    expect(blocks!.filter((b) => b.type === "image")).toHaveLength(1);
    expect(blocks!.find((b) => b.type === "image")!.file_id).toBe(newId);
    // no orphan: nothing was inserted with a null file_id
    expect(blocks!.some((b) => b.type === "image" && b.file_id === null)).toBe(false);
    expect(blocks!.find((b) => b.type === "text")!.content).toBe("survives");
  });

  it("carries the project's own fields onto the copy", async () => {
    const source = await newProject(clientA, "Fields Source");
    const newProjectId = crypto.randomUUID();
    const { error } = await clientA.rpc("duplicate_project_hierarchy", {
      p_source_project_id: source.id,
      p_new_project_id: newProjectId,
      p_new_name: "Fields Source (copy)",
      p_new_cover_image: null,
      p_include_content: false,
      p_file_map: [],
    });
    expect(error).toBeNull();

    const { data: copy } = await clientA
      .from("projects").select("name, description, cover_image, user_id").eq("id", newProjectId).single();

    expect(copy!.name).toBe("Fields Source (copy)");
    expect(copy!.description).toBe("source description");
    // a template copy starts coverless on purpose
    expect(copy!.cover_image).toBeNull();
    // user_id defaults to auth.uid(), so the copy belongs to the caller
    expect(copy!.user_id).toBe(userA.id);
  });

  it("refuses to clone a project the caller cannot see", async () => {
    const source = await newProject(clientA, "Private Source");
    await newFolder(clientA, source.id, "Secret", null, 100);

    const { error } = await duplicate(clientB, source.id, true);

    // SECURITY INVOKER + RLS: not visible, therefore not found.
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/not found/i);

    // and nothing was created for B
    const { count } = await clientB
      .from("projects").select("id", { count: "exact", head: true }).eq("name", "Copy");
    expect(count).toBe(0);
  });
});
