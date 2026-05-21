// Single source of truth for song frontmatter fields.
// Add new fields here as the songbook grows.
export const REQUIRED_FIELDS = ["title"];
export const OPTIONAL_FIELDS = ["artist", "key"];

export const KNOWN_FIELDS = new Set([...REQUIRED_FIELDS, ...OPTIONAL_FIELDS]);

export function validate(data) {
  const errors = [];

  for (const field of REQUIRED_FIELDS) {
    const value = data[field];
    if (value === undefined || value === null || value === "") {
      errors.push(`missing required field: ${field}`);
    }
  }

  for (const field of Object.keys(data)) {
    if (!KNOWN_FIELDS.has(field)) {
      errors.push(`unknown field: ${field}`);
    }
  }

  return errors;
}
