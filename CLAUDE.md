# CLAUDE.md

Notes for Claude when working in this repo.

## `test/song-schema.js` is the single source of truth for songs

The `FIELDS` object in `test/song-schema.js` defines every frontmatter
field: its type, whether it's required, and where it renders
(`display: ["index", "song"]`). Two tests enforce that the rest of the
project agrees with the schema:

- `test/readme.test.js` parses the frontmatter table in `README.md` and
  asserts each row's Required / Index / Song columns match `FIELDS`.
- `test/views.test.js` renders `src/index.njk` and
  `src/_includes/song.njk` with a fixture and asserts each field renders
  (or doesn't) according to `FIELDS[field].display`.

### Workflow for changing the schema

1. Edit `test/song-schema.js` — add, remove, or rename the field, and
   set its `required`, `type`, `check`, and `display` properties.
2. Run `npm test`. The README and view tests will fail until the rest
   of the project agrees.
3. Update the **frontmatter table in `README.md`** so the row matches
   the schema (Required column = "yes"/"no", Index/Song columns marked
   with ✓ to match `display`).
4. If `display` includes `"index"`, edit `src/index.njk`. If it
   includes `"song"`, edit `src/_includes/song.njk`. The templates are
   handwritten because rendering is per-field bespoke (stars for
   `bop_rating`, byline join for `author`/`year_written`, etc.).
5. Add an entry in `FIELD_FIXTURES` in `test/views.test.js` if the new
   field needs a custom rendered-form marker (e.g. for non-string types
   whose literal value doesn't appear in the HTML).
6. Update the example YAML block in the README if the new field is
   worth illustrating.

### What you should *not* do

- Don't edit the README table without also updating the schema (or vice
  versa) — the test will fail and you'll have to come back.
- Don't try to drive the view templates programmatically from the
  schema. Presentation is bespoke; keep it in the templates.
- Don't move `FIELDS` to declare presentation details (CSS classes, star
  glyphs, etc.) — `display` is intentionally just a list of view names.
