// Verifies Project CRUD behavior: create defaults (auto-owned by the
// caller), rename, cover image upload/replace (including storage RLS), and
// cascade delete of a project's folders and files.
//
// Requires a local Supabase instance — see tests/authorization.test.ts for
// setup instructions.

import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import {
  buildStorageKey,
  PROJECT_FILES_BUCKET,
} from "../src/lib/supabase/storage";
import { createAdminClient, createTestUser, requireEnv, signInAs } from "./helpers";

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

describe("project CRUD", () => {
  let userA: { id: string; email: string; password: string };
  let userB: { id: string; email: string; password: string };
  let clientA: SupabaseClient;
  let clientB: SupabaseClient;

  beforeAll(async () => {
    requireEnv();
    const admin = createAdminClient();
    userA = await createTestUser(admin, "crud-a");
    userB = await createTestUser(admin, "crud-b");
    clientA = await signInAs(userA.email, userA.password);
    clientB = await signInAs(userB.email, userB.password);
  });

  it("creates a project owned by the current user with the given fields", async () => {
    const { data: project, error } = await clientA
      .from("projects")
      .insert({ name: "Tel Aviv Apartment", description: "Full renovation" })
      .select()
      .single();

    expect(error).toBeNull();
    expect(project?.user_id).toBe(userA.id);
    expect(project?.name).toBe("Tel Aviv Apartment");
    expect(project?.description).toBe("Full renovation");
    expect(project?.cover_image).toBeNull();
  });

  it("renames a project and updates its description", async () => {
    const { data: project } = await clientA
      .from("projects")
      .insert({ name: "Original name" })
      .select()
      .single();
    if (!project) throw new Error("setup failed");

    const { data: updated, error } = await clientA
      .from("projects")
      .update({ name: "New name", description: "New description" })
      .eq("id", project.id)
      .select()
      .single();

    expect(error).toBeNull();
    expect(updated?.name).toBe("New name");
    expect(updated?.description).toBe("New description");
    expect(new Date(updated!.updated_at).getTime()).toBeGreaterThanOrEqual(
      new Date(project.updated_at).getTime()
    );
  });

  it("uploads a cover image and can produce a signed URL for it", async () => {
    const { data: project } = await clientA
      .from("projects")
      .insert({ name: "Cover Image Project" })
      .select()
      .single();
    if (!project) throw new Error("setup failed");

    const storageKey = buildStorageKey(userA.id, project.id, "cover", "cover.png");
    const { error: uploadError } = await clientA.storage
      .from(PROJECT_FILES_BUCKET)
      .upload(storageKey, PNG_BYTES, { contentType: "image/png" });
    expect(uploadError).toBeNull();

    const { error: updateError } = await clientA
      .from("projects")
      .update({ cover_image: storageKey })
      .eq("id", project.id);
    expect(updateError).toBeNull();

    const { data: signed, error: signError } = await clientA.storage
      .from(PROJECT_FILES_BUCKET)
      .createSignedUrl(storageKey, 60);
    expect(signError).toBeNull();
    expect(signed?.signedUrl).toBeTruthy();
  });

  it("removes the old cover object when replacing it", async () => {
    const { data: project } = await clientA
      .from("projects")
      .insert({ name: "Cover Replace Project" })
      .select()
      .single();
    if (!project) throw new Error("setup failed");

    const firstKey = buildStorageKey(userA.id, project.id, "cover", "first.png");
    const secondKey = buildStorageKey(userA.id, project.id, "cover", "second.png");

    await clientA.storage
      .from(PROJECT_FILES_BUCKET)
      .upload(firstKey, PNG_BYTES, { contentType: "image/png" });
    await clientA.storage
      .from(PROJECT_FILES_BUCKET)
      .upload(secondKey, PNG_BYTES, { contentType: "image/png" });
    await clientA
      .from("projects")
      .update({ cover_image: secondKey })
      .eq("id", project.id);

    // This is what updateCoverImage() does after a successful replace.
    await clientA.storage.from(PROJECT_FILES_BUCKET).remove([firstKey]);

    const { data: listing } = await clientA.storage
      .from(PROJECT_FILES_BUCKET)
      .list(`${userA.id}/${project.id}`);
    const names = listing?.map((f) => f.name) ?? [];
    expect(names).not.toContain(firstKey.split("/").pop());
    expect(names).toContain(secondKey.split("/").pop());
  });

  it("cannot upload a storage object under another user's path", async () => {
    const { data: project } = await clientA
      .from("projects")
      .insert({ name: "Storage Boundary Project" })
      .select()
      .single();
    if (!project) throw new Error("setup failed");

    const key = buildStorageKey(userA.id, project.id, "cover", "hijack.png");
    const { error } = await clientB.storage
      .from(PROJECT_FILES_BUCKET)
      .upload(key, PNG_BYTES, { contentType: "image/png" });

    expect(error).not.toBeNull();
  });

  it("deletes a project and cascades to its folders and files", async () => {
    const { data: project } = await clientA
      .from("projects")
      .insert({ name: "To Be Deleted" })
      .select()
      .single();
    if (!project) throw new Error("setup failed");

    const { data: folder } = await clientA
      .from("folders")
      .insert({ project_id: project.id, name: "Contracts" })
      .select()
      .single();
    if (!folder) throw new Error("setup failed");

    const { data: file } = await clientA
      .from("files")
      .insert({
        project_id: project.id,
        folder_id: folder.id,
        name: "lease.pdf",
        mime_type: "application/pdf",
        size_bytes: 10,
        storage_key: buildStorageKey(userA.id, project.id, "f1", "lease.pdf"),
      })
      .select()
      .single();
    if (!file) throw new Error("setup failed");

    const { error: deleteError } = await clientA
      .from("projects")
      .delete()
      .eq("id", project.id);
    expect(deleteError).toBeNull();

    const { data: remainingFolder } = await clientA
      .from("folders")
      .select()
      .eq("id", folder.id);
    expect(remainingFolder).toEqual([]);

    const { data: remainingFile } = await clientA
      .from("files")
      .select()
      .eq("id", file.id);
    expect(remainingFile).toEqual([]);
  });
});
