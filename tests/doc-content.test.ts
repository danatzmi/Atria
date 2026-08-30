// Pure logic tests for the ProseMirror-JSON side of block content — the
// WYSIWYG ribbon (ticket: Word-grade rich text editor) saves editor.getJSON()
// directly instead of markdown, since colors/highlights/alignment/checklists
// have no honest markdown representation. Every pre-existing (markdown-text)
// block must keep rendering exactly as before via markdown.tsx, so these
// tests focus on: detecting which format a block has, rendering the JSON
// format, and making sure note-filtering works identically for both.

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  blockContentHasNoteCallout,
  docJSONHasNoteCallout,
  docJSONIsEmpty,
  renderBlockContent,
  renderDocJSON,
  tryParseDocJSON,
  type DocJSON,
} from "../src/lib/doc-content";
import { filterNoteBlocks, type BlockRow } from "../src/app/(app)/projects/[id]/folder/data";

function html(doc: DocJSON): string {
  return renderToStaticMarkup(renderDocJSON(doc));
}

function textBlock(id: string, content: string): BlockRow {
  return { id, type: "text", content, sort_order: 0, file: null, font_family: null, font_size: null };
}

describe("tryParseDocJSON", () => {
  it("recognizes a valid ProseMirror doc", () => {
    const doc: DocJSON = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }] };
    expect(tryParseDocJSON(JSON.stringify(doc))).toEqual(doc);
  });

  it("returns null for legacy markdown text", () => {
    expect(tryParseDocJSON("# Heading\nSome text")).toBeNull();
  });

  it("returns null for non-doc JSON and for empty/null content", () => {
    expect(tryParseDocJSON('{"foo": "bar"}')).toBeNull();
    expect(tryParseDocJSON("")).toBeNull();
    expect(tryParseDocJSON(null)).toBeNull();
  });
});

describe("renderDocJSON", () => {
  it("renders headings, including level 4 as the Subtitle style", () => {
    const out = html({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Title" }] },
        { type: "heading", attrs: { level: 4 }, content: [{ type: "text", text: "A subtitle" }] },
      ],
    });
    expect(out).toContain("<h1");
    expect(out).toContain("Title");
    expect(out).toContain("<h4");
    expect(out).toContain("A subtitle");
  });

  it("renders bold/italic/underline/strike/code marks", () => {
    const out = html({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "bold", marks: [{ type: "bold" }] },
            { type: "text", text: "italic", marks: [{ type: "italic" }] },
            { type: "text", text: "under", marks: [{ type: "underline" }] },
            { type: "text", text: "struck", marks: [{ type: "strike" }] },
            { type: "text", text: "code", marks: [{ type: "code" }] },
          ],
        },
      ],
    });
    expect(out).toContain("<strong>bold</strong>");
    expect(out).toContain("<em>italic</em>");
    expect(out).toContain("<u>under</u>");
    expect(out).toContain("<s>struck</s>");
    expect(out).toContain("code</code>");
  });

  it("renders text color and highlight as inline styles", () => {
    const out = html({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "red", marks: [{ type: "textStyle", attrs: { color: "#dc2626" } }] },
            { type: "text", text: "lit", marks: [{ type: "highlight", attrs: { color: "#fef08a" } }] },
          ],
        },
      ],
    });
    expect(out).toContain("color:#dc2626");
    expect(out).toContain("background-color:#fef08a");
  });

  it("renders a checklist with checked state", () => {
    const out = html({
      type: "doc",
      content: [
        {
          type: "taskList",
          content: [
            { type: "taskItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "Done" }] }] },
            { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Todo" }] }] },
          ],
        },
      ],
    });
    expect((out.match(/type="checkbox"/g) ?? []).length).toBe(2);
    expect(out).toContain("checked=\"\"");
    expect(out).toContain("line-through");
  });

  it("renders a table with header-row cell shading", () => {
    // Real TipTap output always wraps cell content in a paragraph node
    // (ProseMirror's table schema requires block content in cells).
    const out = html({
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableHeader",
                  attrs: { backgroundColor: "#fef08a" },
                  content: [{ type: "paragraph", content: [{ type: "text", text: "Item" }] }],
                },
              ],
            },
            {
              type: "tableRow",
              content: [{ type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Slab" }] }] }],
            },
          ],
        },
      ],
    });
    expect(out).toContain("<table");
    expect(out).toContain("background-color:#fef08a");
    expect(out).toContain("Item");
    expect(out).toContain("Slab");
  });

  it("renders a Note callout (blockquote) as the amber highlighted box", () => {
    const out = html({
      type: "doc",
      content: [{ type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "Internal only." }] }] }],
    });
    expect(out).toContain("bg-amber-50");
    expect(out).toContain("Internal only.");
  });
});

describe("docJSONHasNoteCallout / docJSONIsEmpty", () => {
  const withNote: DocJSON = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Visible." }] },
      { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "Hidden." }] }] },
    ],
  };
  const withoutNote: DocJSON = {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "Just text." }] }],
  };
  const empty: DocJSON = { type: "doc", content: [{ type: "paragraph" }] };

  it("detects a blockquote node anywhere in the tree", () => {
    expect(docJSONHasNoteCallout(withNote)).toBe(true);
    expect(docJSONHasNoteCallout(withoutNote)).toBe(false);
  });

  it("treats a doc with no text content as empty", () => {
    expect(docJSONIsEmpty(empty)).toBe(true);
    expect(docJSONIsEmpty(withoutNote)).toBe(false);
  });
});

describe("blockContentHasNoteCallout (dual-format dispatch)", () => {
  it("detects a Note callout in legacy markdown content", () => {
    expect(blockContentHasNoteCallout("> **Note:** secret")).toBe(true);
    expect(blockContentHasNoteCallout("Just a paragraph.")).toBe(false);
  });

  it("detects a Note callout in JSON-format content", () => {
    const withNote: DocJSON = {
      type: "doc",
      content: [{ type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "secret" }] }] }],
    };
    const withoutNote: DocJSON = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }] };
    expect(blockContentHasNoteCallout(JSON.stringify(withNote))).toBe(true);
    expect(blockContentHasNoteCallout(JSON.stringify(withoutNote))).toBe(false);
  });
});

describe("renderBlockContent (dual-format dispatch)", () => {
  it("renders legacy markdown and JSON content through the same call", () => {
    const legacy = renderToStaticMarkup(renderBlockContent("# Heading"));
    expect(legacy).toContain("<h1");

    const doc: DocJSON = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }] };
    const modern = renderToStaticMarkup(renderBlockContent(JSON.stringify(doc)));
    expect(modern).toContain("hi");
  });
});

describe("filterNoteBlocks with JSON-format blocks", () => {
  it("drops a JSON-format block containing a Note callout, keeps a plain one", () => {
    const withNote: DocJSON = {
      type: "doc",
      content: [{ type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "secret" }] }] }],
    };
    const blocks = [textBlock("a", JSON.stringify(withNote)), textBlock("b", "Just a normal paragraph.")];
    expect(filterNoteBlocks(blocks).map((b) => b.id)).toEqual(["b"]);
  });
});
