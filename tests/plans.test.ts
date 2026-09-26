// Plan configuration and limit resolution. Pure logic, no Supabase — the
// enforcement path itself is exercised end-to-end in tests/project-crud.
import { describe, expect, it } from "vitest";
import {
  PLANS,
  exceedsProjectLimit,
  planFor,
  projectLimitMessage,
} from "../src/lib/plans";

describe("plan config", () => {
  it("prices in USD", () => {
    for (const plan of PLANS) expect(plan.price.startsWith("$")).toBe(true);
  });

  it("exposes the numeric project limits the server enforces", () => {
    expect(planFor("free").projectLimit).toBe(1);
    expect(planFor("basic").projectLimit).toBe(10);
    expect(planFor("pro").projectLimit).toBe(Infinity);
  });

  it("keeps the marketing copy consistent with the enforced limit", () => {
    // The whole point of one shared config: a visitor reading "10 projects"
    // and a server allowing 10 must never drift apart.
    expect(planFor("basic").features).toContain("10 projects");
    expect(planFor("free").features).toContain("1 project");
  });

  // Failing open would hand a free plan unlimited projects.
  // The numbers the upload gate compares against. Nothing else in the
  // suite pins them, so a typo — 20 * GB becoming 2 * GB — would break no
  // test and no page, and would only surface as a customer being refused
  // an upload they had paid for.
  it("exposes the numeric storage ceilings the server enforces", () => {
    const GB = 1024 * 1024 * 1024;
    expect(planFor("free").storageBytes).toBe(1 * GB);
    expect(planFor("basic").storageBytes).toBe(20 * GB);
    expect(planFor("pro").storageBytes).toBe(100 * GB);
  });

  // storageLabel is derived from storageBytes precisely so the two cannot
  // drift; this is the assertion that would catch the derivation being
  // replaced by a hand-written string again.
  it("keeps the advertised storage label in step with the enforced bytes", () => {
    for (const plan of PLANS) {
      const gb = plan.storageBytes / (1024 * 1024 * 1024);
      expect(Number.isInteger(gb)).toBe(true);
      expect(plan.storageLabel).toBe(`${gb} GB`);
      expect(plan.features).toContain(`${gb} GB of storage`);
    }
  });

  it("gives each tier strictly more storage than the one below", () => {
    const bytes = PLANS.map((p) => p.storageBytes);
    expect(bytes).toEqual([...bytes].sort((a, b) => a - b));
    expect(new Set(bytes).size).toBe(bytes.length);
  });

  it("falls back to Free for a missing or unknown tier", () => {
    expect(planFor(null).tier).toBe("free");
    expect(planFor(undefined).tier).toBe("free");
    expect(planFor("enterprise").tier).toBe("free");
  });

  it("names the plan and the next step in the limit message", () => {
    const msg = projectLimitMessage(planFor("free"));
    expect(msg).toContain("Free");
    expect(msg.toLowerCase()).toContain("upgrade");
  });

  it("every tier in the config is unique and ordered cheapest first", () => {
    expect(PLANS.map((p) => p.tier)).toEqual(["free", "basic", "pro"]);
  });
});

// The rule createProject and duplicateProject both gate on. plan config
// tests above pin the NUMBERS; these pin what is done with them.
describe("exceedsProjectLimit", () => {
  const free = planFor("free");     // 1
  const basic = planFor("basic");   // 10
  const pro = planFor("pro");       // unlimited

  it("lets a workspace reach its limit but not pass it", () => {
    // "at the limit" means the next one is refused, not that the last one
    // was. A Free user may hold one project; holding it blocks a second.
    expect(exceedsProjectLimit(free, 0)).toBe(false);
    expect(exceedsProjectLimit(free, 1)).toBe(true);

    expect(exceedsProjectLimit(basic, 9)).toBe(false);
    expect(exceedsProjectLimit(basic, 10)).toBe(true);
  });

  it("keeps refusing once a workspace is over the limit", () => {
    // Reachable after a downgrade: someone on Basic with 10 projects who
    // drops to Free still holds them, and must not be able to add more.
    expect(exceedsProjectLimit(free, 10)).toBe(true);
    expect(exceedsProjectLimit(basic, 50)).toBe(true);
  });

  it("never refuses on the unlimited tier", () => {
    expect(pro.projectLimit).toBe(Infinity);
    for (const count of [0, 1, 10, 10_000, Number.MAX_SAFE_INTEGER]) {
      expect(exceedsProjectLimit(pro, count)).toBe(false);
    }
  });

  it("treats an unknown tier as Free, the restrictive direction", () => {
    // planFor's fallback matters here: a user row with a plan value the app
    // does not recognise must not become unlimited.
    expect(exceedsProjectLimit(planFor("enterprise-plus"), 1)).toBe(true);
    expect(exceedsProjectLimit(planFor(null), 1)).toBe(true);
    expect(exceedsProjectLimit(planFor(undefined), 1)).toBe(true);
  });

  it("gives each tier strictly more projects than the one below", () => {
    const limits = PLANS.map((p) => p.projectLimit);
    expect(limits).toEqual([...limits].sort((a, b) => a - b));
    expect(new Set(limits).size).toBe(limits.length);
  });
});
