// Single source of truth for song frontmatter fields.
// Add new fields here as the songbook grows.
//
// `display` lists the views where this field (when present) is rendered.
// Valid entries: "home" (homepage list) and "song" (per-song page).
// The README frontmatter table is asserted to match these declarations
// (see test/readme.test.js), as are the actual view templates (see
// test/views.test.js). Edit only this file; the rest is checked.

const isString = (v) => typeof v === "string";
const isStringList = (v) => Array.isArray(v) && v.every(isString);
const isBopRating = (v) =>
  typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5;

export const FIELDS = {
  title: {
    required: true,
    type: "string",
    check: isString,
    display: ["home", "song"],
  },
  alternate_title: {
    required: false,
    type: "string",
    check: isString,
    display: ["home", "song"],
  },
  author: {
    required: false,
    type: "string",
    check: isString,
    display: ["home", "song"],
  },
  year_written: {
    required: false,
    type: "string",
    check: isString,
    display: ["song"],
  },
  topics: {
    required: false,
    type: "list[string]",
    check: isStringList,
    display: ["song"],
  },
  genre: {
    required: false,
    type: "string",
    check: isString,
    display: ["song"],
  },
  mood: {
    required: false,
    type: "string",
    check: isString,
    display: ["song"],
  },
  bop_rating: {
    required: false,
    type: "integer 1-5",
    check: isBopRating,
    display: ["song"],
  },
  structure: {
    required: false,
    type: "string",
    check: isString,
    display: ["song"],
  },
  notes: {
    required: false,
    type: "string",
    check: isString,
    display: ["song"],
  },
};

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
      errors.push(`field ${field} must be ${spec.type}`);
    }
  }

  return errors;
}
