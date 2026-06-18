// Builds one record of the home-page filter index from a song's URL
// and frontmatter data. Filterable fields (FIELDS[f].filterable) plus
// a fixed set of table display fields (title, alternate_title, author)
// are included; absent or null values are dropped so the JSON stays
// compact. Consumed by the `filterIndex` collection in eleventy.config.js
// and emitted as /filter-index.json by src/filter-index.njk.
import { FILTERABLE_FIELDS, FIELDS } from "./song-schema.js";
import { slugify } from "./slug.js";

// Non-filterable fields always included for table display and sorting.
const TABLE_FIELDS = ["title", "alternate_title", "author", "author_short"];

export function buildFilterRecord(url, data, content = "") {
  // Augment data with the computed has_lyrics value before building the record.
  const augmented = {
    ...data,
    has_lyrics: Boolean(content && content.trim()),
    in_nb: data.in_nb ?? false,
  };
  const record = { url };
  for (const field of TABLE_FIELDS) {
    const v = augmented[field];
    if (v !== undefined && v !== null && v !== "") record[field] = v;
  }
  const indexUrls = {};
  for (const field of FILTERABLE_FIELDS) {
    const v = augmented[field];
    if (v !== undefined && v !== null && v !== "") {
      const sorted = Array.isArray(v)
        ? [...v].sort((a, b) => String(a).localeCompare(String(b)))
        : v;
      record[field] = sorted;
      if (FIELDS[field].indexable) {
        indexUrls[field] = Array.isArray(sorted)
          ? sorted.map((item) => `/index/${field}/${slugify(String(item))}/`)
          : `/index/${field}/${slugify(String(sorted))}/`;
      }
    }
  }
  if (Object.keys(indexUrls).length > 0) record.indexUrls = indexUrls;
  return record;
}
