// Pure helper: compute the CSS class string for a song table row.
export function songRowClass(song) {
  const hasLyrics = song.has_lyrics !== false;
  let cls = hasLyrics ? "song-tr" : "song-tr song-tr--no-lyrics";
  if (!hasLyrics && song.in_nb === true) cls += " song-tr--no-lyrics-in-nb";
  return cls;
}
