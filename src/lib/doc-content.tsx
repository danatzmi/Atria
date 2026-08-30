import type { ElementType, ReactNode } from "react";
import { NOTE_LINE_PATTERN, NoteCalloutIcon, renderMarkdown } from "./markdown";

// A block's `content` column holds one of two formats:
//  - legacy markdown text (every block created before the WYSIWYG ribbon
//    upgrade — still rendered via markdown.tsx's hand-rolled renderer)
//  - ProseMirror JSON (everything the rich-text ribbon can now produce:
//    heading levels 1-4, font family/size/color, highlight, alignment,
//    checklists, tables with header/shading, dividers, links — none of
//    which have a clean, lossless markdown representation)
// Detecting which one a block has and dispatching to the right renderer
// keeps every pre-existing block rendering exactly as before, forever,
// while new/re-saved blocks get the richer JSON-native rendering.

export type DocMark = { type: string; attrs?: Record<string, unknown> };
export type DocNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  text?: string;
  marks?: DocMark[];
};
export type DocJSON = { type: "doc"; content?: DocNode[] };

export function tryParseDocJSON(content: string | null | undefined): DocJSON | null {
  if (!content) return null;
  const trimmed = content.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && parsed.type === "doc") {
      return parsed as DocJSON;
    }
  } catch {
    // Not JSON — legacy markdown content, handled by renderMarkdown instead.
  }
  return null;
}

function walkNodes(nodes: DocNode[] | undefined, predicate: (n: DocNode) => boolean): boolean {
  if (!nodes) return false;
  return nodes.some((n) => predicate(n) || walkNodes(n.content, predicate));
}

export function docJSONHasNoteCallout(doc: DocJSON): boolean {
  return walkNodes(doc.content, (n) => n.type === "blockquote");
}

export function docJSONIsEmpty(doc: DocJSON): boolean {
  function hasContent(nodes: DocNode[] | undefined): boolean {
    if (!nodes) return false;
    return nodes.some((n) => {
      if (n.type === "text" && n.text?.trim()) return true;
      if (n.type === "horizontalRule") return true;
      return hasContent(n.content);
    });
  }
  return !hasContent(doc.content);
}

// Used by the export/print route's note-filtering and by anywhere else
// that needs to detect (not render) a Note callout — dispatches by format
// so the two content types can never drift apart.
export function blockContentHasNoteCallout(content: string | null | undefined): boolean {
  if (!content) return false;
  const doc = tryParseDocJSON(content);
  if (doc) return docJSONHasNoteCallout(doc);
  return content.split("\n").some((line) => NOTE_LINE_PATTERN.test(line));
}

export function renderBlockContent(content: string | null | undefined): ReactNode {
  const doc = tryParseDocJSON(content);
  if (doc) return renderDocJSON(doc);
  return renderMarkdown(content ?? "");
}

const HEADING_CLASS: Record<number, string> = {
  1: "text-2xl font-semibold tracking-tight text-stone-900",
  2: "text-xl font-semibold tracking-tight text-stone-900",
  3: "text-lg font-semibold tracking-tight text-stone-900",
  // Level 4 is the ribbon's "Subtitle" style — smaller and lighter than a
  // heading, not a literal fourth heading rank.
  4: "text-base font-normal italic text-stone-500",
};

const ALIGN_CLASS: Record<string, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
  justify: "text-justify",
};

function alignClass(attrs: Record<string, unknown> | undefined): string {
  const align = attrs?.textAlign;
  return typeof align === "string" ? (ALIGN_CLASS[align] ?? "") : "";
}

function renderMarks(text: string, marks: DocMark[] | undefined, key: number): ReactNode {
  let node: ReactNode = text;
  const list = marks ?? [];

  for (const m of list) {
    if (m.type === "bold") node = <strong>{node}</strong>;
    else if (m.type === "italic") node = <em>{node}</em>;
    else if (m.type === "underline") node = <u>{node}</u>;
    else if (m.type === "strike") node = <s>{node}</s>;
    else if (m.type === "code")
      node = <code className="rounded bg-stone-100 px-1 py-0.5 text-[0.85em]">{node}</code>;
    else if (m.type === "highlight")
      node = (
        <mark className="rounded px-0.5" style={{ backgroundColor: String(m.attrs?.color ?? "#fef08a") }}>
          {node}
        </mark>
      );
  }

  const textStyle = list.find((m) => m.type === "textStyle");
  if (textStyle) {
    const attrs = textStyle.attrs ?? {};
    const style: Record<string, string> = {};
    if (typeof attrs.color === "string") style.color = attrs.color;
    if (typeof attrs.fontFamily === "string") style.fontFamily = attrs.fontFamily;
    if (typeof attrs.fontSize === "string") style.fontSize = attrs.fontSize;
    if (Object.keys(style).length > 0) {
      node = <span style={style}>{node}</span>;
    }
  }

  const link = list.find((m) => m.type === "link");
  if (link) {
    node = (
      <a
        href={String(link.attrs?.href ?? "#")}
        target="_blank"
        rel="noopener noreferrer"
        className="text-zinc-900 underline decoration-zinc-300 underline-offset-2 transition-colors hover:decoration-zinc-900"
      >
        {node}
      </a>
    );
  }

  return <span key={key}>{node}</span>;
}

function renderInline(nodes: DocNode[] | undefined): ReactNode[] {
  return (nodes ?? []).map((n, i) => {
    if (n.type === "text") return renderMarks(n.text ?? "", n.marks, i);
    if (n.type === "hardBreak") return <br key={i} />;
    return null;
  });
}

function renderNode(node: DocNode, key: number): ReactNode {
  switch (node.type) {
    case "paragraph":
      return (
        <p key={key} className={`leading-relaxed ${alignClass(node.attrs)}`}>
          {renderInline(node.content)}
        </p>
      );
    case "heading": {
      const level = Math.min(Math.max(Number(node.attrs?.level ?? 1), 1), 4);
      const Tag = `h${level}` as ElementType;
      return (
        <Tag key={key} className={`${HEADING_CLASS[level]} ${alignClass(node.attrs)}`}>
          {renderInline(node.content)}
        </Tag>
      );
    }
    case "bulletList":
      return (
        <ul key={key} className="list-disc space-y-1 pl-5">
          {(node.content ?? []).map((li, i) => renderNode(li, i))}
        </ul>
      );
    case "orderedList":
      return (
        <ol key={key} className="list-decimal space-y-1 pl-5">
          {(node.content ?? []).map((li, i) => renderNode(li, i))}
        </ol>
      );
    case "listItem":
      return <li key={key}>{(node.content ?? []).map((c, i) => renderNode(c, i))}</li>;
    case "taskList":
      return (
        <ul key={key} className="space-y-1.5">
          {(node.content ?? []).map((li, i) => renderNode(li, i))}
        </ul>
      );
    case "taskItem": {
      const checked = Boolean(node.attrs?.checked);
      return (
        <li key={key} className="flex list-none items-start gap-2">
          <input
            type="checkbox"
            checked={checked}
            readOnly
            className="mt-1 h-3.5 w-3.5 shrink-0 rounded border-stone-300 text-stone-700"
          />
          <span className={checked ? "text-stone-400 line-through" : ""}>
            {(node.content ?? []).map((c, i) => renderNode(c, i))}
          </span>
        </li>
      );
    }
    case "blockquote":
      return (
        <div key={key} className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
          <NoteCalloutIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div className="space-y-1 text-amber-900">
            {(node.content ?? []).map((c, i) => renderNode(c, i))}
          </div>
        </div>
      );
    case "horizontalRule":
      return <hr key={key} className="border-stone-200" />;
    case "table":
      return (
        <div key={key} className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <tbody>{(node.content ?? []).map((row, i) => renderNode(row, i))}</tbody>
          </table>
        </div>
      );
    case "tableRow":
      return <tr key={key}>{(node.content ?? []).map((c, i) => renderNode(c, i))}</tr>;
    case "tableCell":
    case "tableHeader": {
      const Tag = node.type === "tableHeader" ? "th" : "td";
      const bg = node.attrs?.backgroundColor;
      return (
        <Tag
          key={key}
          className={
            node.type === "tableHeader"
              ? "border border-stone-300 px-2 py-1 text-left align-top font-semibold text-stone-700"
              : "border border-stone-100 px-2 py-1 text-left align-top text-stone-700"
          }
          style={typeof bg === "string" ? { backgroundColor: bg } : undefined}
        >
          {(node.content ?? []).map((c, i) => renderNode(c, i))}
        </Tag>
      );
    }
    default:
      return null;
  }
}

export function renderDocJSON(doc: DocJSON): ReactNode {
  return <div className="space-y-2 text-stone-700">{(doc.content ?? []).map((n, i) => renderNode(n, i))}</div>;
}
