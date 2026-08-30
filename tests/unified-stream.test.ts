// Verifies the two new pieces of "Unified Sub-tab Blocks & Recursive
// Search": searchSubtree() (folder/data.ts) walking an entire tab's subtree
// to find matches in nested sub-tabs, and the fact that folders and blocks
// now share one comparable sort_order space so a sub-tab can be dragged to
// any position among blocks, not just within its own separate list.
//
// Server actions in folder/actions.ts depend on Next's request-scoped
// cookies() context and can't be called directly from Vitest. searchSubtree
// itself is a plain (non-"use server") helper in folder/data.ts and IS
// imported and called directly, same as getFolderDescendantIds elsewhere.

import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { searchSubtree } from "../src/app/(app)/projects/[id]/folder/data";
import { createAdminClient, createTestUser, requireEnv, signInAs } from "./helpers";

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
  parentFolderId: string | null = null,
  sortOrder = 0
) {
  const { data, error } = await client
    .from("folders")
    .insert({ project_id: projectId, parent_folder_id: parentFolderId, name, sort_order: sortOrder })
    .select()
    .single();
  if (error || !data) throw error ?? new Error("failed to create folder");
  return data;
}

async function createTextBlock(
  client: SupabaseClient,
  projectId: string,
  sectionId: string | null,
  content: string,
  sortOrder: number
) {
  const { data, error } = await client
    .from("blocks")
    .insert({ project_id: projectId, section_id: sectionId, type: "text", content, sort_order: sortOrder })
    .select()
    .single();
  if (error || !data) throw error ?? new Error("failed to create block");
  return data;
}

describe("searchSubtree (recursive in-tab search)", () => {
  let userA: { id: string; email: string; password: string };
  let userB: { id: string; email: string; password: string };
  let clientA: SupabaseClient;
  let clientB: SupabaseClient;

  beforeAll(async () => {
    requireEnv();
    const admin = createAdminClient();
    userA = await createTestUser(admin, "search-a");
    userB = await createTestUser(admin, "search-b");
    clientA = await signInAs(userA.email, userA.password);
    clientB = await signInAs(userB.email, userB.password);
  });

  it("finds a block nested two sub-tabs deep and force-opens every ancestor up to (not including) the root", async () => {
    const project = await createProject(clientA, "Deep Nesting Project");
    const kitchen = await createFolder(clientA, project.id, "Kitchen");
    const cabinetry = await createFolder(clientA, project.id, "Cabinetry", kitchen.id);
    const hardware = await createFolder(clientA, project.id, "Hardware", cabinetry.id);
    const match = await createTextBlock(clientA, project.id, hardware.id, "Brushed nickel pulls, 3-inch spacing.", 0);
    const nonMatch = await createTextBlock(clientA, project.id, kitchen.id, "Paint color still TBD.", 0);

    const result = await searchSubtree(clientA, project.id, kitchen.id, "nickel");

    expect(result.blockIds).toEqual([match.id]);
    expect(result.blockIds).not.toContain(nonMatch.id);
    expect(result.openFolderIds).toEqual(expect.arrayContaining([cabinetry.id, hardware.id]));
    expect(result.visibleFolderIds).toEqual(expect.arrayContaining([cabinetry.id, hardware.id]));
  });

  it("matches a sub-tab by name without force-opening it (nothing nested to reveal)", async () => {
    const project = await createProject(clientA, "Name Match Project");
    const kitchen = await createFolder(clientA, project.id, "Kitchen");
    const nickelFixtures = await createFolder(clientA, project.id, "Nickel Fixtures", kitchen.id);
    await createFolder(clientA, project.id, "Plumbing", kitchen.id);

    const result = await searchSubtree(clientA, project.id, kitchen.id, "nickel");

    expect(result.visibleFolderIds).toContain(nickelFixtures.id);
    // A direct child of the search root has no ancestors within the
    // subtree to force open — it just shows up in the list, same as a
    // plain (non-recursive) name filter always did.
    expect(result.openFolderIds).not.toContain(nickelFixtures.id);
  });

  it("returns nothing for a blank query", async () => {
    const project = await createProject(clientA, "Blank Query Project");
    const kitchen = await createFolder(clientA, project.id, "Kitchen");

    const result = await searchSubtree(clientA, project.id, kitchen.id, "   ");

    expect(result).toEqual({ visibleFolderIds: [], openFolderIds: [], blockIds: [] });
  });

  it("finds nothing under another user's tab (RLS-scoped)", async () => {
    const project = await createProject(clientA, "Private Search Project");
    const kitchen = await createFolder(clientA, project.id, "Kitchen");
    const cabinetry = await createFolder(clientA, project.id, "Cabinetry", kitchen.id);
    await createTextBlock(clientA, project.id, cabinetry.id, "Brushed nickel pulls.", 0);

    const result = await searchSubtree(clientB, project.id, kitchen.id, "nickel");

    expect(result).toEqual({ visibleFolderIds: [], openFolderIds: [], blockIds: [] });
  });
});

describe("unified sort_order space (sub-tab drag-and-drop among blocks)", () => {
  let userA: { id: string; email: string; password: string };
  let clientA: SupabaseClient;

  beforeAll(async () => {
    requireEnv();
    const admin = createAdminClient();
    userA = await createTestUser(admin, "reorder-a");
    clientA = await signInAs(userA.email, userA.password);
  });

  it("drags a sub-tab to before an existing block, interleaving folders and blocks by one shared sort_order", async () => {
    const project = await createProject(clientA, "Interleaved Stream Project");
    const kitchen = await createFolder(clientA, project.id, "Kitchen");
    const note = await createTextBlock(clientA, project.id, kitchen.id, "First note", 0);
    const cabinetry = await createFolder(clientA, project.id, "Cabinetry", kitchen.id, 1);

    // Drag "Cabinetry" (a sub-tab) to before "First note" (a block) — the
    // exact fractional-midpoint math BlockGap's drop target uses client
    // side, mirroring moveFolderToPosition. No predecessor, so target = 0 - 1.
    await clientA.from("folders").update({ sort_order: -1 }).eq("id", cabinetry.id);

    const [{ data: folders }, { data: blocks }] = await Promise.all([
      clientA.from("folders").select("id, name, sort_order").eq("parent_folder_id", kitchen.id),
      clientA.from("blocks").select("id, content, sort_order").eq("section_id", kitchen.id),
    ]);

    // Merge by sort_order the same way browser.tsx's buildStream does —
    // folders and blocks are directly comparable now, not two separate lists.
    const merged = [
      ...(folders ?? []).map((f) => ({ kind: "folder" as const, sortOrder: f.sort_order, label: f.name })),
      ...(blocks ?? []).map((b) => ({ kind: "block" as const, sortOrder: b.sort_order, label: b.content })),
    ].sort((a, b) => a.sortOrder - b.sortOrder);

    expect(merged.map((m) => m.label)).toEqual(["Cabinetry", "First note"]);
    expect(merged[0].kind).toBe("folder");
    expect(merged[1].label).toBe(note.content);
  });
});
