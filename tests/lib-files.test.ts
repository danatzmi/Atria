// Pure logic tests for shared file-display helpers — no Supabase needed,
// these are plain functions.

import { describe, expect, it } from "vitest";
import { formatBytes } from "../src/lib/files";

describe("formatBytes", () => {
  it("formats bytes, KB, MB, GB appropriately", () => {
    expect(formatBytes(42)).toBe("42 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(1.5 * 1024 * 1024 * 1024)).toBe("1.5 GB");
  });
});
