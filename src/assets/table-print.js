// Client-side table renderer for the list-print and index-print pages.
// Reads all view state from URL params (q, filter values, cols, sort/dir),
// fetches the same filter-index and search-index endpoints as the screen
// table, applies the same filtering/sorting logic, and renders a static
// table with no interactive chrome (no sort buttons, no column picker).
//
// Mirror of the constants in table.js — must stay in sync.
import { matchTokens } from "./match.js";
import { songMatchesFilters } from "./filter-match.js";
import { sortSongs } from "./sort.js";

const PINNED_COL_KEYS = ["title"];
const REMOVABLE_DEFAULT_COL_KEYS = ["author", "bop_rating"];
const DEFAULT_COL_LABELS = { title: "Title", author: "Author", bop_rating: "Bop" };

(async () => {
  const tableWrap = document.getElementById("song-table-wrap");
  if (!tableWrap) return;

  const configEl = document.getElementById("filter-config");
  const filterFields = configEl ? JSON.parse(configEl.textContent).fields : [];

  const tableConfigEl = document.getElementById("table-config");
  const tableConfig = tableConfigEl ? JSON.parse(tableConfigEl.textContent) : {};
  const searchIndexUrl = tableConfig.searchIndexUrl || "/search-index.json";
  const filterIndexUrl = tableConfig.filterIndexUrl || "/filter-index.json";
  const lockedFilter = tableConfig.lockedFilter || null;

  const visibleFilterFields = lockedFilter
    ? filterFields.filter((f) => f.key !== lockedFilter.field)
    : filterFields;

  const colLabels = { ...DEFAULT_COL_LABELS };
  for (const f of filterFields) {
    if (!(f.key in colLabels)) colLabels[f.key] = f.label;
  }

  const removableDefaultKeySet = new Set(REMOVABLE_DEFAULT_COL_KEYS);
  const optionalCols = [
    ...REMOVABLE_DEFAULT_COL_KEYS.map((key) => ({ key })),
    ...visibleFilterFields.filter(
      (f) => !PINNED_COL_KEYS.includes(f.key) && !removableDefaultKeySet.has(f.key)
    ),
  ];

  // ── Read URL params ────────────────────────────────────────────────────────
  const params = new URLSearchParams(location.search);
  const q = params.get("q") || "";

  const active = Object.fromEntries(visibleFilterFields.map((f) => [f.key, new Set()]));
  for (const { key } of visibleFilterFields) {
    for (const val of params.getAll(key)) {
      if (active[key]) active[key].add(val);
    }
  }

  const activeCols = new Set(REMOVABLE_DEFAULT_COL_KEYS);
  const colsParam = params.get("cols");
  if (colsParam !== null) {
    activeCols.clear();
    for (const col of colsParam.split(",").filter(Boolean)) {
      if (optionalCols.some((f) => f.key === col)) activeCols.add(col);
    }
  }

  const sortField = params.get("sort") || "title";
  const sortDir = params.get("dir") === "desc" ? "desc" : "asc";

  // ── Fetch data ─────────────────────────────────────────────────────────────
  const [searchEntries, filterEntries] = await Promise.all([
    fetch(searchIndexUrl)
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []),
    fetch(filterIndexUrl)
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []),
  ]);

  const searchByUrl = new Map(searchEntries.map((e) => [e.url, e.text]));
  let songs = filterEntries;

  // ── Apply locked filter ────────────────────────────────────────────────────
  if (lockedFilter) {
    const { field, value } = lockedFilter;
    songs = songs.filter((song) => {
      const val = song[field];
      if (val === undefined || val === null) return false;
      const vals = Array.isArray(val) ? val.map(String) : [String(val)];
      return vals.includes(String(value));
    });
  }

  // ── Apply search + filters + sort ──────────────────────────────────────────
  const visible = songs.filter(
    (song) =>
      matchTokens(searchByUrl.get(song.url) || "", q) &&
      songMatchesFilters(song, active)
  );
  const sorted = sortSongs(visible, sortField, sortDir);

  const cols = [
    ...PINNED_COL_KEYS,
    ...optionalCols.filter((f) => activeCols.has(f.key)).map((f) => f.key),
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  if (q.trim()) {
    const notice = document.createElement("p");
    notice.className = "print-search-notice";
    notice.textContent = `Search: "${q}"`;
    tableWrap.appendChild(notice);
  }

  if (sorted.length === 0) {
    const msg = document.createElement("p");
    msg.textContent = "No songs match.";
    tableWrap.appendChild(msg);
    return;
  }

  const table = document.createElement("table");
  table.className = "song-table";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  for (const col of cols) {
    const th = document.createElement("th");
    th.className = "song-th";
    th.textContent = colLabels[col] || col;
    if (sortField === col) {
      const arrow = document.createElement("span");
      arrow.className = "print-sort-arrow";
      arrow.textContent = sortDir === "asc" ? " ▲" : " ▼";
      th.appendChild(arrow);
    }
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const song of sorted) {
    const tr = document.createElement("tr");
    tr.className = "song-tr";
    for (const col of cols) {
      const td = document.createElement("td");
      td.className = col === "title" ? "song-td song-td--title" : "song-td";
      if (col === "title") {
        td.textContent = song.title || "(untitled)";
        if (song.alternate_title) {
          td.appendChild(document.createTextNode(" "));
          const alt = document.createElement("span");
          alt.className = "alt-title";
          alt.textContent = `(${song.alternate_title})`;
          td.appendChild(alt);
        }
      } else {
        renderCellContent(td, song, col);
      }
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  tableWrap.appendChild(table);
})();

function renderCellContent(td, song, col) {
  const val = song[col];
  if (val === undefined || val === null) return;
  if (Array.isArray(val)) {
    const wrap = document.createElement("span");
    wrap.className = "cell-chips";
    for (const item of val) {
      const chip = document.createElement("span");
      chip.className = "cell-chip";
      chip.textContent = humanizeVal(String(item));
      wrap.appendChild(chip);
    }
    td.appendChild(wrap);
  } else if (typeof val === "boolean") {
    td.textContent = val ? "yes" : "no";
  } else {
    td.textContent = humanizeVal(String(val));
  }
}

function humanizeVal(val) {
  if (val === "true") return "yes";
  if (val === "false") return "no";
  return val.replace(/[_-]/g, " ");
}
