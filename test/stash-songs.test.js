import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readdir, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { stash, unstash } from "../scripts/stash-songs.js";

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "stash-test-"));
  const stashDir = join(dir, "stash");
  await writeFile(join(dir, "song-a.md"), "# A");
  await writeFile(join(dir, "song-b.md"), "# B");
  await writeFile(join(dir, "not-a-song.txt"), "ignored");
  return { dir, stashDir };
}

test("stash: moves .md files to stash dir, leaves non-.md alone", async () => {
  const { dir, stashDir } = await setup();
  await stash(dir, stashDir);

  const inSongs = await readdir(dir);
  assert.ok(!inSongs.includes("song-a.md"));
  assert.ok(!inSongs.includes("song-b.md"));
  assert.ok(inSongs.includes("not-a-song.txt"));

  const inStash = await readdir(stashDir);
  assert.ok(inStash.includes("song-a.md"));
  assert.ok(inStash.includes("song-b.md"));
});

test("stash: no-ops when there are no .md files", async () => {
  const dir = await mkdtemp(join(tmpdir(), "stash-test-"));
  const stashDir = join(dir, "stash");
  await writeFile(join(dir, "readme.txt"), "hi");
  await stash(dir, stashDir);
  assert.ok(!existsSync(stashDir));
});

test("unstash: moves .md files back and removes empty stash dir", async () => {
  const { dir, stashDir } = await setup();
  await stash(dir, stashDir);
  await unstash(dir, stashDir);

  const inSongs = await readdir(dir);
  assert.ok(inSongs.includes("song-a.md"));
  assert.ok(inSongs.includes("song-b.md"));
  assert.ok(!existsSync(stashDir), "stash dir should be deleted when empty");
});

test("unstash: keeps stash dir if non-.md files remain", async () => {
  const { dir, stashDir } = await setup();
  await stash(dir, stashDir);
  await writeFile(join(stashDir, "notes.txt"), "keep");
  await unstash(dir, stashDir);

  assert.ok(existsSync(stashDir), "stash dir should persist when non-.md files remain");
  const inStash = await readdir(stashDir);
  assert.ok(inStash.includes("notes.txt"));
});

test("unstash: no-ops when stash dir does not exist", async () => {
  const dir = await mkdtemp(join(tmpdir(), "stash-test-"));
  const stashDir = join(dir, "stash");
  await assert.doesNotReject(() => unstash(dir, stashDir));
});
