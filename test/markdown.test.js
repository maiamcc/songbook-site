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
