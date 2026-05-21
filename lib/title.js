// Normalized form of a song title used for alphabetical sorting.
// Strips a leading "the" or "a" article so e.g. "The Bells of Norwich"
// sorts under B, not T. Matches only article + whitespace boundary, so
// "Theatre" and "Apple" pass through untouched.
export function sortKey(title) {
  return title.toLowerCase().replace(/^(the|a)\s+/, "");
}
