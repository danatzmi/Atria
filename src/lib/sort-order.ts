// Fractional-index insertion: every manually-orderable list in Atria
// (blocks within a tab, folders within a project) uses a double precision
// sort_order column specifically so a dragged item can slot exactly between
// two existing ones without renumbering anything else.
export function midpointSortOrder(before?: number, after?: number): number {
  if (before !== undefined && after !== undefined) {
    // Equal neighbors (duplicate sort_order values, e.g. legacy rows that
    // predate fractional ordering) average to that same value — the dragged
    // item would land exactly where one of its neighbors already is,
    // instead of strictly between them.
    if (before === after) return before + 0.5;
    return (before + after) / 2;
  }
  if (after !== undefined) return after - 1;
  if (before !== undefined) return before + 1;
  return 0;
}
