// Plan configuration and limit resolution. Pure logic, no Supabase — the
// enforcement path itself is exercised end-to-end in tests/project-crud.
import { describe, expect, it } from "vitest";
import { PLANS, planFor, projectLimitMessage } from "../src/lib/plans";

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
