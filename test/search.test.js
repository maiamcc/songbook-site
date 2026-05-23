import { test } from "node:test";
import assert from "node:assert/strict";
import { FIELDS } from "../lib/song-schema.js";
import { buildSongIndexRecord } from "../lib/search-index.js";
import { matchTokens } from "../src/assets/match.js";

// --- index generation -------------------------------------------------------

// A sentinel value (and the lowercased marker we expect to find in the
// record's `text`) for every schema field. Distinct from the views.test.js
// fixtures so the two tests can evolve independently; intentionally
// all-lowercase so we test value-passthrough without also testing the
// case folding (covered separately below).
const SENTINELS = {
  title: { value: "titlesentinel", marker: "titlesentinel" },
  alternate_title: { value: "altsentinel", marker: "altsentinel" },
  author: { value: "authorsentinel", marker: "authorsentinel" },
  topics: { value: ["topicsentinel"], marker: "topicsentinel" },
  genre: { value: "genresentinel", marker: "genresentinel" },
  mood: { value: "moodsentinel", marker: "moodsentinel" },
  bop_rating: { value: 3, marker: "3" },
  structure: { value: "structuresentinel", marker: "structuresentinel" },
  notes: { value: "notessentinel", marker: "notessentinel" },
  rnge: { value: "qz-rk", marker: "qz-rk" },
};

test("SENTINELS covers every schema field (guards future additions)", () => {
  for (const field of Object.keys(FIELDS)) {
    assert.ok(
      SENTINELS[field],
      `add a SENTINELS entry for new schema field "${field}" in test/search.test.js`
    );
  }
});

const fullData = Object.fromEntries(
  Object.entries(SENTINELS).map(([k, v]) => [k, v.value])
);

for (const field of Object.keys(FIELDS)) {
  test(`buildSongIndexRecord: ${field} value lands in the search text`, () => {
    const rec = buildSongIndexRecord("/songs/x/", fullData, "");
    assert.ok(
      rec.text.includes(SENTINELS[field].marker),
      `expected "${SENTINELS[field].marker}" in record.text for field "${field}"`
    );
  });
}

test("buildSongIndexRecord: body content lands in the search text", () => {
  const rec = buildSongIndexRecord(
    "/songs/x/",
    fullData,
    "Loud are the BodySentinel of Norwich"
  );
  assert.ok(rec.text.includes("bodysentinel"));
});

test("buildSongIndexRecord: text is lowercased", () => {
  const rec = buildSongIndexRecord(
    "/songs/x/",
    { ...fullData, title: "MixedCase Title" },
    "BODY"
  );
  assert.equal(rec.text, rec.text.toLowerCase());
  assert.ok(rec.text.includes("mixedcase title"));
  assert.ok(rec.text.includes("body"));
});

test("buildSongIndexRecord: url passes through verbatim (not lowercased)", () => {
  const rec = buildSongIndexRecord("/songs/Foo-Bar/", fullData, "");
  assert.equal(rec.url, "/songs/Foo-Bar/");
});

test("buildSongIndexRecord: missing optional fields are silently skipped", () => {
  // Only required fields present; everything else absent. Should not
  // throw, should not include literal "undefined" or "null".
  const minimal = {
    title: "minimaltitle",
    author: "minimalauthor",
    bop_rating: 3,
    rnge: "do-mi",
  };
  const rec = buildSongIndexRecord("/songs/min/", minimal, "minimal body");
  assert.ok(rec.text.includes("minimaltitle"));
  assert.ok(rec.text.includes("minimal body"));
  assert.ok(!rec.text.includes("undefined"));
  assert.ok(!rec.text.includes("null"));
});

test("buildSongIndexRecord: list-valued fields are flattened with spaces", () => {
  const rec = buildSongIndexRecord(
    "/songs/x/",
    { ...fullData, topics: ["alpha", "beta gamma"] },
    ""
  );
  // Both values present, separated by whitespace, so each is searchable.
  assert.ok(rec.text.includes("alpha"));
  assert.ok(rec.text.includes("beta gamma"));
});

// --- search matching --------------------------------------------------------

test("matchTokens: empty query matches anything", () => {
  assert.equal(matchTokens("hello world", ""), true);
  assert.equal(matchTokens("", ""), true);
});

test("matchTokens: single token substring match", () => {
  assert.equal(matchTokens("the bells of norwich", "norwich"), true);
  assert.equal(matchTokens("the bells of norwich", "cairo"), false);
});

test("matchTokens: whitespace-separated tokens are ANDed", () => {
  assert.equal(matchTokens("norwich daffodil yellow", "norwich daffodil"), true);
  assert.equal(matchTokens("norwich daffodil", "norwich cairo"), false);
});

test("matchTokens: case-insensitive in both haystack and query", () => {
  assert.equal(matchTokens("The Bells of NORWICH", "norwich"), true);
  assert.equal(matchTokens("the bells of norwich", "NORWICH"), true);
  assert.equal(matchTokens("The Bells of Norwich", "BELLS"), true);
});

test("matchTokens: leading/trailing/multi-space query is normalized", () => {
  assert.equal(matchTokens("a b c", "  a   c  "), true);
  assert.equal(matchTokens("a b c", "  z  "), false);
});

test("matchTokens: token can be a multi-word substring inside a single token", () => {
  // A user typing "sydney carter" gets two tokens, both substrings — fine.
  // A user typing a single dashed token like "qz-rk" should still match.
  assert.equal(matchTokens("range qz-rk inside", "qz-rk"), true);
});
