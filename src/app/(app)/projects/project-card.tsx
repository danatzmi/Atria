import Image from "next/image";
import Link from "next/link";
import { ProjectCardMenu } from "./project-card-menu";

type Project = {
  id: string;
  name: string;
  description: string | null;
};

export function ProjectCard({
  project,
  coverImageUrl,
}: {
  project: Project;
  coverImageUrl: string | null;
}) {
  return (
    <div className="group relative">
      <Link href={`/projects/${project.id}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-zinc-100">
          {coverImageUrl ? (
            // next/image, not a raw <img>: covers are multi-megabyte phone
            // photos and this card renders them a few hundred pixels wide.
            // Vercel's optimizer fetches the original server-side and serves
            // a resized WebP, which is the same win Supabase's transform API
            // would give without needing a paid Supabase plan. `sizes` is what
            // tells it how small it can go — the widths mirror the grid's
            // breakpoints in projects/page.tsx.
            <Image
              src={coverImageUrl}
              alt=""
              fill
              sizes="(min-width: 1536px) 16vw, (min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-10 w-10 text-zinc-300"
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
        </div>
        {/* Cover + name only — the description now lives on the project's
            own home canvas, where there's room to actually read it. */}
        <h3 className="mt-3 truncate text-sm font-medium text-zinc-900">
          {project.name}
        </h3>
      </Link>

      {/* One control instead of three. The actions sit on top of the cover
          photo, and on a touch device they are permanently visible — three
          buttons covered enough of the image to change what the card is
          for.

          Hover-to-reveal on a pointer device, always visible without one.
          The override is keyed on hover CAPABILITY rather than a width
          breakpoint, because Tailwind v4 already compiles every
          group-hover: rule inside @media (hover:hover) — so on any touch
          device the reveal can never fire, and a width-based escape like
          sm:opacity-0 would simply move the dead zone to tablets, which
          are touch and wider than sm. */}
      <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:none)]:opacity-100">
        <ProjectCardMenu project={project} />
      </div>
    </div>
  );
}
