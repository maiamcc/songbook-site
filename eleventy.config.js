import { configureMarkdown } from "./lib/markdown.js";

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });

  eleventyConfig.amendLibrary("md", configureMarkdown);

  eleventyConfig.addCollection("songs", (api) =>
    api.getFilteredByGlob("src/songs/*.md").sort((a, b) =>
      a.data.title.localeCompare(b.data.title)
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
