# Songbook Site

I caved and am vibecoding a songbook site.

## Song frontmatter

Each song lives in `src/songs/<slug>.md` with YAML frontmatter. The schema is enforced by `test/song-schema.js` and checked in `test/songs.test.js`.

| Field             | Type            | Required | Notes         | Indexable | Home | Index | Song | Print |
| ----------------- | --------------- | -------- | ------------- | --------- | ---- | ----- | ---- | ----- |
| `title`           | string          | yes      |               |           | ✓    | ✓     | ✓    | ✓     |
| `alternate_title` | string          | no       |               |           | ✓    | ✓     | ✓    | ✓     |
| `author`          | string          | no       |               |           | ✓    |       | ✓    | ✓     |
| `year_written`    | string          | no       |               |           |      |       | ✓    | ✓     |
| `topics`          | list of strings | no       |               | ✓         |      | ✓     | ✓    |       |
| `genre`           | string          | no       |               | ✓         |      | ✓     | ✓    |       |
| `mood`            | string          | no       |               | ✓         |      | ✓     | ✓    |       |
| `bop_rating`      | integer         | no       | 1–5 inclusive | ✓         |      | ✓     | ✓    | ✓     |
| `structure`       | string          | no       |               | ✓         |      | ✓     | ✓    |       |
| `notes`           | string          | no       |               |           |      |       | ✓    | ✓     |

The Home, Index, Song, and Print columns mark which fields, when present, are surfaced on the homepage list, on a per-value index page (listing all songs sharing one metadata value), on an individual song page on screen, and on the printed form of a song page (via `@media print`), respectively. The Indexable column marks fields whose values can serve as the *key* of an index page — e.g. an index of all songs with `mood: uplifting`.

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
