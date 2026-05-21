import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import nunjucks from "nunjucks";
import matter from "gray-matter";
import { FIELDS } from "./song-schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..", "src");
const SONG_NJK = join(SRC, "_includes", "song.njk");
const HOME_NJK = join(SRC, "index.njk");
const INDEX_NJK = join(SRC, "index-pages.njk");

// Render an .njk file with the given context, after stripping the
// Eleventy frontmatter block (which Nunjucks doesn't understand).
// We're testing what fields end up in the markup, not the layout chain.
function render(filepath, ctx) {
  const { content } = matter(readFileSync(filepath, "utf8"));
  return new nunjucks.Environment().renderString(content, ctx);
}

// Fixture values per field. Each value is paired with a "marker" string
// that must (or must not) appear in the rendered HTML to prove the field
// did (or did not) render. Markers are unique sentinels chosen so they
// can't appear coincidentally.
const FIELD_FIXTURES = {
  title: { value: "TitleSentinel", marker: "TitleSentinel" },
  alternate_title: { value: "AltTitleSentinel", marker: "AltTitleSentinel" },
  author: { value: "AuthorSentinel", marker: "AuthorSentinel" },
  year_written: { value: "YearSentinel1492", marker: "YearSentinel1492" },
  topics: { value: ["TopicSentinel"], marker: "TopicSentinel" },
  genre: { value: "GenreSentinel", marker: "GenreSentinel" },
  mood: { value: "MoodSentinel", marker: "MoodSentinel" },
  // bop_rating renders as stars, not its literal value — match the .rating div instead.
  bop_rating: { value: 3, marker: /class="rating">★★★☆☆</ },
  structure: { value: "StructureSentinel", marker: "StructureSentinel" },
  notes: { value: "NotesSentinel", marker: "NotesSentinel" },
};

function contains(html, marker) {
  return marker instanceof RegExp ? marker.test(html) : html.includes(marker);
}

const fullSong = Object.fromEntries(
  Object.entries(FIELD_FIXTURES).map(([k, v]) => [k, v.value])
);
fullSong.content = "<p>body sentinel</p>";

// --- schema-driven: each field renders in exactly the views it declares -----

for (const [field, spec] of Object.entries(FIELDS)) {
  const fixture = FIELD_FIXTURES[field];

  test(`song view: ${field} ${spec.display.includes("song") ? "renders" : "does NOT render"}`, () => {
    const html = render(SONG_NJK, fullSong);
    const shouldRender = spec.display.includes("song");
    assert.equal(
      contains(html, fixture.marker),
      shouldRender,
      `expected ${field} marker to ${shouldRender ? "" : "not "}appear in song view`
    );
  });

  test(`home view: ${field} ${spec.display.includes("home") ? "renders" : "does NOT render"}`, () => {
    const html = render(HOME_NJK, {
      collections: { songs: [{ url: "/songs/x/", data: fullSong }] },
    });
    const shouldRender = spec.display.includes("home");
    assert.equal(
      contains(html, fixture.marker),
      shouldRender,
      `expected ${field} marker to ${shouldRender ? "" : "not "}appear in home view`
    );
  });

  test(`index view: ${field} ${spec.display.includes("index") ? "renders" : "does NOT render"}`, () => {
    // Pick a non-special field for the entry key so the heading doesn't
    // collide with the per-song row's content for that same field.
    const html = render(INDEX_NJK, {
      entry: {
        field: "genre",
        value: "FilterSentinel",
        slug: "filtersentinel",
        songs: [{ url: "/songs/x/", data: fullSong }],
      },
    });
    const shouldRender = spec.display.includes("index");
    assert.equal(
      contains(html, fixture.marker),
      shouldRender,
      `expected ${field} marker to ${shouldRender ? "" : "not "}appear in index view`
    );
  });
}

// --- presentation invariants not derivable from the schema ------------------

test("song view: title renders inside an h1", () => {
  const html = render(SONG_NJK, fullSong);
  assert.match(html, /<h1>TitleSentinel<\/h1>/);
});

test("song view: byline joins author and year_written with ·", () => {
  const html = render(SONG_NJK, fullSong);
  assert.match(
    html,
    /<p class="byline">[\s\S]*AuthorSentinel[\s\S]*·[\s\S]*YearSentinel1492[\s\S]*<\/p>/
  );
});

test("song view: bop_rating renders as N filled then 5-N empty stars", () => {
  for (const n of [1, 2, 3, 4, 5]) {
    const stars = "★".repeat(n) + "☆".repeat(5 - n);
    const html = render(SONG_NJK, { ...fullSong, bop_rating: n });
    assert.match(html, new RegExp(`class="rating">${stars}<`));
  }
});

test("song view: body content passes through", () => {
  const html = render(SONG_NJK, fullSong);
  assert.match(html, /<p>body sentinel<\/p>/);
});

test("song view: a title-only song renders no optional field markers", () => {
  const html = render(SONG_NJK, { title: "Minimal", content: "" });
  assert.match(html, /<h1>Minimal<\/h1>/);
  for (const cls of ["alt-title", "byline", "song-meta", "notes", "rating"]) {
    assert.doesNotMatch(
      html,
      new RegExp(`class="${cls}"`),
      `unexpected .${cls} block`
    );
  }
});

test("home view: each song's title appears inside its link", () => {
  const html = render(HOME_NJK, {
    collections: {
      songs: [
        { url: "/songs/full/", data: { title: "Full Song" } },
        { url: "/songs/bare/", data: { title: "Bare Song" } },
      ],
    },
  });
  // The whole row is wrapped in <a>, so the title may sit alongside
  // other spans inside the link. Just assert href + title coexist
  // within the same anchor.
  assert.match(
    html,
    /<a [^>]*href="\/songs\/full\/"[^>]*>[\s\S]*?Full Song[\s\S]*?<\/a>/
  );
  assert.match(
    html,
    /<a [^>]*href="\/songs\/bare\/"[^>]*>[\s\S]*?Bare Song[\s\S]*?<\/a>/
  );
});

test("index view: heading shows field name (underscore→space) and value", () => {
  const html = render(INDEX_NJK, {
    entry: {
      field: "bop_rating",
      value: 4,
      slug: "4",
      songs: [{ url: "/songs/x/", data: { title: "X" } }],
    },
  });
  // For bop_rating specifically, the value is rendered as stars.
  assert.match(html, /<span class="index-field">bop rating:<\/span>/);
  assert.match(html, /<span class="rating">★★★★☆<\/span>/);
});

test("index view: heading shows literal value for non-bop_rating fields", () => {
  const html = render(INDEX_NJK, {
    entry: {
      field: "mood",
      value: "uplifting",
      slug: "uplifting",
      songs: [{ url: "/songs/x/", data: { title: "X" } }],
    },
  });
  assert.match(html, /<span class="index-field">mood:<\/span>\s*uplifting/);
});

test("index view: count line pluralizes correctly", () => {
  const one = render(INDEX_NJK, {
    entry: {
      field: "mood",
      value: "x",
      slug: "x",
      songs: [{ url: "/s/a/", data: { title: "A" } }],
    },
  });
  assert.match(one, /1 song[^s]/);

  const two = render(INDEX_NJK, {
    entry: {
      field: "mood",
      value: "x",
      slug: "x",
      songs: [
        { url: "/s/a/", data: { title: "A" } },
        { url: "/s/b/", data: { title: "B" } },
      ],
    },
  });
  assert.match(two, /2 songs/);
});

test("home view: title-only songs emit no alt-title or author markup", () => {
  const html = render(HOME_NJK, {
    collections: {
      songs: [{ url: "/songs/bare/", data: { title: "Bare Song" } }],
    },
  });
  assert.doesNotMatch(html, /class="alt-title"/);
  assert.doesNotMatch(html, /class="author"/);
});
