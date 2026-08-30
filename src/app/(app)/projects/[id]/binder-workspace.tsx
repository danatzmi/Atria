"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getTabCounts, getTabContents, moveFolderToPosition } from "./folder/actions";
import type { FolderRow } from "./folder/data";
import { FolderBrowser } from "./folder/browser";
import { FolderFormDialog } from "./folder/folder-form-dialog";
import { RenameDialog } from "./folder/rename-dialog";
import { DeleteItemDialog } from "./folder/delete-item-dialog";
import {
  AnimatedPanel,
  DividerDropZone,
  DividerGripHandle,
  DividerRow,
} from "./folder/divider-row";
import { midpointSortOrder } from "@/lib/sort-order";
import { setDragPayload, type DragPayload } from "@/lib/drag-payload";

// Not a real tab — blocks with section_id IS NULL don't have one, so
// they're grouped under this virtual, non-renameable/non-deletable tab.
const UNSORTED = "unsorted";

type Tab = { id: string; name: string; sort_order: number };

// Owns only the top-level Tab list (fetch, drag-reorder, "+Add Tab", the
// virtual Unsorted row). Everything below an open Tab — its own blocks, and
// any depth of Sub-tab — is FolderBrowser's job: it's self-fetching and
// renders itself again recursively, so this component doesn't need to know
// anything about what's inside a Tab.
export function BinderWorkspace({
  projectId,
  userId,
  initialTabs,
  initialTabCounts,
  initialUnsortedCount,
}: {
  projectId: string;
  userId: string;
  initialTabs: FolderRow[];
  initialTabCounts: Record<string, number>;
  initialUnsortedCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Only the top-level open/closed Tab stays URL-tracked, so bookmarking
  // and back/forward for "which Tab is open" keep working. Expansion of
  // Sub-tabs (any depth inside an open Tab) is local state owned by each
  // FolderBrowser instance — see its own comment for why.
  const activeTabId = searchParams.get("tab");
  // View Mode vs Edit Mode — the ?mode= toggle lives in the project page's
  // header (view-mode-toggle.tsx) and reads/writes this same URL param, so
  // it's shareable/bookmarkable just like which tab is open. Edit is the
  // default (unset), matching the app's existing always-editable behavior.
  const editable = searchParams.get("mode") !== "view";

  const [tabs, setTabs] = useState<Tab[]>(
    initialTabs.map((f) => ({ id: f.id, name: f.name, sort_order: f.sort_order }))
  );
  const [tabCounts, setTabCounts] = useState(initialTabCounts);
  const [unsortedCount, setUnsortedCount] = useState(initialUnsortedCount);
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
  const [dragOverZone, setDragOverZone] = useState<number | null>(null);

  // A Tab itself was created/renamed/deleted, or a mutation happened
  // somewhere inside an open Tab (bubbled up one level so this list's count
  // badges stay accurate — see FolderBrowser's onItemsChanged comment).
  const refreshTabs = useCallback(async () => {
    const [result, counts] = await Promise.all([
      getTabContents(projectId, null),
      getTabCounts(projectId),
    ]);
    setTabs(result.folders.map((f) => ({ id: f.id, name: f.name, sort_order: f.sort_order })));
    setUnsortedCount(result.blocks.length);
    setTabCounts(counts);
  }, [projectId]);

  // The payload comes from the drop event's dataTransfer, not draggingTabId
  // state — see drag-payload.ts. draggingTabId stays around only to drive
  // the drop zones' "active" visuals.
  async function handleDropTab(payload: DragPayload, sortOrder: number) {
    setDraggingTabId(null);
    await moveFolderToPosition(payload.id, projectId, sortOrder);
    refreshTabs();
  }

  function navigate(tab: string | null) {
    const params = new URLSearchParams(searchParams);
    if (tab) params.set("tab", tab);
    else params.delete("tab");
    const query = params.toString();
    router.push(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  }

  function openTab(id: string) {
    navigate(activeTabId === id ? null : id);
  }

  return (
    <div className="space-y-3">
      {tabs.length === 0 && unsortedCount === 0 && (
        <div className="flex flex-col items-center gap-1 py-10 text-center">
          <h2 className="text-sm font-medium text-stone-700">This is your project&rsquo;s home</h2>
          <p className="max-w-sm text-sm text-stone-400">
            Start organizing it here — create a Tab for each area, like &ldquo;Kitchen&rdquo; or
            &ldquo;Contracts &amp; Permits,&rdquo; to hold its photos, documents, and notes.
          </p>
        </div>
      )}

      {tabs.map((tab, index) => (
        <div key={tab.id}>
          {editable && (
            <DividerDropZone
              active={draggingTabId !== null}
              isOver={dragOverZone === index}
              onDragOverZone={() => setDragOverZone(index)}
              onDragLeaveZone={() => setDragOverZone((z) => (z === index ? null : z))}
              onDrop={(payload) =>
                handleDropTab(payload, midpointSortOrder(tabs[index - 1]?.sort_order, tab.sort_order))
              }
            />
          )}
          <DividerRow
            index={String(index + 1).padStart(2, "0")}
            name={tab.name}
            count={tabCounts[tab.id] ?? 0}
            isOpen={activeTabId === tab.id}
            onToggle={() => openTab(tab.id)}
            grip={
              editable ? (
                <DividerGripHandle
                  onDragStart={(e) => {
                    setDragPayload(e, { kind: "folder", id: tab.id });
                    setDraggingTabId(tab.id);
                  }}
                  onDragEnd={() => setDraggingTabId(null)}
                />
              ) : undefined
            }
            actions={
              editable ? (
                <>
                  <RenameDialog
                    kind="folder"
                    itemId={tab.id}
                    projectId={projectId}
                    currentName={tab.name}
                    onSuccess={refreshTabs}
                  />
                  <DeleteItemDialog
                    kind="folder"
                    itemId={tab.id}
                    projectId={projectId}
                    itemName={tab.name}
                    onSuccess={() => {
                      refreshTabs();
                      if (activeTabId === tab.id) navigate(null);
                    }}
                  />
                </>
              ) : undefined
            }
          />
          <AnimatedPanel isOpen={activeTabId === tab.id}>
            {activeTabId === tab.id && (
              <FolderBrowser
                projectId={projectId}
                userId={userId}
                folderId={tab.id}
                indexPath={String(index + 1).padStart(2, "0")}
                onItemsChanged={refreshTabs}
                editable={editable}
              />
            )}
          </AnimatedPanel>
        </div>
      ))}

      {editable && (
        <DividerDropZone
          active={draggingTabId !== null}
          isOver={dragOverZone === tabs.length}
          onDragOverZone={() => setDragOverZone(tabs.length)}
          onDragLeaveZone={() => setDragOverZone((z) => (z === tabs.length ? null : z))}
          onDrop={(payload) =>
            handleDropTab(payload, midpointSortOrder(tabs[tabs.length - 1]?.sort_order, undefined))
          }
        />
      )}

      {unsortedCount > 0 && (
        <div>
          <DividerRow
            index={String(tabs.length + 1).padStart(2, "0")}
            name="Unsorted"
            count={unsortedCount}
            isOpen={activeTabId === UNSORTED}
            dashed
            onToggle={() => openTab(UNSORTED)}
          />
          <AnimatedPanel isOpen={activeTabId === UNSORTED} dashed>
            {activeTabId === UNSORTED && (
              <FolderBrowser
                projectId={projectId}
                userId={userId}
                folderId={null}
                indexPath=""
                onItemsChanged={refreshTabs}
                editable={editable}
              />
            )}
          </AnimatedPanel>
        </div>
      )}

      {editable && (
        <FolderFormDialog
          projectId={projectId}
          parentFolderId={null}
          triggerLabel="+ Add Tab"
          triggerClassName="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-stone-300 px-4 py-3.5 text-sm font-medium text-stone-500 transition-colors hover:border-stone-400 hover:bg-stone-50"
          dialogTitle="New tab"
          namePlaceholder="Kitchen"
          submitLabel="Create tab"
          onSuccess={refreshTabs}
        />
      )}
    </div>
  );
}
