// Builds one record of the home-page search index from a song's URL,
// frontmatter data, and raw markdown body. The schema (FIELDS) is the
// single source of truth — every declared field is included, so a new
// field is automatically searchable with no template edit needed.
//
// The returned `text` is a single lowercased string concatenating every
// present field value (list-valued fields joined with spaces) followed
// by the body content. The client matches against it via substring
// inclusion (see src/assets/match.js); it does not need to be parseable
// back into structured data.
//
// Consumed by the `searchIndex` collection in eleventy.config.js, which
// is then serialized to /search-index.json by src/search-index.njk.
import { FIELDS } from "./song-schema.js";

export function buildSongIndexRecord(url, data, content) {
  const parts = [];
  for (const field of Object.keys(FIELDS)) {
    const v = data[field];
    if (v === undefined || v === null) continue;
    parts.push(Array.isArray(v) ? v.join(" ") : String(v));
  }
  parts.push(content);
  return { url, text: parts.join(" ").toLowerCase() };
}
