"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { searchInProject } from "./folder/actions";
import type { ProjectSearchHit } from "./folder/data";
import { DocumentIcon, FolderIcon } from "./folder/item-icon";

// Global project search: one box in the header that reaches every tab,
// sub-tab and block, with results in a Spotlight-style popover rather than
// taking over the canvas. Replaces the old per-tab filter, which could only
// ever find things in the tab you were already looking at.
export function ProjectSearch({ projectId }: { projectId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ProjectSearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced so a fast typist doesn't fire a query per keystroke. The
  // sequence guard drops responses that arrive out of order — without it a
  // slow early query can land after a faster later one and show stale hits.
  const seq = useRef(0);
  useEffect(() => {
    const q = query.trim();
    // Nothing to search for. Deliberately does NOT clear `hits` here: a
    // synchronous setState in an effect body cascades an extra render (and
    // trips react-hooks/set-state-in-effect). An empty box renders no
    // results anyway — see `visibleHits` below.
    if (!q) return;
    const mine = ++seq.current;
    const timer = setTimeout(() => {
      startTransition(async () => {
        const results = await searchInProject(projectId, q);
        if (seq.current === mine) setHits(results);
      });
    }, 180);
    return () => clearTimeout(timer);
  }, [query, projectId]);

  // Close on an outside click or Escape — the two ways anyone expects to
  // dismiss a popover.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function goTo(hit: ProjectSearchHit) {
    // Same URL shape the sidebar navigates with, so the workspace picks the
    // tab up from ?tab= exactly as it would from a sidebar click.
    const target = hit.tabId ? `${pathname}?tab=${hit.tabId}` : `${pathname}?tab=unsorted`;
    router.push(target, { scroll: false });
    setOpen(false);
    setQuery("");
  }

  const trimmed = query.trim();
  const showPopover = open && trimmed !== "";
  // Derived rather than stored, so results can never outlive the query that
  // produced them — including the instant the box is cleared.
  const visibleHits = trimmed === "" ? [] : hits;

  return (
    <div ref={containerRef} className="relative w-full sm:w-64">
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search this project"
        aria-label="Search this project"
        className="block w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
      />

      {showPopover && (
        <div className="absolute left-0 right-0 z-30 mt-1 max-h-80 overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
          {visibleHits.length === 0 ? (
            <p className="px-3 py-2 text-sm text-zinc-400">
              {pending ? "Searching…" : `No matches for “${trimmed}”`}
            </p>
          ) : (
            <ul>
              {visibleHits.map((hit, i) => (
                <li key={`${hit.kind}-${hit.tabId ?? "root"}-${i}`}>
                  <button
                    type="button"
                    onClick={() => goTo(hit)}
                    className="flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors hover:bg-zinc-50"
                  >
                    {hit.kind === "tab" ? (
                      <FolderIcon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                    ) : (
                      <DocumentIcon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-300" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-zinc-800">
                        {hit.label}
                      </span>
                      {hit.context && (
                        <span className="block truncate text-xs text-zinc-400">
                          {hit.context}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
