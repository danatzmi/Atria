  ## 1. Product Vision & Core Metaphor
  • Product: Atria is a Digital Binder for real-world projects (interior design, renovations, weddings, architecture, creative productions).
  • Hierarchy: Workspace → Project (Binder) → Tabs (Dividers) & Sub-tabs (Recursive) → Linear Stream of Blocks.
  • Metaphor: A project opens like a physical binder. Content is organized into user-defined project units (Kitchen, Living Room, Contracts), which contain an
  ordered, scrollable stream of rich notes, photos, documents, and nested sub-tabs.
  ──────
  ## 2. MVP Scope & Explicit Non-Goals
  • In Scope:
      • Authentication (Email/Password via Supabase Auth).
      • Project Dashboard (/projects) & Project Cover/Header.
      • Interactive Digital Binder workspace (/projects/[id]).
      • Recursive vertical tabs and sub-tabs with arbitrary depth (01, 01.1, 01.1.1).
      • Jupyter/Notion-style linear block canvas:
          • Text Block: Word-grade WYSIWYG editor (Headings, Sans/Serif, Sizes, Colors, Highlights, Alignments, Checklists, Interactive Tables, Note Callouts).
          • File Block: Smart-rendered media (Photos with captions in auto-grouping grids, Video cards, Document rows with format badges).
          • Sub-tab Block: Inline vertical divider card expanding its own nested stream in-place.
      • In-tab recursive search (searches entire sub-tree and auto-expands matching ancestors).
      • View Mode vs. Edit Mode toggle ([ 👁️ View ] [ ✏️ Edit ] via ?mode=).
      • PDF Export (/projects/[id]/export): Publication-quality printable dossier with clickable Table of Contents and signed file links. Internal Note callouts
      are strictly excluded from the exported PDF.
  • Explicit Non-Goals: Task management, Kanban boards, Gantt charts, Chat, CRM, Invoicing/Payments, Complex collaboration/social feeds, AI engines.
  ──────
  ## 3. Technical Architecture & Stack
  • Framework: Next.js 16.3.3 (App Router, Turbopack, Server Actions enabled with bodySizeLimit: "10mb" in next.config.ts), React 19.2.8, TypeScript 5, Tailwind
  CSS 4.
  • Database & Auth: Supabase Postgres (Local Docker: 127.0.0.1:54322 / Studio: http://localhost:54323).
  • Object Storage: Supabase Storage bucket project-files. Uploads go direct from browser to storage via @supabase/ssr client; metadata is saved via
  createFileRecord.
  • Rich Text Engine: TipTap (@tiptap/react, @tiptap/starter-kit, @tiptap/extension-table, @tiptap/extension-underline, @tiptap/extension-text-align,
  @tiptap/extension-color, @tiptap/extension-highlight, @tiptap/extension-task-list) saving ProseMirror JSON trees directly in blocks.content.
  • Rendering & Fallback: src/lib/doc-content.tsx renders ProseMirror JSON directly to React VDOM with zero dangerouslySetInnerHTML, and automatically falls back
  to src/lib/markdown.tsx for legacy markdown blocks.
  • Testing: Vitest (vitest run), 61 tests currently passing.
  ──────
  ## 4. Repository Structure
    src/
    ├── app/
    │   ├── (auth)/login, signup, actions.ts
    │   ├── (app)/
    │   │   ├── projects/
    │   │   │   ├── page.tsx (Dashboard grid)
    │   │   │   ├── actions.ts (Project CRUD)
    │   │   │   └── [id]/
    │   │   │       ├── page.tsx (Binder view & View/Edit toggle)
    │   │   │       ├── binder-workspace.tsx (Top-level tab stack)
    │   │   │       ├── export/
    │   │   │       │   ├── page.tsx (Printable PDF dossier)
    │   │   │       │   └── print-button.tsx
    │   │   │       └── folder/
    │   │   │           ├── actions.ts (Block, folder, file server actions)
    │   │   │           ├── data.ts (Tree assembly, recursive search, count queries)
    │   │   │           ├── browser.tsx (Self-recursive notebook stream & DND)
    │   │   │           ├── divider-row.tsx (Physical divider card & drop zones)
    │   │   │           ├── block-form-dialog.tsx (Text & caption editor modal)
    │   │   │           ├── rich-text-editor.tsx (TipTap Word-grade ribbon editor)
    │   │   │           └── item-icon.tsx
    ├── lib/
    │   ├── doc-content.tsx (ProseMirror JSON tree renderer & note detector)
    │   ├── markdown.tsx (XSS-safe legacy markdown parser)
    │   ├── sort-order.ts (Fractional-index midpoint math)
    │   ├── files.ts (MIME classification, format badges, byte formatting)
    │   └── supabase/ (client.ts, server.ts, storage.ts)
    supabase/migrations/
    ├── 0001_init.sql (projects, folders, files tables, RLS, triggers)
    ├── 0002_blocks.sql (blocks table, RLS, boundary triggers, file backfill)
    ├── 0003_simplify_blocks.sql (unified heading into text blocks)
    ├── 0004_folder_sort_order.sql (sort_order on folders table)
    └── 0005_block_typography.sql (font_family & font_size on blocks)
    tests/ (61 tests covering auth, project CRUD, digital folder, blocks, markdown, doc-content, unified-stream)
  ──────
  ## 5. Database Schema & Data Model Decisions

  1. projects: (id, user_id, name, description, cover_image, created_at, updated_at)
  2. folders (Tabs & Sub-tabs): (id, project_id, parent_folder_id, name, sort_order, created_at, updated_at)
      • Top-level tabs have parent_folder_id IS NULL.
      • Sub-tabs have parent_folder_id pointing to the parent tab.
  3. files: (id, project_id, folder_id, name, mime_type, size_bytes, storage_key, thumbnail_key, created_at, updated_at)
  4. blocks: (id, project_id, section_id, type, content, file_id, sort_order, font_family, font_size, created_at, updated_at)
      • type ∈ ('text', 'image', 'file', 'video').
      • content stores ProseMirror JSON string (or legacy markdown).
      • sort_order is double precision using fractional-midpoint math (midpointSortOrder) so inserting between two blocks requires zero row renumbering.
  5. Ordering & Append:
      • Both folders and blocks share the same fractional sort_order space.
      • New tabs, sub-tabs, and blocks append to the bottom (max(sort_order) + 1).

  ──────
  ## 6. Security & Storage Architecture Decisions

  • Server-Side RLS: Every table enforces projects.user_id = auth.uid().
  • Project Boundary Triggers: PostgreSQL triggers (check_folder_parent_project, check_file_folder_project, check_block_section_project) enforce that child rows
  never reference parent rows from a different project.
  • Storage Protection: Path format is <user_id>/<project_id>/<file_id>/<filename>.
  • Cascade Cleanup: Deleting a project, folder, or file purges all associated objects from the project-files bucket in Supabase Storage.
  • Signed URLs: Files are private. Images/attachments receive pre-signed URLs batch-generated via createSignedUrls.
  ──────
  ## 7. Key Decisions Considered and Rejected

  • ❌ Fixed file-type pages (/photos, /videos, /documents, /folder): Rejected. Replaced by unified Digital Binder tabs where photos, videos, and documents live
  together in context.
  • ❌ Separate Sub-Tab Chip Bar: Rejected. Sub-tabs are insertable vertical divider blocks placed directly in the notebook stream.
  • ❌ Raw Markdown Textarea: Rejected. Non-technical users need a true Word-grade WYSIWYG editor without markdown code.
  • ❌ Puppeteer / Chromium Server-Side PDF: Rejected. Client/browser @media print route (/projects/[id]/export) provides pixel-perfect Tailwind typography, zero
  heavy binaries, and instant generation.
  • ❌ External Heavy Drag-and-Drop Libraries: Rejected. Clean native HTML5 drag-and-drop with fractional midpoint sorting avoids bundle bloat.
  ──────
  ## 8. Current Phase & Exact Next Steps

  ### Current State

  • Phases 1–5 (MVP feature set) complete. Word-grade editor, recursive tabs, View/Edit toggle, and paginated PDF export are fully built and tested.
  • **UI/UX Redesign complete** — the project workspace (`/projects/[id]`) moved from a single-column accordion stack of top-level Tabs to a persistent
      Two-Column Project Shell:
      • **Two-Column Shell**: a slim top nav bar (← Projects, title, View/Edit toggle, Export PDF, project Edit/Delete) replaced the old header's large
      cover banner; `binder-workspace.tsx` now renders a permanent left sidebar beside a Main Canvas instead of an accordion.
      • **Persistent Sidebar with Drag-and-Drop & Nesting** (new `project-sidebar.tsx`): an Overview item, a recursive Tab/Sub-tab tree (lazily
      self-fetching each node's children only when expanded, reusing `getTabContents`/`getTabCounts`), and the virtual Unsorted row. Every row is
      draggable and doubles as a drop target — dropping between siblings reorders (`moveFolderToParent` with a fractional `sort_order`, new server
      action in `folder/actions.ts`), dropping directly onto a row reparents the dragged Tab as that row's last child (same action, cycle-checked via
      `getFolderDescendantIds` so a Tab can never be dropped into its own subtree). Rename/Delete live inline per row (hover-revealed).
      • **Project Overview Canvas**: the Main Canvas's default view (no Tab selected) — cover banner, name, description, then either the calm
      "This is your project's home" invitation with a primary "+ Add Tab" action (zero Tabs) or an editorial grid of every top-level Tab (index, name,
      item count) that jumps straight into the canvas on click.
      • **Compact Tab Header** (`folder/browser.tsx`): when `FolderBrowser` is the canvas's root content (a `name` prop is passed — omitted for a
      nested Sub-tab, which still gets its header from its own `DividerRow`), it renders a slim header — dotted index + Tab name on the left, a search
      box + a new "+ Add" popover menu (Text Note / Upload File / Sub-tab) + Rename/Delete on the right — with a `border-b` drop line straight into the
      content stream below.
      • **Mobile Drawer** (`<768px`): a `[ ☰ Tabs ]` toggle in a mobile-only bar above the canvas opens `ProjectSidebar` as a slide-out drawer with a
      backdrop (one shared sidebar instance for both desktop and mobile — not a duplicate — so a node's expand state isn't lost across the
      breakpoint); selecting any Tab or Overview in the drawer navigates and closes it. Canvas padding scales `p-4 sm:p-6 md:p-8`, and the compact tab
      header wraps its search/action cluster onto its own row below 640px.
  • Milestone 5.1 (Block Drag-and-Drop Polish) complete:
      • Grip handle event suppression fix: `<button draggable>` → `<div role="button" draggable>` — WebKit/Chromium intercept mousedown on native
      buttons for press-state handling, which swallowed `dragstart` before a real mouse drag could start.
      • `dragleave` child-bubbling guard (`e.currentTarget.contains(e.relatedTarget)`) on every drop target — without it, moving the cursor over a
      nested button/icon/caption fired `dragleave` on the parent and flickered the drop indicator off mid-drag.
      • Draggable card bodies (not just the grip) on Photo, Video, and Document blocks, paired with full-height `w-8` grip handles; Text blocks keep
      grip-only dragging so the card stays a normal click/select/edit surface.
      • Crisp `h-0.5 bg-stone-600` drop indicators, with `dropEffect`/`effectAllowed` explicitly set to `"move"` on all drag events.
  • PDF export print layout reviewed and refined: break-inside-avoid moved off the oversized photo-grid/attachment-table wrapper divs onto their
      individual items (figure/row) so a long list doesn't force a blank-page gap; attachment table header gets break-after-avoid so it isn't orphaned
      alone at a page bottom. Note-callout exclusion re-verified airtight (recursive walk catches a blockquote at any depth, both legacy-markdown and
      ProseMirror-JSON). Real paginated print-preview verification across Chrome/Safari still needs a human — the native print dialog isn't reachable
      by browser automation in this environment.
  • Milestone 5.2 (Responsive Layout & Empty States) complete:
      • Header wrapping & title truncation protection on /projects/[id]: the title/description block and the View/Edit toggle + action-icon cluster
      now wrap (`flex-wrap` + `min-w-0`) instead of overflowing when a long project name meets the full action cluster on a narrow screen.
      • Mobile document row badge collapse: DocumentBlockRow's format badge and byte-size are `hidden ... sm:inline-block`/`sm:inline` below 640px —
      previously these fixed-width siblings could squeeze the filename to nothing (or overflow) on a narrow screen since only the filename was flexible.
      • Editorial project empty state on binder-workspace.tsx: a project with zero tabs previously showed nothing but a bare "+ Add Tab" button (and
      nothing at all in View Mode) — added a calm headline + one-line explanation above it, matching the tone of the tab-level and dashboard-level
      empty states.
  • End-to-End MVP Audit complete — **Phase 5 (Polish & Production Hardening) is done.** Walked the full lifecycle on a disposable test project
      (deleted afterward; both real projects — "TLV Apartment" and "tali test" — untouched throughout), confirming every step works end to end:
      project creation with cover image → Tab creation (index/count correct) → Word-grade rich text note (heading, bold, italic, bulleted list) →
      image upload with caption + document upload with a working signed "View" link → recursive sub-tab (index `01.1`, expands in place, count
      bubbles to its parent) → drag-and-drop reorder of both a sub-tab divider and a document row, persisted across reload → in-tab recursive
      search with ancestor auto-expansion → View Mode toggle cleanly hiding every grip/insert-bar/edit affordance → PDF export (TOC, headings,
      photo grid, attachment register, Note-callout exclusion all correct) → project deletion, with storage-bucket cleanup confirmed directly in
      Supabase Studio (the project's storage folder verified present before deletion and completely gone after, alongside the two real projects'
      folders, which were untouched).
  • All 66 automated tests pass.

  ### Immediate Next Tasks for the Next Session

  1. Manually verify PDF export pagination in real Chrome and Safari print previews (see above — outside what automation can check here).
  2. The Mobile Drawer (UI/UX Redesign, above) was live-verified this session at both a phone width (390×844) and a desktop width (1024×700) with
      real interaction — drawer open/close, tab selection, and the compact tab header's wrap-to-two-rows all confirmed working. `resize_window`
      still doesn't change the tab's actual rendered viewport in this environment; the workaround that worked is embedding the page in a same-origin
      `<iframe>` sized to the target viewport (Tailwind's breakpoints respond to the iframe's own dimensions) and driving it via
      `iframe.contentDocument`/`contentWindow`. Worth reusing for the still-unverified Milestone 5.2 fixes and any future responsive work.

  ──────
  ## 9. Critical Warnings for the Reviewer

  1. ⚠️ NEVER run npx supabase db reset:
       • It will wipe real user test data in the local database. Always use npx supabase migration up --local.
  2. ⚠️ Never leak Note callouts to PDF Export:
       • filterNoteBlocks in src/app/(app)/projects/[id]/folder/data.ts must always drop any block containing a > Note callout or blockquote from
      /projects/[id]/export.
  3. ⚠️ Maintain RLS and Storage Cascades:
       • All mutations must use the session-scoped client in Server Actions, and file deletions must clean up storage objects.
  4. ⚠️ Vitest Flake Mitigation:
       • When running tests, if a transient JWT issued at future clock skew error occurs, run npx vitest run --no-file-parallelism or re-run.
