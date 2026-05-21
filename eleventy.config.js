import { readFileSync } from "node:fs";
import matter from "gray-matter";
import { configureMarkdown } from "./lib/markdown.js";
import { sortKey } from "./lib/title.js";
import { slugify } from "./lib/slug.js";
import { INDEXABLE_FIELDS, validate } from "./lib/song-schema.js";

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

  eleventyConfig.amendLibrary("md", configureMarkdown);

  eleventyConfig.addCollection("songs", (api) => {
    const songs = api.getFilteredByGlob("src/songs/*.md");
    assertValidSongs(songs);
    return songs.sort((a, b) =>
      sortKey(a.data.title).localeCompare(sortKey(b.data.title))
    );
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
