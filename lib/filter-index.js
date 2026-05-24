// Builds one record of the home-page filter index from a song's URL
// and frontmatter data. Only filterable fields (FIELDS[f].filterable)
// are included; absent or null values are dropped so the JSON stays
// compact. Consumed by the `filterIndex` collection in eleventy.config.js
// and emitted as /filter-index.json by src/filter-index.njk.
import { FILTERABLE_FIELDS } from "./song-schema.js";

export function buildFilterRecord(url, data) {
  const record = { url };
  for (const field of FILTERABLE_FIELDS) {
    const v = data[field];
    if (v !== undefined && v !== null && v !== "") record[field] = v;
  }
  return record;
}
