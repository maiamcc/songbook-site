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

// Normalize one enum's `values` (as written in enums.yaml) into a
// flat { <key>: <description-or-null> } object. Two shapes are
// accepted: a YAML mapping (each value is a string description, or
// null/omitted for self-explanatory values) or a YAML list of bare
// keys (shorthand for "all values have no description"). Numbers in
// the list form are coerced to strings so `- 1` works alongside
// `- "1"` (js-yaml parses integer-looking list items as numbers).
function normalizeEnumValues(rawValues, fieldName) {
  if (Array.isArray(rawValues)) {
    const out = {};
    for (const item of rawValues) {
      if (typeof item !== "string" && typeof item !== "number") {
        throw new Error(
          `enums.yaml: "${fieldName}.values" list entries must be strings or numbers`
        );
      }
      out[String(item)] = null;
    }
    return out;
  }
  if (rawValues && typeof rawValues === "object") {
    const out = {};
    for (const [key, v] of Object.entries(rawValues)) {
      if (v === null || v === undefined) {
        out[key] = null;
      } else if (typeof v === "string") {
        out[key] = v;
      } else {
        throw new Error(
          `enums.yaml: "${fieldName}.values.${key}" must be a string description or omitted`
        );
      }
    }
    return out;
  }
  throw new Error(`enums.yaml: "${fieldName}.values" must be a map or list`);
}

// Load + lightly validate enums.yaml. Shape per top-level field is
// { desc?, values: <map or list> } — both `desc` and any per-value
// description are optional. After normalization, the in-memory shape
// is always { desc: string|null, values: { <key>: string|null } } so
// templates and the factory have a single representation to consume.
function loadEnums(yamlStr) {
  const raw = yaml.load(yamlStr);
  const out = {};
  for (const [field, body] of Object.entries(raw || {})) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error(`enums.yaml: "${field}" must be a map`);
    }
    if (body.desc !== undefined && typeof body.desc !== "string") {
      throw new Error(`enums.yaml: "${field}.desc" must be a string if present`);
    }
    out[field] = {
      desc: body.desc ?? null,
      values: normalizeEnumValues(body.values, field),
    };
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
const isBoolean = (v) => typeof v === "boolean";

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
export function enumField({ desc, values, required, display, indexable, collapsedOn, check, filterable, coerceInt }) {
  const keys = Object.keys(values);
  const valid = new Set(keys);
  // Default check expects string values (the joiny_inny case). Pass
  // `check` to override — e.g. bop_rating wants its integer 1-5
  // check from isBopRating since YAML integer keys load as strings
  // in the values map but frontmatter still types as int.
  // `coerceInt: true` makes the default check also accept bare integers
  // by stringifying them before testing membership (e.g. known: 2 → "2").
  const defaultCheck = coerceInt
    ? (v) => { const k = typeof v === "number" ? String(v) : v; return typeof k === "string" && valid.has(k); }
    : (v) => typeof v === "string" && valid.has(v);
  const entry = {
    required,
    type: `one of: ${keys.join(", ")}`,
    desc,
    values,
    check: check || defaultCheck,
    display,
  };
  if (indexable) entry.indexable = true;
  if (filterable) entry.filterable = true;
  if (collapsedOn) entry.collapsedOn = collapsedOn;
  return entry;
}

// Build a FIELDS entry for a list-of-closed-set-strings field. Like
// enumField() but the frontmatter value must be a non-empty YAML list
// where every element is one of the legal keys. Carries the same
// `desc` and `values` so templates can render legends identically.
//
// Usage:
//   mood: listEnumField({
//     ...ENUMS.mood,
//     required: false,
//     display: ["index", "song"],
//     collapsedOn: ["song"],
//     indexable: true,
//   })
export function listEnumField({ desc, values, required, display, indexable, collapsedOn, filterable }) {
  const keys = Object.keys(values);
  const valid = new Set(keys);
  const entry = {
    required,
    type: `list of: ${keys.join(", ")}`,
    desc,
    values,
    check: (v) =>
      Array.isArray(v) &&
      v.length > 0 &&
      v.every((item) => typeof item === "string" && valid.has(item)),
    display,
  };
  if (indexable) entry.indexable = true;
  if (filterable) entry.filterable = true;
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
    filterable: true,
  },
  genre: enumField({
    ...ENUMS.genre,
    required: false,
    display: ["index", "song"],
    collapsedOn: ["song"],
    indexable: true,
    filterable: true,
  }),
  mood: listEnumField({
    ...ENUMS.mood,
    required: false,
    display: ["index", "song"],
    collapsedOn: ["song"],
    indexable: true,
    filterable: true,
  }),
  bop_rating: enumField({
    ...ENUMS.bop_rating,
    required: true,
    display: ["index", "song", "print"],
    indexable: true,
    filterable: true,
    check: isBopRating,
  }),
  structure: listEnumField({
    ...ENUMS.structure,
    required: false,
    display: ["index", "song"],
    collapsedOn: ["song"],
    indexable: true,
    filterable: true,
  }),
  joiny_inny: enumField({
    ...ENUMS.joiny_inny,
    required: false,
    display: ["index", "song"],
    collapsedOn: ["song"],
    indexable: true,
    filterable: true,
  }),
  // Reference-only enum: declared so it can be assigned to songs and
  // validated, but display: [] keeps it out of every view template
  // until you decide where to surface it. Indexable so existing
  // /index/known/<value>/ wiring works the moment you flip display on.
  known: enumField({
    ...ENUMS.known,
    required: false,
    display: [],
    indexable: true,
    filterable: true,
    coerceInt: true,
  }),
  // Reference-only boolean flag. Optional; an absent value behaves as
  // false in templates ({% if in_nb %} skips it). Not rendered anywhere
  // yet; flip display on when ready to surface it.
  in_nb: {
    required: false,
    type: "boolean",
    check: isBoolean,
    display: [],
    filterable: true,
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

export const FILTERABLE_FIELDS = Object.keys(FIELDS).filter(
  (f) => FIELDS[f].filterable
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
      errors.push(`field "${field}" must be ${spec.type} (got: ${JSON.stringify(value)})`);
    }
  }

  return errors;
}
