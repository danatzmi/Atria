"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getTabCounts, getTabContents } from "./folder/actions";
import type { FolderRow } from "./folder/data";
import { FolderBrowser } from "./folder/browser";
import { MenuIcon } from "./folder/item-icon";
import { CoverImageDialog } from "./cover-image-dialog";
import { ProjectFormDialog } from "../project-form-dialog";
import { ProjectSidebar, UNSORTED } from "./project-sidebar";

type Tab = { id: string; name: string; sort_order: number };

// Owns the top-level Tab list (fetch, "+Add Tab", the virtual Unsorted
// count) and which one is active, then renders the two-column shell: a
// ProjectSidebar for navigation and a Main Canvas showing either the
// Project Overview or the active Tab's content. Everything below an open
// Tab — its own blocks, and any depth of Sub-tab — stays FolderBrowser's
// job: it's self-fetching and renders itself again recursively, so this
// component doesn't need to know anything about what's inside a Tab.
export function BinderWorkspace({
  projectId,
  userId,
  project,
  coverImageUrl,
  hasCoverImage,
  initialTabs,
  initialTabCounts,
  initialUnsortedCount,
}: {
  projectId: string;
  userId: string;
  project: { name: string; description: string | null };
  coverImageUrl: string | null;
  hasCoverImage: boolean;
  initialTabs: FolderRow[];
  initialTabCounts: Record<string, number>;
  initialUnsortedCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Only the top-level open/closed Tab stays URL-tracked, so bookmarking
  // and back/forward for "which Tab is open" keep working. Expansion of
  // Sub-tabs in the sidebar tree, and inside the canvas, is local state.
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
  // Only actually needed for a deep-linked Sub-tab (any depth below the
  // top-level Tabs, whose name isn't in `tabs`) — top-level Tabs and
  // Unsorted always derive their canvas header name straight from data
  // already in state below, so this only ever holds the name of whichever
  // Sub-tab the sidebar was last clicked into.
  const [nestedActiveName, setNestedActiveName] = useState<string | null>(null);
  // Below md, ProjectSidebar renders as a slide-out drawer instead of a
  // static column (one shared instance either way — see its own comment).
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // A Tab itself was created/renamed/deleted, or a mutation happened
  // somewhere inside an open Tab (bubbled up so the sidebar's list and
  // count badges stay accurate — see FolderBrowser's onItemsChanged and
  // ProjectSidebar's own comment on reusing tabCounts as a refresh signal).
  const refreshTabs = useCallback(async () => {
    const [result, counts] = await Promise.all([
      getTabContents(projectId, null),
      getTabCounts(projectId),
    ]);
    setTabs(result.folders.map((f) => ({ id: f.id, name: f.name, sort_order: f.sort_order })));
    setUnsortedCount(result.blocks.length);
    setTabCounts(counts);
  }, [projectId]);

  function navigate(tab: string | null, name?: string) {
    if (tab && name !== undefined) setNestedActiveName(name);
    const params = new URLSearchParams(searchParams);
    if (tab) params.set("tab", tab);
    else params.delete("tab");
    const query = params.toString();
    router.push(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  }

  // The sidebar's own onNavigate — same as navigate above, but also closes
  // the mobile drawer on any selection (harmless no-op on desktop, where
  // mobileDrawerOpen never affects layout). Kept separate from the Tab
  // grid/Overview canvas's own onNavigate calls, which don't have a drawer
  // to close.
  function navigateFromSidebar(tab: string | null, name?: string) {
    navigate(tab, name);
    setMobileDrawerOpen(false);
  }

  // A deep-linked Sub-tab (any depth) shows its own top-level position when
  // it happens to be one of the top-level Tabs; otherwise the canvas simply
  // starts its index path fresh at "01" rather than threading the full
  // dotted path down from the sidebar tree — a disclosed simplification,
  // purely cosmetic (it only affects the numbering shown inside the canvas).
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const activeTabIndex = tabs.findIndex((t) => t.id === activeTabId);
  const activeIndexPath =
    activeTabIndex >= 0 ? String(activeTabIndex + 1).padStart(2, "0") : "01";
  // The canvas header's title: derived straight from state for a top-level
  // Tab or Unsorted (always correct, including after back/forward), and
  // falling back to whatever name the sidebar passed on last click for a
  // deep-linked Sub-tab — null only on a hard reload straight into one,
  // which the header shows a graceful fallback for.
  const activeTabName =
    activeTabId === null
      ? null
      : activeTabId === UNSORTED
        ? "Unsorted"
        : (activeTab?.name ?? nestedActiveName);

  return (
    <div className="flex w-full flex-1 flex-col md:flex-row">
      <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-4 py-3 md:hidden">
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          className="flex items-center gap-2 rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
        >
          <MenuIcon className="h-4 w-4" />
          Tabs
        </button>
        <span className="min-w-0 flex-1 truncate text-right text-sm font-medium text-stone-500">
          {activeTabId === null ? "Overview" : (activeTabName ?? "")}
        </span>
      </div>

      <ProjectSidebar
        projectId={projectId}
        tabs={tabs}
        tabCounts={tabCounts}
        unsortedCount={unsortedCount}
        activeTabId={activeTabId}
        editable={editable}
        onNavigate={navigateFromSidebar}
        onChanged={refreshTabs}
        mobileOpen={mobileDrawerOpen}
        onCloseMobile={() => setMobileDrawerOpen(false)}
      />

      <div className="min-w-0 flex-1 p-4 sm:p-6 md:p-8">
        {activeTabId === null ? (
          <ProjectOverview
            name={project.name}
            description={project.description}
            coverImageUrl={coverImageUrl}
            hasCoverImage={hasCoverImage}
            projectId={projectId}
            editable={editable}
            hasTabs={tabs.length > 0}
          />
        ) : (
          <FolderBrowser
            projectId={projectId}
            userId={userId}
            folderId={activeTabId === UNSORTED ? null : activeTabId}
            indexPath={activeTabId === UNSORTED ? "" : activeIndexPath}
            name={activeTabName}
            onItemsChanged={refreshTabs}
            editable={editable}
          />
        )}
      </div>
    </div>
  );
}

// The Main Canvas's default view when no Tab is active: what the project
// is, at a glance. The large cover banner + name + description used to live
// permanently in the page header; it now only shows here, since the header
// is a slim persistent nav bar across every Tab too. Below that, an
// editorial space for the project's own overview/notes — the Tab list
// itself isn't repeated here since the sidebar, right beside this canvas,
// already shows it.
function ProjectOverview({
  name,
  description,
  coverImageUrl,
  hasCoverImage,
  projectId,
  editable,
  hasTabs,
}: {
  name: string;
  description: string | null;
  coverImageUrl: string | null;
  hasCoverImage: boolean;
  projectId: string;
  editable: boolean;
  hasTabs: boolean;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="relative aspect-[3/1] w-full overflow-hidden rounded-xl bg-zinc-100">
        {coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverImageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-12 w-12 text-zinc-300"
            >
              <path d="M3.75 4.5A1.5 1.5 0 0 1 5.25 3h4.19c.398 0 .78.158 1.06.44l1.31 1.31c.281.281.663.44 1.06.44h6.128a1.5 1.5 0 0 1 1.5 1.5v.75H3.75V4.5Z" />
              <path
                fillRule="evenodd"
                d="M2.25 9.75a.75.75 0 0 1 .75-.75h18a.75.75 0 0 1 .75.75v8.25a1.5 1.5 0 0 1-1.5 1.5H3.75a1.5 1.5 0 0 1-1.5-1.5V9.75Z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}
        {editable && (
          <div className="absolute bottom-3 right-3">
            <CoverImageDialog projectId={projectId} hasCoverImage={hasCoverImage} />
          </div>
        )}
      </div>

      <div className="mt-5">
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">{name}</h2>
      </div>

      {description ? (
        <div className="mt-8">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              Overview
            </h3>
            {editable && (
              <ProjectFormDialog
                mode="edit"
                project={{ id: projectId, name, description }}
              />
            )}
          </div>
          <p className="mt-3 max-w-2xl whitespace-pre-line text-base leading-relaxed text-stone-600">
            {description}
          </p>
        </div>
      ) : (
        editable && (
          <div className="mt-8 rounded-xl border border-dashed border-stone-300 px-6 py-10 text-center">
            <p className="mx-auto max-w-sm text-sm text-stone-400">
              Add an overview, project goals, timeline, or notes about this project.
            </p>
            <div className="mt-4">
              <ProjectFormDialog
                mode="edit"
                project={{ id: projectId, name, description }}
                triggerLabel="+ Add Overview"
                triggerClassName="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
              />
            </div>
          </div>
        )
      )}

      {!hasTabs && (
        <div className="mt-8 flex flex-col items-center gap-1 rounded-xl border border-dashed border-stone-300 py-10 text-center">
          <h3 className="text-sm font-medium text-stone-700">This is your project&rsquo;s home</h3>
          <p className="max-w-sm text-sm text-stone-400">
            Create a Tab in the sidebar to start organizing photos, documents, and notes.
          </p>
        </div>
      )}
    </div>
  );
}
