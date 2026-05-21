#!/usr/bin/env node
import { createInterface } from "node:readline";
import process, { stdin, stdout } from "node:process";
import { writeFile, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { FIELDS, validate } from "../test/song-schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SONGS_DIR = join(__dirname, "..", "src", "songs");

export function slugify(s) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Default slug derived from a song title. Strips a leading "the" or "a"
// article so e.g. "The Bells of Norwich" sorts as "bells-of-norwich".
// Only applied to the auto-generated default — a user-supplied slug is
// taken at face value.
export function defaultSlug(title) {
  return slugify(title).replace(/^(the|a)-/, "");
}

// Convert one raw input string into the typed value the schema expects.
// Returns undefined for blank input (the user is skipping). For bop_rating,
// non-numeric input is passed through as-is so the validator surfaces the
// canonical type error message.
export function parse(field, raw) {
  const trimmed = raw.trim();
  if (trimmed === "") return undefined;
  switch (field) {
    case "topics":
      return trimmed
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    case "bop_rating": {
      const n = Number(trimmed);
      return Number.isInteger(n) ? n : trimmed;
    }
    default:
      return trimmed;
  }
}

function promptFor(field) {
  const spec = FIELDS[field];
  const tail = spec.required ? "required" : "enter to skip";
  return `${field} [${spec.type}] (${tail}): `;
}

async function main() {
  const rl = createInterface({ input: stdin });
  const lines = rl[Symbol.asyncIterator]();
  const ask = async (prompt) => {
    stdout.write(prompt);
    const { value, done } = await lines.next();
    if (done) throw new Error("unexpected end of input");
    return value;
  };
  const data = {};

  try {
    for (const field of Object.keys(FIELDS)) {
      while (true) {
        const raw = await ask(promptFor(field));
        const value = parse(field, raw);

        if (value === undefined) {
          if (FIELDS[field].required) {
            console.log(`  ${field} is required`);
            continue;
          }
          break;
        }

        const errors = validate({ ...data, [field]: value }).filter((e) =>
          e.includes(field)
        );
        if (errors.length > 0) {
          for (const e of errors) console.log(`  ${e}`);
          continue;
        }

        data[field] = value;
        break;
      }
    }

    const fallback = defaultSlug(data.title);
    let filepath;
    while (true) {
      const raw = await ask(`slug (enter for "${fallback}"): `);
      const slug = raw.trim() === "" ? fallback : slugify(raw);
      if (!slug) {
        console.log("  slug must contain at least one alphanumeric character");
        continue;
      }
      const candidate = join(SONGS_DIR, `${slug}.md`);
      try {
        await access(candidate);
        console.log(`  ${slug}.md already exists, pick another slug`);
        continue;
      } catch {
        filepath = candidate;
        break;
      }
    }

    await writeFile(filepath, matter.stringify("", data));
    console.log(`created ${filepath}`);
  } finally {
    rl.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
