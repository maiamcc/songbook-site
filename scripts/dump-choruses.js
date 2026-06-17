#!/usr/bin/env node
/**
 * dump-choruses.js
 *
 * For each song that has lyrics, extracts the singable hook — refrain
 * lines and/or the first standalone chorus block — and writes a single
 * markdown file suitable for quick reference or further processing.
 *
 * Extensibility surface:
 *   - formatSongHeader(song)  → string   change the heading format
 *   - formatExcerpt(lines)    → string   change how chorus/refrain lines render
 *   - formatEntry(song, excerpts) → string   change the overall entry layout
 *   - formatDocument(entries) → string   change the overall document structure
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SONGS_DIR = join(__dirname, "../src/songs");
const OUT_PATH = join(__dirname, "choruses.md");

// ── Paragraph parsing ────────────────────────────────────────────────────────

const isIndented = (line) => /^(\t| {4})/.test(line);

function stripIndent(line) {
  return line.replace(/^(\t| {4})/, "");
}

/** Split raw body into paragraphs (blank-line-separated). */
function paragraphs(body) {
  return body
    .split(/\n\n+/)
    .filter((p) => p.trim() !== "");
}

/**
 * Classify a paragraph's lines as chorus / refrain / neither.
 *
 * Returns one of:
 *   { type: "chorus",  lines: string[] }  — all non-empty lines are indented
 *   { type: "refrain", lines: string[] }  — mix of indented and non-indented
 *   { type: "verse",   lines: string[] }  — no indented lines
 */
function classifyParagraph(para) {
  const raw = para.split("\n");
  // strip leading/trailing blank lines that are artifacts of paragraph splitting
  const first = raw.findIndex((l) => l.trim() !== "");
  const last = raw.findLastIndex((l) => l.trim() !== "");
  const lines = first >= 0 ? raw.slice(first, last + 1) : [];
  const indentedCount = lines.filter(isIndented).length;

  if (lines.length === 0 || indentedCount === 0) return { type: "verse", lines };
  if (indentedCount === lines.length) return { type: "chorus", lines };
  return { type: "refrain", lines };
}

/**
 * Extract the singable hook from a song body.
 *
 * Rules (applied in order, both results accumulated if both exist):
 *   1. First paragraph containing refrain lines (mixed verse+refrain).
 *   2. First contiguous run of all-indented (chorus) paragraphs.
 *
 * Returns an array of excerpt objects, each:
 *   { kind: "refrain" | "chorus", lines: string[] }
 */
function extractHook(body) {
  const paras = paragraphs(body).map(classifyParagraph);
  const results = [];

  // 1. First refrain paragraph
  const refrainPara = paras.find((p) => p.type === "refrain");
  if (refrainPara) {
    results.push({ kind: "refrain", lines: refrainPara.lines });
  }

  // 2. First contiguous chorus block
  let chorusStart = -1;
  for (let i = 0; i < paras.length; i++) {
    if (paras[i].type === "chorus") { chorusStart = i; break; }
  }
  if (chorusStart >= 0) {
    const chorusLines = [];
    for (let i = chorusStart; i < paras.length && paras[i].type === "chorus"; i++) {
      if (chorusLines.length > 0) chorusLines.push(""); // blank line between stanzas
      chorusLines.push(...paras[i].lines);
    }
    results.push({ kind: "chorus", lines: chorusLines });
  }

  return results;
}

// ── Formatting ───────────────────────────────────────────────────────────────

/** Render the song's heading line. */
function formatSongHeader(song) {
  const { title, alternate_title } = song;
  const titlePart = alternate_title ? `${title} (${alternate_title})` : title;
  return `# ${titlePart}`;
}

/**
 * Render a single excerpt's lines as markdown.
 * Indented lines → blockquotes; non-indented lines → plain.
 */
function formatExcerpt(lines) {
  return lines
    .map((line) => {
      if (line.trim() === "") return "";
      if (isIndented(line)) return stripIndent(line);
      return `_${line}_`;
    })
    .join("\n");
}

/** Render one song's full entry (header + excerpts, or placeholder). */
function formatEntry(song, excerpts) {
  const header = formatSongHeader(song);
  if (excerpts.length === 0) {
    return `${header}\n\n_(no chorus or refrain found)_`;
  }
  const body = excerpts.map((e) => formatExcerpt(e.lines)).join("\n\n");
  return `${header}\n\n${body}`;
}

/** Render the complete output document from an array of entry strings. */
function formatDocument(entries) {
  return entries.join("\n\n---\n\n") + "\n";
}

// ── Main ─────────────────────────────────────────────────────────────────────

const files = readdirSync(SONGS_DIR)
  .filter((f) => f.endsWith(".md"))
  .sort();

const entries = [];

for (const file of files) {
  const raw = readFileSync(join(SONGS_DIR, file), "utf8");
  const { data: song, content: body } = matter(raw);

  if (!body || !body.trim()) continue; // no lyrics

  const excerpts = extractHook(body);
  entries.push(formatEntry(song, excerpts));
}

const doc = formatDocument(entries);
writeFileSync(OUT_PATH, doc, "utf8");
console.log(`Wrote ${entries.length} entries to ${OUT_PATH}`);
