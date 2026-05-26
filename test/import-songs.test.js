import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import matter from "gray-matter";
import { parseCSV, importSongs } from "../scripts/import-songs.js";

// Minimal frontmatter satisfying every required field.
const REQUIRED_CSV_HEADER = "title,author,bop_rating,rnge";
const REQUIRED_CSV_VALUES = "My Song,Test Author,3,ab-cd";

function withTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), "import-songs-test-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// --- parseCSV ---------------------------------------------------------------

test("parseCSV: basic multi-row parsing", () => {
  const rows = parseCSV("a,b,c\n1,2,3\n4,5,6\n");
  assert.deepEqual(rows, [
    ["a", "b", "c"],
    ["1", "2", "3"],
    ["4", "5", "6"],
  ]);
});

test("parseCSV: quoted field with embedded comma", () => {
  const rows = parseCSV('name,desc\nfoo,"hello, world"\n');
  assert.deepEqual(rows[1], ["foo", "hello, world"]);
});

test("parseCSV: double-quote inside quotes becomes literal quote", () => {
  const rows = parseCSV('a\n"say ""hi"""\n');
  assert.deepEqual(rows[1], ['say "hi"']);
});

test("parseCSV: CRLF line endings are normalised", () => {
  const rows = parseCSV("a,b\r\n1,2\r\n");
  assert.deepEqual(rows, [["a", "b"], ["1", "2"]]);
});

test("parseCSV: trailing all-empty row is ignored", () => {
  const rows = parseCSV("a,b\n1,2\n");
  assert.equal(rows.length, 2);
});

test("parseCSV: no trailing newline still captures final row", () => {
  const rows = parseCSV("a,b\n1,2");
  assert.deepEqual(rows, [["a", "b"], ["1", "2"]]);
});

// --- importSongs: basic creation --------------------------------------------

test("importSongs: creates a new .md file", () => {
  withTempDir((dir) => {
    const csv = `${REQUIRED_CSV_HEADER}\n${REQUIRED_CSV_VALUES}\n`;
    const { created, skipped } = importSongs(dir, csv);
    assert.equal(created, 1);
    assert.equal(skipped, 0);
    const { data } = matter(readFileSync(join(dir, "my-song.md"), "utf8"));
    assert.equal(data.title, "My Song");
    assert.equal(data.author, "Test Author");
    assert.equal(data.bop_rating, 3);
    assert.equal(data.rnge, "ab-cd");
  });
});

test("importSongs: slug derived from title when no slug column", () => {
  withTempDir((dir) => {
    const csv = `${REQUIRED_CSV_HEADER}\nThe Long Road,A Author,2,ab-cd\n`;
    importSongs(dir, csv);
    assert.ok(readFileSync(join(dir, "long-road.md"), "utf8"));
  });
});

test("importSongs: explicit slug column overrides title-derived slug", () => {
  withTempDir((dir) => {
    const csv = `${REQUIRED_CSV_HEADER},slug\n${REQUIRED_CSV_VALUES},custom-slug\n`;
    importSongs(dir, csv);
    assert.ok(readFileSync(join(dir, "custom-slug.md"), "utf8"));
  });
});

test("importSongs: body column is written as markdown body", () => {
  withTempDir((dir) => {
    const csv = `${REQUIRED_CSV_HEADER},body\n${REQUIRED_CSV_VALUES},Verse one lyrics\n`;
    importSongs(dir, csv);
    const raw = readFileSync(join(dir, "my-song.md"), "utf8");
    assert.ok(raw.includes("Verse one lyrics"));
  });
});

test("importSongs: unknown column is ignored, song still created", () => {
  withTempDir((dir) => {
    const csv = `${REQUIRED_CSV_HEADER},bogus_col\n${REQUIRED_CSV_VALUES},whatever\n`;
    const { created } = importSongs(dir, csv);
    assert.equal(created, 1);
    const { data } = matter(readFileSync(join(dir, "my-song.md"), "utf8"));
    assert.ok(!("bogus_col" in data));
  });
});

test("importSongs: column names matched case-insensitively", () => {
  withTempDir((dir) => {
    const csv = `TITLE,AUTHOR,BOP_RATING,RNGE\nMy Song,Test Author,3,ab-cd\n`;
    const { created } = importSongs(dir, csv);
    assert.equal(created, 1);
    const { data } = matter(readFileSync(join(dir, "my-song.md"), "utf8"));
    assert.equal(data.title, "My Song");
    assert.equal(data.bop_rating, 3);
  });
});

test("importSongs: reserved columns slug and body matched case-insensitively", () => {
  withTempDir((dir) => {
    const csv = `${REQUIRED_CSV_HEADER},SLUG,BODY\n${REQUIRED_CSV_VALUES},my-slug,Some lyrics\n`;
    importSongs(dir, csv);
    const raw = readFileSync(join(dir, "my-slug.md"), "utf8");
    assert.ok(raw.includes("Some lyrics"));
  });
});

test("importSongs: unknown column emits a warning with original casing", () => {
  withTempDir((dir) => {
    const warnings = [];
    const origWarn = console.warn;
    console.warn = (msg) => warnings.push(msg);
    try {
      importSongs(dir, `${REQUIRED_CSV_HEADER},Bogus_Col\n${REQUIRED_CSV_VALUES},whatever\n`);
    } finally {
      console.warn = origWarn;
    }
    assert.ok(
      warnings.some((w) => w.includes("Bogus_Col")),
      `expected a warning mentioning "Bogus_Col", got: ${JSON.stringify(warnings)}`
    );
  });
});

test("importSongs: list field parsed from comma-separated cell", () => {
  withTempDir((dir) => {
    const csv = `${REQUIRED_CSV_HEADER},topics\n${REQUIRED_CSV_VALUES},"home, travel"\n`;
    importSongs(dir, csv);
    const { data } = matter(readFileSync(join(dir, "my-song.md"), "utf8"));
    assert.deepEqual(data.topics, ["home", "travel"]);
  });
});

// --- importSongs: validation ------------------------------------------------

test("importSongs: row missing required field is skipped", () => {
  withTempDir((dir) => {
    // missing title
    const csv = `author,bop_rating,rnge\nTest Author,3,ab-cd\n`;
    const { created, skipped } = importSongs(dir, csv);
    assert.equal(created, 0);
    assert.equal(skipped, 1);
  });
});

test("importSongs: throws when CSV has no data rows", () => {
  withTempDir((dir) => {
    assert.throws(
      () => importSongs(dir, "title,author\n"),
      /header row and at least one data row/
    );
  });
});

// --- importSongs: collision handling ----------------------------------------

test("importSongs: collision with onConflict=true overwrites the file", () => {
  withTempDir((dir) => {
    const original = "---\ntitle: My Song\nauthor: Old Author\nbop_rating: 1\nrnge: aa-bb\n---\n";
    writeFileSync(join(dir, "my-song.md"), original);

    const csv = `${REQUIRED_CSV_HEADER}\nMy Song,New Author,3,ab-cd\n`;
    const { overwritten, skipped } = importSongs(dir, csv, { onConflict: () => true });
    assert.equal(overwritten, 1);
    assert.equal(skipped, 0);

    const { data } = matter(readFileSync(join(dir, "my-song.md"), "utf8"));
    assert.equal(data.author, "New Author");
  });
});

test("importSongs: collision with onConflict=false skips the row", () => {
  withTempDir((dir) => {
    const original = "---\ntitle: My Song\nauthor: Original\nbop_rating: 1\nrnge: aa-bb\n---\n";
    writeFileSync(join(dir, "my-song.md"), original);

    const csv = `${REQUIRED_CSV_HEADER}\nMy Song,New Author,3,ab-cd\n`;
    const { overwritten, skipped } = importSongs(dir, csv, { onConflict: () => false });
    assert.equal(overwritten, 0);
    assert.equal(skipped, 1);

    const { data } = matter(readFileSync(join(dir, "my-song.md"), "utf8"));
    assert.equal(data.author, "Original");
  });
});

test("importSongs: autoOverwrite overwrites without calling onConflict", () => {
  withTempDir((dir) => {
    writeFileSync(join(dir, "my-song.md"), "---\ntitle: My Song\nauthor: Old\nbop_rating: 1\nrnge: aa-bb\n---\n");

    let conflictCalled = false;
    const csv = `${REQUIRED_CSV_HEADER}\nMy Song,New Author,3,ab-cd\n`;
    const { overwritten } = importSongs(dir, csv, {
      autoOverwrite: true,
      onConflict: () => { conflictCalled = true; return false; },
    });

    assert.equal(overwritten, 1);
    assert.equal(conflictCalled, false);
  });
});

test("importSongs: no onConflict and no autoOverwrite skips the collision", () => {
  withTempDir((dir) => {
    writeFileSync(join(dir, "my-song.md"), "---\ntitle: My Song\nauthor: Old\nbop_rating: 1\nrnge: aa-bb\n---\n");

    const csv = `${REQUIRED_CSV_HEADER}\nMy Song,New Author,3,ab-cd\n`;
    const { overwritten, skipped } = importSongs(dir, csv);
    assert.equal(overwritten, 0);
    assert.equal(skipped, 1);
  });
});

// --- importSongs: merge behavior (default, no --overwrite-empty) ------------

test("importSongs: merge preserves existing field absent from CSV", () => {
  withTempDir((dir) => {
    // notes is not in the CSV; it should survive the overwrite
    writeFileSync(
      join(dir, "my-song.md"),
      "---\ntitle: My Song\nauthor: Old\nbop_rating: 1\nrnge: aa-bb\nnotes: keep me\n---\n"
    );
    const csv = `${REQUIRED_CSV_HEADER}\nMy Song,New Author,3,ab-cd\n`;
    importSongs(dir, csv, { onConflict: () => true });

    const { data } = matter(readFileSync(join(dir, "my-song.md"), "utf8"));
    assert.equal(data.notes, "keep me");
  });
});

test("importSongs: merge lets CSV non-empty field overwrite existing value", () => {
  withTempDir((dir) => {
    writeFileSync(
      join(dir, "my-song.md"),
      "---\ntitle: My Song\nauthor: Old Author\nbop_rating: 1\nrnge: aa-bb\n---\n"
    );
    const csv = `${REQUIRED_CSV_HEADER}\nMy Song,New Author,3,ab-cd\n`;
    importSongs(dir, csv, { onConflict: () => true });

    const { data } = matter(readFileSync(join(dir, "my-song.md"), "utf8"));
    assert.equal(data.author, "New Author");
  });
});

test("importSongs: merge preserves body when CSV body cell is empty", () => {
  withTempDir((dir) => {
    writeFileSync(
      join(dir, "my-song.md"),
      "---\ntitle: My Song\nauthor: Old\nbop_rating: 1\nrnge: aa-bb\n---\nOriginal lyrics\n"
    );
    // body column present but empty
    const csv = `${REQUIRED_CSV_HEADER},body\nMy Song,New Author,3,ab-cd,\n`;
    importSongs(dir, csv, { onConflict: () => true });

    const raw = readFileSync(join(dir, "my-song.md"), "utf8");
    assert.ok(raw.includes("Original lyrics"), "existing body should be preserved");
  });
});

test("importSongs: merge replaces body when CSV body cell is non-empty", () => {
  withTempDir((dir) => {
    writeFileSync(
      join(dir, "my-song.md"),
      "---\ntitle: My Song\nauthor: Old\nbop_rating: 1\nrnge: aa-bb\n---\nOriginal lyrics\n"
    );
    const csv = `${REQUIRED_CSV_HEADER},body\nMy Song,New Author,3,ab-cd,New lyrics\n`;
    importSongs(dir, csv, { onConflict: () => true });

    const raw = readFileSync(join(dir, "my-song.md"), "utf8");
    assert.ok(raw.includes("New lyrics"));
    assert.ok(!raw.includes("Original lyrics"));
  });
});

// --- importSongs: --overwrite-empty -----------------------------------------

test("importSongs: overwriteEmpty replaces file with only CSV fields", () => {
  withTempDir((dir) => {
    writeFileSync(
      join(dir, "my-song.md"),
      "---\ntitle: My Song\nauthor: Old\nbop_rating: 1\nrnge: aa-bb\nnotes: should be gone\n---\n"
    );
    const csv = `${REQUIRED_CSV_HEADER}\nMy Song,New Author,3,ab-cd\n`;
    importSongs(dir, csv, { onConflict: () => true, overwriteEmpty: true });

    const { data } = matter(readFileSync(join(dir, "my-song.md"), "utf8"));
    assert.equal(data.author, "New Author");
    // notes was not in the CSV; buildSongFile emits a commented-out placeholder.
    assert.equal(data.notes, undefined, "notes should be absent (commented out) when not in CSV");
  });
});

// --- importSongs: return counts ---------------------------------------------

test("importSongs: counts across mixed-outcome rows are correct", () => {
  withTempDir((dir) => {
    // pre-create a file for the collision row
    writeFileSync(join(dir, "existing-song.md"), "---\ntitle: Existing Song\nauthor: A\nbop_rating: 1\nrnge: aa-bb\n---\n");

    const csv = [
      REQUIRED_CSV_HEADER + ",slug",
      `${REQUIRED_CSV_VALUES},new-song`,           // created
      `Existing Song,A,1,aa-bb,existing-song`,     // collision → skipped
      `,Missing Title,3,ab-cd,`,                   // validation fail → skipped
    ].join("\n") + "\n";

    const result = importSongs(dir, csv, { onConflict: () => false });
    assert.deepEqual(result, { created: 1, overwritten: 0, skipped: 2 });
  });
});
