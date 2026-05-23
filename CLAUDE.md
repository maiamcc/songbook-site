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
- **print** — a dedicated print layout served at
  `/songs/<slug>/print/`. A small "Print view →" link on the screen
  song page leads here; the print page has a "← View on screen" link
  back. The print page renders via the `renderSongPrint` macro in
  `src/_includes/song-print.njk`, wrapped in `base-print.njk`
  (no site header). Only fields with `"print"` in their `display`
  appear in the macro — there is no `@media print` hiding logic. The
  paginated `src/songs-print.njk` walks `collections.songs` and emits
  one print page per song, using `song.data.bodyHtml` (pre-rendered
  in `eleventy.config.js`) for the lyrics. If you add a new field
  that should print, append `"print"` to its `display`, tick the
  Print column in the README, and render the field in the
  `renderSongPrint` macro.

### Closed-set (enum) fields

Fields whose value must be one of a known set of strings are defined
via the `enumField()` factory in `lib/song-schema.js`, with the legal
values and their user-facing descriptions in `lib/enums.yaml`:

```yaml
# lib/enums.yaml
joiny_inny:
  desc: how easy it is to join in on this one in a vacuum
  values:
    easy: easy in a pub sing context, e.g. simple chorus or repeated lines
    hard: fast, wordy, Nancy Kerr bullshit etc.
```

```js
// lib/song-schema.js
joiny_inny: enumField({
  ...ENUMS.joiny_inny,          // spreads in desc + values
  required: false,
  display: ["song", "index"],
  collapsedOn: ["song"],
  indexable: true,
}),
```

The factory builds a membership `check`, an informative `type` string
(`"one of: very_easy, easy, moderate, hard"` — surfaces in validate() error messages and
the `new-song` script's prompt), and carries both `desc` and `values`
through so templates can render the field-level tooltip and the
per-value legend. The same map is exposed as the `enums` template
global (registered in `eleventy.config.js`), so song.njk can show the
field description via `enums.joiny_inny.desc` and list the legal
values+descriptions via `{% for k, v in enums.joiny_inny.values %}`.
The `enumLink` macro in `src/_includes/macros.njk` uses the per-value
description as the link `title=`, replacing the standard `indexLink`'s
"N songs" tooltip.

### Workflow for changing the schema

1. Edit `lib/song-schema.js` — add, remove, or rename the field, and
   set its `required`, `type`, `check`, and `display` properties.
   For a closed-set string field, add the values to `lib/enums.yaml`
   first and define the FIELDS entry via `enumField({ values: ENUMS.foo, ... })`.
2. Run `npm test`. The README and view tests will fail until the rest
   of the project agrees.
3. Update the **frontmatter table in `README.md`** so the row matches
   the schema (Required column = "yes"/"no", Indexable column ✓ when
   `indexable: true`, Home/Index/Song/Print columns ✓ to match
   `display`).
4. If `display` includes `"home"`, edit `src/index.njk`. If it
   includes `"index"`, edit `src/index-pages.njk`. If it includes
   `"song"`, edit `src/_includes/song.njk`. If it includes `"print"`,
   edit the `renderSongPrint` macro in
   `src/_includes/song-print.njk`. The templates are handwritten
   because rendering is per-field bespoke (slash form for screen
   `bop_rating`, plain "Bop: N" for print, byline join for
   `author`/`year_written`, etc.).
5. Add an entry in `FIELD_FIXTURES` in `test/views.test.js` if the new
   field needs a custom rendered-form marker (e.g. for non-string types
   whose literal value doesn't appear in the HTML).
6. Update the example YAML block in the README if the new field is
   worth illustrating.

### Home-page search is schema-driven

The home page has a client-side search box (`src/assets/search.js`)
that filters the song list by substring matching against a JSON index
emitted at `/search-index.json` by `src/search-index.njk` (driven by
the `searchIndex` collection in `eleventy.config.js`). The collection
iterates every key in `FIELDS` plus the body markdown, so a new schema
field is automatically searchable — no template edit needed for
search. The search blob is lowercased and stored as a single string
per song; tokens in the query are ANDed.

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
