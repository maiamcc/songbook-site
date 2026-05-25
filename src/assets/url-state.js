// Pure URL-state helper for the home page.
// buildSearchParams encodes the full current view state as URLSearchParams
// so it can be serialised, restored, and shared. Keeping the construction
// pure (no history side-effects) makes it unit-testable.
//
// Params produced:
//   q=<text>            search text (omitted when blank)
//   <field>=<val>       repeated per active filter value, per field
//   cols=<f1>,<f2>      optional columns (omitted when state matches defaults,
//                       written as cols= when all defaults removed)
//   sort=<field>        active sort field (omitted when none)
//   dir=desc            sort direction (omitted when "asc", the default)
export function buildSearchParams(q, active, activeCols, defaultOptionalCols, sortField, sortDir) {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q);
  for (const [key, selected] of Object.entries(active)) {
    for (const val of selected) params.append(key, val);
  }
  // Only write cols when the state differs from the defaults, so a fresh
  // default view keeps a clean URL but removing a default column persists.
  const defaultSet = new Set(defaultOptionalCols);
  const colsMatchDefaults =
    activeCols.size === defaultSet.size &&
    [...activeCols].every((c) => defaultSet.has(c));
  if (!colsMatchDefaults) params.set("cols", [...activeCols].join(","));
  if (sortField) {
    params.set("sort", sortField);
    if (sortDir !== "asc") params.set("dir", sortDir);
  }
  return params;
}
