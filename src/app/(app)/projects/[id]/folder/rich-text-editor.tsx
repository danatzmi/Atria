"use client";

import { useEffect } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import { TextStyle, Color, FontFamily, FontSize } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import { Markdown } from "tiptap-markdown";
import insertPlugin from "markdown-it-ins";
import { tryParseDocJSON } from "@/lib/doc-content";

// Only needed to LOAD legacy content: blocks saved before this editor
// existed store markdown text (content.tsx / markdown.tsx's hand-rolled
// renderer), and that markdown used ++text++ as a private underline
// convention (CommonMark's __text__ collides with bold — see markdown.tsx).
// New saves go out as ProseMirror JSON (rich-text-editor.tsx's onUpdate),
// which needs no markdown round-trip at all, so this is parse-only now.
const LegacyUnderline = Underline.extend({
  addStorage() {
    return {
      markdown: {
        parse: {
          setup(md: Parameters<typeof insertPlugin>[0] & { __atriaInsRegistered?: boolean }) {
            if (md.__atriaInsRegistered) return;
            md.use(insertPlugin);
            md.renderer.rules.ins_open = () => "<u>";
            md.renderer.rules.ins_close = () => "</u>";
            md.__atriaInsRegistered = true;
          },
        },
      },
    };
  },
});

// Custom table cells carrying an optional background color — Word-style
// "cell shading", which neither @tiptap/extension-table nor markdown has
// any built-in notion of.
const ShadedTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (el: HTMLElement) => el.style.backgroundColor || null,
        renderHTML: (attrs: { backgroundColor?: string | null }) =>
          attrs.backgroundColor ? { style: `background-color: ${attrs.backgroundColor}` } : {},
      },
    };
  },
});
const ShadedTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (el: HTMLElement) => el.style.backgroundColor || null,
        renderHTML: (attrs: { backgroundColor?: string | null }) =>
          attrs.backgroundColor ? { style: `background-color: ${attrs.backgroundColor}` } : {},
      },
    };
  },
});

// Heading levels 1-4 — level 4 is the ribbon's "Subtitle" style (see
// doc-content.tsx's HEADING_CLASS). Strike/horizontalRule/link are all
// standard node/marks now enabled (link swapped for the standalone
// extension below so link-clicking-while-editing can be disabled).
const extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3, 4] },
    underline: false,
    link: false,
  }),
  LegacyUnderline,
  Table.configure({ resizable: false }),
  TableRow,
  ShadedTableHeader,
  ShadedTableCell,
  TextStyle,
  Color,
  FontFamily,
  FontSize,
  Highlight.configure({ multicolor: true }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  Link.configure({ openOnClick: false, autolink: false, HTMLAttributes: { rel: "noopener noreferrer" } }),
  TaskList,
  TaskItem.configure({ nested: true }),
  Markdown.configure({
    html: false,
    tightLists: true,
    bulletListMarker: "-",
  }),
];

export function useRichTextEditor({
  content,
  onChange,
  autofocus,
}: {
  content: string;
  onChange: (content: string) => void;
  autofocus?: boolean;
}) {
  const editor = useEditor({
    extensions,
    // JSON content loads natively (no markdown round-trip); a plain string
    // falls through to the Markdown extension's parser for legacy blocks.
    content: tryParseDocJSON(content) ?? content,
    autofocus: autofocus ? "end" : false,
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        // Text size/family intentionally NOT set here — they inherit from
        // whichever wrapper the caller renders this in.
        class: "min-h-[10rem] px-3 py-2 text-stone-700 focus:outline-none",
      },
    },
    onUpdate({ editor }) {
      onChange(JSON.stringify(editor.getJSON()));
    },
  });

  useEffect(() => {
    return () => editor?.destroy();
  }, [editor]);

  return editor;
}

function ToolbarButton({
  label,
  title,
  active,
  disabled,
  onClick,
}: {
  label: string;
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      // Keep the editor's selection alive through the click.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-7 min-w-7 items-center justify-center rounded px-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? "bg-zinc-800 text-white" : "text-zinc-600 hover:bg-zinc-200"
      }`}
    >
      {label}
    </button>
  );
}

function ToolbarSelect({
  title,
  value,
  onChange,
  options,
}: {
  title: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      title={title}
      value={value}
      onMouseDown={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value)}
      className="h-7 rounded border border-zinc-300 bg-white px-1 text-xs text-zinc-700"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function ColorSwatch({
  color,
  title,
  active,
  onClick,
}: {
  color: string | null;
  title: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`h-6 w-6 shrink-0 rounded border transition-transform ${
        active ? "scale-110 border-zinc-900" : "border-zinc-300 hover:scale-105"
      }`}
      style={{ backgroundColor: color ?? "white" }}
    >
      {!color && <span className="block text-[9px] leading-none text-zinc-400">✕</span>}
    </button>
  );
}

const TEXT_COLORS = [
  { label: "Default", value: null },
  { label: "Red", value: "#dc2626" },
  { label: "Blue", value: "#2563eb" },
  { label: "Green", value: "#16a34a" },
  { label: "Purple", value: "#9333ea" },
];

const HIGHLIGHT_COLORS = [
  { label: "Yellow", value: "#fef08a" },
  { label: "Amber", value: "#fde68a" },
  { label: "Green", value: "#bbf7d0" },
  { label: "Blue", value: "#bfdbfe" },
];

function Divider() {
  return <div className="mx-1 h-5 w-px shrink-0 bg-zinc-300" />;
}

function headingSelectValue(editor: Editor): string {
  if (editor.isActive("heading", { level: 1 })) return "h1";
  if (editor.isActive("heading", { level: 2 })) return "h2";
  if (editor.isActive("heading", { level: 3 })) return "h3";
  if (editor.isActive("heading", { level: 4 })) return "subtitle";
  return "p";
}

// Visual formatting ribbon for the WYSIWYG editor — every control is a
// direct TipTap command, so nothing here ever inserts literal markdown or
// HTML characters; the user only ever sees the formatted result.
export function RichTextToolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;

  const inTable = editor.isActive("table");
  const textStyleAttrs = editor.getAttributes("textStyle") as {
    color?: string;
    fontFamily?: string;
    fontSize?: string;
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-t-md border border-b-0 border-zinc-300 bg-zinc-50 p-1.5">
      <ToolbarSelect
        title="Text style"
        value={headingSelectValue(editor)}
        onChange={(v) => {
          const chain = editor.chain().focus();
          if (v === "p") chain.setParagraph().run();
          else if (v === "h1") chain.toggleHeading({ level: 1 }).run();
          else if (v === "h2") chain.toggleHeading({ level: 2 }).run();
          else if (v === "h3") chain.toggleHeading({ level: 3 }).run();
          else if (v === "subtitle") chain.toggleHeading({ level: 4 }).run();
        }}
        options={[
          { value: "p", label: "Paragraph" },
          { value: "h1", label: "Heading 1" },
          { value: "h2", label: "Heading 2" },
          { value: "h3", label: "Heading 3" },
          { value: "subtitle", label: "Subtitle" },
        ]}
      />
      <ToolbarSelect
        title="Font family"
        value={textStyleAttrs.fontFamily ?? "default"}
        onChange={(v) => {
          if (v === "default") editor.chain().focus().unsetFontFamily().run();
          else editor.chain().focus().setFontFamily(v).run();
        }}
        options={[
          { value: "default", label: "Modern Sans" },
          { value: "serif", label: "Editorial Serif" },
          { value: "monospace", label: "Technical Mono" },
        ]}
      />
      <ToolbarSelect
        title="Font size"
        value={textStyleAttrs.fontSize ?? "16px"}
        onChange={(v) => editor.chain().focus().setFontSize(v).run()}
        options={[
          { value: "12px", label: "12" },
          { value: "14px", label: "14" },
          { value: "16px", label: "16" },
          { value: "18px", label: "18" },
          { value: "24px", label: "24" },
        ]}
      />

      <Divider />

      <ToolbarButton label="B" title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} />
      <ToolbarButton label="I" title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} />
      <ToolbarButton label="U" title="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} />
      <ToolbarButton label="S" title="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} />
      <ToolbarButton label="</>" title="Code" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()} />

      <Divider />

      <div className="flex items-center gap-1" title="Text color">
        {TEXT_COLORS.map((c) => (
          <ColorSwatch
            key={c.label}
            color={c.value}
            title={c.label}
            active={c.value ? textStyleAttrs.color === c.value : !textStyleAttrs.color}
            onClick={() =>
              c.value
                ? editor.chain().focus().setColor(c.value).run()
                : editor.chain().focus().unsetColor().run()
            }
          />
        ))}
      </div>

      <Divider />

      <div className="flex items-center gap-1" title="Highlight">
        <ColorSwatch color={null} title="No highlight" active={!editor.isActive("highlight")} onClick={() => editor.chain().focus().unsetHighlight().run()} />
        {HIGHLIGHT_COLORS.map((c) => (
          <ColorSwatch
            key={c.label}
            color={c.value}
            title={c.label}
            active={editor.isActive("highlight", { color: c.value })}
            onClick={() => editor.chain().focus().toggleHighlight({ color: c.value }).run()}
          />
        ))}
      </div>

      <Divider />

      <ToolbarButton label="⟸" title="Align left" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} />
      <ToolbarButton label="⟺" title="Align center" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} />
      <ToolbarButton label="⟹" title="Align right" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} />
      <ToolbarButton label="☰" title="Justify" active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()} />

      <Divider />

      <ToolbarButton label="•" title="Bulleted list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} />
      <ToolbarButton label="1." title="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
      <ToolbarButton label="☑" title="Checklist" active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()} />

      <Divider />

      <ToolbarButton
        label="🔗"
        title="Link"
        active={editor.isActive("link")}
        onClick={() => {
          if (editor.isActive("link")) {
            editor.chain().focus().unsetLink().run();
            return;
          }
          const url = window.prompt("Link URL");
          if (url) editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
        }}
      />
      <ToolbarButton label="―" title="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()} />
      <ToolbarButton label="📝" title="Note callout" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
      {!inTable ? (
        <ToolbarButton label="⊞" title="Insert table" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} />
      ) : (
        <>
          <Divider />
          <span className="px-1 text-[10px] font-medium uppercase tracking-wide text-zinc-400">Table</span>
          <ToolbarButton label="+Row" title="Add row below" onClick={() => editor.chain().focus().addRowAfter().run()} />
          <ToolbarButton label="−Row" title="Delete row" onClick={() => editor.chain().focus().deleteRow().run()} />
          <ToolbarButton label="+Col" title="Add column after" onClick={() => editor.chain().focus().addColumnAfter().run()} />
          <ToolbarButton label="−Col" title="Delete column" onClick={() => editor.chain().focus().deleteColumn().run()} />
          <ToolbarButton label="Hdr" title="Toggle header row" active={editor.isActive("tableHeader")} onClick={() => editor.chain().focus().toggleHeaderRow().run()} />
          <div className="flex items-center gap-1" title="Cell shading">
            <ColorSwatch
              color={null}
              title="Clear shading"
              active={false}
              onClick={() =>
                editor.chain().focus().updateAttributes("tableCell", { backgroundColor: null }).updateAttributes("tableHeader", { backgroundColor: null }).run()
              }
            />
            {HIGHLIGHT_COLORS.map((c) => (
              <ColorSwatch
                key={c.label}
                color={c.value}
                title={`Shade ${c.label}`}
                active={false}
                onClick={() =>
                  editor
                    .chain()
                    .focus()
                    .updateAttributes("tableCell", { backgroundColor: c.value })
                    .updateAttributes("tableHeader", { backgroundColor: c.value })
                    .run()
                }
              />
            ))}
          </div>
          <ToolbarButton label="⌫▦" title="Delete table" onClick={() => editor.chain().focus().deleteTable().run()} />
        </>
      )}
    </div>
  );
}

export function RichTextEditorSurface({ editor }: { editor: Editor | null }) {
  return (
    <div className="atria-editor rounded-b-md border border-zinc-300 bg-white shadow-sm">
      <EditorContent editor={editor} />
    </div>
  );
}
