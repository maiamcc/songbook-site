// Pure sort helpers for the home-page song table.
// Extracted so they can be unit-tested without a DOM environment.
import { sortKey as titleSortKey } from "./title.js";

// Sort an array of song records by a single field, ascending or descending.
// Songs missing the sort field always sort last regardless of direction.
// Returns a new array; the original is not mutated.
//
// `enumOrders` is an optional { [field]: string[] } map. When a field has an
// entry, its values are sorted by their position in that array rather than
// alphabetically (e.g. joiny_inny: very-easy < easy < moderate < hard < n/a).
export function sortSongs(songs, field, dir, enumOrders = {}) {
  if (!field) return songs;
  return [...songs].sort((a, b) => {
    const av = getSortVal(a, field, enumOrders);
    const bv = getSortVal(b, field, enumOrders);
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
// Title field returns a de-articled lowercase key for article-aware sorting.
// When `enumOrders` contains an entry for `field`, returns the value's
// positional index so numeric comparison gives the declared enum order.
export function getSortVal(song, field, enumOrders = {}) {
  const v = song[field];
  if (v === undefined || v === null) return null;
  if (Array.isArray(v)) return v.length > 0 ? [...v].map(String).sort().join("|") : null;
  if (field === "title" && typeof v === "string") return titleSortKey(v);
  const order = enumOrders[field];
  if (order) {
    const idx = order.indexOf(String(v));
    return idx === -1 ? null : idx;
  }
  return v;
}
