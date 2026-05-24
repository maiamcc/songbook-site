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
| `npm run import-songs <file.csv>` | Bulk-import songs from a CSV file (see below).                              |
| `npm run check-print-pages` | Build the site, render each song's `/print/` page through headless Chrome as A5 PDF, and list any that span 2+ pages (see below). |
| `npm run deploy`   | Build the site, commit the resulting `_site/` to its own git repo with a timestamp, and push to GitHub Pages (see below). |

### Adding a song with `npm run new-song`

`scripts/new-song.js` walks every field in the schema in order and prompts for a value. Blank input skips an optional field; a required field re-prompts. Input is validated against the schema as you go, so a bad value (e.g. a non-integer for `bop_rating`) re-prompts with the canonical error.

After all fields are entered, the script proposes a slug derived from the title (with a leading `the`/`a` stripped) and asks you to accept it or enter a custom one. The file is written to `src/songs/<slug>.md` with the frontmatter populated and an empty body ready for lyrics. If the slug collides with an existing song, you're re-prompted.

For list-valued fields like `topics`, `mood`, and `structure`, enter a comma-separated string (e.g. `uplifting, sweet`).

### Importing songs from a CSV with `npm run import-songs`

`scripts/import-songs.js` bulk-creates song files from a CSV. Pass the CSV path as an argument:

```sh
npm run import-songs path/to/songs.csv
# skip the overwrite prompt and always overwrite:
npm run import-songs -- --auto-overwrite path/to/songs.csv
# also allow empty CSV cells to clear existing field values:
npm run import-songs -- --auto-overwrite --overwrite-empty path/to/songs.csv
```

The header row should use field names from the schema (`title`, `author`, `mood`, etc.). Two extra columns are also recognised:

- **`slug`** — if present and non-empty, used as the file slug; otherwise derived from the title (same rule as `new-song`).
- **`body`** — if present, written as the song's markdown body (lyrics).

For list-valued fields (`topics`, `mood`, `structure`), put a comma-separated string in the cell (e.g. `uplifting, rousing`). Rows that fail schema validation are skipped with an error message. If a song file already exists for a slug, you'll be prompted to confirm whether to overwrite it; pass `--auto-overwrite` to skip the prompt and always overwrite. When overwriting, empty CSV cells leave existing field values intact — pass `--overwrite-empty` to allow empty cells to clear existing values. All other rows are written. Unknown column names are ignored with a warning.

### Checking print-page count with `npm run check-print-pages`

`scripts/check-print-pages.js` spins up a tiny static server over `_site/`, then renders every song's `/print/` page through headless Chrome (`--headless=new --print-to-pdf`) at A5. It counts `/Type /Page` objects in the resulting PDF binary — so no extra dependencies — and prints the slugs of any songs that span two or more A5 sheets, with their page counts.

The npm script runs `npm run build` first so `_site/` is fresh; you don't need to build separately. The underlying script auto-detects Chrome at `/Applications/Google Chrome.app/...`; override with `CHROME_BIN=/path/to/chrome npm run check-print-pages` if you have it somewhere else.

### Deploying with `npm run deploy`

The build output directory `_site/` is itself a separate git repo whose `origin` is the GitHub Pages repo that serves the site (see `_site/.git/config`). The Eleventy build writes into it, and `npm run deploy` is the one-shot ship command:

1. `npm run build` — rebuild `_site/` from source.
2. In `_site/`, `git add -A` and commit any changes with a UTC timestamp (`Deploy 2026-05-21T21:14:00Z`). If nothing changed, the commit is skipped; any prior unpushed commit still gets pushed.
3. `git push` — pushes to the GitHub Pages remote, which serves the new content shortly after.

Internal URLs in the built HTML are relative (see `lib/url.js` and the `relativeUrl` filter in `eleventy.config.js`), so the same `_site/` works whether the GitHub Pages repo serves at a custom domain root or at `<user>.github.io/<repo>/`.

## Song frontmatter

Each song lives in `src/songs/<slug>.md` with YAML frontmatter. The schema is defined in `lib/song-schema.js` and enforced both in tests (`test/songs.test.js`) and at build time (the `songs` collection in `eleventy.config.js`).

| Field             | Type            | Required | Notes         | Indexable | Filter | Home | Index | Song | Print |
| ----------------- | --------------- | -------- | ------------- | --------- | ------ | ---- | ----- | ---- | ----- |
| `title`           | string          | yes      |               |           |        | ✓    | ✓     | ✓    | ✓     |
| `alternate_title` | string          | no       |               |           |        | ✓    | ✓     | ✓    | ✓     |
| `author`          | string          | yes      |               |           |        | ✓    |       | ✓    | ✓     |
| `topics`          | list of strings | no       |               | ✓         | ✓      |      | ✓     | +    |       |
| `genre`           | enum (string)   | no       | values + descriptions in [`lib/enums.yaml`](lib/enums.yaml) | ✓ | ✓ |      | ✓     | +    |       |
| `mood`            | list of enums (string) | no | values + descriptions in [`lib/enums.yaml`](lib/enums.yaml) | ✓ | ✓ |      | ✓     | +    |       |
| `bop_rating`      | enum (integer)  | yes      | 1–5 inclusive; descriptions in [`lib/enums.yaml`](lib/enums.yaml) | ✓ | ✓ |      | ✓     | ✓    | ✓     |
| `structure`       | list of enums (string) | no | values + descriptions in [`lib/enums.yaml`](lib/enums.yaml) | ✓ | ✓ |      | ✓     | +    |       |
| `known`           | enum (string)   | no       | reference-only; not rendered anywhere yet | ✓ | ✓ |      |       |      |       |
| `in_nb`           | boolean         | no       | reference-only; not rendered anywhere yet; absent ≡ false |   | ✓  |      |       |      |       |
| `joiny_inny`      | enum (string)   | no       | values + descriptions in [`lib/enums.yaml`](lib/enums.yaml) | ✓ | ✓ |      | ✓     | +    |       |
| `notes`           | string          | no       |               |           |        |      |       | ✓    | ✓     |
| `rnge`            | string          | yes      | format `aa-bb` (lowercase) |           |        |      |       | ✓    | ✓     |

The Home, Index, Song, and Print columns mark which fields, when present, are surfaced on which view. A `✓` means the field is visible by default; a `+` means the field is rendered but hidden by default behind a collapsible drawer (the "Metadata" `<details>` element on the song view).
- `Home`: the homepage list
- `Index`: on a per-value index page (listing all songs sharing one metadata value)
- `Song`: on an individual song page on screen
- `Print`: on a song's print page at `/songs/<slug>/print/` (linked from each screen song page).

The Indexable column marks fields whose values can serve as the *key* of an index page — e.g. an index of all songs with `mood: uplifting`.

The Filter column marks fields that appear as toggle-button filter controls on the home page. Selecting one or more values for a field hides songs that don't match (OR within a field, AND across fields). Filter state is reflected in the URL as query params (`?mood=rousing&mood=fun`) so a filtered view is shareable.

Example:

```yaml
---
title: Country Roads
author: John Denver
topics: [home, travel]
genre: folk
mood: [uplifting, sweet]
bop_rating: 5
structure: [chorus, zipper]
rnge: do-mi
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
