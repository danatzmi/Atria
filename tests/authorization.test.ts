// Verifies that Postgres Row Level Security — not application code — is what
// stops one user from reading or writing another user's projects, folders,
// and files, and that the project-boundary triggers reject folders/files
// whose parent belongs to a different project.
//
// Requires a local Supabase instance: `npx supabase start`, then copy the
// printed API URL / anon key / service_role key into `.env.local` (see
// `.env.local.example`). Run with `npm run test`.

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import {
  createAdminClient,
  createTestUser,
  requireEnv,
  signInAs,
} from "./helpers";

describe("authorization boundaries", () => {
  let userA: { id: string; email: string; password: string };
  let userB: { id: string; email: string; password: string };
  let clientA: SupabaseClient;
  let clientB: SupabaseClient;
  let projectA: { id: string };
  let folderA: { id: string };
  let fileA: { id: string };

  beforeAll(async () => {
    requireEnv();
    const admin = createAdminClient();

    userA = await createTestUser(admin, "a");
    userB = await createTestUser(admin, "b");

    clientA = await signInAs(userA.email, userA.password);
    clientB = await signInAs(userB.email, userB.password);

    const { data: project, error: projectError } = await clientA
      .from("projects")
      .insert({ name: "User A Project" })
      .select()
      .single();
    if (projectError || !project) {
      throw projectError ?? new Error("failed to create project");
    }
    projectA = project;

    const { data: folder, error: folderError } = await clientA
      .from("folders")
      .insert({ project_id: projectA.id, name: "Contracts" })
      .select()
      .single();
    if (folderError || !folder) {
      throw folderError ?? new Error("failed to create folder");
    }
    folderA = folder;

    const { data: file, error: fileError } = await clientA
      .from("files")
      .insert({
        project_id: projectA.id,
        folder_id: folderA.id,
        name: "lease.pdf",
        mime_type: "application/pdf",
        size_bytes: 1024,
        storage_key: `${userA.id}/${projectA.id}/${randomUUID()}-lease.pdf`,
      })
      .select()
      .single();
    if (fileError || !file) {
      throw fileError ?? new Error("failed to create file");
    }
    fileA = file;
  });

  it("cannot see another user's project", async () => {
    const { data, error } = await clientB
      .from("projects")
      .select()
      .eq("id", projectA.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("cannot read another user's folder by guessing its id", async () => {
    const { data, error } = await clientB
      .from("folders")
      .select()
      .eq("id", folderA.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("cannot read another user's file by guessing its id", async () => {
    const { data, error } = await clientB
      .from("files")
      .select()
      .eq("id", fileA.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("cannot insert a folder into another user's project", async () => {
    const { error } = await clientB
      .from("folders")
      .insert({ project_id: projectA.id, name: "Malicious" });
    expect(error).not.toBeNull();
  });

  it("cannot insert a file into another user's project", async () => {
    const { error } = await clientB.from("files").insert({
      project_id: projectA.id,
      name: "malicious.txt",
      mime_type: "text/plain",
      size_bytes: 1,
      storage_key: `${userB.id}/${projectA.id}/${randomUUID()}-malicious.txt`,
    });
    expect(error).not.toBeNull();
  });

  it("cannot update or delete another user's project", async () => {
    const { error: updateError, data: updateData } = await clientB
      .from("projects")
      .update({ name: "Hijacked" })
      .eq("id", projectA.id)
      .select();
    expect(updateError).toBeNull();
    expect(updateData).toEqual([]);

    const { error: deleteError, data: deleteData } = await clientB
      .from("projects")
      .delete()
      .eq("id", projectA.id)
      .select();
    expect(deleteError).toBeNull();
    expect(deleteData).toEqual([]);
  });

  it("rejects a folder whose parent belongs to a different project", async () => {
    const { data: otherProject, error: otherProjectError } = await clientB
      .from("projects")
      .insert({ name: "User B Project" })
      .select()
      .single();
    if (otherProjectError || !otherProject) {
      throw otherProjectError ?? new Error("setup failed");
    }

    const { error } = await clientB.from("folders").insert({
      project_id: otherProject.id,
      parent_folder_id: folderA.id, // belongs to User A's project
      name: "Cross-project child",
    });
    expect(error).not.toBeNull();
  });

  it("rejects a file whose folder belongs to a different project", async () => {
    const { data: otherProject, error: otherProjectError } = await clientA
      .from("projects")
      .insert({ name: "User A Second Project" })
      .select()
      .single();
    if (otherProjectError || !otherProject) {
      throw otherProjectError ?? new Error("setup failed");
    }

    const { error } = await clientA.from("files").insert({
      project_id: otherProject.id,
      folder_id: folderA.id, // belongs to the first project
      name: "cross-project.txt",
      mime_type: "text/plain",
      size_bytes: 1,
      storage_key: `${userA.id}/${otherProject.id}/${randomUUID()}-cross-project.txt`,
    });
    expect(error).not.toBeNull();
  });
});
