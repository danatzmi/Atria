"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Prominent header switch between Edit Mode (every insert bar, drag handle,
// and rename/move/delete affordance active) and View Mode (a clean,
// read-only presentation view for walking a client through the binder —
// everything stays readable and navigable, just none of the authoring
// chrome). Reads/writes the same ?mode= URL param binder-workspace.tsx and
// every FolderBrowser instance key off of, so it's shareable/bookmarkable.
export function ViewModeToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isViewMode = searchParams.get("mode") === "view";

  function setMode(mode: "view" | "edit") {
    const params = new URLSearchParams(searchParams);
    if (mode === "edit") params.delete("mode");
    else params.set("mode", "view");
    const query = params.toString();
    router.push(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  }

  return (
    <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-zinc-200 bg-zinc-50 p-0.5">
      <button
        type="button"
        onClick={() => setMode("view")}
        className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
          isViewMode ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
        }`}
      >
        👁️ View
      </button>
      <button
        type="button"
        onClick={() => setMode("edit")}
        className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
          !isViewMode ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
        }`}
      >
        ✏️ Edit
      </button>
    </div>
  );
}
