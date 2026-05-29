import { readFileSync } from "node:fs";
import matter from "gray-matter";
import MarkdownIt from "markdown-it";
import { configureMarkdown } from "./lib/markdown.js";
import { sortKey } from "./lib/title.js";
import { slugify } from "./lib/slug.js";
import { relativeUrl } from "./lib/url.js";
import { ENUMS, INDEXABLE_FIELDS, validate } from "./lib/song-schema.js";
import { buildSongIndexRecord } from "./lib/search-index.js";
import { buildFilterRecord } from "./lib/filter-index.js";
import { filterFields } from "./lib/filter-config.js";

// A standalone markdown-it instance configured the same way Eleventy's
// instance is (via configureMarkdown), used to pre-render each song's
// body so the print pagination template (src/songs-print.njk) has the
// rendered HTML available as song.data.bodyHtml. Eleventy renders the
// .md files itself for the screen view; this is purely for the parallel
// print view, which doesn't go through the .md → song.njk pipeline.
const md = configureMarkdown(MarkdownIt({ html: true }));

// Validate every song's raw frontmatter against the schema and fail
// the build with a clear, located error if anything's off. This is the
// same check `test/songs.test.js` runs, lifted to build time so the
// site stops producing pages instead of crashing deep inside Nunjucks.
function assertValidSongs(songs) {
  const problems = [];
  for (const song of songs) {
    const { data } = matter(readFileSync(song.inputPath, "utf8"));
    const errors = validate(data);
    if (errors.length > 0) {
      problems.push(`  ${song.inputPath}:\n    - ${errors.join("\n    - ")}`);
    }
  }
  if (problems.length > 0) {
    throw new Error(
      `Song frontmatter failed schema validation:\n${problems.join("\n")}`
    );
  }
}

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });

  // Expose the schema's enum value+description tables to every
  // template under `enums.<field>` (e.g. enums.joiny_inny.easy).
  // Loaded once by song-schema.js from lib/enums.yaml; re-exposing it
  // here lets templates render a legend without re-parsing YAML.
  eleventyConfig.addGlobalData("enums", ENUMS);

  // Per-field config for the home-page filter UI (field keys, labels,
  // and enum value ordering). Derived from the schema; add new filterable
  // fields to lib/filter-config.js to surface them in the filter panel.
  eleventyConfig.addGlobalData("filterFields", filterFields);

  eleventyConfig.amendLibrary("md", configureMarkdown);

  // Templates use this to build /index/<field>/<slug>/ links against
  // the same slugifier the indexEntries collection uses for permalinks.
  eleventyConfig.addFilter("slugify", slugify);

  // Rewrites root-absolute URLs to be relative to the current page so
  // the build is portable across deploy paths (custom domain root vs.
  // GitHub project page subpath). See lib/url.js.
  eleventyConfig.addFilter("relativeUrl", relativeUrl);

  // Render a short markdown snippet (e.g. a song's `notes` field) as
  // inline HTML — emphasis, links, line breaks — without wrapping it
  // in a <p>. Uses the same markdown-it instance as the body so the
  // configuration (breaks: true, chorus rule) is identical.
  eleventyConfig.addFilter("inlineMarkdown", (str) =>
    str == null ? "" : md.renderInline(String(str))
  );

  // Returns the previous and next songs (alphabetically) relative to `url`.
  // Used by song.njk to render prev/next navigation links.
  eleventyConfig.addFilter("adjacentSongs", (songs, url) => {
    if (!Array.isArray(songs)) return { prev: null, next: null };
    const idx = songs.findIndex((s) => s.url === url);
    if (idx < 0) return { prev: null, next: null };
    return {
      prev: idx > 0 ? songs[idx - 1] : null,
      next: idx < songs.length - 1 ? songs[idx + 1] : null,
    };
  });

  // Returns the number of songs sharing this (field, value) pair.
  // Used by templates to put a "N songs" tooltip on index-page links.
  eleventyConfig.addFilter("indexCount", (entries, field, value) => {
    const entry = entries.find((e) => e.field === field && e.value === value);
    return entry ? entry.songs.length : 0;
  });

  // Underscore or dash → space, so enum keys like "very_easy" or
  // "refrain-lines" read as "very easy" / "refrain lines" wherever
  // they're shown to the reader. Slugs and schema keys keep their
  // raw underscored / hyphenated form.
  eleventyConfig.addFilter("humanize", (s) =>
    typeof s === "string" ? s.replace(/[_-]/g, " ") : s
  );

  eleventyConfig.addCollection("songs", (api) => {
    const songs = api.getFilteredByGlob("src/songs/*.md");
    assertValidSongs(songs);
    for (const song of songs) {
      const { content } = matter(readFileSync(song.inputPath, "utf8"));
      song.data.bodyHtml = md.render(content);
    }
    return songs.sort((a, b) =>
      sortKey(a.data.title).localeCompare(sortKey(b.data.title))
    );
  });

  // Per-song filter data: one record per song containing only the
  // filterable fields (schema.filterable === true) that are set.
  // Emitted as /filter-index.json by src/filter-index.njk; consumed by
  // the client-side filter UI in src/assets/search.js.
  eleventyConfig.addCollection("filterIndex", (api) => {
    const songs = api.getFilteredByGlob("src/songs/*.md");
    return songs.map((song) => {
      const { data, content } = matter(readFileSync(song.inputPath, "utf8"));
      return buildFilterRecord(song.url, data, content);
    });
  });

  // Per-song search blob: every schema field's value plus the body
  // markdown, lowercased, for substring matching by src/assets/search.js
  // on the home page. New schema fields are picked up automatically;
  // there's no opt-in needed. Emitted as /search-index.json by
  // src/search-index.njk. Record shape is defined in lib/search-index.js
  // and exercised by test/search.test.js.
  eleventyConfig.addCollection("searchIndex", (api) => {
    const songs = api.getFilteredByGlob("src/songs/*.md");
    return songs.map((song) => {
      const { data, content } = matter(readFileSync(song.inputPath, "utf8"));
      return buildSongIndexRecord(song.url, data, content);
    });
  });

  // One entry per (indexable field, distinct value) pair. Drives the
  // paginated index pages in src/index-pages.njk. List-valued fields
  // (e.g. topics) are flattened: a song with topics: [home, travel]
  // contributes to both /index/topics/home/ and /index/topics/travel/.
  eleventyConfig.addCollection("indexEntries", (api) => {
    const songs = api.getFilteredByGlob("src/songs/*.md").sort((a, b) =>
      sortKey(a.data.title).localeCompare(sortKey(b.data.title))
    );
    const byKey = new Map();
    for (const song of songs) {
      for (const field of INDEXABLE_FIELDS) {
        const raw = song.data[field];
        if (raw === undefined || raw === null || raw === "") continue;
        const values = Array.isArray(raw) ? raw : [raw];
        for (const value of values) {
          const key = `${field}|${value}`;
          if (!byKey.has(key)) {
            byKey.set(key, {
              field,
              value,
              slug: slugify(value),
              songs: [],
            });
          }
          byKey.get(key).songs.push(song);
        }
      }
    }
    return [...byKey.values()].sort((a, b) =>
      a.field === b.field
        ? String(a.value).localeCompare(String(b.value))
        : a.field.localeCompare(b.field)
    );
  });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      output: "_site",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}
