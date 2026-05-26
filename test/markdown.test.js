import { test } from "node:test";
import assert from "node:assert/strict";
import MarkdownIt from "markdown-it";
import { configureMarkdown } from "../lib/markdown.js";

function render(src) {
  return configureMarkdown(new MarkdownIt()).render(src);
}

test("tab-indented block renders as a chorus div", () => {
  const html = render("verse line\n\n\trefrain line\n\nnext verse");
  assert.match(html, /<div class="chorus">refrain line<\/div>/);
});

test("4-space-indented block renders as a chorus div", () => {
  const html = render("verse line\n\n    refrain line\n\nnext verse");
  assert.match(html, /<div class="chorus">refrain line<\/div>/);
});

test("multi-line indented block keeps newlines inside the chorus div", () => {
  const html = render("verse\n\n\tline one\n\tline two\n\tline three\n");
  assert.match(
    html,
    /<div class="chorus">line one\nline two\nline three<\/div>/
  );
});

test("unindented lines stay in paragraphs, not chorus divs", () => {
  const html = render("just a verse line\nsecond line of verse");
  assert.doesNotMatch(html, /class="chorus"/);
  assert.match(html, /<p>/);
});

test("HTML inside an indented block is escaped, not passed through", () => {
  const html = render("verse\n\n\t<script>alert(1)</script>\n");
  assert.match(
    html,
    /<div class="chorus">&lt;script&gt;alert\(1\)&lt;\/script&gt;<\/div>/
  );
});

test("indented blocks do not produce <pre><code> wrappers", () => {
  const html = render("verse\n\n\trefrain line\n");
  assert.doesNotMatch(html, /<pre>|<code>/);
});

// --- Refrain lines: interleaved within a verse (no blank-line separator) ---

test("tab-indented line within a verse block renders as a refrain div", () => {
  const html = render("verse line\n\trefrain line\nnext verse line");
  assert.match(html, /<div class="chorus refrain">refrain line<\/div>/);
  assert.match(html, /<p>verse line/);
  assert.match(html, /next verse line<\/p>/);
});

test("multiple interleaved verse/refrain lines each get refrain divs", () => {
  const html = render("verse one\n\trefrain one\nverse two\n\trefrain two");
  const refrainMatches = [...html.matchAll(/<div class="chorus refrain">/g)];
  assert.equal(refrainMatches.length, 2);
  assert.match(html, /<div class="chorus refrain">refrain one<\/div>/);
  assert.match(html, /<div class="chorus refrain">refrain two<\/div>/);
});

test("interleaved refrain divs carry both chorus and refrain classes", () => {
  const html = render("verse\n\trefrain line\nnext verse");
  assert.match(html, /class="chorus refrain"/);
});

test("standalone chorus block (blank-line separated) is still a chorus div", () => {
  const html = render("verse line\n\n\tchorus line\n\nnext verse");
  assert.match(html, /<div class="chorus">chorus line<\/div>/);
  assert.doesNotMatch(html, /class="refrain"/);
});

// Regression: a mixed verse (with 4-space refrains) followed by a blank line
// and then a tab-indented standalone chorus must NOT merge the last refrain
// and the chorus into a single block.
test("standalone chorus after a mixed verse is not merged into the last refrain", () => {
  const src =
    "verse line\n    refrain line\n\n\tstandalone chorus line";
  const html = render(src);
  assert.match(html, /<div class="chorus refrain">refrain line<\/div>/);
  assert.match(html, /<div class="chorus">standalone chorus line<\/div>/);
});

// --- Inner indentation within a chorus/refrain block ---

// An all-indented block where some lines are MORE indented (e.g. Jacky Frost)
// must render as a SINGLE chorus div with inner indentation preserved.
// The block must be blank-line-separated so the parser sees it as a code_block.
test("extra indentation within an all-indented block stays in one chorus div", () => {
  const html = render(
    "before\n\n    verse A\n        refrain A\n    verse B\n        refrain B\n\nafter"
  );
  const chorusMatches = [...html.matchAll(/<div class="chorus">/g)];
  assert.equal(chorusMatches.length, 1);
  assert.match(html, /    refrain A/); // inner indent preserved
});

test("double-tab line following an interleaved refrain stays in the same refrain div", () => {
  const html = render(
    "verse line\n\trefrain line\n\t\textra indented within refrain\nnext verse"
  );
  const refrainMatches = [...html.matchAll(/<div class="chorus refrain">/g)];
  assert.equal(refrainMatches.length, 1);
  assert.match(html, /refrain line/);
  assert.match(html, /extra indented within refrain/);
});

test("inner indentation of a refrain block is not treated as a second refrain", () => {
  const html = render("verse\n\trefrain line\n\t\tsub-indented\nnext verse");
  const refrainMatches = [...html.matchAll(/<div class="chorus refrain">/g)];
  assert.equal(refrainMatches.length, 1);
});
