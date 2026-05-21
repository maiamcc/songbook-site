# Songbook Site

I caved and am vibecoding a songbook site.

## Getting started

Clone the repo, then from the project root:

```sh
npm install
```

That installs Eleventy and the few dev dependencies (`gray-matter`, `markdown-it`, `nunjucks`) used by the build, tests, and scripts.

## Commands

| Command            | What it does                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| `npm start`        | Run Eleventy in dev mode (`eleventy --serve`). Serves the site locally with live reload.        |
| `npm run build`    | Build the site to `_site/`. Frontmatter is validated against the schema; bad data fails the build. |
| `npm run clean`    | Remove the `_site/` build output.                                                               |
| `npm test`         | Run the Node test suite (`node --test test/*.test.js`). Validates every song, asserts the README table matches the schema, and renders the view templates against fixtures. |
| `npm run new-song` | Launch the interactive new-song script (see below).                                             |

### Adding a song with `npm run new-song`

`scripts/new-song.js` walks every field in the schema in order and prompts for a value. Blank input skips an optional field; a required field re-prompts. Input is validated against the schema as you go, so a bad value (e.g. a non-integer for `bop_rating`) re-prompts with the canonical error.

After all fields are entered, the script proposes a slug derived from the title (with a leading `the`/`a` stripped) and asks you to accept it or enter a custom one. The file is written to `src/songs/<slug>.md` with the frontmatter populated and an empty body ready for lyrics. If the slug collides with an existing song, you're re-prompted.

For list-valued fields like `topics`, enter a comma-separated string (e.g. `home, travel`).

## Song frontmatter

Each song lives in `src/songs/<slug>.md` with YAML frontmatter. The schema is defined in `lib/song-schema.js` and enforced both in tests (`test/songs.test.js`) and at build time (the `songs` collection in `eleventy.config.js`).

| Field             | Type            | Required | Notes         | Indexable | Home | Index | Song | Print |
| ----------------- | --------------- | -------- | ------------- | --------- | ---- | ----- | ---- | ----- |
| `title`           | string          | yes      |               |           | ✓    | ✓     | ✓    | ✓     |
| `alternate_title` | string          | no       |               |           | ✓    | ✓     | ✓    | ✓     |
| `author`          | string          | no       |               |           | ✓    |       | ✓    | ✓     |
| `year_written`    | string          | no       |               |           |      |       | ✓    | ✓     |
| `topics`          | list of strings | no       |               | ✓         |      | ✓     | +    |       |
| `genre`           | string          | no       |               | ✓         |      | ✓     | +    |       |
| `mood`            | string          | no       |               | ✓         |      | ✓     | +    |       |
| `bop_rating`      | integer         | no       | 1–5 inclusive | ✓         |      | ✓     | ✓    | ✓     |
| `structure`       | string          | no       |               | ✓         |      | ✓     | +    |       |
| `notes`           | string          | no       |               |           |      |       | ✓    | ✓     |
| `rnge`            | string          | no       | format `aa-bb` (lowercase) |           |      |       | ✓    |       |

The Home, Index, Song, and Print columns mark which fields, when present, are surfaced on which view. A `✓` means the field is visible by default; a `+` means the field is rendered but hidden by default behind a collapsible drawer (the "Metadata" `<details>` element on the song view).
- `Home`: the homepage list
- `Index`: on a per-value index page (listing all songs sharing one metadata value)
- `Song`: on an individual song page on screen
- `Print`: on a song's print page at `/songs/<slug>/print/` (linked from each screen song page).

The Indexable column marks fields whose values can serve as the *key* of an index page — e.g. an index of all songs with `mood: uplifting`.

Example:

```yaml
---
title: Country Roads
topics: [home, travel]
genre: folk
mood: nostalgic
bop_rating: 5
structure: verse-chorus
notes: capo 2 sounds nicer
---
```

## Lyrics

Everything after the frontmatter is the song's lyrics.

Verses are plain text.  Indent a line (one tab, or four spaces, after a blank line) to mark it as a chorus or refrain. Indented blocks render as `<div class="chorus">` and pick up a distinct visual style.

```markdown
Mary had a little lamb (3x)
Mary had a little lamb, its fleece was white as snow.
And everywhere that Mary went (3x)
The lamb was sure to go.

	Hurrah for Mary, Hurrah for the lamb!
	Hurrah for the Union Boys who did not give a damn!
    ...
```

Markdown rendering is configured in `lib/markdown.js` and exercised by `test/markdown.test.js`.
