import { createClient } from "@/lib/supabase/server";
import { createSignedUrls, IMAGE_COVER_WIDTH } from "@/lib/supabase/storage";
import { ProjectFormDialog } from "./project-form-dialog";
import { ProjectCard } from "./project-card";

export default async function ProjectsPage() {
  const supabase = await createClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, description, cover_image")
    .order("created_at", { ascending: false });

  const coverKeys = (projects ?? [])
    .map((p) => p.cover_image)
    .filter((key): key is string => !!key);
  // Cover art for grid cards — a few hundred CSS px each, so there's no
  // reason to ship the 4MB original.
  const signedUrls = await createSignedUrls(supabase, coverKeys, IMAGE_COVER_WIDTH);

  const projectsWithCovers = (projects ?? []).map((project) => ({
    project,
    coverImageUrl: project.cover_image
      ? (signedUrls.get(project.cover_image) ?? null)
      : null,
  }));

  // Full-bleed like the project canvas — no max-width cap, just edge
  // padding, so the grid keeps filling the screen on wide displays.
  return (
    <div className="w-full flex-1 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          Projects
        </h1>
        <ProjectFormDialog mode="create" />
      </div>

      {projectsWithCovers.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-24 text-center">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
            Your projects will appear here
          </h2>
          <p className="mt-2 max-w-sm text-sm text-zinc-500">
            Create your first project to give it a home — everything you
            upload will live in one clear, organized place.
          </p>
        </div>
      ) : (
        // Extra columns past lg: without the max-width cap, four columns on
        // a wide display stretch each cover to ~600px. More columns keeps a
        // card the size it was designed at and shows more of the binder.
        <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {projectsWithCovers.map(({ project, coverImageUrl }) => (
            <ProjectCard
              key={project.id}
              project={project}
              coverImageUrl={coverImageUrl}
            />
          ))}
        </div>
      )}
    </div>
  );
}
