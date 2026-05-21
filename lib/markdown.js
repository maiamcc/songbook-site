// Markdown-it configuration shared by the Eleventy build and tests.
//
// Conventions:
//   - Single line breaks in source render as <br> (breaks: true).
//   - Indented blocks (leading tab or 4 spaces after a blank line) render
//     as <div class="chorus"> instead of the default <pre><code>. We
//     repurpose markdown's indented-code-block syntax to mark choruses.
export function configureMarkdown(md) {
  md.set({ breaks: true });
  md.enable("code");
  md.renderer.rules.code_block = (tokens, idx) =>
    `<div class="chorus">${md.utils.escapeHtml(
      tokens[idx].content.replace(/\n+$/, "")
    )}</div>\n`;
  return md;
}
