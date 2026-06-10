// Markdown-it configuration shared by the Eleventy build and tests.
//
// Conventions:
//   - Single line breaks in source render as <br> (breaks: true).
//   - Indented blocks separated by blank lines render as <div class="chorus">.
//   - Tab-indented lines interleaved with non-indented lines (no blank line
//     separator) render as <div class="chorus refrain">: same visual
//     treatment as chorus but no vertical margin so they flow with the verse.
//   - 2-space-indented lines render as <p class="indent">: a verse paragraph
//     with a left padding, flowing tight with surrounding verse (no gaps).

const isIndented = (line) => /^(\t| {4})/.test(line);
const isHalfIndented = (line) => /^ {2}(?! {2})/.test(line);

const lineType = (line) => {
  if (isIndented(line)) return "refrain";
  if (isHalfIndented(line)) return "indent";
  return "verse";
};

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
      const hasIndent = lines.some(isHalfIndented);
      const hasVerse = lines.some((l) => lineType(l) === "verse" && l.trim() !== "");

      if (!hasIndent && (!hasRefrain || !hasVerse)) {
        out.push(token);
        continue;
      }

      // This inline token is a mixed verse/refrain/indent paragraph. Remove the
      // paragraph_open already pushed, split into runs, and skip the
      // paragraph_close that follows.
      out.pop(); // paragraph_open
      i++;       // will skip paragraph_close at end of loop body below

      const blockLevel = token.level - 1;

      // Group consecutive lines of the same type into runs.
      const runs = [];
      for (const line of lines) {
        const type = lineType(line);
        if (!runs.length || runs[runs.length - 1].type !== type) {
          runs.push({ type, lines: [line] });
        } else {
          runs[runs.length - 1].lines.push(line);
        }
      }

      for (let j = 0; j < runs.length; j++) {
        const run = runs[j];
        const isLast = j === runs.length - 1;
        const nextType = isLast ? null : runs[j + 1].type;

        if (run.type === "verse") {
          const open = new state.Token("paragraph_open", "p", 1);
          open.level = blockLevel;
          // Mark verse paragraphs immediately followed by a refrain or indent
          // so CSS can suppress just that bottom margin.
          if (nextType === "refrain") open.attrSet("class", "verse-pre-refrain");
          if (nextType === "indent") open.attrSet("class", "verse-pre-indent");
          const inlineTok = new state.Token("inline", "", 0);
          inlineTok.content = run.lines.join("\n");
          inlineTok.level = token.level;
          inlineTok.children = [];
          const close = new state.Token("paragraph_close", "p", -1);
          close.level = blockLevel;
          out.push(open, inlineTok, close);
        } else if (run.type === "indent") {
          const open = new state.Token("paragraph_open", "p", 1);
          open.level = blockLevel;
          // indent-mid: verse follows in the same stanza, so CSS can suppress
          // that next paragraph's top margin.
          const cls = isLast ? "indent" : "indent indent-mid";
          open.attrSet("class", cls);
          const inlineTok = new state.Token("inline", "", 0);
          inlineTok.content = run.lines.map((l) => l.replace(/^ {2}/, "")).join("\n");
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
