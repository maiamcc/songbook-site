# Songbook Site

I caved and am vibecoding a songbook site.

## Song frontmatter

Each song lives in `src/songs/<slug>.md` with YAML frontmatter. The schema is enforced by `test/song-schema.js` and checked in `test/songs.test.js`.

| Field        | Type            | Required | Notes                |
| ------------ | --------------- | -------- | -------------------- |
| `title`      | string          | yes      |                      |
| `topics`     | list of strings | no       |                      |
| `genre`      | string          | no       |                      |
| `mood`       | string          | no       |                      |
| `bop_rating` | integer         | no       | 1–5 inclusive        |
| `structure`  | string          | no       |                      |
| `notes`      | string          | no       |                      |

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
