// The storage ceiling.
//
// Two halves, tested separately because they fail differently:
//
//   exceedsStorageLimit — pure arithmetic and a boundary. Cheap to get
//   subtly wrong (>= vs >), and nothing about it needs a database.
//
//   getStorageUsed — a query whose correctness is entirely about SCOPE. It
//   deliberately carries no user filter, relying on RLS to confine `files`
//   to the caller. If that assumption were ever wrong, one tenant's uploads
//   would count against another's plan, and the bug would look like a
//   billing complaint rather than a leak.
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { exceedsStorageLimit, getStorageUsed } from "../src/lib/storage-usage";
import { planFor } from "../src/lib/plans";
import { buildStorageKey } from "../src/lib/supabase/storage";
import { createAdminClient, createTestUser, requireEnv, signInAs } from "./helpers";

describe("exceedsStorageLimit", () => {
  const free = planFor("free");     // 1 GB
  const basic = planFor("basic");   // 20 GB
  const pro = planFor("pro");       // 100 GB
  const GB = 1024 * 1024 * 1024;

  it("allows an upload that lands exactly on the ceiling", () => {
    // The boundary itself is inclusive: someone on a 1 GB plan may fill it
    // to 1 GB. A `>=` here would refuse the last byte they paid for.
    expect(exceedsStorageLimit(free, 0, free.storageBytes)).toBe(false);
    expect(exceedsStorageLimit(free, free.storageBytes - 1, 1)).toBe(false);
  });

  it("refuses the byte after the ceiling", () => {
    expect(exceedsStorageLimit(free, free.storageBytes, 1)).toBe(true);
    expect(exceedsStorageLimit(free, 0, free.storageBytes + 1)).toBe(true);
  });

  it("counts what is already stored, not just what is arriving", () => {
    // A half-full free plan cannot take another full gigabyte.
    expect(exceedsStorageLimit(free, 0.5 * GB, 0.4 * GB)).toBe(false);
    expect(exceedsStorageLimit(free, 0.5 * GB, 0.6 * GB)).toBe(true);
  });

  it("scales with the plan, so the same upload differs by tier", () => {
    const fiveGB = 5 * GB;
    expect(exceedsStorageLimit(free, 0, fiveGB)).toBe(true);
    expect(exceedsStorageLimit(basic, 0, fiveGB)).toBe(false);
    expect(exceedsStorageLimit(pro, 0, fiveGB)).toBe(false);
  });

  // The middle tier deserves its own case rather than being assumed to
  // behave because the extremes do: an upload it must accept, and one it
  // must refuse, both of which the tiers either side would answer
  // differently.
  it("gives Basic its own ceiling, distinct from both neighbours", () => {
    const thirtyGB = 30 * GB;
    expect(exceedsStorageLimit(basic, 0, thirtyGB)).toBe(true);
    expect(exceedsStorageLimit(pro, 0, thirtyGB)).toBe(false);

    const tenGB = 10 * GB;
    expect(exceedsStorageLimit(free, 0, tenGB)).toBe(true);
    expect(exceedsStorageLimit(basic, 0, tenGB)).toBe(false);
  });

  it("applies the exact-boundary rule to Basic too", () => {
    expect(exceedsStorageLimit(basic, 0, basic.storageBytes)).toBe(false);
    expect(exceedsStorageLimit(basic, basic.storageBytes, 1)).toBe(true);
  });

  it("treats an unknown tier as Free, the restrictive direction", () => {
    const unknown = planFor("enterprise-plus");
    expect(unknown.tier).toBe("free");
    expect(exceedsStorageLimit(unknown, 0, 2 * GB)).toBe(true);
  });

  it("allows a zero-byte upload against a full workspace", () => {
    // Not a curiosity: an empty file still creates a row, and refusing it
    // would be refusing something that costs nothing.
    expect(exceedsStorageLimit(free, free.storageBytes, 0)).toBe(false);
  });
});

describe("getStorageUsed", () => {
  let admin: SupabaseClient;
  let clientA: SupabaseClient;
  let clientB: SupabaseClient;
  let userA: { id: string };
  let userB: { id: string };

  beforeAll(async () => {
    requireEnv();
    admin = createAdminClient();
    const a = await createTestUser(admin, "storage-a");
    const b = await createTestUser(admin, "storage-b");
    userA = a;
    userB = b;
    clientA = await signInAs(a.email, a.password);
    clientB = await signInAs(b.email, b.password);
  });

  async function addFile(
    client: SupabaseClient,
    userId: string,
    projectId: string,
    name: string,
    sizeBytes: number
  ) {
    const fileId = crypto.randomUUID();
    const { error } = await client.from("files").insert({
      id: fileId,
      project_id: projectId,
      folder_id: null,
      name,
      mime_type: "application/octet-stream",
      size_bytes: sizeBytes,
      storage_key: buildStorageKey(userId, projectId, fileId, name),
    });
    if (error) throw error;
  }

  async function newProject(client: SupabaseClient, name: string) {
    const { data, error } = await client
      .from("projects")
      .insert({ name })
      .select()
      .single();
    if (error || !data) throw error ?? new Error("failed to create project");
    return data;
  }

  it("is zero for a workspace with no files", async () => {
    expect(await getStorageUsed(clientA)).toBe(0);
  });

  it("sums across every project the user owns, not just one", async () => {
    // The ceiling is a workspace limit. Summing a single project would let
    // someone stay under it forever by making more projects.
    const p1 = await newProject(clientA, "Storage One");
    const p2 = await newProject(clientA, "Storage Two");
    await addFile(clientA, userA.id, p1.id, "a.bin", 1000);
    await addFile(clientA, userA.id, p2.id, "b.bin", 2500);

    expect(await getStorageUsed(clientA)).toBe(3500);
  });

  it("does not count another user's files", async () => {
    const pB = await newProject(clientB, "B's Project");
    await addFile(clientB, userB.id, pB.id, "big.bin", 999_999);

    // A is unchanged by anything B did, and B sees only their own.
    expect(await getStorageUsed(clientA)).toBe(3500);
    expect(await getStorageUsed(clientB)).toBe(999_999);
  });

  it("drops a deleted file's bytes back out of the total", async () => {
    const { data: files } = await clientA
      .from("files")
      .select("id, size_bytes")
      .eq("name", "b.bin");
    const target = files?.[0];
    expect(target).toBeTruthy();

    await clientA.from("files").delete().eq("id", target!.id);
    expect(await getStorageUsed(clientA)).toBe(3500 - target!.size_bytes);
  });

  it("stays exact well past the range a float would round", async () => {
    // size_bytes is a bigint. A 40 GB file is far inside what JS integers
    // hold exactly, but it is past where a careless sum in a smaller type
    // would drift — and a drifting total silently moves the ceiling.
    const p = await newProject(clientA, "Large File Project");
    const huge = 40 * 1024 * 1024 * 1024;
    await addFile(clientA, userA.id, p.id, "huge.bin", huge);

    const used = await getStorageUsed(clientA);
    expect(used).toBe(1000 + huge);
    expect(Number.isSafeInteger(used)).toBe(true);
  });
});
