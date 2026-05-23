import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import nunjucks from "nunjucks";
import matter from "gray-matter";
import MarkdownIt from "markdown-it";
import { ENUMS, FIELDS } from "../lib/song-schema.js";
import { slugify } from "../lib/slug.js";
import { relativeUrl } from "../lib/url.js";
import { configureMarkdown } from "../lib/markdown.js";

// Mirror the eleventy.config.js inlineMarkdown filter so notes
// render through the same markdown-it instance the build uses.
const md = configureMarkdown(MarkdownIt({ html: true }));
const inlineMarkdown = (str) =>
  str == null ? "" : md.renderInline(String(str));

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..", "src");
const INCLUDES = join(SRC, "_includes");
const SONG_NJK = join(INCLUDES, "song.njk");
const SONG_PRINT_NJK = join(INCLUDES, "song-print.njk");
const HOME_NJK = join(SRC, "index.njk");
const INDEX_NJK = join(SRC, "index-pages.njk");

// Render an .njk file with the given context, after stripping the
// Eleventy frontmatter block (which Nunjucks doesn't understand).
// We're testing what fields end up in the markup, not the layout chain.
// Filters here must mirror what eleventy.config.js registers, since
// the templates use them.
function render(filepath, ctx) {
  const { content } = matter(readFileSync(filepath, "utf8"));
  // Loader on the _includes directory so {% import "macros.njk" %}
  // resolves the same way Eleventy resolves it at build time.
  const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(INCLUDES));
  env.addFilter("slugify", slugify);
  env.addFilter("relativeUrl", relativeUrl);
  env.addFilter("inlineMarkdown", inlineMarkdown);
  env.addFilter("humanize", (s) =>
    typeof s === "string" ? s.replace(/_/g, " ") : s
  );
  env.addFilter("indexCount", (entries, field, value) => {
    const entry = entries.find((e) => e.field === field && e.value === value);
    return entry ? entry.songs.length : 0;
  });
  // Mirror the eleventy.config.js enumHelpText filter so song.njk's
  // "?" tooltip can render without registering a separate Nunjucks env.
  env.addFilter("enumHelpText", (enumDef) => {
    if (!enumDef) return "";
    const lines = [enumDef.desc, ""];
    for (const [k, v] of Object.entries(enumDef.values || {})) {
      lines.push(`${k.replace(/_/g, " ")}: ${v}`);
    }
    return lines.join("\n");
  });
  return env.renderString(content, {
    // Templates expect collections.indexEntries to exist. Default to
    // an empty list; individual tests can override.
    collections: { indexEntries: [], ...(ctx.collections || {}) },
    // Mirror eleventy.config.js's addGlobalData("enums", ENUMS) so the
    // enumLink macro can resolve `enums[field][value]` to a description.
    // Tests can override by passing their own enums in ctx.
    enums: ENUMS,
    ...ctx,
  });
}

// Slice out a <details class="X">…</details> block while honoring
// nested <details> elements. A non-greedy regex would stop at the
// first inner </details> (e.g. the enum-legend nested inside the
// Metadata drawer); this walks open/close pairs to find the matching
// outer close.
function extractBalancedDetails(html, className) {
  const open = `<details class="${className}">`;
  const start = html.indexOf(open);
  if (start < 0) return null;
  let depth = 1;
  let i = start + open.length;
  while (depth > 0) {
    const nextOpen = html.indexOf("<details", i);
    const nextClose = html.indexOf("</details>", i);
    if (nextClose < 0) return null;
    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth++;
      i = nextOpen + "<details".length;
    } else {
      depth--;
      i = nextClose + "</details>".length;
    }
  }
  return html.slice(start, i);
}

// Fixture values per field. Each value is paired with a "marker" string
// that must (or must not) appear in the rendered HTML to prove the field
// did (or did not) render. Markers are unique sentinels chosen so they
// can't appear coincidentally.
const FIELD_FIXTURES = {
  title: { value: "TitleSentinel", marker: "TitleSentinel" },
  alternate_title: { value: "AltTitleSentinel", marker: "AltTitleSentinel" },
  author: { value: "AuthorSentinel", marker: "AuthorSentinel" },
  topics: { value: ["TopicSentinel"], marker: "TopicSentinel" },
  genre: { value: "GenreSentinel", marker: "GenreSentinel" },
  mood: { value: "MoodSentinel", marker: "MoodSentinel" },
  // bop_rating renders as "N / 5" on screen (and on index pages); the
  // print view drops the "/ 5" and the index link, so it gets its own
  // distinctive marker that targets the <dt>Bop</dt><dd>N</dd> pair.
  bop_rating: {
    value: 3,
    marker: /3 \/ 5/,
    printMarker: /<dt>Bop<\/dt><dd>3<\/dd>/,
  },
  structure: { value: "StructureSentinel", marker: "StructureSentinel" },
  // joiny_inny is an enum field — value must be a legal key from
  // lib/enums.yaml or validate() will reject it. Pick the first key
  // from ENUMS at runtime rather than hardcoding one, so editing the
  // YAML doesn't break this test as long as *some* values are defined.
  // The marker is anchored to the link the enumLink macro emits so a
  // passing test confirms not just text presence but the wiring (href
  // to /index/joiny_inny/<slug>/ and the description in title=).
  joiny_inny: (() => {
    const value = Object.keys(ENUMS.joiny_inny.values)[0];
    const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const humanized = value.replace(/_/g, " ");
    return {
      value,
      marker: new RegExp(
        `href="/index/joiny_inny/${escape(slugify(value))}/"[^>]*title="[^"]+"[^>]*>${escape(humanized)}<`
      ),
    };
  })(),
  notes: { value: "NotesSentinel", marker: "NotesSentinel" },
  // rnge is validated against [a-z]{2}-[a-z]{2} and rendered as the
  // two halves with an arrow between, so the raw "qz-rk" string never
  // appears in the markup. The marker matches the two halves in
  // source order; qz/rk are distinct enough that a false positive is
  // not a concern.
  rnge: { value: "qz-rk", marker: /qz[\s\S]*?rk/ },
};

function contains(html, marker) {
  return marker instanceof RegExp ? marker.test(html) : html.includes(marker);
}

// song-print.njk is a Nunjucks macro file, not a standalone template,
// so we render by importing it and invoking the macro with a song-data
// object and a pre-rendered bodyHtml string (same shape Eleventy passes
// at build time from src/songs-print.njk).
function renderPrint(songData, bodyHtml) {
  const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(INCLUDES));
  env.addFilter("inlineMarkdown", inlineMarkdown);
  return env.renderString(
    `{% import "song-print.njk" as p %}{{ p.renderSongPrint(s, body) }}`,
    { s: songData, body: bodyHtml || "" }
  );
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

  test(`print view: ${field} ${spec.display.includes("print") ? "renders" : "does NOT render"}`, () => {
    const html = renderPrint(fullSong, fullSong.content);
    const shouldRender = spec.display.includes("print");
    const marker = fixture.printMarker || fixture.marker;
    assert.equal(
      contains(html, marker),
      shouldRender,
      `expected ${field} marker to ${shouldRender ? "" : "not "}appear in print view`
    );
  });
}

// --- presentation invariants not derivable from the schema ------------------

test("song view: title renders inside an h1", () => {
  const html = render(SONG_NJK, fullSong);
  assert.match(html, /<h1>[\s\S]*?TitleSentinel[\s\S]*?<\/h1>/);
});

test("song view: byline is the author", () => {
  const html = render(SONG_NJK, fullSong);
  assert.match(html, /<p class="byline">\s*AuthorSentinel\s*<\/p>/);
});

test("print view: byline is the author", () => {
  const html = renderPrint(fullSong, fullSong.content);
  assert.match(html, /<p class="byline">\s*AuthorSentinel\s*<\/p>/);
});

test("song view: rnge renders as low [arrow] high inline", () => {
  const html = render(SONG_NJK, fullSong);
  // qz/rk are the FIELD_FIXTURES sentinel halves; the field name is
  // "rnge" rather than "range" to avoid a Nunjucks builtin collision.
  assert.match(
    html,
    /<span class="range">qz<svg class="range-arrow"[\s\S]*?<\/svg>rk<\/span>/
  );
});

test("song view: bop_rating renders as 'N / 5' inside a .rating link", () => {
  for (const n of [1, 2, 3, 4, 5]) {
    const html = render(SONG_NJK, { ...fullSong, bop_rating: n });
    // <dd class="rating"><span class="screen-only"><a href="/index/bop_rating/N/" title="...">N / 5</a></span>...
    assert.match(
      html,
      new RegExp(
        `class="rating"[\\s\\S]*?<a [^>]*href="/index/bop_rating/${n}/"[^>]*>${n} / 5<`
      )
    );
  }
});

test("song view: indexable values link to /index/<field>/<slug>/", () => {
  const html = render(SONG_NJK, fullSong);
  for (const [field, slug] of [
    ["genre", "genresentinel"],
    ["mood", "moodsentinel"],
    ["structure", "structuresentinel"],
    ["bop_rating", "3"],
    ["topics", "topicsentinel"],
  ]) {
    assert.match(
      html,
      new RegExp(`href="/index/${field}/${slug}/"`),
      `missing link to /index/${field}/${slug}/`
    );
  }
});

test("song view: index links carry an N-songs tooltip from collections.indexEntries", () => {
  const html = render(SONG_NJK, {
    ...fullSong,
    collections: {
      indexEntries: [
        { field: "mood", value: "MoodSentinel", songs: [1, 2, 3] },
        { field: "genre", value: "GenreSentinel", songs: [1] },
      ],
    },
  });
  assert.match(
    html,
    /href="\/index\/mood\/moodsentinel\/" title="3 songs"/
  );
  assert.match(html, /href="\/index\/genre\/genresentinel\/" title="1 song"/);
});

test("song view: each topic gets its own index link", () => {
  const html = render(SONG_NJK, {
    ...fullSong,
    topics: ["alpha", "beta gamma"],
  });
  assert.match(html, /href="\/index\/topics\/alpha\/"[^>]*>alpha</);
  assert.match(html, /href="\/index\/topics\/beta-gamma\/"[^>]*>beta gamma</);
});

test("song view: body content passes through", () => {
  const html = render(SONG_NJK, fullSong);
  assert.match(html, /<p>body sentinel<\/p>/);
});

test("print view: body content passes through", () => {
  const html = renderPrint(fullSong, fullSong.content);
  assert.match(html, /<p>body sentinel<\/p>/);
});

test("print view: bop_rating renders as plain 'Bop: N' (no /5, no link)", () => {
  const html = renderPrint(fullSong, fullSong.content);
  assert.match(html, /<dt>Bop<\/dt><dd>3<\/dd>/);
  assert.doesNotMatch(html, /href="\/index\/bop_rating\//);
});

test("print view: file path is reachable", () => {
  // Read the file directly to make sure the symbol is exercised — the
  // renderPrint helper loads it via the loader, but this guards against
  // accidental renames slipping past the schema-driven loop above.
  const src = readFileSync(SONG_PRINT_NJK, "utf8");
  assert.match(src, /macro renderSongPrint/);
});

test("song view: schema's collapsedOn:['song'] fields land inside the drawer", () => {
  // The "Metadata" <details> drawer holds the schema's collapsedOn:["song"]
  // fields. Fields that are display:["song"] but NOT in collapsedOn must
  // render outside the drawer (e.g. bop_rating sits in its own song-meta
  // dl so the rating stays visible by default).
  const html = render(SONG_NJK, fullSong);
  const drawer = extractBalancedDetails(html, "song-meta-drawer");
  assert.ok(drawer, "expected a .song-meta-drawer <details> block");
  const outside = html.replace(drawer, "");

  for (const [field, spec] of Object.entries(FIELDS)) {
    if (!spec.display.includes("song")) continue;
    const fixture = FIELD_FIXTURES[field];
    const collapsed = (spec.collapsedOn || []).includes("song");
    const target = collapsed ? drawer : outside;
    const other = collapsed ? outside : drawer;
    assert.ok(
      contains(target, fixture.marker),
      `expected ${field} marker ${collapsed ? "inside" : "outside"} the drawer`
    );
    assert.ok(
      !contains(other, fixture.marker),
      `expected ${field} marker NOT ${collapsed ? "outside" : "inside"} the drawer`
    );
  }
});

test("song view: a title-only song renders no optional field markers", () => {
  const html = render(SONG_NJK, { title: "Minimal", content: "" });
  assert.match(html, /<h1>[\s\S]*?Minimal[\s\S]*?<\/h1>/);
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
  // For bop_rating specifically, the value is rendered as "N / 5".
  assert.match(html, /<span class="index-field">bop rating:<\/span>/);
  assert.match(html, /<span class="rating">4 \/ 5<\/span>/);
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
