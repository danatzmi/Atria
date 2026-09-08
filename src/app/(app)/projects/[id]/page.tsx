import Link from "next/link";
import { Suspense } from "react";
import { createSignedUrl } from "@/lib/supabase/storage";
import { getProjectOrNotFound } from "./data";
import { getSubtabCounts, getTabContents, getTabCounts } from "./folder/actions";
import { ProjectFormDialog } from "../project-form-dialog";
import { BinderWorkspace } from "./binder-workspace";
import { ExportMenu } from "./export-menu";
import { ViewModeToggle } from "./view-mode-toggle";

export default async function ProjectHomePage(
  props: PageProps<"/projects/[id]">
) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const isViewMode = searchParams.mode === "view";
  // Which Tab (if any) the workspace currently has open — read here purely
  // so Export PDF can carry that scope through to the export route.
  const activeTabId = typeof searchParams.tab === "string" ? searchParams.tab : null;
  const { supabase, project } = await getProjectOrNotFound(id);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const coverImageUrl = project.cover_image
    ? await createSignedUrl(supabase, project.cover_image)
    : null;

  // The project root's folders are the top-level Binder Tabs; its blocks are
  // ones with no tab (shown under the virtual "Unsorted" tab).
  const [{ folders: tabs, blocks: rootBlocks }, tabCounts, subtabCounts] =
    await Promise.all([
      getTabContents(id, null),
      getTabCounts(id),
      getSubtabCounts(id),
    ]);

  return (
    <div className="flex w-full flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-zinc-200 px-6 py-4">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            href="/projects"
            className="shrink-0 text-sm text-zinc-500 transition-colors hover:text-zinc-900"
          >
            ← Projects
          </Link>
          {/* The title doubles as the way back to the project home view —
              it replaces the sidebar's old "Overview" row. */}
          <div className="flex min-w-0 items-center gap-1">
            <Link
              href={`/projects/${project.id}`}
              className="truncate text-lg font-semibold tracking-tight text-zinc-900 transition-colors hover:text-zinc-600"
            >
              {project.name}
            </Link>
            {!isViewMode && (
              <ProjectFormDialog mode="edit" field="name" project={project} />
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ViewModeToggle />
          <div className="flex shrink-0 items-center gap-1">
            {/* Inside a tab this offers a scope choice; from the Overview
                it's a plain link straight to the whole-binder export. */}
            <ExportMenu projectId={project.id} activeTabId={activeTabId} />
          </div>
        </div>
      </header>

      <Suspense fallback={null}>
        <BinderWorkspace
          projectId={project.id}
          userId={user!.id}
          projectName={project.name}
          projectDescription={project.description}
          coverImageUrl={coverImageUrl}
          hasCoverImage={!!project.cover_image}
          initialTabs={tabs}
          initialTabCounts={tabCounts}
          initialSubtabCounts={subtabCounts}
          initialUnsortedCount={rootBlocks.length}
        />
      </Suspense>
    </div>
  );
}
