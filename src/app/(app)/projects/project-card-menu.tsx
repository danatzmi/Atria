"use client";

import { Dropdown } from "@/components/dropdown";
import { ProjectFormDialog } from "./project-form-dialog";
import { DeleteProjectDialog } from "./delete-project-dialog";
import { DuplicateProjectDialog } from "./duplicate-project-dialog";

// Its own client component rather than inline in the card, because the card
// is a Server Component and Dropdown takes a render function for its
// trigger — a function prop cannot cross that boundary. Extracting the menu
// keeps the card, and the cover image beside it, rendering on the server.

// Matches AddMenu's rows in browser.tsx, so every menu in the app has the
// same row metrics.
const MENU_ITEM =
  "block w-full px-3 py-2 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-50";

function EllipsisIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <circle cx="4.5" cy="10" r="1.5" />
      <circle cx="10" cy="10" r="1.5" />
      <circle cx="15.5" cy="10" r="1.5" />
    </svg>
  );
}

export function ProjectCardMenu({
  project,
}: {
  project: { id: string; name: string; description: string | null };
}) {
  return (
    <Dropdown
      label="Project actions"
      align="end"
      menuClassName="w-44"
      contentWidth={176}
      trigger={(props) => (
        <button
          {...props}
          type="button"
          aria-label="Project actions"
          className="flex h-8 w-8 items-center justify-center rounded-md bg-white/90 text-zinc-600 shadow-sm backdrop-blur-sm transition-colors hover:bg-white hover:text-zinc-900"
        >
          <EllipsisIcon className="h-4 w-4" />
        </button>
      )}
    >
      {/* Deliberately no close-on-click. The Dropdown only renders its
          children while open, so closing the menu when an item is pressed
          would unmount the dialog before its own native <dialog> had a
          chance to render — the trap AddMenu documents in browser.tsx. The
          menu sits behind the modal, and goes away with the card on delete
          or on navigation. */}
      <ProjectFormDialog
        mode="edit"
        project={project}
        triggerLabel="Edit"
        triggerClassName={MENU_ITEM}
      />
      <DuplicateProjectDialog
        projectId={project.id}
        projectName={project.name}
        triggerLabel="Duplicate"
        triggerClassName={MENU_ITEM}
      />
      <DeleteProjectDialog
        projectId={project.id}
        projectName={project.name}
        triggerLabel="Delete"
        triggerClassName={`${MENU_ITEM} text-red-600 hover:bg-red-50`}
      />
    </Dropdown>
  );
}
