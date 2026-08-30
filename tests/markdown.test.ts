// Pure logic tests for the hand-rolled markdown renderer backing text
// blocks — no Supabase needed. Rendered to a static HTML string (via
// react-dom/server, already a dependency) so assertions can check for
// expected tags/text without a full DOM testing library.

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../src/lib/markdown";
import { filterNoteBlocks, type BlockRow } from "../src/app/(app)/projects/[id]/folder/data";

function html(content: string): string {
  return renderToStaticMarkup(renderMarkdown(content));
}

describe("renderMarkdown", () => {
  it("renders H1 and H2 headings", () => {
    const out = html("# Big Title\n## Subtitle");
    expect(out).toContain("<h1");
    expect(out).toContain("Big Title");
    expect(out).toContain("<h2");
    expect(out).toContain("Subtitle");
  });

  it("renders bold, italic, underline, and code inline", () => {
    const out = html("**bold** *italic* ++underline++ `code`");
    expect(out).toContain("<strong>bold</strong>");
    expect(out).toContain("<em>italic</em>");
    expect(out).toContain("<u>underline</u>");
    expect(out).toContain("<code");
    expect(out).toContain("code</code>");
  });

  it("renders a bulleted list", () => {
    const out = html("- First\n- Second\n- Third");
    expect(out).toContain("<ul");
    expect((out.match(/<li>/g) ?? []).length).toBe(3);
    expect(out).toContain("First");
    expect(out).toContain("Third");
  });

  it("renders a numbered list", () => {
    const out = html("1. Alpha\n2. Beta");
    expect(out).toContain("<ol");
    expect((out.match(/<li>/g) ?? []).length).toBe(2);
  });

  it("renders a pipe table with a header and rows", () => {
    const out = html("| Item | Price |\n| --- | --- |\n| Tile | $12 |\n| Grout | $4 |");
    expect(out).toContain("<table");
    expect(out).toContain("<th");
    expect(out).toContain("Item");
    expect(out).toContain("Price");
    expect((out.match(/<tr>/g) ?? []).length).toBe(3); // 1 header + 2 rows
    expect(out).toContain("Tile");
    expect(out).toContain("$12");
  });

  it("falls back to a plain paragraph for ordinary text", () => {
    const out = html("Just a normal sentence.");
    expect(out).toContain("<p");
    expect(out).toContain("Just a normal sentence.");
  });

  it("renders a Note callout as a highlighted box with bold 'Note:'", () => {
    const out = html("> **Note:** Verify measurements before ordering.");
    expect(out).toContain("bg-amber-50");
    expect(out).toContain("<strong>Note:</strong>");
    expect(out).toContain("Verify measurements before ordering.");
  });

  it("groups consecutive quote lines into one callout", () => {
    const out = html("> **Note:** First line.\n> Second line.");
    expect((out.match(/bg-amber-50/g) ?? []).length).toBe(1);
    expect(out).toContain("First line.");
    expect(out).toContain("Second line.");
  });
});

function textBlock(id: string, content: string): BlockRow {
  return { id, type: "text", content, sort_order: 0, file: null, font_family: null, font_size: null };
}

describe("filterNoteBlocks", () => {
  it("drops a text block containing a Note callout and keeps a plain one", () => {
    const blocks = [
      textBlock("a", "Just a normal paragraph."),
      textBlock("b", "> **Note:** Internal only, do not share."),
    ];
    const result = filterNoteBlocks(blocks);
    expect(result.map((b) => b.id)).toEqual(["a"]);
  });

  it("passes through unchanged when there are no notes", () => {
    const blocks = [
      textBlock("a", "First paragraph."),
      textBlock("b", "# Heading\nSecond paragraph."),
      {
        id: "c",
        type: "image",
        content: "A caption",
        sort_order: 1,
        file: null,
        font_family: null,
        font_size: null,
      } as BlockRow,
    ];
    expect(filterNoteBlocks(blocks)).toEqual(blocks);
  });

  it("drops a whole block if a note line appears anywhere within it, not just at the start", () => {
    const blocks = [textBlock("a", "Regular line first.\n> **Note:** Buried mid-block.")];
    expect(filterNoteBlocks(blocks)).toEqual([]);
  });
});
