// Tests for the home-page filter system:
//   - songMatchesFilters (pure matching logic in src/assets/filter-match.js)
//   - buildFilterRecord (filter-index record builder in lib/filter-index.js)
//   - filterFields / FILTER_LABELS coverage (lib/filter-config.js)
//   - schema consistency: every FILTERABLE_FIELDS entry appears in filterFields
import { test } from "node:test";
import assert from "node:assert/strict";
import { FIELDS, FILTERABLE_FIELDS } from "../lib/song-schema.js";
import { buildFilterRecord } from "../lib/filter-index.js";
import { filterFields } from "../lib/filter-config.js";
import { songMatchesFilters } from "../src/assets/filter-match.js";

// ---------------------------------------------------------------------------
// Schema consistency
// ---------------------------------------------------------------------------

test("FILTERABLE_FIELDS contains exactly the fields with filterable: true", () => {
  const expected = Object.keys(FIELDS).filter((f) => FIELDS[f].filterable);
  assert.deepEqual(
    [...FILTERABLE_FIELDS].sort(),
    [...expected].sort(),
    "FILTERABLE_FIELDS does not match FIELDS entries with filterable: true"
  );
});

test("every filterable field has an entry in filterFields", () => {
  const configKeys = filterFields.map((f) => f.key);
  for (const field of FILTERABLE_FIELDS) {
    assert.ok(
      configKeys.includes(field),
      `filterable field "${field}" is missing from filterFields (add it to FILTER_LABELS in lib/filter-config.js)`
    );
  }
});

test("filterFields references only filterable fields", () => {
  for (const { key } of filterFields) {
    assert.ok(
      FILTERABLE_FIELDS.includes(key),
      `filterFields entry "${key}" is not marked filterable in the schema`
    );
  }
});

test("filterFields: enum and list-enum fields carry a valueOrder array", () => {
  for (const { key, valueOrder } of filterFields) {
    const spec = FIELDS[key];
    if (spec.values) {
      assert.ok(
        Array.isArray(valueOrder) && valueOrder.length > 0,
        `${key} has a values map but filterFields entry is missing valueOrder`
      );
      // Every value in valueOrder must be a string (bop_rating keys are
      // stored as integers in JS but must be stringified for the client).
      for (const v of valueOrder) {
        assert.equal(typeof v, "string", `${key}.valueOrder entry ${v} must be a string`);
      }
    } else {
      assert.equal(
        valueOrder,
        undefined,
        `${key} has no values map but filterFields entry has a valueOrder`
      );
    }
  }
});

// ---------------------------------------------------------------------------
// buildFilterRecord
// ---------------------------------------------------------------------------

const REQUIRED = { title: "X", author: "Y", bop_rating: 3, rnge: "ab>cd" };

test("buildFilterRecord: includes all filterable fields that are present", () => {
  const data = {
    ...REQUIRED,
    genre: "chantey",
    mood: ["rousing", "fun"],
    bop_rating: 4,
    topics: ["sea"],
    structure: ["chorus"],
    joiny_inny: "easy",
    known: "2",
    in_nb: true,
  };
  const rec = buildFilterRecord("/songs/x/", data);
  assert.equal(rec.url, "/songs/x/");
  assert.equal(rec.genre, "chantey");
  assert.deepEqual(rec.mood, ["fun", "rousing"]);
  assert.equal(rec.bop_rating, 4);
  assert.deepEqual(rec.topics, ["sea"]);
  assert.deepEqual(rec.structure, ["chorus"]);
  assert.equal(rec.joiny_inny, "easy");
  assert.equal(rec.known, "2");
  assert.equal(rec.in_nb, true);
});

test("buildFilterRecord: non-display non-filterable fields are excluded", () => {
  const data = { ...REQUIRED, notes: "n/a", rnge: "ab>cd" };
  const rec = buildFilterRecord("/songs/x/", data);
  assert.ok(!("notes" in rec), "notes should not appear in filter record");
  assert.ok(!("rnge" in rec), "rnge should not appear in filter record");
});

test("buildFilterRecord: always includes table display fields", () => {
  const data = {
    ...REQUIRED,
    title: "My Song",
    author: "A. Person",
    alternate_title: "Alt",
  };
  const rec = buildFilterRecord("/songs/x/", data);
  assert.equal(rec.title, "My Song");
  assert.equal(rec.author, "A. Person");
  assert.equal(rec.alternate_title, "Alt");
});

test("buildFilterRecord: absent optional fields are excluded", () => {
  const rec = buildFilterRecord("/songs/x/", REQUIRED);
  // bop_rating is filterable and present; rnge is neither filterable nor a table field.
  assert.equal(rec.bop_rating, 3);
  assert.ok(!("genre" in rec));
  assert.ok(!("mood" in rec));
  assert.ok(!("topics" in rec));
  assert.equal(rec.in_nb, false); // defaults to false when absent
  assert.ok(!("rnge" in rec));
});

test("buildFilterRecord: has_lyrics is true when content is non-empty", () => {
  const rec = buildFilterRecord("/songs/x/", REQUIRED, "There once was a union maid");
  assert.equal(rec.has_lyrics, true);
});

test("buildFilterRecord: has_lyrics is false when content is empty string", () => {
  const rec = buildFilterRecord("/songs/x/", REQUIRED, "");
  assert.equal(rec.has_lyrics, false);
});

test("buildFilterRecord: has_lyrics is false when content is whitespace only", () => {
  const rec = buildFilterRecord("/songs/x/", REQUIRED, "   \n  ");
  assert.equal(rec.has_lyrics, false);
});

test("buildFilterRecord: has_lyrics defaults to false when content is omitted", () => {
  const rec = buildFilterRecord("/songs/x/", REQUIRED);
  assert.equal(rec.has_lyrics, false);
});

test("buildFilterRecord: null and empty-string values are excluded", () => {
  const rec = buildFilterRecord("/songs/x/", {
    ...REQUIRED,
    genre: null,
    joiny_inny: "",
  });
  assert.ok(!("genre" in rec));
  assert.ok(!("joiny_inny" in rec));
});

// ---------------------------------------------------------------------------
// songMatchesFilters
// ---------------------------------------------------------------------------

function active(obj) {
  // Helper: convert { field: [values] } to the Set-valued active object
  // that songMatchesFilters expects.
  return Object.fromEntries(
    Object.entries(obj).map(([k, vs]) => [k, new Set(vs)])
  );
}

test("songMatchesFilters: empty active filters always match", () => {
  assert.equal(songMatchesFilters({ genre: "chantey" }, {}), true);
  assert.equal(songMatchesFilters(null, {}), true);
  assert.equal(songMatchesFilters(undefined, {}), true);
});

test("songMatchesFilters: empty Set for a field is a no-op", () => {
  const a = active({ genre: [] });
  assert.equal(songMatchesFilters({ genre: "chantey" }, a), true);
  assert.equal(songMatchesFilters({}, a), true);
});

test("songMatchesFilters: scalar field match and no-match", () => {
  const a = active({ genre: ["chantey"] });
  assert.equal(songMatchesFilters({ genre: "chantey" }, a), true);
  assert.equal(songMatchesFilters({ genre: "hymn" }, a), false);
});

test("songMatchesFilters: missing field does not match when filter is active", () => {
  const a = active({ genre: ["chantey"] });
  assert.equal(songMatchesFilters({}, a), false);
  assert.equal(songMatchesFilters({ mood: ["rousing"] }, a), false);
  assert.equal(songMatchesFilters(null, a), false);
});

test("songMatchesFilters: multiple selected values for a field are ORed", () => {
  const a = active({ genre: ["chantey", "hymn"] });
  assert.equal(songMatchesFilters({ genre: "chantey" }, a), true);
  assert.equal(songMatchesFilters({ genre: "hymn" }, a), true);
  assert.equal(songMatchesFilters({ genre: "parody" }, a), false);
});

test("songMatchesFilters: multiple active fields are ANDed", () => {
  const a = active({ genre: ["chantey"], mood: ["rousing"] });
  assert.equal(
    songMatchesFilters({ genre: "chantey", mood: ["rousing"] }, a),
    true
  );
  assert.equal(
    songMatchesFilters({ genre: "chantey", mood: ["sad"] }, a),
    false,
    "wrong mood"
  );
  assert.equal(
    songMatchesFilters({ genre: "hymn", mood: ["rousing"] }, a),
    false,
    "wrong genre"
  );
});

test("songMatchesFilters: list-valued field matches if any selected value is present", () => {
  const a = active({ mood: ["rousing", "fun"] });
  assert.equal(songMatchesFilters({ mood: ["rousing", "sad"] }, a), true);
  assert.equal(songMatchesFilters({ mood: ["fun"] }, a), true);
  assert.equal(songMatchesFilters({ mood: ["sad", "melancholy"] }, a), false);
});

test("songMatchesFilters: numeric field (bop_rating) matched as string", () => {
  // filter-index records store bop_rating as an integer; the client
  // calls String(val) before comparing against the active set.
  const a = active({ bop_rating: ["4"] });
  assert.equal(songMatchesFilters({ bop_rating: 4 }, a), true);
  assert.equal(songMatchesFilters({ bop_rating: 3 }, a), false);
});

test("songMatchesFilters: boolean field (in_nb) matched as string", () => {
  const a = active({ in_nb: ["true"] });
  assert.equal(songMatchesFilters({ in_nb: true }, a), true);
  assert.equal(songMatchesFilters({ in_nb: false }, a), false);
  assert.equal(songMatchesFilters({}, a), false);
});

test("filterFields: abbrs map is exposed for fields that declare it", () => {
  const entry = filterFields.find((f) => f.key === "joiny_inny");
  assert.ok(entry, "expected joiny_inny in filterFields");
  assert.deepEqual(entry.abbrs, { "very-easy": "v. easy", moderate: "mod." });
});

test("filterFields: abbrs is absent for fields without abbreviations", () => {
  for (const entry of filterFields) {
    if (entry.key === "joiny_inny") continue;
    assert.ok(!("abbrs" in entry), `${entry.key} should not have abbrs`);
  }
});

test("filterFields: every abbrs key is a legal value for that field", () => {
  for (const entry of filterFields) {
    if (!entry.abbrs) continue;
    const legal = new Set(entry.valueOrder || []);
    for (const k of Object.keys(entry.abbrs)) {
      assert.ok(legal.has(k), `${entry.key}.abbrs key "${k}" is not in valueOrder`);
    }
  }
});
