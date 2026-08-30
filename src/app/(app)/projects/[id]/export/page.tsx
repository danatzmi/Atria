import type { ElementType } from "react";
import Link from "next/link";
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
@media print {
  .export-cover-page { page-break-after: always; break-after: page; }
  .export-top-tab { page-break-before: always; break-before: page; }
  .export-section-title { page-break-after: avoid; break-after: avoid; }
  .export-avoid-break { page-break-inside: avoid; break-inside: avoid; }
}
`;

export default async function ExportPage(props: PageProps<"/projects/[id]/export">) {
  const { id } = await props.params;
  const { supabase, project } = await getProjectOrNotFound(id);

  const coverImageUrl = project.cover_image
    ? await createSignedUrl(supabase, project.cover_image)
    : null;

  const { tree, unsortedBlocks, imageUrls, fileUrls } = await getExportTree(supabase, id);

  return (
    <div className="mx-auto w-full max-w-3xl scroll-smooth px-8 py-14 print:max-w-none print:px-0 print:py-0">
      <style>{PRINT_PAGINATION_CSS}</style>

      <div className="flex items-center justify-between gap-4 print:hidden">
        <Link
          href={`/projects/${id}`}
          className="text-sm text-zinc-500 transition-colors hover:text-zinc-900"
        >
          ← Back to project
        </Link>
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
          {project.description && (
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-zinc-600">
              {project.description}
            </p>
          )}
        </div>

        {tree.length > 0 && (
          <nav className="mt-12 break-inside-avoid rounded-xl border border-zinc-200 px-8 py-7 print:border-0 print:px-0 print:py-0">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
              Contents
            </h2>
            <TableOfContents nodes={tree} />
          </nav>
        )}
      </div>

      <div className="mt-16 space-y-14 print:mt-0">
        {tree.map((node, i) => (
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

      {filterNoteBlocks(unsortedBlocks).length > 0 && (
        <div className="mt-14 break-inside-avoid border-t border-zinc-200 pt-10">
          <h2 className="export-section-title text-2xl font-semibold tracking-tight text-zinc-900">
            Unsorted
          </h2>
          <BlockList blocks={filterNoteBlocks(unsortedBlocks)} imageUrls={imageUrls} fileUrls={fileUrls} />
        </div>
      )}
    </div>
  );
}

function TableOfContents({ nodes }: { nodes: ExportNode[] }) {
  return (
    <ul className="mt-3 space-y-2">
      {nodes.map((node) => (
        <li key={node.id}>
          <a
            href={`#section-${node.id}`}
            className="text-[15px] text-zinc-600 transition-colors hover:text-zinc-900 hover:underline"
          >
            {node.name}
          </a>
          {node.children.length > 0 && (
            <div className="ml-4 mt-2 border-l border-zinc-200 pl-4">
              <TableOfContents nodes={node.children} />
            </div>
          )}
        </li>
      ))}
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
