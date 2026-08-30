import Link from "next/link";
import { Suspense } from "react";
import { createSignedUrl } from "@/lib/supabase/storage";
import { getProjectOrNotFound } from "./data";
import { getTabContents, getTabCounts } from "./folder/actions";
import { CoverImageDialog } from "./cover-image-dialog";
import { ProjectFormDialog } from "../project-form-dialog";
import { DeleteProjectDialog } from "../delete-project-dialog";
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
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <Link
        href="/projects"
        className="text-sm text-zinc-500 transition-colors hover:text-zinc-900"
      >
        ← Projects
      </Link>

      <div className="relative mt-4 aspect-[3/1] w-full overflow-hidden rounded-xl bg-zinc-100">
        {coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverImageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
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
        {!isViewMode && (
          <div className="absolute bottom-3 right-3">
            <CoverImageDialog
              projectId={project.id}
              hasCoverImage={!!project.cover_image}
            />
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            {project.name}
          </h1>
          {project.description && (
            <p className="mt-1 max-w-2xl text-sm text-zinc-500">
              {project.description}
            </p>
          )}
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
            {!isViewMode && (
              <>
                <ProjectFormDialog mode="edit" project={project} />
                <DeleteProjectDialog
                  projectId={project.id}
                  projectName={project.name}
                />
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mt-10">
        <Suspense fallback={null}>
          <BinderWorkspace
            projectId={project.id}
            userId={user!.id}
            initialTabs={tabs}
            initialTabCounts={tabCounts}
            initialUnsortedCount={rootBlocks.length}
          />
        </Suspense>
      </div>
    </div>
  );
}
