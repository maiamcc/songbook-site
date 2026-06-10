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
  // verse → refrain → verse: refrain is mid-stanza, gets refrain-mid
  const html = render("verse line\n\trefrain line\nnext verse line");
  assert.match(html, /<div class="chorus refrain refrain-mid">refrain line<\/div>/);
  assert.match(html, /<p class="verse-pre-refrain">verse line<\/p>/);
  assert.match(html, /next verse line<\/p>/);
});

test("verse paragraph immediately before a refrain gets verse-pre-refrain class", () => {
  const html = render("verse line\n\trefrain line\nnext verse");
  assert.match(html, /<p class="verse-pre-refrain">verse line<\/p>/);
});

test("mid-stanza refrain gets refrain-mid class; stanza-ending refrain does not", () => {
  // verse → refrain → verse → refrain: first refrain is mid-stanza, second ends
  const html = render("verse one\n\trefrain one\nverse two\n\trefrain two");
  assert.match(html, /<div class="chorus refrain refrain-mid">refrain one<\/div>/);
  assert.match(html, /<div class="chorus refrain">refrain two<\/div>/);
  assert.doesNotMatch(html, /<div class="chorus refrain refrain-mid">refrain two/);
});

test("stanza-ending refrain does not suppress the next stanza paragraph margin", () => {
  // The <p> starting a new stanza after a stanza-ending refrain must NOT
  // have its top margin zeroed out (no refrain-mid → no .refrain-mid + p rule).
  const html = render("verse\n\trefrain ends stanza\n\nnew stanza");
  // new stanza paragraph is NOT immediately after a refrain-mid
  assert.doesNotMatch(html, /refrain-mid/);
  assert.match(html, /<div class="chorus refrain">refrain ends stanza<\/div>/);
  assert.match(html, /<p>new stanza<\/p>/);
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
  const html = render("verse line\n    refrain line\n\n\tstandalone chorus line");
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
  // verse → refrain (with sub-indent) → verse: one refrain-mid div
  const html = render(
    "verse line\n\trefrain line\n\t\textra indented within refrain\nnext verse"
  );
  const refrainMatches = [...html.matchAll(/<div class="chorus refrain refrain-mid">/g)];
  assert.equal(refrainMatches.length, 1);
  assert.match(html, /refrain line/);
  assert.match(html, /extra indented within refrain/);
});

test("inner indentation of a refrain block is not treated as a second refrain", () => {
  // verse → refrain (with sub-indent) → verse: still only one refrain div
  const html = render("verse\n\trefrain line\n\t\tsub-indented\nnext verse");
  const refrainMatches = [...html.matchAll(/<div class="chorus refrain refrain-mid">/g)];
  assert.equal(refrainMatches.length, 1);
});

// --- 2-space indent lines ---

test("2-space-indented line renders as <p class=\"indent\">", () => {
  const html = render("verse line\n  indented line\nnext verse");
  assert.match(html, /<p class="indent( indent-mid)?">indented line<\/p>/);
});

test("2-space indent strips the leading two spaces from content", () => {
  const html = render("verse\n  indented line\nverse");
  assert.doesNotMatch(html, /  indented line/);
  assert.match(html, /indented line/);
});

test("2-space indent does not produce a chorus div", () => {
  const html = render("verse\n  indented line\nverse");
  assert.doesNotMatch(html, /class="chorus"/);
});

test("4-space indent is still a chorus refrain, not a <p class=\"indent\">", () => {
  const html = render("verse\n    refrain line\nverse");
  assert.match(html, /class="chorus refrain/);
  assert.doesNotMatch(html, /class="indent"/);
});

test("verse before a 2-space indent gets verse-pre-indent class", () => {
  const html = render("verse line\n  indented line\nnext verse");
  assert.match(html, /<p class="verse-pre-indent">verse line<\/p>/);
});

test("mid-stanza indent (verse follows) gets indent-mid class", () => {
  const html = render("verse line\n  indented line\nnext verse");
  assert.match(html, /<p class="indent indent-mid">indented line<\/p>/);
});

test("stanza-ending indent (nothing follows) does not get indent-mid class", () => {
  const html = render("verse line\n  indented line");
  assert.match(html, /<p class="indent">indented line<\/p>/);
  assert.doesNotMatch(html, /indent-mid/);
});

// Alice and Jessie: 2-space indent interleaved with verse, tab-indented chorus separate
test("alice-and-jessie structure: 2-space indents within verse, tab chorus separate", () => {
  const src =
    "In a white four-in-hand by a coachman.\n  Summers they spent in the country\nPlaying in the fields.\n\n\tAlice was married in Baltimore,\n\tIn a long dress.";
  const html = render(src);
  assert.match(html, /<p class="indent( indent-mid)?">Summers they spent in the country<\/p>/);
  assert.match(html, /<div class="chorus">Alice was married in Baltimore/);
  assert.doesNotMatch(html, /<div class="chorus">Summers/);
});
