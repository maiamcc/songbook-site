import { test } from "node:test";
import assert from "node:assert/strict";
import { songRowClass } from "../src/assets/row-class.js";

test("songRowClass: song with lyrics", () => {
  assert.equal(songRowClass({ has_lyrics: true }), "song-tr");
});

test("songRowClass: has_lyrics absent defaults to lyrics present", () => {
  assert.equal(songRowClass({}), "song-tr");
});

test("songRowClass: song without lyrics", () => {
  assert.equal(songRowClass({ has_lyrics: false }), "song-tr song-tr--no-lyrics");
});

test("songRowClass: song without lyrics, in_nb=true — no gray background modifier", () => {
  assert.equal(
    songRowClass({ has_lyrics: false, in_nb: true }),
    "song-tr song-tr--no-lyrics song-tr--no-lyrics-in-nb"
  );
});

test("songRowClass: song without lyrics, in_nb=false — gray background applies", () => {
  assert.equal(
    songRowClass({ has_lyrics: false, in_nb: false }),
    "song-tr song-tr--no-lyrics"
  );
});

test("songRowClass: song with lyrics, in_nb=true — no effect", () => {
  assert.equal(songRowClass({ has_lyrics: true, in_nb: true }), "song-tr");
});
