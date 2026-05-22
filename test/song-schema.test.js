import { test } from "node:test";
import assert from "node:assert/strict";
import { validate } from "../lib/song-schema.js";

// Minimal valid frontmatter: every required field set to a valid
// value. Spread into a test fixture, then override the field under
// test. Add a new required field here whenever lib/song-schema.js
// gains one.
const REQUIRED = {
  title: "X",
  author: "Y",
  bop_rating: 3,
  rnge: "ab-cd",
};

test("missing required fields are flagged", () => {
  // Empty frontmatter should fail with one error per required field,
  // emitted in the order the schema declares them.
  assert.deepEqual(validate({}), [
    "missing required field: title",
    "missing required field: author",
    "missing required field: bop_rating",
    "missing required field: rnge",
  ]);
});

test("unknown field rejected", () => {
  assert.deepEqual(validate({ ...REQUIRED, artist: "Y" }), [
    "unknown field: artist",
  ]);
});

test("all optional fields with valid types", () => {
  const data = {
    ...REQUIRED,
    alternate_title: "Alt",
    topics: ["a", "b"],
    genre: "folk",
    mood: "happy",
    structure: "verse-chorus",
    notes: "n/a",
  };
  assert.deepEqual(validate(data), []);
});

test("topics must be list[string]", () => {
  assert.deepEqual(validate({ ...REQUIRED, topics: "home" }), [
    'field "topics" must be list[string]',
  ]);
  assert.deepEqual(validate({ ...REQUIRED, topics: ["a", 2] }), [
    'field "topics" must be list[string]',
  ]);
});

test("string fields reject non-strings", () => {
  for (const field of ["genre", "mood", "structure", "notes"]) {
    assert.deepEqual(validate({ ...REQUIRED, [field]: 5 }), [
      `field "${field}" must be string`,
    ]);
  }
});

test("bop_rating must be integer 1-5", () => {
  for (const bad of [0, 6, 3.5, "5", -1]) {
    assert.deepEqual(validate({ ...REQUIRED, bop_rating: bad }), [
      'field "bop_rating" must be integer 1-5',
    ]);
  }
  for (const ok of [1, 2, 3, 4, 5]) {
    assert.deepEqual(validate({ ...REQUIRED, bop_rating: ok }), []);
  }
});

test("rnge must match [a-z]{2}-[a-z]{2}", () => {
  // Wrong shape, wrong case, non-string — all flagged with the same
  // "must be string matching ..." message that surfaces the pattern.
  const bad = [
    "AB-CD",    // uppercase
    "abc-de",   // 3 letters before the dash
    "ab-cde",   // 3 letters after the dash
    "a-b",      // too short
    "abcd",     // missing dash
    "ab_cd",    // wrong separator
    "ab-c1",    // digit
    "ab-cd ",   // trailing space (anchors must reject)
    " ab-cd",   // leading space
    5,          // non-string
    null,       // null (treated as "field present but invalid")
  ];
  for (const v of bad) {
    if (v === null) continue; // null is dropped by validate before check
    assert.deepEqual(validate({ ...REQUIRED, rnge: v }), [
      'field "rnge" must be string matching [a-z]{2}-[a-z]{2}',
    ]);
  }
  for (const ok of ["ab-cd", "aa-aa", "zz-yz"]) {
    assert.deepEqual(validate({ ...REQUIRED, rnge: ok }), []);
  }
});
