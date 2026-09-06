import Link from "next/link";
import { Suspense } from "react";
import { createSignedUrl } from "@/lib/supabase/storage";
import { getProjectOrNotFound } from "./data";
import { getSubtabCounts, getTabContents, getTabCounts } from "./folder/actions";
import { ProjectFormDialog } from "../project-form-dialog";
import { BinderWorkspace } from "./binder-workspace";
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
            {/* Carries the open Tab through, so Export PDF from inside a tab
                exports that tab rather than the whole binder. */}
            <Link
              href={`/projects/${project.id}/export${activeTabId ? `?tab=${activeTabId}` : ""}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              aria-label="Export PDF"
              title="Export PDF"
            >
              {/* Standard printer glyph — the conventional Print/Save-as-PDF
                  affordance, rather than a document icon. */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4"
              >
                <path
                  fillRule="evenodd"
                  d="M5 2.75C5 1.784 5.784 1 6.75 1h6.5c.966 0 1.75.784 1.75 1.75v3.552c.377.046.752.097 1.126.153A2.212 2.212 0 0 1 18 8.653v4.097A2.25 2.25 0 0 1 15.75 15h-.241l.305 1.984A1.75 1.75 0 0 1 14.084 19H5.916a1.75 1.75 0 0 1-1.73-2.016L4.492 15H4.25A2.25 2.25 0 0 1 2 12.75V8.653c0-1.082.775-2.034 1.874-2.198.374-.056.75-.107 1.126-.153V2.75Zm8.5 3.397a41.533 41.533 0 0 0-7 0V2.75a.25.25 0 0 1 .25-.25h6.5a.25.25 0 0 1 .25.25v3.397ZM6.608 12.5a.25.25 0 0 0-.247.212l-.693 4.5a.25.25 0 0 0 .247.288h8.17a.25.25 0 0 0 .246-.288l-.692-4.5a.25.25 0 0 0-.247-.212H6.608Z"
                  clipRule="evenodd"
                />
                <path d="M14 7.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z" />
              </svg>
            </Link>
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
