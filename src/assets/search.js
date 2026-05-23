// Client-side search for the home page. Fetches /search-index.json
// (emitted by src/search-index.njk from the searchIndex collection in
// eleventy.config.js), keys it by song URL, and filters the song-list
// <li>s on each input event. Token AND-matching is in match.js so the
// logic can be unit-tested without a DOM (see test/search.test.js).
import { matchTokens } from "./match.js";

(async () => {
  const input = document.getElementById("song-search");
  const list = document.getElementById("song-list");
  const empty = document.getElementById("song-search-empty");
  if (!input || !list) return;

  let byUrl;
  try {
    const res = await fetch("search-index.json");
    if (!res.ok) throw new Error(res.status);
    const entries = await res.json();
    byUrl = new Map(entries.map((e) => [e.url, e.text]));
  } catch {
    input.disabled = true;
    input.placeholder = "Search unavailable";
    return;
  }

  const items = [...list.querySelectorAll("li[data-url]")];
  if (items.length === 0) {
    input.disabled = true;
    return;
  }

  function filter() {
    const q = input.value;
    let visible = 0;
    for (const li of items) {
      const text = byUrl.get(li.dataset.url) || "";
      const match = matchTokens(text, q);
      li.hidden = !match;
      if (match) visible++;
    }
    if (empty) empty.hidden = !(q.trim() && visible === 0);
  }

  input.addEventListener("input", filter);
})();
