// Markdown-it configuration shared by the Eleventy build and tests.
//
// Conventions:
//   - Single line breaks in source render as <br> (breaks: true).
//   - Indented blocks separated by blank lines render as <div class="chorus">.
//   - Tab-indented lines interleaved with non-indented lines (no blank line
//     separator) render as <div class="chorus refrain">: same visual
//     treatment as chorus but no vertical margin so they flow with the verse.
//
// The refrain_lines core rule runs after block parsing (when mixed paragraphs
// already exist as inline tokens) and before inline expansion. It replaces
// each mixed paragraph's paragraph_open + inline + paragraph_close triple
// with a sequence of plain paragraph tokens (verse) and html_block tokens
// (refrain), keeping standalone chorus code_blocks untouched.

const isIndented = (line) => /^(\t| {4})/.test(line);

export function configureMarkdown(md) {
  md.set({ breaks: true });
  md.enable("smartquotes");
  md.enable("code");

  md.core.ruler.before("inline", "refrain_lines", (state) => {
    const out = [];
    for (let i = 0; i < state.tokens.length; i++) {
      const token = state.tokens[i];

      if (token.type !== "inline") {
        out.push(token);
        continue;
      }

      const lines = token.content.split("\n");
      const hasRefrain = lines.some(isIndented);
      const hasVerse = lines.some((l) => !isIndented(l) && l.trim() !== "");

      if (!hasRefrain || !hasVerse) {
        out.push(token);
        continue;
      }

      // This inline token is a mixed verse/refrain paragraph. Remove the
      // paragraph_open already pushed, split into runs, and skip the
      // paragraph_close that follows.
      out.pop(); // paragraph_open
      i++;       // will skip paragraph_close at end of loop body below

      const blockLevel = token.level - 1;

      // Group consecutive lines of the same type into runs.
      const runs = [];
      for (const line of lines) {
        const type = isIndented(line) ? "refrain" : "verse";
        if (!runs.length || runs[runs.length - 1].type !== type) {
          runs.push({ type, lines: [line] });
        } else {
          runs[runs.length - 1].lines.push(line);
        }
      }

      for (let j = 0; j < runs.length; j++) {
        const run = runs[j];
        const isLast = j === runs.length - 1;
        const nextIsRefrain = !isLast && runs[j + 1].type === "refrain";

        if (run.type === "verse") {
          const open = new state.Token("paragraph_open", "p", 1);
          open.level = blockLevel;
          // Mark verse paragraphs that are immediately followed by a refrain
          // in the same stanza so CSS can suppress just that bottom margin.
          if (nextIsRefrain) open.attrSet("class", "verse-pre-refrain");
          const inlineTok = new state.Token("inline", "", 0);
          inlineTok.content = run.lines.join("\n");
          inlineTok.level = token.level;
          inlineTok.children = [];
          const close = new state.Token("paragraph_close", "p", -1);
          close.level = blockLevel;
          out.push(open, inlineTok, close);
        } else {
          const content = run.lines
            .map((l) => l.replace(/^(\t| {4})/, ""))
            .join("\n");
          // Mid-stanza refrains (verse follows in the same stanza) get an
          // extra class so CSS can suppress only the *next* paragraph's
          // top margin without affecting the next stanza.
          const cls = isLast
            ? "chorus refrain"
            : "chorus refrain refrain-mid";
          const html = new state.Token("html_block", "", 0);
          html.content = `<div class="${cls}">${md.utils.escapeHtml(content)}</div>\n`;
          html.level = blockLevel;
          out.push(html);
        }
      }
    }
    state.tokens = out;
  });

  md.renderer.rules.code_block = (tokens, idx) =>
    tokens[idx].content
      .replace(/\n+$/, "")
      .split(/\n\n+/)
      .map((part) => `<div class="chorus">${md.utils.escapeHtml(part)}</div>`)
      .join("\n") + "\n";

  return md;
}
