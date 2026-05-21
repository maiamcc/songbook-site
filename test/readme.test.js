// Asserts the frontmatter table in README.md matches FIELDS in
// test/song-schema.js. The schema is the source of truth; this test
// fails loudly whenever the README drifts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FIELDS } from "./song-schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const README = readFileSync(join(__dirname, "..", "README.md"), "utf8");

// Parse the first markdown table that has the expected header.
function parseFieldTable(md) {
  const lines = md.split("\n");
  const headerIdx = lines.findIndex(
    (l) => /\|\s*Field\s*\|.*Required.*Home.*Song/.test(l)
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

test("README table lists exactly the fields declared in FIELDS", () => {
  const schemaFields = Object.keys(FIELDS);
  assert.deepEqual(
    [...tableFields].sort(),
    [...schemaFields].sort(),
    "README field rows do not match FIELDS"
  );
});

for (const row of rows) {
  const [nameCell, , requiredCell, , homeCell, songCell] = row;
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

    const expectHome = spec.display.includes("home");
    const hasHome = homeCell.includes("✓");
    assert.equal(hasHome, expectHome, `Home column for ${name}`);

    const expectSong = spec.display.includes("song");
    const hasSong = songCell.includes("✓");
    assert.equal(hasSong, expectSong, `Song column for ${name}`);
  });
}
