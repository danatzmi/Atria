"use client";

import { useEffect, useState, useTransition, type Dispatch, type SetStateAction } from "react";
import { getTabContents, moveFolderToParent } from "./folder/actions";
import { FolderFormDialog } from "./folder/folder-form-dialog";
import { RenameDialog } from "./folder/rename-dialog";
import { DeleteItemDialog } from "./folder/delete-item-dialog";
import { DividerDropZone } from "./folder/divider-row";
import { ChevronIcon, CloseIcon, SidebarToggleIcon } from "./folder/item-icon";
import { midpointSortOrder } from "@/lib/sort-order";
import { readDragPayload, setDragPayload, type DragPayload } from "@/lib/drag-payload";

export type SidebarTab = { id: string; name: string; sort_order: number };

// Mirrors the same virtual "unsorted" sentinel binder-workspace.tsx uses for
// the ?tab= URL param — not a real folder id.
export const UNSORTED = "unsorted";


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
          <button
            type="button"
            onClick={onToggleCollapsed}
            title="Collapse sidebar"
            className="hidden items-center justify-center rounded-md p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 md:flex"
          >
            <SidebarToggleIcon className="h-4 w-4" />
          </button>
          {editable && (
            <FolderFormDialog
              projectId={projectId}
              parentFolderId={null}
              triggerLabel="+"
              triggerClassName="flex h-5 w-5 items-center justify-center rounded-full bg-stone-100 pb-0.5 text-lg font-light text-stone-500 transition-colors hover:bg-stone-200 hover:text-stone-900"
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
            // Same active treatment as a tab row, so the two read as one
            // list rather than two systems.
            className={`mt-4 flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
              activeTabId === UNSORTED
                ? "bg-white font-medium text-stone-900 shadow-sm"
                : "text-stone-500 hover:bg-stone-100/70 hover:text-stone-800"
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
    // Only nested levels reserve rail space (pl-3 = the 12px the rows'
    // -left-3 lines are drawn into, so the tree lands on the list's own
    // left edge). Root tabs have no rail — there is no parent above them
    // to descend from, so a line there is decoration with nothing to
    // connect, and it shows even when everything is collapsed.
    //
    // The rail is drawn per row, never as a border on this wrapper: a
    // wrapper border also spans the trailing drop zone after the last
    // child, leaving a tail hanging past the final branch.
    <div className={`flex flex-col ${depth > 0 ? "ml-3 gap-0.5 pl-3" : "gap-1.5"}`}>
      {zone(0)}
      {tabs.map((tab, index) => (
        <div key={tab.id}>
          <SidebarTabNode
            projectId={projectId}
            tab={tab}
            depth={depth}
            isLast={index === tabs.length - 1}
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
  isLast,
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
  // Last child of its list — its rail stops at the branch rather than
  // running on past it.
  isLast: boolean;
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

  // Two separate controls, two separate jobs: the chevron opens and closes
  // the tree, the name navigates. Navigating still auto-expands, so arriving
  // at a tab reveals what's nested inside it — but it never collapses, so a
  // tree you opened stays open as you move around it. Closing is the
  // chevron's job alone.
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

  // Server-side sub-tab count, so this is known before the row has ever
  // been expanded. A tab that only holds photos/notes gets a plain dot
  // rather than a chevron that would promise hidden sub-tabs it doesn't
  // have. Falls back to any children already fetched, which keeps the
  // affordance correct in the instant after adding the first sub-tab,
  // before the counts refetch lands.
  const hasSubtabs = (subtabCounts?.[tab.id] ?? 0) > 0 || (children?.length ?? 0) > 0;

  return (
    <div>
      {/* A border-free shell around the row, and the tree lines hang off
          this rather than off the row itself.
          Absolute offsets resolve against the padding box, so a child of
          the row would be pushed inward by its 2px left border — putting
          the row's rail 2px right of the subtree continuation below and
          breaking the master rail. This shell has no border, so every
          segment at every depth shares one x. It wraps only the row, so
          top-1/2 is still the row's own middle. */}
      <div className="relative">
        {/* The ├── branch — nested rows only, so nothing is drawn when a
            tab is collapsed and has nothing below it. Both pieces sit at
            -left-3, matching the list's pl-3, so they meet on the rail
            rather than near it.

            The vertical always starts 8px ABOVE the row. For the first
            child that reaches up into the parent row, which is what
            visibly joins a subtree to the tab it belongs to; for the rest
            it overlaps the segment above (more than the 2px gap-0.5),
            since rows have fractional heights and an exact join leaves a
            1px break.

            isLast stops it at bottom-1/2 — exactly where the horizontal
            stub crosses — so the tree ends on its last branch instead of
            trailing past it. */}
        {depth > 0 && (
          <>
            <span
              aria-hidden
              className={`pointer-events-none absolute -left-3 -top-2 w-px bg-stone-300 ${
                isLast ? "bottom-1/2" : "bottom-0"
              }`}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute -left-3 top-1/2 w-3 border-t border-stone-300"
            />
          </>
        )}
        <div
        // Active state is carried by background + weight + text color
        // alone. No border, no accent spine, no offset: on a list of tabs
        // one quiet filled row reads as "you are here" more clearly than
        // several competing signals, and it stays calm at any list length.
        // Indentation now comes from the parent list's padding, not a
        // per-row margin, so the rail and the rows can't drift apart.
        className={`group relative flex items-center rounded-lg pl-2.5 pr-1 transition-colors duration-150 ${
          isActive
            ? "border border-stone-200 border-l-2 border-l-stone-900 bg-white shadow-sm"
            : // Same border widths as the active row, just invisible — the
              // 2px left edge has to be reserved on every row or the label
              // jumps sideways as selection moves between tabs.
              "border border-transparent border-l-2 border-l-transparent hover:bg-stone-100/60"
        } ${isNestTarget ? "ring-2 ring-inset ring-stone-400" : ""}`}
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
          // No leading icon slot at all — a tab with nothing nested starts
          // flush at the left edge, as specified.
          className={`flex min-w-0 flex-1 select-none items-center gap-2 py-2 text-left text-sm transition-colors ${
            editable ? "cursor-grab active:cursor-grabbing" : ""
          } ${
            isActive
              ? "font-medium text-stone-900"
              : depth > 0
                ? "text-stone-500 group-hover:text-stone-800"
                : "text-stone-600 group-hover:text-stone-900"
          }`}
        >
          <span className="truncate">{tab.name}</span>
        </button>

        {hasSubtabs ? (
          <button
            type="button"
            onClick={toggleExpand}
            className={`order-last flex h-6 w-6 shrink-0 items-center justify-center rounded transition-colors hover:bg-stone-200/70 hover:text-stone-900 ${
              isActive ? "text-stone-600" : "text-stone-400"
            }`}
            aria-label={expanded ? "Collapse" : "Expand"}
            aria-expanded={expanded}
          >
            <ChevronIcon
              className={`h-3.5 w-3.5 transition-transform duration-150 ${
                expanded ? "rotate-90" : ""
              }`}
            />
          </button>
        ) : null}
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

      </div>

      {expanded && children !== null && (
        // The row's own rail stops at the row. An expanded subtree sits
        // between this row and the next sibling, so without a continuation
        // the master rail breaks for the whole height of the children.
        // Skipped when this IS the last sibling — its rail already ended at
        // its own branch, and continuing would recreate the hanging tail.
        <div className="relative">
          {depth > 0 && !isLast && (
            <span
              aria-hidden
              className="pointer-events-none absolute -left-3 bottom-0 top-0 w-px bg-stone-300"
            />
          )}
          <SidebarTabList
            projectId={projectId}
            parentFolderId={tab.id}
            tabs={children}
            depth={depth + 1}
            activeTabId={activeTabId}
            tabCounts={tabCounts}
            subtabCounts={subtabCounts}
            editable={editable}
            onNavigate={onNavigate}
            onChanged={onChanged}
            drag={drag}
          />
        </div>
      )}
    </div>
  );
}
