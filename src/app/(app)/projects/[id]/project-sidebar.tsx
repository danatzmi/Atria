"use client";

import { useEffect, useState, useTransition, type Dispatch, type SetStateAction } from "react";
import { getTabContents, moveFolderToParent } from "./folder/actions";
import { FolderFormDialog } from "./folder/folder-form-dialog";
import { RenameDialog } from "./folder/rename-dialog";
import { DeleteItemDialog } from "./folder/delete-item-dialog";
import { DividerDropZone } from "./folder/divider-row";
import { ChevronIcon, ChevronLeftIcon, CloseIcon } from "./folder/item-icon";
import { midpointSortOrder } from "@/lib/sort-order";
import { readDragPayload, setDragPayload, type DragPayload } from "@/lib/drag-payload";

export type SidebarTab = { id: string; name: string; sort_order: number };

// Mirrors the same virtual "unsorted" sentinel binder-workspace.tsx uses for
// the ?tab= URL param — not a real folder id.
export const UNSORTED = "unsorted";

// A cycling editorial palette for the sidebar's physical divider tabs — each
// top-level Tab gets one by its position (index % length); a Sub-tab
// inherits its parent's palette unchanged rather than getting its own (see
// SidebarTabList's paletteFor). Every field is a complete, literal Tailwind
// class name — never concatenate extra modifiers onto them at render time
// (e.g. `${bg}/60`), since Tailwind's build-time scanner only picks up
// classes that appear as whole tokens somewhere in source.
export const TAB_PALETTES = [
  {
    name: "blush",
    bg: "bg-rose-50/80",
    activeBg: "bg-rose-100",
    text: "text-rose-900",
    border: "border-rose-200",
    accent: "bg-rose-300",
  },
  {
    name: "lavender",
    bg: "bg-purple-50/80",
    activeBg: "bg-purple-100",
    text: "text-purple-900",
    border: "border-purple-200",
    accent: "bg-purple-300",
  },
  {
    name: "sage",
    bg: "bg-emerald-50/80",
    activeBg: "bg-emerald-100",
    text: "text-emerald-900",
    border: "border-emerald-200",
    accent: "bg-emerald-300",
  },
  {
    name: "butter",
    bg: "bg-amber-50/80",
    activeBg: "bg-amber-100",
    text: "text-amber-900",
    border: "border-amber-200",
    accent: "bg-amber-300",
  },
  {
    name: "peach",
    bg: "bg-orange-50/80",
    activeBg: "bg-orange-100",
    text: "text-orange-900",
    border: "border-orange-200",
    accent: "bg-orange-300",
  },
  {
    name: "sky",
    bg: "bg-sky-50/80",
    activeBg: "bg-sky-100",
    text: "text-sky-900",
    border: "border-sky-200",
    accent: "bg-sky-300",
  },
] as const;
export type TabPalette = (typeof TAB_PALETTES)[number];

// Shared drag state for the whole Tab tree — lifted to ProjectSidebar (the
// tree's root) and threaded down as one bundle, since a drop zone or a
// node's "nest under me" highlight at ANY depth needs to react to a drag
// that may have started at any OTHER depth.
type DragState = {
  draggingFolderId: string | null;
  setDraggingFolderId: Dispatch<SetStateAction<string | null>>;
  dragOverZoneKey: string | null;
  setDragOverZoneKey: Dispatch<SetStateAction<string | null>>;
  dragOverRowId: string | null;
  setDragOverRowId: Dispatch<SetStateAction<string | null>>;
};

// Presentational for the top-level Tab list (owned by binder-workspace's
// state, passed in as props); lazily self-fetches Sub-tab children only when
// a node is expanded, reusing the same getTabContents/getTabCounts calls
// binder-workspace already makes rather than inventing new server actions.
export function ProjectSidebar({
  projectId,
  tabs,
  tabCounts,
  subtabCounts,
  unsortedCount,
  activeTabId,
  editable,
  onNavigate,
  onChanged,
  mobileOpen,
  onCloseMobile,
  collapsed,
  onToggleCollapsed,
}: {
  projectId: string;
  tabs: SidebarTab[];
  tabCounts: Record<string, number>;
  // Sub-tab counts only (not blocks) — drives chevron vs. dot per row.
  subtabCounts: Record<string, number>;
  unsortedCount: number;
  activeTabId: string | null;
  editable: boolean;
  // name is the clicked node's own display name — threaded straight
  // through so the canvas header (browser.tsx) can show it immediately
  // without a lookup, since a Sub-tab's name isn't otherwise known outside
  // whichever node's lazily-fetched children list currently holds it.
  onNavigate: (id: string | null, name?: string) => void;
  onChanged: () => void;
  // Below md, this same sidebar instance doubles as a slide-out drawer —
  // one instance rather than a separate mobile copy, so a node's expand
  // state and lazily-fetched children aren't duplicated/lost when the
  // viewport crosses the breakpoint. binder-workspace owns whether it's
  // open and already closes it itself whenever onNavigate is called, so
  // this component only needs to render its own open/closed presentation.
  mobileOpen: boolean;
  onCloseMobile: () => void;
  // Desktop only. The mobile drawer is driven entirely by mobileOpen above,
  // so collapsing never applies below md — a collapsed sidebar would
  // otherwise leave the drawer permanently unopenable.
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const [draggingFolderId, setDraggingFolderId] = useState<string | null>(null);
  const [dragOverZoneKey, setDragOverZoneKey] = useState<string | null>(null);
  const [dragOverRowId, setDragOverRowId] = useState<string | null>(null);
  const drag: DragState = {
    draggingFolderId,
    setDraggingFolderId,
    dragOverZoneKey,
    setDragOverZoneKey,
    dragOverRowId,
    setDragOverRowId,
  };

  return (
    <>
      {/* Backdrop — mobile drawer only; the desktop sidebar is a normal
          static column, never modal. */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-zinc-900/40 md:hidden"
        />
      )}
      <aside
        // Two independent behaviors on one element: below md it slides in as
        // a drawer (translate-x), at md and up it's a static column that
        // collapses by animating its width to 0. Only the md: classes change
        // with `collapsed`, so the drawer keeps working exactly as before.
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col overflow-y-auto border-r border-stone-200 bg-white px-3 py-6 shadow-xl transition-transform duration-200 ease-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } md:static md:z-auto md:translate-x-0 md:bg-stone-50/50 md:shadow-none md:transition-[width,padding] md:duration-200 md:ease-out ${
          collapsed
            ? // md:invisible as well as w-0: clipping to zero width hides the
              // tabs visually but leaves every control in the tab order, so a
              // keyboard user would otherwise tab into a sidebar they can't
              // see. visibility:hidden takes them out of it and still animates.
              "md:invisible md:w-0 md:overflow-hidden md:border-r-0 md:px-0 lg:w-0"
            : "md:w-64 lg:w-72"
        }`}
      >
        {/* Desktop collapse control. Hidden on mobile, where the drawer's
            own X button (below) is the way out. The word "Collapse" carries
            the meaning here — a bare glyph asks the reader to already know
            the convention, and this sidebar's audience shouldn't have to. */}
        <div className="mb-3 hidden md:flex md:justify-end">
          <button
            type="button"
            onClick={onToggleCollapsed}
            title="Collapse sidebar"
            className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold tracking-wider text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
          >
            <ChevronLeftIcon className="h-3.5 w-3.5" />
            COLLAPSE
          </button>
        </div>

        <div className="mb-2 flex items-center justify-between md:hidden">
          <span className="text-sm font-semibold text-stone-900">Tabs</span>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close"
            className="rounded-md p-1.5 text-stone-500 transition-colors hover:bg-stone-100"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {/* No "Overview" row here — the project title in the top nav bar is
            the way back to the project home view. */}
        <div className="flex items-center justify-between px-3">
          <span className="text-[11px] font-semibold tracking-wider text-stone-400">
            TABS
          </span>
          {editable && (
            <FolderFormDialog
              projectId={projectId}
              parentFolderId={null}
              triggerLabel="+ Tab"
              triggerClassName="text-[11px] font-semibold tracking-wider text-stone-400 transition-colors hover:text-stone-700"
              dialogTitle="New tab"
              namePlaceholder="Kitchen"
              submitLabel="Create tab"
              onSuccess={(id) => {
                onChanged();
                if (id) onNavigate(id);
              }}
            />
          )}
        </div>

        <div className="mt-1">
          {tabs.length === 0 && (
            <p className="px-3 py-2 text-sm text-stone-400">No tabs yet</p>
          )}
          <SidebarTabList
            projectId={projectId}
            parentFolderId={null}
            tabs={tabs}
            depth={0}
            paletteFor={(index) => TAB_PALETTES[index % TAB_PALETTES.length]}
            activeTabId={activeTabId}
            tabCounts={tabCounts}
            subtabCounts={subtabCounts}
            editable={editable}
            onNavigate={onNavigate}
            onChanged={onChanged}
            drag={drag}
          />
        </div>

        {unsortedCount > 0 && (
          <button
            type="button"
            onClick={() => onNavigate(UNSORTED, "Unsorted")}
            className={`mt-4 flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
              activeTabId === UNSORTED
                ? "bg-white font-medium text-stone-900 shadow-xs"
                : "text-stone-400 hover:bg-stone-100"
            }`}
          >
            <span className="truncate">Unsorted</span>
            <span className="ml-auto rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">
              {unsortedCount}
            </span>
          </button>
        )}
      </aside>
    </>
  );
}

// Renders one sibling list — a leading drop zone, then each Tab's own row
// followed by a trailing drop zone — reused for both the top-level list
// (parentFolderId: null) and every node's own children list, so the
// between-siblings reorder/reparent logic only needs to be written once.
// Rendered even when `tabs` is empty: a childless list is still exactly one
// valid drop target (its only zone), which is what lets a Sub-tab become a
// node's very first child, or the top-level list's very first Tab.
function SidebarTabList({
  projectId,
  parentFolderId,
  tabs,
  depth,
  paletteFor,
  activeTabId,
  tabCounts,
  subtabCounts,
  editable,
  onNavigate,
  onChanged,
  drag,
}: {
  projectId: string;
  parentFolderId: string | null;
  tabs: SidebarTab[];
  depth: number;
  // Varies by index at the top level (cycles through TAB_PALETTES); every
  // nested SidebarTabList instead passes a constant function returning its
  // own tab's already-resolved palette, so Sub-tabs inherit their parent's
  // color family rather than getting a new one from their own position.
  paletteFor: (index: number) => TabPalette;
  activeTabId: string | null;
  tabCounts: Record<string, number>;
  subtabCounts: Record<string, number>;
  editable: boolean;
  onNavigate: (id: string | null, name?: string) => void;
  onChanged: () => void;
  drag: DragState;
}) {
  const listKey = parentFolderId ?? "root";

  async function handleDropBetween(payload: DragPayload, before?: number, after?: number) {
    drag.setDraggingFolderId(null);
    drag.setDragOverZoneKey(null);
    if (payload.kind !== "folder") return;
    await moveFolderToParent(payload.id, projectId, parentFolderId, midpointSortOrder(before, after));
    onChanged();
  }

  function zone(index: number) {
    const key = `${listKey}:${index}`;
    return (
      <DividerDropZone
        active={editable && drag.draggingFolderId !== null}
        isOver={drag.dragOverZoneKey === key}
        onDragOverZone={() => drag.setDragOverZoneKey(key)}
        onDragLeaveZone={() => drag.setDragOverZoneKey((k) => (k === key ? null : k))}
        onDrop={(payload) =>
          handleDropBetween(payload, tabs[index - 1]?.sort_order, tabs[index]?.sort_order)
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {zone(0)}
      {tabs.map((tab, index) => (
        <div key={tab.id}>
          <SidebarTabNode
            projectId={projectId}
            tab={tab}
            depth={depth}
            palette={paletteFor(index)}
            activeTabId={activeTabId}
            tabCounts={tabCounts}
            subtabCounts={subtabCounts}
            editable={editable}
            onNavigate={onNavigate}
            onChanged={onChanged}
            drag={drag}
          />
          {zone(index + 1)}
        </div>
      ))}
    </div>
  );
}

function SidebarTabNode({
  projectId,
  tab,
  depth,
  palette,
  activeTabId,
  tabCounts,
  subtabCounts,
  editable,
  onNavigate,
  onChanged,
  drag,
}: {
  projectId: string;
  tab: SidebarTab;
  depth: number;
  palette: TabPalette;
  activeTabId: string | null;
  tabCounts: Record<string, number>;
  subtabCounts: Record<string, number>;
  editable: boolean;
  onNavigate: (id: string | null, name?: string) => void;
  onChanged: () => void;
  drag: DragState;
}) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<SidebarTab[] | null>(null);
  const [, startTransition] = useTransition();
  const isActive = activeTabId === tab.id;
  const isNestTarget = drag.dragOverRowId === tab.id;

  function loadChildren() {
    startTransition(async () => {
      const result = await getTabContents(projectId, tab.id);
      setChildren(
        result.folders.map((f) => ({
          id: f.id,
          name: f.name,
          sort_order: f.sort_order,
        }))
      );
    });
  }

  // tabCounts is refetched project-wide by binder-workspace on every
  // create/rename/delete/move anywhere in the project — reused here as a
  // cheap "something changed" signal so an already-expanded node's own
  // children list doesn't go stale (e.g. a Sub-tab dropped onto this node
  // from elsewhere in the tree), without needing separate parent/child
  // refresh plumbing at arbitrary depth.
  useEffect(() => {
    if (expanded) loadChildren();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabCounts]);

  // Fetches this node's own Sub-tabs the moment it becomes expanded, by
  // whichever path set that — the manual chevron, a click on the tab
  // itself, or becoming the active Tab (below). loadChildren's own setState
  // happens after an await inside a transition, so — unlike the render-time
  // sync just below — this really is a normal effect-driven fetch.
  useEffect(() => {
    if (expanded && children === null) loadChildren();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  function toggleExpand() {
    setExpanded((e) => !e);
  }

  // Clicking the tab itself both navigates AND reveals whatever's nested
  // inside it — a separate manual chevron click to discover a tab's own
  // Sub-tabs shouldn't be required. Doesn't collapse anything: clicking an
  // already-expanded tab just re-navigates, leaving its tree open.
  function handleTabClick() {
    onNavigate(tab.id, tab.name);
    setExpanded(true);
  }

  // Covers the same "reveal what's nested inside the active Tab" intent for
  // the cases a click can't: the initial page load and any deep link that
  // lands directly on this Tab (activeTabId arriving via the ?tab= URL
  // param, not a click in this component). This runs during render rather
  // than in a useEffect — the react.dev-recommended way to "adjust state
  // when a prop changes" — since calling setExpanded synchronously from an
  // effect body trips the set-state-in-effect lint rule (cascading renders);
  // comparing against the previous isActive value here is React's own
  // sanctioned escape hatch, and is safe from infinite loops because the
  // condition is false again the very next render. wasActive always starts
  // false — even when isActive is already true on this very first render
  // (a hard reload/deep link straight onto this Tab) — so that "already
  // active from the start" still reads as a transition into active and
  // triggers the expand; seeding it from isActive itself would make the
  // comparison trivially equal on mount and silently skip that case.
  const [wasActive, setWasActive] = useState(false);
  if (isActive !== wasActive) {
    setWasActive(isActive);
    if (isActive) setExpanded(true);
  }

  function handleDeleted() {
    onChanged();
    if (isActive) onNavigate(null);
  }

  // Dropping directly onto this row (rather than a between-siblings zone)
  // nests the dragged Tab as this one's last child. Appends after the last
  // *known* child when this node is already expanded; otherwise there's no
  // children list to measure against client-side, so it lands at sort_order
  // 0 — landing first rather than last among any existing-but-unloaded
  // children, a disclosed cosmetic simplification rather than an extra
  // fetch just to compute an exact append position.
  async function handleDropOntoSelf(payload: DragPayload) {
    drag.setDraggingFolderId(null);
    drag.setDragOverRowId(null);
    if (payload.kind !== "folder" || payload.id === tab.id) return;
    const lastChildSortOrder = children?.[children.length - 1]?.sort_order;
    await moveFolderToParent(payload.id, projectId, tab.id, midpointSortOrder(lastChildSortOrder, undefined));
    setExpanded(true);
    onChanged();
  }

  // Sub-tabs inherit their parent's color family but stay visually quieter
  // at rest — a full palette.bg tint is reserved for top-level tabs (each
  // one's own "distinct color identity" per the sidebar's overall design);
  // a nested row only shows color via its (thinner) accent bar until it's
  // the active one, at which point it gets the same activeBg/elevation
  // treatment as any other tab.
  const restBg = depth === 0 ? palette.bg : "bg-white";

  // Server-side sub-tab count, so this is known before the row has ever
  // been expanded. A tab that only holds photos/notes gets a plain dot
  // rather than a chevron that would promise hidden sub-tabs it doesn't
  // have. Falls back to any children already fetched, which keeps the
  // affordance correct in the instant after adding the first sub-tab,
  // before the counts refetch lands.
  const hasSubtabs = (subtabCounts?.[tab.id] ?? 0) > 0 || (children?.length ?? 0) > 0;

  return (
    <div>
      <div
        className={`group relative flex items-center gap-0.5 rounded-l-md rounded-r-lg border pr-1 transition-all duration-150 ${palette.border} ${
          isActive
            ? `${palette.activeBg} z-10 translate-x-1.5 font-semibold shadow-md`
            : `${restBg} hover:translate-x-0.5`
        } ${isNestTarget ? "ring-2 ring-inset ring-stone-500" : ""}`}
        style={{ marginLeft: depth * 14 }}
        onDragOver={(e) => {
          if (!editable || drag.draggingFolderId === null) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          drag.setDragOverRowId(tab.id);
        }}
        onDragLeave={(e) => {
          // dragleave fires when the cursor crosses onto a child element
          // too (the chevron, hover actions) — not just when it truly
          // exits the row — so without this guard the highlight flickers
          // off mid-hover.
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          drag.setDragOverRowId((id) => (id === tab.id ? null : id));
        }}
        onDrop={(e) => {
          if (!editable) return;
          e.preventDefault();
          e.stopPropagation();
          drag.setDragOverRowId(null);
          const payload = readDragPayload(e);
          if (payload) handleDropOntoSelf(payload);
        }}
      >
        {/* The physical divider tab's own colored spine. */}
        <div
          className={`${depth === 0 ? "w-1.5" : "w-1"} shrink-0 self-stretch rounded-full ${palette.accent}`}
        />
        {hasSubtabs ? (
          <button
            type="button"
            onClick={toggleExpand}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-stone-400 transition-colors hover:bg-stone-200/60 hover:text-stone-700"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            <ChevronIcon
              className={`h-3.5 w-3.5 transition-transform duration-150 ${
                expanded ? "rotate-90" : ""
              }`}
            />
          </button>
        ) : (
          // A hollow ring, like a binder hole punch — reads as "nothing
          // nested here" without the filled dot's suggestion of content.
          <span className="flex h-6 w-6 shrink-0 items-center justify-center">
            <span className="h-2 w-2 rounded-full border-[1.5px] border-stone-400 bg-transparent" />
          </span>
        )}
        <button
          type="button"
          draggable={editable}
          onDragStart={(e) => {
            setDragPayload(e, { kind: "folder", id: tab.id });
            drag.setDraggingFolderId(tab.id);
          }}
          onDragEnd={() => {
            drag.setDraggingFolderId(null);
            drag.setDragOverRowId(null);
            drag.setDragOverZoneKey(null);
          }}
          onClick={handleTabClick}
          className={`flex min-w-0 flex-1 select-none items-center gap-2 py-1.5 pl-1 text-left text-sm transition-colors ${
            editable ? "cursor-grab active:cursor-grabbing" : ""
          } ${isActive ? palette.text : "text-stone-600"}`}
        >
          <span className="truncate">{tab.name}</span>
        </button>
        {editable && (
          <div
            // `flex` unconditionally, never `hidden` (display:none) — a
            // native <dialog> shown via showModal() renders in the top
            // layer, but the browser still hides it the instant an
            // ANCESTOR's computed display becomes none, even though its
            // own `.open` stays true. Since Rename/Delete's dialogs live
            // right inside this div, hiding it via display (as `hidden
            // group-hover:flex` used to) made an already-open dialog
            // silently vanish the moment the mouse left the row on its way
            // to the modal. Opacity alone gets the same hover-reveal look
            // without ever touching display — and deliberately skips
            // pointer-events-none too: since it's an inherited property, it
            // would reach down into an already-open dialog's own Cancel/
            // Delete buttons and make them uninteractable the moment the
            // mouse leaves the row. Not needed anyway — these buttons sit
            // entirely inside the row, so there's no position where they'd
            // be both invisible and hoverable at once.
            className={`flex shrink-0 items-center gap-0.5 transition-opacity ${
              isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
            // The row itself is a drag source and (via its sibling
            // navigate button) a click-to-navigate target — clicks here
            // are for Rename/Delete only, never either of those.
            onClick={(e) => e.stopPropagation()}
          >
            <RenameDialog
              kind="folder"
              itemId={tab.id}
              projectId={projectId}
              currentName={tab.name}
              onSuccess={onChanged}
            />
            <DeleteItemDialog
              kind="folder"
              itemId={tab.id}
              projectId={projectId}
              itemName={tab.name}
              onSuccess={handleDeleted}
            />
          </div>
        )}
      </div>

      {expanded && children !== null && (
        <SidebarTabList
          projectId={projectId}
          parentFolderId={tab.id}
          tabs={children}
          depth={depth + 1}
          paletteFor={() => palette}
          activeTabId={activeTabId}
          tabCounts={tabCounts}
          subtabCounts={subtabCounts}
          editable={editable}
          onNavigate={onNavigate}
          onChanged={onChanged}
          drag={drag}
        />
      )}
    </div>
  );
}
