import { test } from "node:test";
import assert from "node:assert/strict";
import { sortSongs, getSortVal } from "../src/assets/sort.js";

// ---------------------------------------------------------------------------
// getSortVal
// ---------------------------------------------------------------------------

test("getSortVal: returns string value for a string field", () => {
  assert.equal(getSortVal({ title: "Bells" }, "title"), "Bells");
});

test("getSortVal: returns number value for a numeric field", () => {
  assert.equal(getSortVal({ bop_rating: 4 }, "bop_rating"), 4);
});

test("getSortVal: returns null for a missing field", () => {
  assert.equal(getSortVal({ title: "X" }, "genre"), null);
});

test("getSortVal: returns null for an explicit null value", () => {
  assert.equal(getSortVal({ genre: null }, "genre"), null);
});

test("getSortVal: returns first element (stringified) for a non-empty array", () => {
  assert.equal(getSortVal({ mood: ["rousing", "fun"] }, "mood"), "rousing");
  assert.equal(getSortVal({ mood: [42] }, "mood"), "42");
});

test("getSortVal: returns null for an empty array", () => {
  assert.equal(getSortVal({ mood: [] }, "mood"), null);
});

// ---------------------------------------------------------------------------
// sortSongs — field=null (no sort)
// ---------------------------------------------------------------------------

test("sortSongs: null field returns the original array unchanged", () => {
  const songs = [{ title: "B" }, { title: "A" }];
  const result = sortSongs(songs, null, "asc");
  assert.equal(result, songs, "should return the exact same array reference");
});

// ---------------------------------------------------------------------------
// sortSongs — string fields
// ---------------------------------------------------------------------------

test("sortSongs: string field asc gives locale-alphabetical order", () => {
  const songs = [{ title: "Zebra" }, { title: "Apple" }, { title: "Mango" }];
  const result = sortSongs(songs, "title", "asc");
  assert.deepEqual(
    result.map((s) => s.title),
    ["Apple", "Mango", "Zebra"]
  );
});

test("sortSongs: string field desc reverses alphabetical order", () => {
  const songs = [{ title: "Apple" }, { title: "Zebra" }, { title: "Mango" }];
  const result = sortSongs(songs, "title", "desc");
  assert.deepEqual(
    result.map((s) => s.title),
    ["Zebra", "Mango", "Apple"]
  );
});

test("sortSongs: does not mutate the input array", () => {
  const songs = [{ title: "B" }, { title: "A" }];
  const copy = [...songs];
  sortSongs(songs, "title", "asc");
  assert.deepEqual(songs, copy, "original array should be unchanged");
});

// ---------------------------------------------------------------------------
// sortSongs — numeric fields
// ---------------------------------------------------------------------------

test("sortSongs: numeric field asc compares numerically, not lexicographically", () => {
  // Lexicographic would give 1, 10, 5; numeric gives 1, 5, 10.
  const songs = [{ n: 10 }, { n: 1 }, { n: 5 }];
  const result = sortSongs(songs, "n", "asc");
  assert.deepEqual(result.map((s) => s.n), [1, 5, 10]);
});

test("sortSongs: numeric field desc", () => {
  const songs = [{ n: 1 }, { n: 5 }, { n: 3 }];
  const result = sortSongs(songs, "n", "desc");
  assert.deepEqual(result.map((s) => s.n), [5, 3, 1]);
});

// ---------------------------------------------------------------------------
// sortSongs — null/missing values sort last
// ---------------------------------------------------------------------------

test("sortSongs: songs missing the sort field sort after songs that have it (asc)", () => {
  const songs = [{ title: "X" }, {}, { title: "A" }];
  const result = sortSongs(songs, "title", "asc");
  assert.equal(result[0].title, "A");
  assert.equal(result[1].title, "X");
  assert.equal(result[2].title, undefined); // missing field → last
});

test("sortSongs: songs missing the sort field sort after songs that have it (desc)", () => {
  const songs = [{}, { title: "A" }, { title: "Z" }];
  const result = sortSongs(songs, "title", "desc");
  assert.equal(result[0].title, "Z");
  assert.equal(result[1].title, "A");
  assert.equal(result[2].title, undefined); // missing field → last in desc too
});

test("sortSongs: two songs both missing the field are considered equal", () => {
  const a = { author: "X" };
  const b = { author: "Y" };
  const result = sortSongs([a, b], "title", "asc");
  // Both null → comparator returns 0; JS sort is stable, so original order preserved.
  assert.equal(result[0], a);
  assert.equal(result[1], b);
});

// ---------------------------------------------------------------------------
// sortSongs — array fields
// ---------------------------------------------------------------------------

test("sortSongs: array field sorted by first element asc", () => {
  const songs = [
    { mood: ["rousing", "fun"] },
    { mood: ["gentle"] },
    { mood: ["bouncy"] },
  ];
  const result = sortSongs(songs, "mood", "asc");
  assert.deepEqual(result.map((s) => s.mood[0]), ["bouncy", "gentle", "rousing"]);
});

test("sortSongs: empty array treated as missing → sorts last", () => {
  const songs = [{ mood: [] }, { mood: ["rousing"] }];
  const result = sortSongs(songs, "mood", "asc");
  assert.equal(result[0].mood[0], "rousing");
  assert.deepEqual(result[1].mood, []);
});
