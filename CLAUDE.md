# CLAUDE.md

Notes for Claude when working in this repo. Treat these as invariants —
the user has already had to remind me about them.

## Keep the schema and its documentation in sync

`test/song-schema.js` is the single source of truth for song frontmatter
fields. The README has a table that mirrors it. **Any change to the
schema must be reflected in the README in the same commit.**

When adding, removing, or renaming a field in `FIELDS` in
`test/song-schema.js`:

- Update the **frontmatter table in `README.md`** with the new row (or
  remove it). Match the existing column layout: `Field | Type | Required
  | Notes | Index | Song`.
- Update the **example YAML block in `README.md`** if the new field is
  worth illustrating, or if a removed field appears there.
- If the new field should appear on the homepage list, edit
  `src/index.njk` and check the **Index** column in the table.
- If the new field should appear on the per-song page, edit
  `src/_includes/song.njk` and check the **Song** column in the table.
- Update or add tests in `test/views.test.js` to cover the rendered
  field in whichever view(s) it surfaces in.

## Keep the views and their documentation in sync

The **Index** and **Song** columns in the README table describe what is
rendered where. If you change what `src/index.njk` or
`src/_includes/song.njk` displays:

- Tick or untick the relevant cell in the README table.
- Update `test/views.test.js` so the new (or removed) field is covered.

If unsure whether a field belongs on the index, default to **no** —
the index is for scannable browsing; the song view is for detail.
