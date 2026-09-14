import Link from "next/link";
import { Suspense } from "react";
import { createSignedUrl } from "@/lib/supabase/storage";
import { getProjectOrNotFound } from "./data";
import { getSubtabCounts, getTabContents, getTabCounts } from "./folder/actions";
import { ProjectFormDialog } from "../project-form-dialog";
import { BinderWorkspace } from "./binder-workspace";
import { ExportMenu } from "./export-menu";
import { ProjectSearch } from "./project-search";
import { ChevronLeftIcon } from "./folder/item-icon";

export default async function ProjectHomePage(
  props: PageProps<"/projects/[id]">
) {
  const { id } = await props.params;
  // Deliberately never reads props.searchParams: a page that does is
  // re-rendered on the server for every ?tab= change, which is what the
  // pushState tab-switching fix exists to avoid. Nothing here depends on
  // the query string any more now that the view/edit mode is gone.
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
      {/* Two rows on mobile, one on desktop. flex-wrap alone put the
          search box on its own line at awkward widths and left the export
          icon stranded; an explicit stack is predictable at every size.
          Row 1: back link + title on the left, export on the right.
          Row 2: search, full width — then folded into the same row at sm. */}
      <header className="border-b border-zinc-200 px-6 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex w-full min-w-0 items-center justify-between gap-4 sm:w-auto sm:flex-1">
            <div className="flex min-w-0 items-center gap-4">
              <Link
                href="/projects"
                className="group flex shrink-0 items-center gap-0.5 text-[13px] font-medium text-zinc-500 transition-colors hover:text-zinc-900"
              >
                <ChevronLeftIcon className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                Projects
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
                <ProjectFormDialog mode="edit" field="name" project={project} />
              </div>
            </div>

            {/* Rides along with the title row on mobile so row 1 has
                something anchoring its right edge; on desktop it moves to
                the end of the single row (order-last below). */}
            <div className="flex shrink-0 items-center gap-1 sm:hidden">
              <ExportMenu projectId={project.id} />
            </div>
          </div>

          <ProjectSearch projectId={project.id} />

          <div className="hidden shrink-0 items-center gap-1 sm:flex">
            {/* Inside a tab this offers a scope choice; from the Overview
                it's a plain link straight to the whole-binder export. */}
            <ExportMenu projectId={project.id} />
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
