// Verifies the blocks layer backing the notebook stream: heading/text
// content persistence, image blocks joined to their file, reordering via
// sort_order swaps, the file_id ON DELETE CASCADE that keeps a file-backed
// block from outliving its file, and cross-user authorization.
//
// Server actions in folder/actions.ts depend on Next's request-scoped
// cookies() context and can't be called directly from Vitest — as in
// digital-folder.test.ts, these tests exercise the same Supabase operations
// the actions perform.

import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
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

async function createFolder(client: SupabaseClient, projectId: string, name: string) {
  const { data, error } = await client
    .from("folders")
    .insert({ project_id: projectId, name })
    .select()
    .single();
  if (error || !data) throw error ?? new Error("failed to create folder");
  return data;
}

async function createFile(
  client: SupabaseClient,
  userId: string,
  projectId: string,
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

async function createBlock(
  client: SupabaseClient,
  projectId: string,
  sectionId: string,
  input: { type: string; content?: string | null; file_id?: string; sort_order: number }
) {
  const { data, error } = await client
    .from("blocks")
    .insert({ project_id: projectId, section_id: sectionId, ...input })
    .select()
    .single();
  if (error || !data) throw error ?? new Error("failed to create block");
  return data;
}

describe("blocks", () => {
  let userA: { id: string; email: string; password: string };
  let userB: { id: string; email: string; password: string };
  let clientA: SupabaseClient;
  let clientB: SupabaseClient;

  beforeAll(async () => {
    requireEnv();
    const admin = createAdminClient();
    userA = await createTestUser(admin, "blocks-a");
    userB = await createTestUser(admin, "blocks-b");
    clientA = await signInAs(userA.email, userA.password);
    clientB = await signInAs(userB.email, userB.password);
  });

  it("creates a text block whose markdown content persists, including a heading line", async () => {
    const project = await createProject(clientA, "Notebook Project");
    const section = await createFolder(clientA, project.id, "Kitchen");

    const text = await createBlock(clientA, project.id, section.id, {
      type: "text",
      content: "# Island & Countertop Concept\nConfirmed Calacatta quartz with the supplier.",
      sort_order: 0,
    });

    expect(text.content).toBe(
      "# Island & Countertop Concept\nConfirmed Calacatta quartz with the supplier."
    );
    expect(text.file_id).toBeNull();
  });

  it("rejects the removed standalone heading block type", async () => {
    const project = await createProject(clientA, "Rejected Type Project");
    const section = await createFolder(clientA, project.id, "Office");

    await expect(
      createBlock(clientA, project.id, section.id, {
        type: "heading",
        content: "Not allowed anymore",
        sort_order: 0,
      })
    ).rejects.toBeTruthy();
  });

  it("creates an image block joined to its file", async () => {
    const project = await createProject(clientA, "Photo Project");
    const section = await createFolder(clientA, project.id, "Living Room");
    const file = await createFile(clientA, userA.id, project.id, "sofa.png");

    await createBlock(clientA, project.id, section.id, {
      type: "image",
      file_id: file.id,
      sort_order: 0,
    });

    const { data: joined, error } = await clientA
      .from("blocks")
      .select("id, type, file:files(id, name)")
      .eq("section_id", section.id)
      .single();

    expect(error).toBeNull();
    expect(joined?.type).toBe("image");
    expect((joined?.file as unknown as { name: string } | null)?.name).toBe("sofa.png");
  });

  it("reorders via a fractional-midpoint sort_order, mirroring moveBlockToPosition", async () => {
    const project = await createProject(clientA, "Reorder Project");
    const section = await createFolder(clientA, project.id, "Bathroom");

    const first = await createBlock(clientA, project.id, section.id, {
      type: "text",
      content: "First",
      sort_order: 0,
    });
    const second = await createBlock(clientA, project.id, section.id, {
      type: "text",
      content: "Second",
      sort_order: 1,
    });
    const third = await createBlock(clientA, project.id, section.id, {
      type: "text",
      content: "Third",
      sort_order: 2,
    });

    // Drag "Third" to between "First" and "Second" — the exact fractional
    // midpoint math the grip-handle drop target uses client-side.
    const midpoint = (first.sort_order + second.sort_order) / 2;
    await clientA.from("blocks").update({ sort_order: midpoint }).eq("id", third.id);

    const { data: ordered } = await clientA
      .from("blocks")
      .select("content")
      .eq("section_id", section.id)
      .order("sort_order");

    expect((ordered ?? []).map((b) => b.content)).toEqual(["First", "Third", "Second"]);
  });

  it("deleting a file cascades to delete its block", async () => {
    const project = await createProject(clientA, "Cascade Project");
    const section = await createFolder(clientA, project.id, "Garden");
    const file = await createFile(clientA, userA.id, project.id, "plan.png");
    const block = await createBlock(clientA, project.id, section.id, {
      type: "image",
      file_id: file.id,
      sort_order: 0,
    });

    await clientA.from("files").delete().eq("id", file.id);

    const { data: remaining } = await clientA.from("blocks").select().eq("id", block.id);
    expect(remaining).toEqual([]);
  });

  it("cannot read, reorder, or delete another user's blocks", async () => {
    const project = await createProject(clientA, "Private Notebook Project");
    const section = await createFolder(clientA, project.id, "Office");
    const block = await createBlock(clientA, project.id, section.id, {
      type: "text",
      content: "Private note",
      sort_order: 0,
    });

    const { data: readAsB } = await clientB.from("blocks").select().eq("id", block.id);
    expect(readAsB).toEqual([]);

    const { data: updatedAsB, error: updateError } = await clientB
      .from("blocks")
      .update({ content: "Hijacked" })
      .eq("id", block.id)
      .select();
    expect(updateError).toBeNull();
    expect(updatedAsB).toEqual([]);

    const { data: deletedAsB, error: deleteError } = await clientB
      .from("blocks")
      .delete()
      .eq("id", block.id)
      .select();
    expect(deleteError).toBeNull();
    expect(deletedAsB).toEqual([]);

    const { data: stillThere } = await clientA.from("blocks").select().eq("id", block.id);
    expect(stillThere?.length).toBe(1);
  });
});
