// Markdown-it configuration shared by the Eleventy build and tests.
//
// Conventions:
//   - Single line breaks in source render as <br> (breaks: true).
//   - Indented blocks separated by blank lines render as <div class="chorus">.
//   - Tab-indented lines interleaved with non-indented lines (no blank line
//     separator) render as <div class="refrain">: same italic/color/border
//     treatment as chorus but no vertical margin so they flow with the verse.
//     A pre-processing core rule splits these out into their own code_block
//     tokens and marks them with a \x02 sentinel so the renderer can tell
//     them apart from standalone chorus blocks.

// \x02 (STX) is used as an in-band sentinel on the first line of a refrain
// code_block. It is inserted after the leading tab/spaces so markdown-it
// strips the indentation and leaves \x02 at the start of the token content.
const REFRAIN_SENTINEL = "\x02";

export function configureMarkdown(md) {
  md.set({ breaks: true });
  md.enable("smartquotes");
  md.enable("code");

  md.core.ruler.before("normalize", "mixed_chorus_blocks", (state) => {
    state.src = splitMixedChorusBlocks(state.src);
  });

  md.renderer.rules.code_block = (tokens, idx) => {
    const raw = tokens[idx].content.replace(/\n+$/, "");
    if (raw.startsWith(REFRAIN_SENTINEL)) {
      const content = md.utils.escapeHtml(raw.slice(1));
      return `<div class="chorus refrain">${content}</div>\n`;
    }
    return (
      raw
        .split(/\n\n+/)
        .map((part) => `<div class="chorus">${md.utils.escapeHtml(part)}</div>`)
        .join("\n") + "\n"
    );
  };
  return md;
}

const isIndented = (line) => /^(\t| {4})/.test(line);

function splitMixedChorusBlocks(src) {
  return src
    .split(/\n\n+/)
    .map((block) => {
      const lines = block.split("\n");
      if (
        !lines.some(isIndented) ||
        !lines.some((l) => !isIndented(l) && l.trim() !== "")
      ) {
        return block;
      }
      const out = [];
      for (let i = 0; i < lines.length; i++) {
        const curr = lines[i];
        const prevIndented = i > 0 && isIndented(lines[i - 1]);
        const currIndented = isIndented(curr);

        if (
          i > 0 &&
          curr.trim() !== "" &&
          lines[i - 1].trim() !== "" &&
          currIndented !== prevIndented
        ) {
          out.push("");
        }

        // Mark the first line of each indented run with the sentinel so the
        // renderer knows this is a refrain (interleaved with verse) rather
        // than a standalone chorus block already separated by blank lines.
        if (currIndented && !prevIndented) {
          out.push(curr.replace(/^(\t| {4})/, `$1${REFRAIN_SENTINEL}`));
        } else {
          out.push(curr);
        }
      }
      return out.join("\n");
    })
    .join("\n\n");
}
