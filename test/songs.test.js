import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { validate } from "./song-schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SONGS_DIR = join(__dirname, "..", "src", "songs");

const songFiles = readdirSync(SONGS_DIR).filter((f) => f.endsWith(".md"));

test("at least one song exists", () => {
  assert.ok(songFiles.length > 0, "no songs found in src/songs/");
});

for (const file of songFiles) {
  test(`frontmatter: ${file}`, () => {
    const raw = readFileSync(join(SONGS_DIR, file), "utf8");
    const { data } = matter(raw);
    const errors = validate(data);
    assert.deepEqual(
      errors,
      [],
      `frontmatter errors in ${file}:\n  - ${errors.join("\n  - ")}`
    );
  });
}
