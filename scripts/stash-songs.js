#!/usr/bin/env node
import { rename, readdir, rmdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SONGS_DIR = join(__dirname, "../src/songs");
const STASH_DIR = join(SONGS_DIR, "stash");

export async function stash(songsDir = SONGS_DIR, stashDir = join(songsDir, "stash")) {
  const entries = await readdir(songsDir);
  const mds = entries.filter((f) => f.endsWith(".md"));
  if (mds.length === 0) {
    console.log("No song files to stash.");
    return;
  }
  if (!existsSync(stashDir)) {
    await (await import("node:fs/promises")).mkdir(stashDir);
  }
  for (const f of mds) {
    await rename(join(songsDir, f), join(stashDir, f));
  }
  console.log(`Stashed ${mds.length} song(s) to ${stashDir}`);
}

export async function unstash(songsDir = SONGS_DIR, stashDir = join(songsDir, "stash")) {
  if (!existsSync(stashDir)) {
    console.log("No stash directory found — nothing to unstash.");
    return;
  }
  const entries = await readdir(stashDir);
  const mds = entries.filter((f) => f.endsWith(".md"));
  if (mds.length === 0) {
    console.log("Stash is empty — nothing to unstash.");
    return;
  }
  for (const f of mds) {
    await rename(join(stashDir, f), join(songsDir, f));
  }
  const remaining = await readdir(stashDir);
  if (remaining.length === 0) {
    await rmdir(stashDir);
  }
  console.log(`Unstashed ${mds.length} song(s) to ${songsDir}`);
}

// Only run as CLI — not when imported by tests or other modules.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const unstashing = process.argv.includes("--unstash");
  if (unstashing) {
    await unstash();
  } else {
    await stash();
  }
}
