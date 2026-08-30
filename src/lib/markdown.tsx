import type { ReactNode } from "react";

export function NoteCalloutIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.25v3.25H9a.75.75 0 0 0 0 1.5h2.5a.75.75 0 0 0 0-1.5h-.25V9.75A.75.75 0 0 0 10.5 9H9Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// A small, hand-rolled renderer for exactly the markdown subset the block
// formatting toolbar produces — not a general CommonMark implementation.
// Builds React elements directly (no dangerouslySetInnerHTML), so there's no
// HTML-injection surface to worry about.
//
// Supported: # / ## headings, **bold**, *italic*, ++underline++, `code`,
// "- "/"* " bullet lists, "1. " numbered lists, and pipe tables with a
// "| --- |" separator row. Underline has no standard markdown syntax, so
// ++text++ is this app's own convention — chosen specifically because
// CommonMark treats __text__ as an alternate bold syntax (identical to
// **text**), which the WYSIWYG editor's markdown round-trip (tiptap-markdown
// + markdown-it) would parse as bold, silently losing the underline on the
// very next edit. ++ has no built-in CommonMark meaning, so there's no
// ambiguity in either direction.

// Exported so callers that need to detect (not render) a Note callout line —
// namely the export/print route's note-filtering — use the exact same
// pattern the renderer does, and the two can never drift apart.
export const NOTE_LINE_PATTERN = /^>\s?/;

type Line =
  | { kind: "h1"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "quote"; text: string }
  | { kind: "bullet"; text: string }
  | { kind: "number"; text: string }
  | { kind: "table-row"; cells: string[] }
  | { kind: "table-sep" }
  | { kind: "blank" }
  | { kind: "paragraph"; text: string };

function classifyLine(raw: string): Line {
  if (raw.trim() === "") return { kind: "blank" };
  if (raw.startsWith("## ")) return { kind: "h2", text: raw.slice(3) };
  if (raw.startsWith("# ")) return { kind: "h1", text: raw.slice(2) };
  if (NOTE_LINE_PATTERN.test(raw)) return { kind: "quote", text: raw.replace(NOTE_LINE_PATTERN, "") };
  if (/^[-*]\s+/.test(raw)) return { kind: "bullet", text: raw.replace(/^[-*]\s+/, "") };
  if (/^\d+\.\s+/.test(raw)) return { kind: "number", text: raw.replace(/^\d+\.\s+/, "") };

  const trimmed = raw.trim();
  if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
    const cells = trimmed
      .slice(1, -1)
      .split("|")
      .map((c) => c.trim());
    if (cells.every((c) => /^:?-{2,}:?$/.test(c))) return { kind: "table-sep" };
    return { kind: "table-row", cells };
  }

  return { kind: "paragraph", text: raw };
}

// Inline spans: **bold**, *italic*, ++underline++, `code`.
const INLINE_PATTERN = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(\+\+(.+?)\+\+)|(`(.+?)`)/g;

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const match of text.matchAll(INLINE_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) nodes.push(text.slice(lastIndex, index));

    if (match[1]) nodes.push(<strong key={key++}>{match[2]}</strong>);
    else if (match[3]) nodes.push(<em key={key++}>{match[4]}</em>);
    else if (match[5]) nodes.push(<u key={key++}>{match[6]}</u>);
    else if (match[7])
      nodes.push(
        <code key={key++} className="rounded bg-stone-100 px-1 py-0.5 text-[0.85em]">
          {match[8]}
        </code>
      );

    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

export function renderMarkdown(content: string): ReactNode {
  const rawLines = content.split("\n").map(classifyLine);
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < rawLines.length) {
    const line = rawLines[i];

    if (line.kind === "blank") {
      i++;
      continue;
    }

    if (line.kind === "h1") {
      blocks.push(
        <h1 key={key++} className="text-xl font-semibold tracking-tight text-stone-900">
          {renderInline(line.text)}
        </h1>
      );
      i++;
      continue;
    }

    if (line.kind === "h2") {
      blocks.push(
        <h2 key={key++} className="text-lg font-semibold tracking-tight text-stone-900">
          {renderInline(line.text)}
        </h2>
      );
      i++;
      continue;
    }

    if (line.kind === "quote") {
      const quoteLines: string[] = [];
      while (i < rawLines.length && rawLines[i].kind === "quote") {
        quoteLines.push((rawLines[i] as { text: string }).text);
        i++;
      }
      blocks.push(
        <div
          key={key++}
          className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3"
        >
          <NoteCalloutIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div className="space-y-1">
            {quoteLines.map((l, idx) => (
              <p key={idx} className="leading-relaxed text-amber-900">
                {renderInline(l)}
              </p>
            ))}
          </div>
        </div>
      );
      continue;
    }

    if (line.kind === "bullet") {
      const items: ReactNode[] = [];
      while (i < rawLines.length && rawLines[i].kind === "bullet") {
        items.push(<li key={items.length}>{renderInline((rawLines[i] as { text: string }).text)}</li>);
        i++;
      }
      blocks.push(
        <ul key={key++} className="list-disc space-y-1 pl-5">
          {items}
        </ul>
      );
      continue;
    }

    if (line.kind === "number") {
      const items: ReactNode[] = [];
      while (i < rawLines.length && rawLines[i].kind === "number") {
        items.push(<li key={items.length}>{renderInline((rawLines[i] as { text: string }).text)}</li>);
        i++;
      }
      blocks.push(
        <ol key={key++} className="list-decimal space-y-1 pl-5">
          {items}
        </ol>
      );
      continue;
    }

    if (line.kind === "table-row" && rawLines[i + 1]?.kind === "table-sep") {
      const header = line.cells;
      i += 2;
      const rows: string[][] = [];
      while (i < rawLines.length && rawLines[i].kind === "table-row") {
        rows.push((rawLines[i] as { cells: string[] }).cells);
        i++;
      }
      blocks.push(
        <div key={key++} className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {header.map((cell, c) => (
                  <th
                    key={c}
                    className="border-b border-stone-300 px-2 py-1 text-left font-semibold text-stone-700"
                  >
                    {renderInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c} className="border-b border-stone-100 px-2 py-1 text-stone-700">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Paragraph: consume consecutive plain-text lines as one block, joined
    // with line breaks (a blank line is what actually separates paragraphs).
    const paraLines: string[] = [];
    while (i < rawLines.length && rawLines[i].kind === "paragraph") {
      paraLines.push((rawLines[i] as { text: string }).text);
      i++;
    }
    blocks.push(
      <p key={key++} className="leading-relaxed">
        {paraLines.map((l, idx) => (
          <span key={idx}>
            {idx > 0 && <br />}
            {renderInline(l)}
          </span>
        ))}
      </p>
    );
  }

  // Text size is intentionally NOT set here — a caller wrapping this in a
  // div that sets text-base (the block's "Large" typography option) would
  // otherwise always lose to this div's own same-specificity text-sm.
  return <div className="space-y-2 text-stone-700">{blocks}</div>;
}
