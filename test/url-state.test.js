import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSearchParams } from "../src/assets/url-state.js";

// Helper: build params with all-default / empty state and override specific args.
function params({
  q = "",
  active = {},
  activeCols = new Set(),
  defaultOptionalCols = [],
  sortField = null,
  sortDir = "asc",
} = {}) {
  return buildSearchParams(q, active, activeCols, defaultOptionalCols, sortField, sortDir);
}

// ---------------------------------------------------------------------------
// search text
// ---------------------------------------------------------------------------

test("buildSearchParams: blank q produces no q param", () => {
  assert.equal(params({ q: "" }).get("q"), null);
  assert.equal(params({ q: "   " }).get("q"), null);
});

test("buildSearchParams: non-blank q is set", () => {
  assert.equal(params({ q: "sea shanty" }).get("q"), "sea shanty");
});

// ---------------------------------------------------------------------------
// active filters
// ---------------------------------------------------------------------------

test("buildSearchParams: empty active object produces no filter params", () => {
  const p = params({ active: { genre: new Set(), mood: new Set() } });
  assert.equal(p.get("genre"), null);
  assert.equal(p.get("mood"), null);
});

test("buildSearchParams: single active filter value", () => {
  const p = params({ active: { genre: new Set(["chantey"]) } });
  assert.deepEqual(p.getAll("genre"), ["chantey"]);
});

test("buildSearchParams: multiple values for one field are repeated params", () => {
  const p = params({ active: { mood: new Set(["rousing", "fun"]) } });
  // Set iteration order matches insertion order; we sort for a stable assertion.
  assert.deepEqual([...p.getAll("mood")].sort(), ["fun", "rousing"]);
});

test("buildSearchParams: multiple active fields each get their params", () => {
  const p = params({
    active: {
      genre: new Set(["chantey"]),
      mood: new Set(["rousing"]),
    },
  });
  assert.deepEqual(p.getAll("genre"), ["chantey"]);
  assert.deepEqual(p.getAll("mood"), ["rousing"]);
});

// ---------------------------------------------------------------------------
// optional columns
// ---------------------------------------------------------------------------

test("buildSearchParams: no active cols produces no cols param", () => {
  assert.equal(params({ activeCols: new Set() }).get("cols"), null);
});

test("buildSearchParams: single active col", () => {
  assert.equal(params({ activeCols: new Set(["mood"]) }).get("cols"), "mood");
});

test("buildSearchParams: multiple active cols are comma-joined", () => {
  const p = params({ activeCols: new Set(["mood", "genre"]) });
  // Set preserves insertion order.
  assert.equal(p.get("cols"), "mood,genre");
});

test("buildSearchParams: activeCols matching defaults produces no cols param", () => {
  const p = params({
    activeCols: new Set(["author", "bop_rating"]),
    defaultOptionalCols: ["author", "bop_rating"],
  });
  assert.equal(p.get("cols"), null);
});

test("buildSearchParams: activeCols with one default removed writes cols", () => {
  const p = params({
    activeCols: new Set(["bop_rating"]),
    defaultOptionalCols: ["author", "bop_rating"],
  });
  assert.equal(p.get("cols"), "bop_rating");
});

test("buildSearchParams: empty activeCols when defaults exist writes cols=", () => {
  const p = params({
    activeCols: new Set(),
    defaultOptionalCols: ["author", "bop_rating"],
  });
  assert.equal(p.get("cols"), "");
});

// ---------------------------------------------------------------------------
// sort state
// ---------------------------------------------------------------------------

test("buildSearchParams: no sort produces no sort or dir params", () => {
  const p = params({ sortField: null });
  assert.equal(p.get("sort"), null);
  assert.equal(p.get("dir"), null);
});

test("buildSearchParams: asc sort sets sort but omits dir", () => {
  const p = params({ sortField: "bop_rating", sortDir: "asc" });
  assert.equal(p.get("sort"), "bop_rating");
  assert.equal(p.get("dir"), null);
});

test("buildSearchParams: desc sort sets both sort and dir", () => {
  const p = params({ sortField: "title", sortDir: "desc" });
  assert.equal(p.get("sort"), "title");
  assert.equal(p.get("dir"), "desc");
});

// ---------------------------------------------------------------------------
// combined state
// ---------------------------------------------------------------------------

test("buildSearchParams: all state combined encodes correctly", () => {
  const p = params({
    q: "sea",
    active: { genre: new Set(["chantey"]), mood: new Set(["rousing", "fun"]) },
    activeCols: new Set(["genre"]),
    sortField: "bop_rating",
    sortDir: "desc",
  });
  assert.equal(p.get("q"), "sea");
  assert.deepEqual(p.getAll("genre"), ["chantey"]);
  assert.deepEqual([...p.getAll("mood")].sort(), ["fun", "rousing"]);
  assert.equal(p.get("cols"), "genre");
  assert.equal(p.get("sort"), "bop_rating");
  assert.equal(p.get("dir"), "desc");
});
