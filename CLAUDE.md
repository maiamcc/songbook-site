# CLAUDE.md

Notes for Claude when working in this repo.

## `lib/song-schema.js` is the single source of truth for songs

The `FIELDS` object in `lib/song-schema.js` defines every frontmatter
field: its type, whether it's required, where it renders
(`display: ["home", "index", "song", "print"]`), and whether its values
can serve as the key of an index page (`indexable: true`). Two tests
enforce that the rest of the project agrees with the schema:

- `test/readme.test.js` parses the frontmatter table in `README.md` and
  asserts each row's Required / Indexable / Home / Index / Song / Print
  columns match `FIELDS`.
- `test/views.test.js` renders `src/index.njk` (the home view) and
  `src/_includes/song.njk` (the song view) with a fixture and asserts
  each field renders (or doesn't) according to `FIELDS[field].display`.

### The four views

- **home** — the homepage list at `/`, one row per song. Template:
  `src/index.njk` (named that way because Eleventy serves `/` from a
  file literally called `index`).
- **index** — a per-value listing: all songs with a given metadata
  value (e.g. `mood=uplifting`). Only fields with `indexable: true` can
  be used as the index key. Template: `src/index-pages.njk`.
- **song** — the per-song detail page. Template:
  `src/_includes/song.njk`.
- **print** — what shows when a song page is printed (`@media print`).
  Uses the same template as the song view; fields without `"print"` in
  their `display` are hidden by CSS that targets `[data-field="…"]` on
  the rendered `<dt>/<dd>` pairs. If you add a new field that should
  print, append `"print"` to its `display` and tick the Print column
  in the README; if a new field should NOT print, add a matching rule
  in the `@media print` block of `src/assets/style.css`.

### Workflow for changing the schema

1. Edit `lib/song-schema.js` — add, remove, or rename the field, and
   set its `required`, `type`, `check`, and `display` properties.
2. Run `npm test`. The README and view tests will fail until the rest
   of the project agrees.
3. Update the **frontmatter table in `README.md`** so the row matches
   the schema (Required column = "yes"/"no", Indexable column ✓ when
   `indexable: true`, Home/Index/Song/Print columns ✓ to match
   `display`).
4. If `display` includes `"home"`, edit `src/index.njk`. If it
   includes `"index"`, edit `src/index-pages.njk`. If it includes
   `"song"`, edit `src/_includes/song.njk`. If it omits `"print"`,
   make sure the `@media print` block in `src/assets/style.css` hides
   the field's `[data-field="…"]` element. The templates are
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

## Keep README usage docs in sync with `package.json`

Whenever you add, rename, or remove a script in `package.json` (or a
standalone CLI tool the user is meant to run), update the **Commands**
section of `README.md` in the same change. New scripts that take
interactive input or non-obvious flags should also get a short
"how to use" paragraph under that table — the goal is that someone
opening the repo for the first time can run every command without
reading the source.
