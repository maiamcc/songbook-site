#!/usr/bin/env node
// Import songs from a CSV file. Each row becomes a song file in src/songs/.
//
// CSV format:
//   - Header row: field names from the schema, plus optional "slug" and "body"
//     columns. Unknown column names are skipped with a warning.
//   - One row per song. Empty cells are treated as absent (optional fields skip;
//     required fields cause the row to fail validation).
//   - List fields (topics, mood, structure): comma-separated within the cell
//     (e.g. "uplifting, rousing" or "chorus, zipper").
//   - bop_rating: integer string (e.g. "4").
//   - slug: if present and non-empty, used as-is (slugified); otherwise derived
//     from the title the same way new-song.js does.
//   - body: if present, written as the song's markdown body (lyrics).
//
// Rows that fail schema validation or whose slug already exists are skipped
// with an error/warning printed to stderr. All other rows are written.

import { readFileSync, writeFileSync, existsSync, openSync, readSync, closeSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { FIELDS, validate } from "../lib/song-schema.js";
import { defaultSlug, parse, slugify } from "./new-song.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SONGS_DIR = join(__dirname, "..", "src", "songs");

// Minimal RFC-4180-compatible CSV parser. Handles quoted fields (commas and
// newlines inside quotes), "" for a literal quote, CRLF and LF line endings.
// Returns an array of row arrays (each row is an array of field strings).
export function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  while (i < s.length) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    } else if (ch === '"') {
      inQuotes = true;
      i++;
    } else if (ch === ",") {
      row.push(field);
      field = "";
      i++;
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
    } else {
      field += ch;
      i++;
    }
  }
  row.push(field);
  if (row.some((f) => f !== "")) rows.push(row);
  return rows;
}

// Core import logic. Separated from main() so it can be tested without
// touching the real songs directory or /dev/tty.
//
// options:
//   autoOverwrite  — overwrite existing files without calling onConflict
//   overwriteEmpty — skip the merge; write only what the CSV row contains
//   onConflict(slug, title, rowNum) => boolean
//                  — called on collision when autoOverwrite is false;
//                    return true to overwrite, false to skip
//
// Returns { created, overwritten, skipped }.
export function importSongs(songsDir, csvText, { autoOverwrite = false, overwriteEmpty = false, onConflict = null } = {}) {
  const rows = parseCSV(csvText);
  if (rows.length < 2) {
    throw new Error("CSV must have a header row and at least one data row");
  }

  const [rawHeaders, ...dataRows] = rows;
  const headers = rawHeaders.map((h) => h.toLowerCase());
  const slugCol = headers.indexOf("slug");
  const bodyCol = headers.indexOf("body");

  const reserved = new Set(["slug", "body"]);
  for (const [i, h] of headers.entries()) {
    if (!reserved.has(h) && !FIELDS[h]) {
      console.warn(`warning: unknown column "${rawHeaders[i]}" will be ignored`);
    }
  }

  let created = 0;
  let overwritten = 0;
  let skipped = 0;

  for (const [i, row] of dataRows.entries()) {
    const rowNum = i + 2; // 1-indexed, +1 for header row

    // Parse each schema field from the row.
    const data = {};
    for (const [j, header] of headers.entries()) {
      if (reserved.has(header) || !FIELDS[header]) continue;
      const cell = (row[j] ?? "").trim();
      if (cell === "") continue;
      data[header] = parse(header, cell);
    }

    const errors = validate(data);
    if (errors.length > 0) {
      console.error(
        `row ${rowNum} (${data.title ?? "?"}): validation failed:\n  - ${errors.join("\n  - ")}`
      );
      skipped++;
      continue;
    }

    const rawSlug = slugCol >= 0 ? (row[slugCol] ?? "").trim() : "";
    const slug = rawSlug ? slugify(rawSlug) : defaultSlug(data.title);
    if (!slug) {
      console.error(`row ${rowNum}: could not derive a slug from title "${data.title}"`);
      skipped++;
      continue;
    }

    const filepath = join(songsDir, `${slug}.md`);
    const isExisting = existsSync(filepath);
    if (isExisting) {
      let doOverwrite;
      if (autoOverwrite) {
        console.log(`row ${rowNum} (${data.title}): ${slug}.md already exists, overwriting (--auto-overwrite)`);
        doOverwrite = true;
      } else {
        doOverwrite = onConflict ? onConflict(slug, data.title, rowNum) : false;
      }
      if (!doOverwrite) {
        skipped++;
        continue;
      }
    }

    const body = bodyCol >= 0 ? (row[bodyCol] ?? "") : "";

    let fileData = data;
    let fileBody = body;
    if (isExisting && !overwriteEmpty) {
      const existing = matter(readFileSync(filepath, "utf8"));
      fileData = { ...existing.data, ...data };
      fileBody = body !== "" ? body : existing.content.trimStart();
    }

    writeFileSync(filepath, matter.stringify(fileBody, fileData));
    if (isExisting) {
      console.log(`overwrote ${slug}.md`);
      overwritten++;
    } else {
      console.log(`created ${slug}.md`);
      created++;
    }
  }

  return { created, overwritten, skipped };
}

function promptYN(question) {
  process.stdout.write(`${question} [y/N] `);
  const ttyFd = openSync("/dev/tty", "r");
  const buf = Buffer.alloc(128);
  const n = readSync(ttyFd, buf, 0, buf.length, null);
  closeSync(ttyFd);
  const answer = buf.slice(0, n).toString().trim().toLowerCase();
  return answer === "y" || answer === "yes";
}

function main() {
  const args = process.argv.slice(2);
  const autoOverwrite = args.includes("--auto-overwrite");
  const overwriteEmpty = args.includes("--overwrite-empty");
  const csvPath = args.find((a) => !a.startsWith("--"));
  if (!csvPath) {
    console.error(
      "Usage: node scripts/import-songs.js [--auto-overwrite] [--overwrite-empty] <path/to/songs.csv>"
    );
    process.exit(1);
  }

  let text;
  try {
    text = readFileSync(csvPath, "utf8");
  } catch {
    console.error(`Cannot read file: ${csvPath}`);
    process.exit(1);
  }

  let result;
  try {
    result = importSongs(SONGS_DIR, text, {
      autoOverwrite,
      overwriteEmpty,
      onConflict: (slug, title, rowNum) =>
        promptYN(`row ${rowNum} (${title}): ${slug}.md already exists. Overwrite?`),
    });
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  const { created, overwritten, skipped } = result;
  console.log(`\ndone: ${created} created, ${overwritten} overwritten, ${skipped} skipped`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
