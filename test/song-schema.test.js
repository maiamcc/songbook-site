import { test } from "node:test";
import assert from "node:assert/strict";
import { validate } from "../lib/song-schema.js";

test("title required", () => {
  assert.deepEqual(validate({}), ["missing required field: title"]);
});

test("unknown field rejected", () => {
  assert.deepEqual(validate({ title: "X", artist: "Y" }), [
    "unknown field: artist",
  ]);
});

test("all optional fields with valid types", () => {
  const data = {
    title: "X",
    topics: ["a", "b"],
    genre: "folk",
    mood: "happy",
    bop_rating: 4,
    structure: "verse-chorus",
    notes: "n/a",
  };
  assert.deepEqual(validate(data), []);
});

test("topics must be list[string]", () => {
  assert.deepEqual(validate({ title: "X", topics: "home" }), [
    "field topics must be list[string]",
  ]);
  assert.deepEqual(validate({ title: "X", topics: ["a", 2] }), [
    "field topics must be list[string]",
  ]);
});

test("string fields reject non-strings", () => {
  for (const field of ["genre", "mood", "structure", "notes"]) {
    assert.deepEqual(validate({ title: "X", [field]: 5 }), [
      `field ${field} must be string`,
    ]);
  }
});

test("bop_rating must be integer 1-5", () => {
  for (const bad of [0, 6, 3.5, "5", -1]) {
    assert.deepEqual(validate({ title: "X", bop_rating: bad }), [
      "field bop_rating must be integer 1-5",
    ]);
  }
  for (const ok of [1, 2, 3, 4, 5]) {
    assert.deepEqual(validate({ title: "X", bop_rating: ok }), []);
  }
});
