import { test } from "node:test";
import assert from "node:assert/strict";
import { ENUMS, FIELDS, enumField, validate } from "../lib/song-schema.js";

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
  // mood/structure are enums now; use values that exist in enums.yaml.
  // genre is also an enum but its values map is intentionally empty
  // (no current songs use it), so we just omit it from this fixture.
  const data = {
    ...REQUIRED,
    alternate_title: "Alt",
    topics: ["a", "b"],
    mood: "sad",
    structure: "chorus",
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
  // Plain-string fields only — enum-typed string fields surface
  // "must be one of: …" errors covered by the enum-field tests above.
  // The loop lets future plain-string fields slot in with a one-line edit.
  for (const field of ["notes"]) {
    assert.deepEqual(validate({ ...REQUIRED, [field]: 5 }), [
      `field "${field}" must be string`,
    ]);
  }
});

test("bop_rating must be integer 1-5", () => {
  // bop_rating now goes through enumField with a custom isBopRating
  // check, so the error message lists the legal values rather than
  // saying "integer 1-5". The check itself still enforces integer in
  // the [1, 5] range — string "5" and float 3.5 still fail.
  for (const bad of [0, 6, 3.5, "5", -1]) {
    assert.deepEqual(validate({ ...REQUIRED, bop_rating: bad }), [
      'field "bop_rating" must be one of: 1, 2, 3, 4, 5',
    ]);
  }
  for (const ok of [1, 2, 3, 4, 5]) {
    assert.deepEqual(validate({ ...REQUIRED, bop_rating: ok }), []);
  }
});

// --- enum-field machinery ---------------------------------------------------

test("ENUMS loads from lib/enums.yaml with the expected shape", () => {
  // Each top-level enum entry is { desc?: string|null, values: { key: string } }.
  // desc is optional (an enum without a field-level description loads as
  // null and its tooltip just omits the desc line); values must be a
  // map of non-empty string descriptions. joiny_inny is the seed
  // entry; other fields slot in without updating this test, since it
  // iterates every loaded field.
  assert.ok(ENUMS.joiny_inny, "expected ENUMS.joiny_inny to be loaded");
  for (const [field, body] of Object.entries(ENUMS)) {
    if (body.desc !== null) {
      assert.equal(typeof body.desc, "string", `${field}.desc must be a string when set`);
      assert.ok(body.desc.length > 0, `${field}.desc must be non-empty when set`);
    }
    assert.ok(body.values && typeof body.values === "object",
      `${field}.values must be a map`);
    for (const [k, v] of Object.entries(body.values)) {
      assert.equal(typeof k, "string");
      assert.equal(typeof v, "string", `${field}.values.${k} must be string`);
      assert.ok(v.length > 0, `${field}.values.${k} should be non-empty`);
    }
  }
});

test("enumField: check accepts members, rejects non-members and non-strings", () => {
  const f = enumField({
    desc: "test enum",
    values: { a: "alpha", b: "beta" },
    required: false,
    display: ["song"],
  });
  assert.equal(f.check("a"), true);
  assert.equal(f.check("b"), true);
  assert.equal(f.check("c"), false);
  assert.equal(f.check(""), false);
  assert.equal(f.check(1), false);
  assert.equal(f.check(null), false);
  assert.equal(f.check(undefined), false);
});

test("enumField: returned entry has the expected FIELDS shape", () => {
  const values = { a: "alpha", b: "beta" };
  const f = enumField({
    desc: "test enum",
    values,
    required: false,
    display: ["song", "index"],
    indexable: true,
    collapsedOn: ["song"],
  });
  assert.equal(f.required, false);
  assert.equal(f.desc, "test enum");
  assert.equal(f.values, values);
  assert.deepEqual(f.display, ["song", "index"]);
  assert.equal(f.indexable, true);
  assert.deepEqual(f.collapsedOn, ["song"]);
  // type string lists the legal values so the validate() error message
  // points the reader at what's actually allowed.
  assert.ok(f.type.includes("a"));
  assert.ok(f.type.includes("b"));
});

test("enumField: indexable/collapsedOn are omitted when not passed", () => {
  const f = enumField({
    desc: "test enum",
    values: { a: "alpha" },
    required: false,
    display: ["song"],
  });
  // Match the hand-written FIELDS entry shape: absent rather than
  // explicitly undefined, so Object.keys() filters work cleanly.
  assert.ok(!("indexable" in f));
  assert.ok(!("collapsedOn" in f));
});

test("joiny_inny: validate rejects unknown enum values", () => {
  const errs = validate({ ...REQUIRED, joiny_inny: "bogus" });
  assert.equal(errs.length, 1);
  // Error message references the actual legal values so the reader
  // doesn't have to dig into the schema or the yaml.
  for (const legal of Object.keys(ENUMS.joiny_inny.values)) {
    assert.ok(
      errs[0].includes(legal),
      `expected error message to list legal value "${legal}", got: ${errs[0]}`
    );
  }
});

test("joiny_inny: validate accepts every legal value from enums.yaml", () => {
  for (const legal of Object.keys(ENUMS.joiny_inny.values)) {
    assert.deepEqual(
      validate({ ...REQUIRED, joiny_inny: legal }),
      [],
      `expected legal value "${legal}" to pass validation`
    );
  }
});

test("joiny_inny: FIELDS entry was built by the enum factory", () => {
  // Sanity: the entry exposes its value table, so templates can render
  // a legend without re-reading the YAML.
  assert.equal(FIELDS.joiny_inny.values, ENUMS.joiny_inny.values);
  assert.equal(FIELDS.joiny_inny.desc, ENUMS.joiny_inny.desc);
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
