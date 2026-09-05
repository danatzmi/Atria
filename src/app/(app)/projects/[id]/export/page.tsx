import type { ElementType } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createSignedUrl } from "@/lib/supabase/storage";
import { formatBytes, getFormatLabel } from "@/lib/files";
import { renderBlockContent, tryParseDocJSON } from "@/lib/doc-content";
import { getProjectOrNotFound } from "../data";
import { filterNoteBlocks, getExportTree, type BlockRow, type ExportNode } from "../folder/data";
import { PrintButton } from "./print-button";

// Both the modern Fragmentation-spec properties (break-after/break-before/
// break-inside) and their older page-break-* equivalents are set together —
// print engines vary in which one they actually honor.
const PRINT_PAGINATION_CSS = `
/* Explicit page margins so pagination is identical across browsers instead
   of inheriting each one's default. This is also the band the browser draws
   its URL/date headers into — the extra room keeps them off the content.
   (Chrome only lets the user switch those off; a page can't suppress them.) */
@page { margin: 16mm 14mm; }
@media print {
  .export-cover-page { page-break-after: always; break-after: page; }
  .export-top-tab { page-break-before: always; break-before: page; }
  .export-section-title { page-break-after: avoid; break-after: avoid; }
  .export-avoid-break { page-break-inside: avoid; break-inside: avoid; }
}
`;

// The browser derives the suggested "Save as PDF" filename from the
// document title, so this is what decides whether the user ends up with
// "TLV Apartment.pdf" or a generic "Atria.pdf". A scoped export names its
// Tab too, so exporting two different Tabs doesn't produce two files with
// the same name. Deliberately two small indexed lookups rather than
// reusing getExportTree — metadata runs alongside the page render, and
// this only needs names.
export async function generateMetadata(
  props: PageProps<"/projects/[id]/export">
): Promise<Metadata> {
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("id", id)
    .single();

  // RLS hides other people's projects, so a missing row here just means the
  // page itself is about to 404 — no need to leak anything in the title.
  if (!project) return { title: "Export" };

  const tabParam = typeof searchParams.tab === "string" ? searchParams.tab : null;
  let scope: string | null = null;
  if (tabParam === "unsorted") {
    scope = "Unsorted";
  } else if (tabParam) {
    const { data: folder } = await supabase
      .from("folders")
      .select("name")
      .eq("id", tabParam)
      .single();
    scope = folder?.name ?? null;
  }

  return { title: scope ? `${project.name} — ${scope}` : project.name };
}

// Depth-first lookup so ?tab= can scope the export to a Sub-tab as well as
// a top-level Tab.
function findNode(nodes: ExportNode[], id: string): ExportNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(node.children, id);
    if (found) return found;
  }
  return null;
}

export default async function ExportPage(props: PageProps<"/projects/[id]/export">) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const tabParam = typeof searchParams.tab === "string" ? searchParams.tab : null;
  const { supabase, project } = await getProjectOrNotFound(id);

  const coverImageUrl = project.cover_image
    ? await createSignedUrl(supabase, project.cover_image)
    : null;

  const { tree, unsortedBlocks, imageUrls, fileUrls } = await getExportTree(supabase, id);

  // ?tab= scopes the export to one tab (and everything nested inside it);
  // no param exports the whole binder. An unrecognised id — e.g. a tab
  // deleted between opening the workspace and hitting Export — falls back
  // to the full export rather than rendering an empty document.
  const scopedNode = tabParam && tabParam !== "unsorted" ? findNode(tree, tabParam) : null;
  const exportsUnsortedOnly = tabParam === "unsorted";
  const exportTree = exportsUnsortedOnly ? [] : scopedNode ? [scopedNode] : tree;
  const exportUnsorted =
    exportsUnsortedOnly || !scopedNode ? unsortedBlocks : [];
  const scopeName = exportsUnsortedOnly ? "Unsorted" : (scopedNode?.name ?? null);

  return (
    <div className="mx-auto w-full max-w-3xl scroll-smooth px-8 py-14 print:max-w-none print:px-0 print:py-0">
      <style>{PRINT_PAGINATION_CSS}</style>

      {/* Auto-print trigger. Waits for `load` so every signed-URL <img> has
          decoded — printing earlier yields a PDF with blank frames.

          Two rules this script must not break, both learned the hard way:
          1. Never print while the document is still parsing. window.print()
             is modal and blocks the main thread, so firing early freezes the
             page mid-build and leaves a blank tab titled "Untitled".
          2. Never depend solely on `load`. One stalled or 404'd image means
             `load` never fires and the export silently never prints — hence
             the backstop, which is itself gated on the document being
             parsed so it can't reintroduce rule 1.

          Assigning __atriaAutoPrint tells PrintButton's fallback to stand
          down, so the two paths can never open two dialogs. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              var printed = false;
              function doPrint() {
                if (printed) return;
                printed = true;
                window.print();
              }
              function ready() { setTimeout(doPrint, 200); }
              if (document.readyState === 'complete') {
                ready();
              } else {
                window.addEventListener('load', ready, { once: true });
              }
              setTimeout(function() {
                if (document.readyState === 'loading') {
                  document.addEventListener('DOMContentLoaded', doPrint, { once: true });
                } else {
                  doPrint();
                }
              }, 10000);
              window.__atriaAutoPrint = doPrint;
            })();
          `,
        }}
      />

      <div className="flex items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <Link
            href={`/projects/${id}`}
            className="text-sm text-zinc-500 transition-colors hover:text-zinc-900"
          >
            ← Back to project
          </Link>
          {/* Opened from inside a Tab, this document only covers that Tab —
              offer the way out without going back and reopening Export. */}
          {scopeName && (
            <Link
              href={`/projects/${id}/export`}
              className="text-xs text-zinc-500 underline transition-colors hover:text-zinc-900"
            >
              Export entire project
            </Link>
          )}
        </div>
        <PrintButton />
      </div>

      <div className="export-cover-page">
        <div className="mt-8 break-inside-avoid print:mt-0">
          {coverImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverImageUrl}
              alt=""
              className="aspect-[3/1] w-full rounded-xl object-cover print:rounded-none"
            />
          )}
          <h1 className="mt-8 text-4xl font-semibold tracking-tight text-zinc-900">
            {project.name}
          </h1>
          {/* Says plainly which slice of the binder this document covers,
              so a single-tab PDF isn't mistaken for the whole project. */}
          {scopeName && (
            <p className="mt-2 text-sm font-medium uppercase tracking-wider text-zinc-400">
              {scopeName}
            </p>
          )}
          {project.description && (
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-zinc-600">
              {project.description}
            </p>
          )}
        </div>

        {exportTree.length > 0 && (
          <nav className="mt-12 break-inside-avoid rounded-xl border border-zinc-200 px-8 py-7 print:border-0 print:px-0 print:py-0">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
              Contents
            </h2>
            <TableOfContents nodes={exportTree} />
          </nav>
        )}
      </div>

      <div className="mt-16 space-y-14 print:mt-0">
        {exportTree.map((node, i) => (
          <ExportSection
            key={node.id}
            node={node}
            index={`${i + 1}`}
            depth={0}
            isFirst={i === 0}
            imageUrls={imageUrls}
            fileUrls={fileUrls}
          />
        ))}
      </div>

      {filterNoteBlocks(exportUnsorted).length > 0 && (
        <div className="mt-14 break-inside-avoid border-t border-zinc-200 pt-10">
          <h2 className="export-section-title text-2xl font-semibold tracking-tight text-zinc-900">
            Unsorted
          </h2>
          <BlockList blocks={filterNoteBlocks(exportUnsorted)} imageUrls={imageUrls} fileUrls={fileUrls} />
        </div>
      )}
    </div>
  );
}

// `prefix` is the parent's number, so a child renders "1.2" and a
// grandchild "1.2.3". Built with the same `${index}.${i + 1}` rule
// ExportSection uses, and both start numbering at 1 from the same
// `exportTree` — so a TOC entry always matches the heading it links to,
// including in a ?tab=-scoped export where the tree has a single root.
function TableOfContents({
  nodes,
  prefix,
}: {
  nodes: ExportNode[];
  prefix?: string;
}) {
  return (
    <ul className="mt-3 space-y-2">
      {nodes.map((node, i) => {
        const index = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
        return (
          <li key={node.id}>
            <a
              href={`#section-${node.id}`}
              className="text-[15px] text-zinc-600 transition-colors hover:text-zinc-900 hover:underline"
            >
              <span className="mr-2 text-zinc-400">{index}</span>
              {node.name}
            </a>
            {node.children.length > 0 && (
              <div className="ml-4 mt-2 border-l border-zinc-200 pl-4">
                <TableOfContents nodes={node.children} prefix={index} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

const HEADING_SIZES = ["text-3xl", "text-2xl", "text-xl", "text-lg"];

function ExportSection({
  node,
  index,
  depth,
  isFirst,
  imageUrls,
  fileUrls,
}: {
  node: ExportNode;
  index: string;
  depth: number;
  isFirst?: boolean;
  imageUrls: Record<string, string>;
  fileUrls: Record<string, string>;
}) {
  const HeadingTag = `h${Math.min(depth + 2, 6)}` as ElementType;
  const blocks = filterNoteBlocks(node.blocks);
  const headingSize = HEADING_SIZES[Math.min(depth, HEADING_SIZES.length - 1)];

  return (
    <section
      id={`section-${node.id}`}
      className={`scroll-mt-6 break-inside-avoid ${depth === 0 ? "export-top-tab" : ""} ${
        depth === 0 && !isFirst ? "border-t border-zinc-200 pt-14 print:border-0 print:pt-0" : ""
      }`}
    >
      <HeadingTag className={`export-section-title ${headingSize} font-semibold tracking-tight text-zinc-900`}>
        <span className="mr-2 font-normal text-zinc-300">{index}</span>
        {node.name}
      </HeadingTag>

      {blocks.length > 0 && <BlockList blocks={blocks} imageUrls={imageUrls} fileUrls={fileUrls} />}

      {node.children.length > 0 && (
        <div className="mt-8 space-y-8" style={{ marginLeft: depth === 0 ? 0 : "1.5rem" }}>
          {node.children.map((child, i) => (
            <ExportSection
              key={child.id}
              node={child}
              index={`${index}.${i + 1}`}
              depth={depth + 1}
              imageUrls={imageUrls}
              fileUrls={fileUrls}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function BlockList({
  blocks,
  imageUrls,
  fileUrls,
}: {
  blocks: BlockRow[];
  imageUrls: Record<string, string>;
  fileUrls: Record<string, string>;
}) {
  const textBlocks = blocks.filter((b) => b.type === "text");
  const imageBlocks = blocks.filter((b) => b.type === "image" && b.file);
  const attachmentBlocks = blocks.filter((b) => (b.type === "file" || b.type === "video") && b.file);

  return (
    <div className="mt-5 space-y-6">
      {textBlocks.map((block) => {
        // Whole-block font/size only ever applies to legacy (markdown)
        // content — new content carries its own per-span font marks from
        // the ribbon, applied directly by renderBlockContent.
        const isLegacy = !tryParseDocJSON(block.content);
        return (
          <div
            key={block.id}
            className={`export-avoid-break break-inside-avoid ${
              isLegacy ? `${block.font_family === "serif" ? "font-serif" : ""} ${block.font_size === "large" ? "text-base" : "text-sm"}` : ""
            }`}
          >
            {renderBlockContent(block.content)}
          </div>
        );
      })}

      {imageBlocks.length > 0 && (
        // No break-inside-avoid on this wrapper: a section can have more
        // photos than fit on one page, and forcing "avoid" on a block taller
        // than a page just pushes it onto a fresh page and leaves a blank
        // gap on the one before it once the browser gives up on the hint
        // anyway. Each individual figure below keeps its own avoid so a
        // photo and its caption never split — that's the pairing that
        // actually matters.
        <div className="grid grid-cols-2 gap-6">
          {imageBlocks.map((block) => (
            <figure key={block.id} className="export-avoid-break break-inside-avoid">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrls[block.file!.storage_key]}
                alt=""
                className="aspect-[4/3] w-full rounded-lg border border-zinc-100 object-cover"
              />
              {block.content && (
                <figcaption className="mt-2 text-xs italic text-zinc-500">{block.content}</figcaption>
              )}
            </figure>
          ))}
        </div>
      )}

      {attachmentBlocks.length > 0 && (
        // Same reasoning as the photo grid above: no break-inside-avoid on
        // the table wrapper, since a long attachment list can legitimately
        // exceed a page — an unsatisfiable "avoid" there just produces a
        // blank gap. Letting the table paginate naturally also means the
        // <thead> repeats on each new page (standard print-engine table
        // behavior), which reads better than one giant unbroken register.
        // Each row keeps break-inside-avoid so a single attachment's cells
        // never split mid-row.
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              {/* break-after-avoid keeps the header from being orphaned alone
                  at the bottom of a page with no rows following it. */}
              <tr className="break-after-avoid">
                <th className="border-t border-b border-zinc-300 py-2 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Name
                </th>
                <th className="border-t border-b border-zinc-300 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Format
                </th>
                <th className="border-t border-b border-zinc-300 py-2 pl-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Size
                </th>
              </tr>
            </thead>
            <tbody>
              {attachmentBlocks.map((block) => {
                const url = fileUrls[block.file!.storage_key];
                return (
                  <tr key={block.id} className="export-avoid-break break-inside-avoid border-b border-zinc-100">
                    <td className="py-2.5 pr-3 text-zinc-700">
                      {url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 transition-colors hover:decoration-zinc-900 print:text-zinc-900"
                        >
                          {block.file!.name}
                        </a>
                      ) : (
                        block.file!.name
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-zinc-500">
                      {getFormatLabel(block.file!.mime_type, block.file!.name)}
                    </td>
                    <td className="py-2.5 pl-3 text-zinc-500">{formatBytes(block.file!.size_bytes)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
