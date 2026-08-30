import { describe, expect, it } from "vitest";
import { midpointSortOrder } from "../src/lib/sort-order";

describe("midpointSortOrder", () => {
  it("averages two distinct neighbors", () => {
    expect(midpointSortOrder(1, 3)).toBe(2);
  });

  it("nudges strictly between equal neighbors instead of collapsing to their shared value", () => {
    // Legacy rows can share a sort_order (e.g. everything defaulted to 0
    // before fractional ordering existed) — averaging two equal values just
    // returns that same value, so a drag between them would silently do
    // nothing.
    expect(midpointSortOrder(0, 0)).toBe(0.5);
    expect(midpointSortOrder(5, 5)).toBe(5.5);
  });

  it("appends after the last item when there's no upper neighbor", () => {
    expect(midpointSortOrder(4, undefined)).toBe(5);
  });

  it("prepends before the first item when there's no lower neighbor", () => {
    expect(midpointSortOrder(undefined, 4)).toBe(3);
  });

  it("defaults to 0 for an empty list", () => {
    expect(midpointSortOrder(undefined, undefined)).toBe(0);
  });
});
