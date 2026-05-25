// Builds one record of the home-page filter index from a song's URL
// and frontmatter data. Filterable fields (FIELDS[f].filterable) plus
// a fixed set of table display fields (title, alternate_title, author)
// are included; absent or null values are dropped so the JSON stays
// compact. Consumed by the `filterIndex` collection in eleventy.config.js
// and emitted as /filter-index.json by src/filter-index.njk.
import { FILTERABLE_FIELDS, FIELDS } from "./song-schema.js";
import { slugify } from "./slug.js";

// Non-filterable fields always included for table display and sorting.
const TABLE_FIELDS = ["title", "alternate_title", "author"];

export function buildFilterRecord(url, data) {
  const record = { url };
  for (const field of TABLE_FIELDS) {
    const v = data[field];
    if (v !== undefined && v !== null && v !== "") record[field] = v;
  }
  const indexUrls = {};
  for (const field of FILTERABLE_FIELDS) {
    const v = data[field];
    if (v !== undefined && v !== null && v !== "") {
      record[field] = v;
      if (FIELDS[field].indexable) {
        indexUrls[field] = Array.isArray(v)
          ? v.map((item) => `/index/${field}/${slugify(String(item))}/`)
          : `/index/${field}/${slugify(String(v))}/`;
      }
    }
  }
  if (Object.keys(indexUrls).length > 0) record.indexUrls = indexUrls;
  return record;
}
