import { configureMarkdown } from "./lib/markdown.js";
import { sortKey } from "./lib/title.js";

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });

  eleventyConfig.amendLibrary("md", configureMarkdown);

  eleventyConfig.addCollection("songs", (api) =>
    api.getFilteredByGlob("src/songs/*.md").sort((a, b) =>
      sortKey(a.data.title).localeCompare(sortKey(b.data.title))
    )
  );

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
