#!/usr/bin/env node
import { createInterface } from "node:readline";
import process, { stdin, stdout } from "node:process";
import { writeFile, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { FIELDS, validate } from "../lib/song-schema.js";

// Serialize a single YAML value inline (no trailing newline).
// Handles the types that appear in song frontmatter: string, number,
// boolean, and array of strings.
function yamlValue(v) {
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return `[${v.map(yamlScalar).join(", ")}]`;
  return yamlScalar(v);
}

// Quote a string if it contains characters that would confuse a YAML parser.
const YAML_KEYWORDS = new Set(["true", "false", "null", "yes", "no", "on", "off"]);
function yamlScalar(s) {
  if (
    s === "" ||
    s !== s.trim() ||
    YAML_KEYWORDS.has(s.toLowerCase()) ||
    /^[{[\|>&*!%@`'"#:?,-]/.test(s) ||
    s.includes(": ") ||
    s.includes(" #")
  ) {
    return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
  }
  return s;
}

// Build a complete song .md file string. Present fields are emitted as
// normal YAML; absent optional fields are emitted as commented-out
// placeholders so the user can see every field and fill it in later.
export function buildSongFile(data, body = "") {
  const lines = ["---"];
  for (const field of Object.keys(FIELDS)) {
    const v = data[field];
    if (v !== undefined && v !== null) {
      lines.push(`${field}: ${yamlValue(v)}`);
    } else if (!FIELDS[field].required) {
      const ph = FIELDS[field].placeholder;
      if (ph) {
        const [first, ...rest] = ph.split("\n");
        lines.push(`# ${field}: ${first}`);
        for (const l of rest) lines.push(`# ${l}`);
      } else {
        lines.push(`# ${field}: TK`);
      }
    }
  }
  lines.push("---");
  lines.push("");
  if (body.trim()) lines.push(body.trimEnd());
  return lines.join("\n") + "\n";
}
import { slugify } from "../lib/slug.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SONGS_DIR = join(__dirname, "..", "src", "songs");

// Re-exported so test/new-song.test.js can keep importing it from here.
export { slugify };

// Default slug derived from a song title. Strips a leading "the" or "a"
// article so e.g. "The Bells of Norwich" sorts as "bells-of-norwich".
// Only applied to the auto-generated default — a user-supplied slug is
// taken at face value.
export function defaultSlug(title) {
  return slugify(title).replace(/^(the|a)-/, "");
}

// Convert one raw input string into the typed value the schema expects.
// Returns undefined for blank input (the user is skipping).
// List fields (type starts with "list") accept comma-separated input.
// Integer-valued enums (all enum keys are digits, e.g. bop_rating) coerce
// to int; non-numeric input passes through as-is so validate() surfaces
// the canonical error message.
export function parse(field, raw) {
  const trimmed = raw.trim();
  if (trimmed === "") return undefined;
  const spec = FIELDS[field];
  if (spec.type.startsWith("list")) {
    return trimmed.split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (spec.values && Object.keys(spec.values).every((k) => /^\d+$/.test(k))) {
    const n = Number(trimmed);
    return Number.isInteger(n) ? n : trimmed;
  }
  return trimmed;
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

    await writeFile(filepath, buildSongFile(data));
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
