import Link from "next/link";
import { Suspense } from "react";
import { createSignedUrl } from "@/lib/supabase/storage";
import { getProjectOrNotFound } from "./data";
import { getTabContents, getTabCounts } from "./folder/actions";
import { ProjectFormDialog } from "../project-form-dialog";
import { BinderWorkspace } from "./binder-workspace";
import { ViewModeToggle } from "./view-mode-toggle";

export default async function ProjectHomePage(
  props: PageProps<"/projects/[id]">
) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const isViewMode = searchParams.mode === "view";
  const { supabase, project } = await getProjectOrNotFound(id);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const coverImageUrl = project.cover_image
    ? await createSignedUrl(supabase, project.cover_image)
    : null;

  // The project root's folders are the top-level Binder Tabs; its blocks are
  // ones with no tab (shown under the virtual "Unsorted" tab).
  const [{ folders: tabs, blocks: rootBlocks }, tabCounts] = await Promise.all([
    getTabContents(id, null),
    getTabCounts(id),
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
          <h1 className="truncate text-lg font-semibold tracking-tight text-zinc-900">
            {project.name}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ViewModeToggle />
          <div className="flex shrink-0 items-center gap-1">
            <Link
              href={`/projects/${project.id}/export`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              aria-label="Export PDF"
              title="Export PDF"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4"
              >
                <path
                  fillRule="evenodd"
                  d="M5 2.75C5 1.784 5.784 1 6.75 1h5.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v11.586A1.75 1.75 0 0 1 15.25 19h-8.5A1.75 1.75 0 0 1 5 17.25v-1H3.75A1.75 1.75 0 0 1 2 14.5v-5c0-.966.784-1.75 1.75-1.75H5v-5Zm1.5 5h7v-3.5h-2.75a.75.75 0 0 1-.75-.75V2.5h-3.5v5.25ZM5 12.75v-2.25H3.75a.25.25 0 0 0-.25.25v5a.25.25 0 0 0 .25.25H5v-3.25Zm1.5 4.5v-7.5h7v7.5a.25.25 0 0 1-.25.25h-6.5a.25.25 0 0 1-.25-.25Z"
                  clipRule="evenodd"
                />
              </svg>
            </Link>
            {!isViewMode && <ProjectFormDialog mode="edit" project={project} />}
          </div>
        </div>
      </header>

      <Suspense fallback={null}>
        <BinderWorkspace
          projectId={project.id}
          userId={user!.id}
          project={{ name: project.name, description: project.description }}
          coverImageUrl={coverImageUrl}
          hasCoverImage={!!project.cover_image}
          initialTabs={tabs}
          initialTabCounts={tabCounts}
          initialUnsortedCount={rootBlocks.length}
        />
      </Suspense>
    </div>
  );
}
