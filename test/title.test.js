import { test } from "node:test";
import assert from "node:assert/strict";
import { sortKey } from "../lib/title.js";

test("sortKey: strips leading 'the'", () => {
  assert.equal(sortKey("The Bells of Norwich"), "bells of norwich");
  assert.equal(sortKey("the weight"), "weight");
});

test("sortKey: strips leading 'a'", () => {
  assert.equal(sortKey("A Hard Day's Night"), "hard day's night");
});

test("sortKey: does not strip articles glued to a longer word", () => {
  assert.equal(sortKey("Theatre Tonight"), "theatre tonight");
  assert.equal(sortKey("Apple Tree"), "apple tree");
});

test("sortKey: single-word article-only titles are left alone", () => {
  assert.equal(sortKey("The"), "the");
  assert.equal(sortKey("A"), "a");
});

test("sortKey produces an ordering that ignores leading articles", () => {
  const titles = [
    "The Bells of Norwich",
    "Cairo Town",
    "Country Roads",
    "Wagon Wheel",
    "A Quiet Song",
  ];
  const sorted = [...titles].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  assert.deepEqual(sorted, [
    "The Bells of Norwich",
    "Cairo Town",
    "Country Roads",
    "A Quiet Song",
    "Wagon Wheel",
  ]);
});
