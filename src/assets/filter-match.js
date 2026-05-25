// Pure filter-matching logic used by table.js for client-side filtering
// on the home page. Extracted here so it can be unit-tested without a DOM
// (see test/filter.test.js).
//
// `data` is one filter-index record (url + per-field values as emitted
// by lib/filter-index.js). `active` is a plain object mapping each field
// key to a Set of selected string values.
//
// Semantics: within a field, a song matches if it has *any* of the
// selected values (OR); across fields, all active field constraints must
// be satisfied (AND).
export function songMatchesFilters(data, active) {
  for (const [key, selected] of Object.entries(active)) {
    if (selected.size === 0) continue;
    if (!data) return false;
    const val = data[key];
    if (val === undefined || val === null) return false;
    const vals = Array.isArray(val) ? val.map(String) : [String(val)];
    if (!vals.some((v) => selected.has(v))) return false;
  }
  return true;
}
