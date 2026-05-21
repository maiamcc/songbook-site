import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import nunjucks from "nunjucks";
import matter from "gray-matter";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..", "src");
const SONG_NJK = join(SRC, "_includes", "song.njk");
const INDEX_NJK = join(SRC, "index.njk");

// Render an .njk file with the given context, after stripping the
// Eleventy frontmatter block (which Nunjucks doesn't understand).
// We're testing what fields end up in the markup, not the layout chain.
function render(filepath, ctx) {
  const { content } = matter(readFileSync(filepath, "utf8"));
  return new nunjucks.Environment().renderString(content, ctx);
}

// --- song view -----------------------------------------------------------

const fullSong = {
  title: "Full Song",
  alternate_title: "Alt Name",
  author: "Some Author",
  year_written: "1990",
  topics: ["home", "travel"],
  genre: "folk",
  mood: "happy",
  bop_rating: 4,
  structure: "verse-chorus",
  notes: "play it cool",
  content: "<p>body here</p>",
};

test("song view: renders title in h1", () => {
  const html = render(SONG_NJK, fullSong);
  assert.match(html, /<h1>Full Song<\/h1>/);
});

test("song view: renders alternate_title when present", () => {
  const html = render(SONG_NJK, fullSong);
  assert.match(html, /<p class="alt-title">Alt Name<\/p>/);
});

test("song view: renders author and year_written in the byline", () => {
  const html = render(SONG_NJK, fullSong);
  assert.match(html, /<p class="byline">[\s\S]*Some Author[\s\S]*1990[\s\S]*<\/p>/);
});

test("song view: renders genre, mood, structure, topics in song-meta", () => {
  const html = render(SONG_NJK, fullSong);
  assert.match(html, /<dt>Genre<\/dt><dd>folk<\/dd>/);
  assert.match(html, /<dt>Mood<\/dt><dd>happy<\/dd>/);
  assert.match(html, /<dt>Structure<\/dt><dd>verse-chorus<\/dd>/);
  assert.match(html, /<dt>Topics<\/dt><dd>home, travel<\/dd>/);
});

test("song view: renders bop_rating as filled and empty stars out of 5", () => {
  const html = render(SONG_NJK, fullSong);
  // 4-star rating → 4 filled, 1 empty
  assert.match(html, /class="rating">★★★★☆<\/dd>/);
});

test("song view: renders notes when present", () => {
  const html = render(SONG_NJK, fullSong);
  assert.match(html, /<p class="notes">[\s\S]*play it cool[\s\S]*<\/p>/);
});

test("song view: renders the body content", () => {
  const html = render(SONG_NJK, fullSong);
  assert.match(html, /<p>body here<\/p>/);
});

test("song view: a title-only song renders no optional field markers", () => {
  const html = render(SONG_NJK, { title: "Minimal", content: "" });
  assert.match(html, /<h1>Minimal<\/h1>/);
  assert.doesNotMatch(html, /class="alt-title"/);
  assert.doesNotMatch(html, /class="byline"/);
  assert.doesNotMatch(html, /class="song-meta"/);
  assert.doesNotMatch(html, /class="notes"/);
  assert.doesNotMatch(html, /class="rating"/);
});

// --- index view ----------------------------------------------------------

const indexCtx = {
  collections: {
    songs: [
      {
        url: "/songs/full/",
        data: {
          title: "Full Song",
          alternate_title: "Alt Name",
          author: "Some Author",
        },
      },
      {
        url: "/songs/bare/",
        data: { title: "Bare Song" },
      },
    ],
  },
};

test("index view: renders a link with the title for every song", () => {
  const html = render(INDEX_NJK, indexCtx);
  assert.match(html, /<a href="\/songs\/full\/">Full Song<\/a>/);
  assert.match(html, /<a href="\/songs\/bare\/">Bare Song<\/a>/);
});

test("index view: renders alternate_title when present", () => {
  const html = render(INDEX_NJK, indexCtx);
  assert.match(html, /<span class="alt-title"> \(Alt Name\)<\/span>/);
});

test("index view: renders author when present", () => {
  const html = render(INDEX_NJK, indexCtx);
  assert.match(html, /<span class="author"> — Some Author<\/span>/);
});

test("index view: does not emit alt-title or author for songs missing them", () => {
  // Use a fixture with only the bare song so we can scope the absence check.
  const html = render(INDEX_NJK, {
    collections: { songs: [{ url: "/songs/bare/", data: { title: "Bare Song" } }] },
  });
  assert.match(html, /Bare Song/);
  assert.doesNotMatch(html, /class="alt-title"/);
  assert.doesNotMatch(html, /class="author"/);
});

test("index view: does not render fields that only appear in the song view", () => {
  // bop_rating, genre, notes, etc. should never leak into the index.
  const html = render(INDEX_NJK, {
    collections: {
      songs: [
        {
          url: "/songs/full/",
          data: {
            title: "Full Song",
            alternate_title: "Alt Name",
            author: "Some Author",
            year_written: "1990",
            topics: ["home"],
            genre: "folk",
            mood: "happy",
            bop_rating: 4,
            structure: "verse-chorus",
            notes: "secret",
          },
        },
      ],
    },
  });
  for (const leaked of ["1990", "folk", "happy", "secret", "verse-chorus", "★"]) {
    assert.ok(
      !html.includes(leaked),
      `index view should not render '${leaked}', but it does`
    );
  }
});
