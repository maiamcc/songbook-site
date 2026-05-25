// Presentation configuration for the home-page filter UI.
// FILTER_LABELS maps each filterable field to its human-readable label
// and defines the display order (Object.keys iteration order). A field
// in FILTERABLE_FIELDS that is absent here still appears in filterFields
// using a humanized key, but adding it explicitly keeps things intentional.
//
// filterFields is consumed by eleventy.config.js (as a global data value
// passed to templates) and by test/filter.test.js to assert the config
// matches the schema.
import { FIELDS, FILTERABLE_FIELDS } from "./song-schema.js";

const FILTER_LABELS = {
  bop_rating: "Bop",
  mood:       "Mood",
  genre:      "Genre",
  structure:  "Structure",
  joiny_inny: "Joiny-inny",
  known:      "Known",
  topics:     "Topics",
  in_nb:      "In notebook",
};

// One entry per filterable field, in FILTER_LABELS display order.
// Fields not in FILTER_LABELS fall back to a humanized key and are
// appended at the end.
export const filterFields = [
  ...Object.keys(FILTER_LABELS).filter((k) => FILTERABLE_FIELDS.includes(k)),
  ...FILTERABLE_FIELDS.filter((k) => !(k in FILTER_LABELS)),
].map((key) => {
  const spec = FIELDS[key];
  const entry = {
    key,
    label: FILTER_LABELS[key] || key.replace(/[_-]/g, " "),
  };
  // Enum and list-enum fields carry a `values` map whose key order
  // (insertion / numeric-sort order) matches the schema's intended
  // display order. Expose it as `valueOrder` so the client renders
  // buttons in that order instead of alphabetically.
  if (spec.values) entry.valueOrder = Object.keys(spec.values).map(String);
  if (spec.indexable) entry.indexable = true;
  return entry;
});
