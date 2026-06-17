import { test } from "node:test";
import assert from "node:assert/strict";
import { sortSongs, getSortVal } from "../src/assets/sort.js";

// ---------------------------------------------------------------------------
// getSortVal
// ---------------------------------------------------------------------------

test("getSortVal: title field returns lowercase sort key", () => {
  assert.equal(getSortVal({ title: "Bells" }, "title"), "bells");
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

test("getSortVal: returns sorted-joined elements for a non-empty array", () => {
  assert.equal(getSortVal({ mood: ["rousing", "fun"] }, "mood"), "fun|rousing");
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

test("sortSongs: array field sorted by joined elements asc (order-independent)", () => {
  const songs = [
    { mood: ["rousing", "fun"] },  // key: "fun|rousing"
    { mood: ["gentle"] },          // key: "gentle"
    { mood: ["bouncy"] },          // key: "bouncy"
  ];
  const result = sortSongs(songs, "mood", "asc");
  // "fun|rousing" sorts after "bouncy" but before "gentle"
  assert.deepEqual(result.map((s) => s.mood[0]), ["bouncy", "rousing", "gentle"]);
});

test("sortSongs: array field with same values in different order sorts identically", () => {
  const a = { structure: ["chorus", "2nd-4th-lines-repeat"] };
  const b = { structure: ["2nd-4th-lines-repeat", "chorus"] };
  const result = sortSongs([a, b], "structure", "asc");
  // Both have the same sort key — JS sort is stable so original order is kept.
  assert.equal(result[0], a);
  assert.equal(result[1], b);
});

test("sortSongs: empty array treated as missing → sorts last", () => {
  const songs = [{ mood: [] }, { mood: ["rousing"] }];
  const result = sortSongs(songs, "mood", "asc");
  assert.equal(result[0].mood[0], "rousing");
  assert.deepEqual(result[1].mood, []);
});

// ---------------------------------------------------------------------------
// sortSongs — title field strips leading articles
// ---------------------------------------------------------------------------

test("sortSongs: title field ignores leading 'The'", () => {
  const songs = [
    { title: "The Bells of Norwich" },
    { title: "Apple Tree" },
    { title: "Mango Song" },
  ];
  const result = sortSongs(songs, "title", "asc");
  // "The Bells…" sorts as "bells…" → B, after "apple…" → A, before "mango…" → M
  assert.deepEqual(
    result.map((s) => s.title),
    ["Apple Tree", "The Bells of Norwich", "Mango Song"]
  );
});

test("sortSongs: title field ignores leading 'A'", () => {
  const songs = [
    { title: "A Roving" },
    { title: "Bold Mariner" },
  ];
  const result = sortSongs(songs, "title", "asc");
  // "A Roving" sorts as "roving" → after "bold"
  assert.deepEqual(
    result.map((s) => s.title),
    ["Bold Mariner", "A Roving"]
  );
});

test("sortSongs: title 'The' stripping does not affect words starting with 'The'", () => {
  // "Theatre" should NOT be stripped — only "the " (article + space)
  const songs = [{ title: "Theatre" }, { title: "Bells" }];
  const result = sortSongs(songs, "title", "asc");
  assert.deepEqual(result.map((s) => s.title), ["Bells", "Theatre"]);
});

test("getSortVal: title field returns de-articled lowercase key", () => {
  assert.equal(getSortVal({ title: "The Bells of Norwich" }, "title"), "bells of norwich");
  assert.equal(getSortVal({ title: "A Roving" }, "title"), "roving");
  assert.equal(getSortVal({ title: "Apple" }, "title"), "apple");
});

// ---------------------------------------------------------------------------
// sortSongs / getSortVal — enum order (joiny_inny)
// ---------------------------------------------------------------------------

const JOINY_ORDER = ["very-easy", "easy", "moderate", "hard", "n/a"];
const joinyEnumOrders = { joiny_inny: JOINY_ORDER };

test("getSortVal: returns positional index when enumOrders provided", () => {
  assert.equal(getSortVal({ joiny_inny: "very-easy" }, "joiny_inny", joinyEnumOrders), 0);
  assert.equal(getSortVal({ joiny_inny: "easy" },      "joiny_inny", joinyEnumOrders), 1);
  assert.equal(getSortVal({ joiny_inny: "moderate" },  "joiny_inny", joinyEnumOrders), 2);
  assert.equal(getSortVal({ joiny_inny: "hard" },      "joiny_inny", joinyEnumOrders), 3);
  assert.equal(getSortVal({ joiny_inny: "n/a" },       "joiny_inny", joinyEnumOrders), 4);
});

test("getSortVal: unknown enum value returns null when enumOrders provided", () => {
  assert.equal(getSortVal({ joiny_inny: "unknown" }, "joiny_inny", joinyEnumOrders), null);
});

test("getSortVal: falls back to string value when field not in enumOrders", () => {
  assert.equal(getSortVal({ joiny_inny: "easy" }, "joiny_inny", {}), "easy");
});

test("sortSongs: joiny_inny asc follows enum definition order", () => {
  const songs = [
    { joiny_inny: "hard" },
    { joiny_inny: "very-easy" },
    { joiny_inny: "n/a" },
    { joiny_inny: "easy" },
    { joiny_inny: "moderate" },
  ];
  const result = sortSongs(songs, "joiny_inny", "asc", joinyEnumOrders);
  assert.deepEqual(
    result.map((s) => s.joiny_inny),
    ["very-easy", "easy", "moderate", "hard", "n/a"]
  );
});

test("sortSongs: joiny_inny desc reverses enum definition order", () => {
  const songs = [
    { joiny_inny: "easy" },
    { joiny_inny: "hard" },
    { joiny_inny: "very-easy" },
  ];
  const result = sortSongs(songs, "joiny_inny", "desc", joinyEnumOrders);
  assert.deepEqual(
    result.map((s) => s.joiny_inny),
    ["hard", "easy", "very-easy"]
  );
});

test("sortSongs: joiny_inny missing values sort last", () => {
  const songs = [
    { joiny_inny: "hard" },
    {},
    { joiny_inny: "easy" },
  ];
  const result = sortSongs(songs, "joiny_inny", "asc", joinyEnumOrders);
  assert.equal(result[0].joiny_inny, "easy");
  assert.equal(result[1].joiny_inny, "hard");
  assert.equal(result[2].joiny_inny, undefined);
});

test("sortSongs: other fields unaffected when joiny enumOrders present", () => {
  const songs = [{ title: "Zebra" }, { title: "Apple" }];
  const result = sortSongs(songs, "title", "asc", joinyEnumOrders);
  assert.deepEqual(result.map((s) => s.title), ["Apple", "Zebra"]);
});
