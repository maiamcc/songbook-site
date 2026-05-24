// Generic slugifier: lowercases, collapses runs of non-alphanumeric
// characters to a single hyphen, and trims leading/trailing hyphens.
// Used both for filenames (the new-song script) and URL segments
// (Eleventy index pages).
export function slugify(s) {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/['‘’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
