import { test } from "node:test";
import assert from "node:assert/strict";
import { parse, slugify, defaultSlug } from "../scripts/new-song.js";

test("slugify: basic kebab-case", () => {
  assert.equal(slugify("Country Roads"), "country-roads");
});

test("slugify: lowercases, collapses runs of non-alphanumeric", () => {
  assert.equal(slugify("Don't Stop -- Believin'!"), "dont-stop-believin");
});

test("slugify: apostrophes are stripped, not converted to hyphens", () => {
  assert.equal(slugify("It's a Pleasure to Know You"), "its-a-pleasure-to-know-you");
  assert.equal(slugify("Don’t You (Forget About Me)"), "dont-you-forget-about-me");
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
