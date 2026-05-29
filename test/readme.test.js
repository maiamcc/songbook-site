// Asserts the frontmatter table in README.md matches FIELDS in
// lib/song-schema.js. The schema is the source of truth; this test
// fails loudly whenever the README drifts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FIELDS } from "../lib/song-schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const README = readFileSync(join(__dirname, "..", "README.md"), "utf8");

// Parse the first markdown table that has the expected header.
function parseFieldTable(md) {
  const lines = md.split("\n");
  const headerIdx = lines.findIndex(
    (l) =>
      /\|\s*Field\s*\|.*Required.*Indexable.*Filter.*Song.*Print/.test(l)
  );
  if (headerIdx < 0) throw new Error("frontmatter table not found in README");

  const rows = [];
  for (let i = headerIdx + 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith("|")) break;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    rows.push(cells);
  }
  return rows;
}

const rows = parseFieldTable(README);
const tableFields = rows.map((r) => r[0].replace(/`/g, ""));

test("README table lists exactly the non-virtual fields declared in FIELDS", () => {
  const schemaFields = Object.keys(FIELDS).filter((f) => !FIELDS[f].virtual);
  assert.deepEqual(
    [...tableFields].sort(),
    [...schemaFields].sort(),
    "README field rows do not match FIELDS (virtual fields are excluded from the table)"
  );
});

for (const row of rows) {
  const [
    nameCell,
    ,
    requiredCell,
    ,
    indexableCell,
    filterCell,
    songCell,
    printCell,
  ] = row;
  const name = nameCell.replace(/`/g, "");
  const spec = FIELDS[name];
  if (!spec) continue; // covered by the previous test

  test(`README row for ${name} matches schema`, () => {
    const expectedRequired = spec.required ? "yes" : "no";
    assert.equal(
      requiredCell,
      expectedRequired,
      `Required column for ${name}`
    );

    const expectIndexable = Boolean(spec.indexable);
    const hasIndexable = indexableCell.includes("✓");
    assert.equal(
      hasIndexable,
      expectIndexable,
      `Indexable column for ${name}`
    );

    const expectFilterable = Boolean(spec.filterable);
    const hasFilter = filterCell.includes("✓");
    assert.equal(
      hasFilter,
      expectFilterable,
      `Filter column for ${name}`
    );

    for (const [view, cell] of [
      ["song", songCell],
      ["print", printCell],
    ]) {
      // "✓" means rendered and visible by default; "+" means rendered
      // but hidden by default behind a collapsible drawer (tracked in
      // the schema's `collapsedOn` list). An empty cell means the
      // field doesn't render in that view at all.
      const visible = cell.includes("✓");
      const collapsed = cell.includes("+");
      const present = visible || collapsed;
      const expectedPresent = spec.display.includes(view);
      const expectedCollapsed = (spec.collapsedOn || []).includes(view);
      const label = view[0].toUpperCase() + view.slice(1);
      assert.equal(
        present,
        expectedPresent,
        `${label} column for ${name}: present`
      );
      assert.equal(
        collapsed,
        expectedCollapsed,
        `${label} column for ${name}: collapsed`
      );
    }
  });
}
