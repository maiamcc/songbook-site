import { test } from "node:test";
import assert from "node:assert/strict";
import matter from "gray-matter";
import { parse, slugify, defaultSlug, buildSongFile, normalizeInput } from "../scripts/new-song.js";

test("slugify: basic kebab-case", () => {
  assert.equal(slugify("Country Roads"), "country-roads");
});

test("slugify: lowercases, collapses runs of non-alphanumeric", () => {
  assert.equal(slugify("Don't Stop -- Believin'!"), "dont-stop-believin");
});

test("slugify: apostrophes are stripped, not converted to hyphens", () => {
  assert.equal(slugify("It's a Pleasure to Know You"), "its-a-pleasure-to-know-you");
  assert.equal(slugify("Don't You (Forget About Me)"), "dont-you-forget-about-me");
});

test("slugify: trims surrounding whitespace and stray hyphens", () => {
  assert.equal(slugify("  Hello, World!  "), "hello-world");
});

test("slugify: returns empty string when nothing alphanumeric remains", () => {
  assert.equal(slugify("!!! ??? ---"), "");
  assert.equal(slugify(""), "");
});

test("defaultSlug: strips leading 'the' article", () => {
  assert.equal(defaultSlug("The Bells of Norwich"), "bells-of-norwich");
  assert.equal(defaultSlug("the weight"), "weight");
});

test("defaultSlug: strips leading 'a' article", () => {
  assert.equal(defaultSlug("A Hard Day's Night"), "hard-days-night");
});

test("defaultSlug: does not strip mid-word matches", () => {
  assert.equal(defaultSlug("Theatre"), "theatre");
  assert.equal(defaultSlug("Apple"), "apple");
});

test("defaultSlug: leaves single-word article-only titles alone", () => {
  assert.equal(defaultSlug("The"), "the");
  assert.equal(defaultSlug("A"), "a");
});

test("normalizeInput: strips non-breaking spaces and trims", () => {
  assert.equal(normalizeInput(" hello "), "hello");
  assert.equal(normalizeInput("foo bar"), "foo bar");
  assert.equal(normalizeInput("     "), "");
});

test("parse: non-breaking spaces are stripped from field input", () => {
  assert.equal(parse("title", " My Song "), "My Song");
  assert.deepEqual(parse("topics", "home, travel"), ["home", "travel"]);
});

test("parse: blank or whitespace-only returns undefined for any field", () => {
  for (const field of ["title", "topics", "bop_rating", "notes"]) {
    assert.equal(parse(field, ""), undefined);
    assert.equal(parse(field, "   "), undefined);
  }
});

test("parse: topics splits on commas, trims, drops empties", () => {
  assert.deepEqual(parse("topics", "home, road"), ["home", "road"]);
  assert.deepEqual(parse("topics", " home ,, , travel "), ["home", "travel"]);
  assert.deepEqual(parse("topics", "solo"), ["solo"]);
});

test("parse: bop_rating coerces integer-looking input to a number", () => {
  assert.equal(parse("bop_rating", "3"), 3);
  assert.equal(parse("bop_rating", " 5 "), 5);
});

test("parse: bop_rating passes non-integer input through as a string", () => {
  // Validator surfaces the canonical type error from these.
  assert.equal(parse("bop_rating", "abc"), "abc");
  assert.equal(parse("bop_rating", "3.5"), "3.5");
});

test("parse: string fields are trimmed but otherwise untouched", () => {
  assert.equal(parse("title", "  Country Roads  "), "Country Roads");
  assert.equal(parse("genre", "folk"), "folk");
  assert.equal(parse("notes", "capo 2"), "capo 2");
});

// ---------------------------------------------------------------------------
// buildSongFile
// ---------------------------------------------------------------------------

// Minimum required data; rnge must match [a-z]{2}-[a-z]{2}.
const REQUIRED = { title: "My Song", author: "A. Person", bop_rating: 3, rnge: "do>re" };

function parseFrontmatter(fileStr) {
  // Split on the closing --- to get the frontmatter block.
  const inner = fileStr.replace(/^---\n/, "").split("\n---\n")[0];
  return inner;
}

test("buildSongFile: opens and closes with --- delimiters", () => {
  const out = buildSongFile(REQUIRED);
  assert.ok(out.startsWith("---\n"), "should start with ---");
  assert.ok(out.includes("\n---\n"), "should have closing ---");
});

test("buildSongFile: required fields present emit as plain YAML", () => {
  const out = buildSongFile(REQUIRED);
  const fm = parseFrontmatter(out);
  assert.match(fm, /^title: My Song$/m);
  assert.match(fm, /^author: A\. Person$/m);
  assert.match(fm, /^bop_rating: 3$/m);
  assert.match(fm, /^rnge: do>re$/m);
});

test("buildSongFile: absent optional fields appear as # field: TK comments", () => {
  const out = buildSongFile(REQUIRED);
  const fm = parseFrontmatter(out);
  // A sampling of optional fields that won't be in REQUIRED.
  assert.match(fm, /^# alternate_title: TK$/m);
  assert.match(fm, /^# genre: TK$/m);
});

test("buildSongFile: absent notes uses commented-out block scalar placeholder", () => {
  const out = buildSongFile(REQUIRED);
  const fm = parseFrontmatter(out);
  assert.match(fm, /^# notes: >-$/m, "notes should be a commented block scalar");
  assert.match(fm, /^#   TK$/m, "notes body should be a commented indented TK");
});

test("buildSongFile: absent required fields are silently omitted (no TK comment)", () => {
  // bop_rating is required — if missing it should not appear at all.
  const out = buildSongFile({ title: "X", author: "Y", rnge: "ab>cd" });
  assert.doesNotMatch(out, /bop_rating/);
});

test("buildSongFile: number values are unquoted", () => {
  const out = buildSongFile(REQUIRED);
  assert.match(out, /^bop_rating: 3$/m);
  assert.doesNotMatch(out, /bop_rating: "3"/);
});

test("buildSongFile: boolean values are unquoted", () => {
  const out = buildSongFile({ ...REQUIRED, in_nb: true });
  assert.match(out, /^in_nb: true$/m);
  assert.doesNotMatch(out, /in_nb: "true"/);
});

test("buildSongFile: array values render as inline YAML list", () => {
  const out = buildSongFile({ ...REQUIRED, topics: ["sea", "work"] });
  assert.match(out, /^topics: \[sea, work\]$/m);
});

test("buildSongFile: strings containing ': ' are quoted", () => {
  const out = buildSongFile({ ...REQUIRED, notes: "capo: 2" });
  assert.match(out, /^notes: "capo: 2"$/m);
});

test("buildSongFile: YAML keyword strings are quoted", () => {
  // "no" is a YAML boolean keyword; must be quoted to remain a string.
  const out = buildSongFile({ ...REQUIRED, notes: "no" });
  assert.match(out, /^notes: "no"$/m);
});

test("buildSongFile: strings starting with # are quoted", () => {
  const out = buildSongFile({ ...REQUIRED, notes: "#1 hit" });
  assert.match(out, /^notes: "#1 hit"$/m);
});

test("buildSongFile: array items that are YAML keywords are quoted", () => {
  const out = buildSongFile({ ...REQUIRED, topics: ["yes", "normal"] });
  assert.match(out, /^topics: \["yes", normal\]$/m);
});

test("buildSongFile: backslash is escaped when quoting is triggered", () => {
  // "#path\to" starts with # → triggers quoting → the backslash must be escaped.
  // File should contain the literal characters:  notes: "#path\\to"
  const out = buildSongFile({ ...REQUIRED, notes: "#path\\to" });
  assert.ok(out.includes('notes: "#path\\\\to"'), `actual: ${JSON.stringify(out)}`);
});

test("buildSongFile: embedded double-quotes are escaped when quoting is triggered", () => {
  // '"hello"' starts with " → triggers quoting → embedded quotes must be escaped.
  // File should contain the literal characters:  notes: "\"hello\""
  const out = buildSongFile({ ...REQUIRED, notes: '"hello"' });
  assert.ok(out.includes('notes: "\\"hello\\""'), `actual: ${JSON.stringify(out)}`);
});

test("buildSongFile: body content appears after the closing ---", () => {
  const out = buildSongFile(REQUIRED, "Verse one\nVerse two");
  const parts = out.split("\n---\n");
  assert.equal(parts.length, 2);
  assert.match(parts[1], /Verse one/);
  assert.match(parts[1], /Verse two/);
});

test("buildSongFile: whitespace-only body is omitted", () => {
  const withBody = buildSongFile(REQUIRED, "   \n  ");
  const noBody = buildSongFile(REQUIRED);
  assert.equal(withBody, noBody);
});

test("buildSongFile: output always ends with a single newline", () => {
  assert.ok(buildSongFile(REQUIRED).endsWith("\n"));
  assert.ok(buildSongFile(REQUIRED, "lyrics").endsWith("\n"));
});

test("buildSongFile: multiline string field uses >- block scalar", () => {
  const data = { ...REQUIRED, notes: "line one\n\nline two" };
  const file = buildSongFile(data);
  // Block scalar header on the same line as the key, indented continuation.
  assert.ok(file.includes("notes: >-\n  line one\n\n  line two"), file);
  // >- folded style: blank lines fold surrounding newlines into one, so a
  // double newline round-trips back as a single newline.
  const parsed = matter(file);
  assert.equal(parsed.data.notes, "line one\nline two");
});
