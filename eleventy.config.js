import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
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
  // Never build stashed songs — they live in src/songs/stash/ and are
  // excluded from the site entirely until unstashed.
  eleventyConfig.ignores.add("src/songs/stash");

  // Suppress song and print pages for songs that have no markdown body.
  // The preprocessor runs before Eleventy writes any output; returning
  // false tells Eleventy to skip this template entirely.
  eleventyConfig.addPreprocessor("suppress-no-lyrics-pages", "md", (data, content) => {
    if (!data.page.inputPath.includes("/songs/")) return;
    if (!content || !content.trim()) return false;
  });

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

  // Parses a rnge value (e.g. "so>>la") into { low, arrows, high }.
  // `arrows` is the number of '>' characters, which equals the number of
  // arrowheads to render (1 = zero octaves, 2 = one octave, etc.).
  eleventyConfig.addFilter("parseRnge", (rnge) => {
    if (!rnge) return null;
    const m = String(rnge).match(/^([a-z]{2})(>+)([a-z]{2})$/);
    if (!m) return null;
    return { low: m[1], arrows: m[2].length, high: m[3] };
  });

  // Generates an inline SVG arrow with `n` arrowheads on a single line.
  // n=1 produces the same shape as the original single-arrowhead SVG.
  // Each additional arrowhead adds a second chevron 4 units to the right,
  // and the viewBox widens accordingly.
  // Parses the rendered HTML of the choruses index page into sorted sections.
  // Splits on <hr>, extracts the <h1> text from each section for sort key
  // (stripping leading articles), and returns an array of HTML strings.
  // Parses the rendered HTML of the choruses index page into sorted sections.
  // Splits on <hr>, extracts the <h1> text from each section for the sort key
  // (stripping leading articles), and returns an array of { title, html } objects.
  // Each <br>-separated lyric line is wrapped in a <span class="lyric-line"> so
  // CSS hanging-indent applies per physical line rather than per paragraph.
  eleventyConfig.addFilter("parseChorusSections", (html) => {
    const stripArticle = (t) => t.replace(/^(the|a|an)\s+/i, "").trim();
    const wrapLines = (s) =>
      s.replace(/<p>([\s\S]*?)<\/p>/g, (_, inner) => {
        const lines = inner
          .split(/<br\s*\/?>/)
          .map((l) => `<span class="lyric-line">${l}</span>`);
        return `<p>${lines.join("")}</p>`;
      });
    return html
      .split(/<hr\s*\/?>/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const title = (s.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "";
        const shortTitle = title.replace(/\s*\(.*?\)\s*$/, "").trim();
        return { title, shortTitle, html: wrapLines(s) };
      })
      .sort((a, b) => stripArticle(a.title).localeCompare(stripArticle(b.title)));
  });

  eleventyConfig.addFilter("rngeArrow", (n) => {
    const count = Math.max(1, n);
    const w = 10 + (count - 1) * 3;
    let d = `M 1.5 5 H 8.5`;
    for (let i = 0; i < count; i++) {
      d += ` M ${6 + i * 3} 3 L ${8.5 + i * 3} 5 L ${6 + i * 3} 7`;
    }
    return `<svg class="range-arrow" viewBox="0 0 ${w} 10" aria-hidden="true"><path d="${d}" stroke="currentColor" stroke-width="0.6" stroke-linecap="round" stroke-linejoin="round" fill="none" /></svg>`;
  });

  eleventyConfig.addCollection("songs", (api) => {
    const songs = api.getFilteredByGlob("src/songs/*.md");
    assertValidSongs(songs);
    const withLyrics = [];
    for (const song of songs) {
      const { content } = matter(readFileSync(song.inputPath, "utf8"));
      if (!content || !content.trim()) continue;
      song.data.bodyHtml = md.render(content);
      withLyrics.push(song);
    }
    return withLyrics.sort((a, b) =>
      sortKey(a.data.title).localeCompare(sortKey(b.data.title))
    );
  });

  // Per-song filter data and search blob are built directly from the
  // filesystem (not from Eleventy's collection API) so that songs without
  // lyrics — which are suppressed from page output via addPreprocessor —
  // are still included in the home-page table and search.
  function allSongFiles() {
    const dir = "./src/songs";
    return readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => ({
        inputPath: join(dir, f),
        url: `/songs/${f.slice(0, -3)}/`,
      }));
  }

  eleventyConfig.addCollection("filterIndex", () =>
    allSongFiles().map(({ inputPath, url }) => {
      const { data, content } = matter(readFileSync(inputPath, "utf8"));
      return buildFilterRecord(url, data, content);
    })
  );

  eleventyConfig.addCollection("searchIndex", () =>
    allSongFiles().map(({ inputPath, url }) => {
      const { data, content } = matter(readFileSync(inputPath, "utf8"));
      return buildSongIndexRecord(url, data, content);
    })
  );

  // One entry per (indexable field, distinct value) pair. Drives the
  // paginated index pages in src/index-pages.njk. List-valued fields
  // (e.g. topics) are flattened: a song with topics: [home, travel]
  // contributes to both /index/topics/home/ and /index/topics/travel/.
  eleventyConfig.addCollection("indexEntries", () => {
    const songs = allSongFiles()
      .map(({ inputPath, url }) => {
        const { data } = matter(readFileSync(inputPath, "utf8"));
        return { url, data };
      })
      .sort((a, b) => sortKey(a.data.title).localeCompare(sortKey(b.data.title)));
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
