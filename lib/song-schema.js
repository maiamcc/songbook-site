// Single source of truth for song frontmatter fields.
// Add new fields here as the songbook grows.
//
// `display` lists the views where this field (when present) is rendered.
// Valid entries: "home" (homepage list), "index" (per-value index pages
// listing all songs with a given metadata value), "song" (per-song
// screen page), and "print" (the dedicated print page at
// /songs/<slug>/print/ — fields without "print" are simply not emitted
// by the song-print.njk macro).
//
// `collapsedOn` (optional) lists views where the field is rendered but
// hidden by default behind a collapsible drawer (currently just the
// "Metadata" <details> element on the song view). The markup is still
// emitted — the field is in the DOM — it's just visually stowed until
// the reader opens the drawer. Represented in the README field table
// as "+" instead of "✓" in the relevant column.
//
// `indexable: true` marks fields that can serve as the *key* of an
// index view — i.e., it makes sense to list songs by that field's
// value (e.g. all songs with mood=uplifting). Only certain fields are
// indexable; the rest are not useful as grouping keys.
//
// The README frontmatter table is asserted to match these declarations
// (see test/readme.test.js), as are the actual view templates (see
// test/views.test.js), and every song file in src/songs/ is validated
// against this schema both in tests (test/songs.test.js) and at build
// time (assertValidSongs in eleventy.config.js). Edit only this file;
// the rest is checked.

const isString = (v) => typeof v === "string";
const isStringList = (v) => Array.isArray(v) && v.every(isString);
const isBopRating = (v) =>
  typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5;
const RANGE_RE = /^[a-z]{2}-[a-z]{2}$/;
const isRange = (v) => isString(v) && RANGE_RE.test(v);

export const FIELDS = {
  title: {
    required: true,
    type: "string",
    check: isString,
    display: ["home", "index", "song", "print"],
  },
  alternate_title: {
    required: false,
    type: "string",
    check: isString,
    display: ["home", "index", "song", "print"],
  },
  author: {
    required: true,
    type: "string",
    check: isString,
    display: ["home", "song", "print"],
  },
  topics: {
    required: false,
    type: "list[string]",
    check: isStringList,
    display: ["index", "song"],
    collapsedOn: ["song"],
    indexable: true,
  },
  genre: {
    required: false,
    type: "string",
    check: isString,
    display: ["index", "song"],
    collapsedOn: ["song"],
    indexable: true,
  },
  mood: {
    required: false,
    type: "string",
    check: isString,
    display: ["index", "song"],
    collapsedOn: ["song"],
    indexable: true,
  },
  bop_rating: {
    required: true,
    type: "integer 1-5",
    check: isBopRating,
    display: ["index", "song", "print"],
    indexable: true,
  },
  structure: {
    required: false,
    type: "string",
    check: isString,
    display: ["index", "song"],
    collapsedOn: ["song"],
    indexable: true,
  },
  notes: {
    required: false,
    type: "string",
    check: isString,
    display: ["song", "print"],
  },
  // Field is named `rnge` rather than `range` because `range` is a
  // Nunjucks builtin (the iterator function), and a missing
  // frontmatter value would fall back to that global in the template
  // context. See song.njk for the rendered shape.
  rnge: {
    required: true,
    type: "string matching [a-z]{2}-[a-z]{2}",
    check: isRange,
    display: ["song", "print"],
  },
};

export const INDEXABLE_FIELDS = Object.keys(FIELDS).filter(
  (f) => FIELDS[f].indexable
);

export const REQUIRED_FIELDS = Object.keys(FIELDS).filter(
  (f) => FIELDS[f].required
);
export const OPTIONAL_FIELDS = Object.keys(FIELDS).filter(
  (f) => !FIELDS[f].required
);
export const KNOWN_FIELDS = new Set(Object.keys(FIELDS));

export function validate(data) {
  const errors = [];

  for (const field of REQUIRED_FIELDS) {
    const value = data[field];
    if (value === undefined || value === null || value === "") {
      errors.push(`missing required field: ${field}`);
    }
  }

  for (const [field, value] of Object.entries(data)) {
    if (!KNOWN_FIELDS.has(field)) {
      errors.push(`unknown field: ${field}`);
      continue;
    }
    if (value === undefined || value === null) continue;
    const spec = FIELDS[field];
    if (!spec.check(value)) {
      errors.push(`field "${field}" must be ${spec.type}`);
    }
  }

  return errors;
}
