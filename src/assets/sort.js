// Pure sort helpers for the home-page song table.
// Extracted so they can be unit-tested without a DOM environment.

// Sort an array of song records by a single field, ascending or descending.
// Songs missing the sort field always sort last regardless of direction.
// Returns a new array; the original is not mutated.
export function sortSongs(songs, field, dir) {
  if (!field) return songs;
  return [...songs].sort((a, b) => {
    const av = getSortVal(a, field);
    const bv = getSortVal(b, field);
    if (av === null && bv === null) return 0;
    if (av === null) return 1;  // nulls last in both directions
    if (bv === null) return -1;
    const cmp =
      typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv));
    return dir === "desc" ? -cmp : cmp;
  });
}

// Extract the value used for sorting from a single song record.
// Returns null for missing/null values (they'll sort last).
// Array fields use their first element (stringified); empty arrays → null.
export function getSortVal(song, field) {
  const v = song[field];
  if (v === undefined || v === null) return null;
  if (Array.isArray(v)) return v.length > 0 ? String(v[0]) : null;
  return v;
}
