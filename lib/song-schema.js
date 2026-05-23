// Single source of truth for song frontmatter fields.
// Add new fields here as the songbook grows.
//
// For closed-set string fields (e.g. joiny_inny), the legal values
// and their descriptions live in lib/enums.yaml and are pulled in
// here as `ENUMS`. Define the field via `enumField({ values: ENUMS.foo, ... })`
// rather than hand-rolling a check — the factory generates a
// membership check, an informative `type` string for error messages,
// and surfaces the same value map to templates (via the `enums`
// global registered in eleventy.config.js) so the song view can
// render a legend without re-parsing the YAML.
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

import { readFileSync } from "node:fs";
import yaml from "js-yaml";

// Load + lightly validate enums.yaml. Shape per top-level field is
// { desc, values: { <key>: <description> } } — both desc and each
// description are required strings. Anything else throws at module
// load so a malformed YAML fails the build with a clear pointer
// instead of producing an empty-tooltip render downstream.
function loadEnums(yamlStr) {
  const raw = yaml.load(yamlStr);
  const out = {};
  for (const [field, body] of Object.entries(raw || {})) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error(`enums.yaml: "${field}" must be a map with desc + values`);
    }
    if (typeof body.desc !== "string") {
      throw new Error(`enums.yaml: "${field}" missing string "desc"`);
    }
    if (!body.values || typeof body.values !== "object" || Array.isArray(body.values)) {
      throw new Error(`enums.yaml: "${field}.values" must be a map`);
    }
    for (const [key, v] of Object.entries(body.values)) {
      if (typeof v !== "string") {
        throw new Error(
          `enums.yaml: "${field}.values.${key}" must be a string description`
        );
      }
    }
    out[field] = { desc: body.desc, values: body.values };
  }
  return out;
}

export const ENUMS = loadEnums(
  readFileSync(new URL("./enums.yaml", import.meta.url), "utf8")
);

const isString = (v) => typeof v === "string";
const isStringList = (v) => Array.isArray(v) && v.every(isString);
const isBopRating = (v) =>
  typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5;
const RANGE_RE = /^[a-z]{2}-[a-z]{2}$/;
const isRange = (v) => isString(v) && RANGE_RE.test(v);

// Build a FIELDS entry for a closed-set string field. The inputs are
// the normalized shape produced by loadEnums(): `desc` is the field-
// level description and `values` is a {key: {description, human_readable}}
// map. `check` enforces membership; `type` lists the legal keys so the
// validate() error message is self-explanatory; both `desc` and `values`
// are carried through so templates can render the field tooltip and
// the per-value legend without re-parsing the YAML.
//
// Usage:
//   joiny_inny: enumField({
//     ...ENUMS.joiny_inny,            // spreads in desc + values
//     required: false,
//     display: ["song", "index"],
//     collapsedOn: ["song"],
//     indexable: true,
//   })
export function enumField({ desc, values, required, display, indexable, collapsedOn, check }) {
  const keys = Object.keys(values);
  const valid = new Set(keys);
  const entry = {
    required,
    type: `one of: ${keys.join(", ")}`,
    desc,
    values,
    // Default check expects string values (the joiny_inny case). Pass
    // `check` to override — e.g. bop_rating wants its integer 1-5
    // check from isBopRating since YAML integer keys load as strings
    // in the values map but frontmatter still types as int.
    check: check || ((v) => typeof v === "string" && valid.has(v)),
    display,
  };
  if (indexable) entry.indexable = true;
  if (collapsedOn) entry.collapsedOn = collapsedOn;
  return entry;
}

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
  bop_rating: enumField({
    ...ENUMS.bop_rating,
    required: true,
    display: ["index", "song", "print"],
    indexable: true,
    check: isBopRating,
  }),
  structure: {
    required: false,
    type: "string",
    check: isString,
    display: ["index", "song"],
    collapsedOn: ["song"],
    indexable: true,
  },
  joiny_inny: enumField({
    ...ENUMS.joiny_inny,
    required: false,
    display: ["index", "song"],
    collapsedOn: ["song"],
    indexable: true,
  }),
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
