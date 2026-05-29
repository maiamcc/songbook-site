// Client-side search, filter, and table rendering for the home page.
// Fetches /search-index.json (text blobs for substring search) and
// /filter-index.json (structured per-field values for faceted filtering
// plus table display fields: title, alternate_title, author), then builds
// the filter UI and a configurable sortable table.
//
// URL encoding: all state is reflected as query params so any view is
// shareable.
//   ?q=searchterm         — search text
//   ?mood=rousing&mood=fun — active filter values (repeated per value)
//   ?cols=mood,genre      — optional columns enabled beyond defaults
//   ?sort=bop_rating&dir=desc — active sort field and direction
// history.replaceState keeps the URL current without creating history entries.
import { matchTokens } from "./match.js";
import { songMatchesFilters } from "./filter-match.js";
import { sortSongs } from "./sort.js";
import { buildSearchParams } from "./url-state.js";

// Pinned columns: always visible, never in the meatball-menu column picker.
const PINNED_COL_KEYS = ["title"];

// Removable default columns: shown by default (pre-checked in the menu) but
// the user can hide them via the meatball menu or the [X] header button.
const REMOVABLE_DEFAULT_COL_KEYS = ["author", "bop_rating"];

// Human-readable labels for non-filterable columns (filterable field labels
// come from the filter-config JSON blob injected by the page template).
const DEFAULT_COL_LABELS = {
  title: "Title",
  author: "Author",
  bop_rating: "Bop",
};

(async () => {
  const searchInput = document.getElementById("song-search");
  const tableWrap = document.getElementById("song-table-wrap");
  const empty = document.getElementById("song-search-empty");
  if (!tableWrap) return;

  const configEl = document.getElementById("filter-config");
  const filterConfig = configEl ? JSON.parse(configEl.textContent) : {};
  const filterFields = filterConfig.fields ?? [];
  // Relative path from the current page to the site root (e.g. "../../" for a
  // page two levels deep). Injected by the template so root-absolute song URLs
  // from the search index can be made relative for subpath deploys.
  const pathPrefix = filterConfig.pathPrefix ?? "";

  const tableConfigEl = document.getElementById("table-config");
  const tableConfig = tableConfigEl ? JSON.parse(tableConfigEl.textContent) : {};
  const searchIndexUrl = tableConfig.searchIndexUrl || "search-index.json";
  const filterIndexUrl = tableConfig.filterIndexUrl || "filter-index.json";
  const lockedFilter = tableConfig.lockedFilter || null; // { field, value } — always-on, hidden from UI

  // Fields used for the filter panel and active state — the locked field is
  // pre-applied and doesn't appear as a toggleable filter button.
  const visibleFilterFields = lockedFilter
    ? filterFields.filter((f) => f.key !== lockedFilter.field)
    : filterFields;

  // Full label map: defaults first, then all filterable field labels.
  const colLabels = { ...DEFAULT_COL_LABELS };
  for (const f of filterFields) {
    if (!(f.key in colLabels)) colLabels[f.key] = f.label;
  }

  // Optional columns: removable defaults first, then other visible filterable
  // fields. All appear in the meatball menu; removable defaults are pre-checked.
  const removableDefaultKeySet = new Set(REMOVABLE_DEFAULT_COL_KEYS);
  const optionalCols = [
    ...REMOVABLE_DEFAULT_COL_KEYS.map((key) => ({ key })),
    ...visibleFilterFields.filter(
      (f) => !PINNED_COL_KEYS.includes(f.key) && !removableDefaultKeySet.has(f.key)
    ),
  ];

  // ── Fetch data ─────────────────────────────────────────────────────────────
  let searchByUrl, songs;
  try {
    const sr = await fetch(searchIndexUrl);
    if (!sr.ok) throw new Error(sr.status);
    const entries = await sr.json();
    searchByUrl = new Map(entries.map((e) => [e.url, e.text]));
  } catch {
    if (searchInput) {
      searchInput.disabled = true;
      searchInput.placeholder = "Search unavailable";
    }
    return;
  }

  try {
    const fr = await fetch(filterIndexUrl);
    if (fr.ok) songs = await fr.json();
  } catch {
    // Filter index unavailable — filtering and table unavailable.
  }

  if (!songs || songs.length === 0) {
    tableWrap.textContent = "No songs yet. Add a markdown file under src/songs/.";
    if (searchInput) searchInput.disabled = true;
    return;
  }

  // Pre-filter by locked value before building any state or UI.
  if (lockedFilter) {
    const { field, value } = lockedFilter;
    songs = songs.filter((song) => {
      const val = song[field];
      if (val === undefined || val === null) return false;
      const vals = Array.isArray(val) ? val.map(String) : [String(val)];
      return vals.includes(String(value));
    });
  }

  // ── State ──────────────────────────────────────────────────────────────────
  // active: { fieldKey -> Set<string> } — currently active filter values.
  const active = Object.fromEntries(visibleFilterFields.map((f) => [f.key, new Set()]));

  // activeCols: Set<string> — optional column keys currently shown.
  const activeCols = new Set(REMOVABLE_DEFAULT_COL_KEYS);

  // sortField / sortDir: currently active sort.
  let sortField = "title";
  let sortDir = "asc"; // "asc" | "desc"

  // selectedUrls: song URLs with their checkbox ticked.
  const selectedUrls = new Set();

  // ── Build table skeleton ───────────────────────────────────────────────────
  const tableScroll = document.createElement("div");
  tableScroll.className = "song-table-scroll";

  const table = document.createElement("table");
  table.className = "song-table";
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");
  table.appendChild(thead);
  table.appendChild(tbody);
  tableScroll.appendChild(table);

  const scrollHintRight = document.createElement("div");
  scrollHintRight.className = "table-scroll-hint table-scroll-hint--right";
  scrollHintRight.setAttribute("aria-hidden", "true");

  const scrollHintLeft = document.createElement("div");
  scrollHintLeft.className = "table-scroll-hint table-scroll-hint--left";
  scrollHintLeft.setAttribute("aria-hidden", "true");

  // ── Meatball menu (column picker) ──────────────────────────────────────────
  let menuOpen = false;

  const meatballBtn = document.createElement("button");
  meatballBtn.type = "button";
  meatballBtn.className = "table-cols-btn";
  meatballBtn.setAttribute("aria-label", "Configure columns");
  meatballBtn.setAttribute("aria-expanded", "false");
  meatballBtn.textContent = "⋮";

  const meatballMenu = document.createElement("div");
  meatballMenu.className = "table-cols-menu";
  meatballMenu.hidden = true;

  for (const col of optionalCols) {
    const label = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = col.key;
    cb.checked = removableDefaultKeySet.has(col.key);
    cb.addEventListener("change", () => {
      if (cb.checked) activeCols.add(col.key);
      else activeCols.delete(col.key);
      renderAll();
    });
    label.appendChild(cb);
    label.append(" " + (colLabels[col.key] || col.key));
    meatballMenu.appendChild(label);
  }

  // Meatball button and menu sit in a wrapper that's absolutely positioned
  // at the top-right of song-table-wrap, level with the thead row.
  const meatballWrap = document.createElement("div");
  meatballWrap.className = "song-table-controls";
  meatballWrap.appendChild(meatballBtn);
  meatballWrap.appendChild(meatballMenu);

  tableWrap.appendChild(tableScroll);
  tableWrap.appendChild(meatballWrap);
  tableWrap.appendChild(scrollHintRight);
  tableWrap.appendChild(scrollHintLeft);

  meatballBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    menuOpen = !menuOpen;
    meatballMenu.hidden = !menuOpen;
    meatballBtn.setAttribute("aria-expanded", String(menuOpen));
  });
  meatballMenu.addEventListener("click", (e) => e.stopPropagation());
  document.addEventListener("click", () => {
    if (menuOpen) {
      menuOpen = false;
      meatballMenu.hidden = true;
      meatballBtn.setAttribute("aria-expanded", "false");
    }
  });

  // ── Scroll affordance ──────────────────────────────────────────────────────
  function updateScrollHint() {
    const { scrollLeft, scrollWidth, clientWidth } = tableScroll;
    scrollHintRight.classList.toggle("visible", scrollLeft + clientWidth < scrollWidth - 1);
    scrollHintLeft.classList.toggle("visible", scrollLeft > 1);
  }
  tableScroll.addEventListener("scroll", updateScrollHint, { passive: true });
  new ResizeObserver(updateScrollHint).observe(tableScroll);

  // ── Filter UI ──────────────────────────────────────────────────────────────
  const filterPanel = document.getElementById("filter-panel");
  let clearBtn = null;
  const filterByUrl = new Map(songs.map((s) => [s.url, s]));
  if (filterPanel && visibleFilterFields.length > 0) {
    clearBtn = buildFilterUI(filterPanel, visibleFilterFields, filterByUrl, active, renderAll);
  }

  // ── Restore state from URL ─────────────────────────────────────────────────
  const initialParams = new URLSearchParams(location.search);

  // Search
  const initialQ = initialParams.get("q");
  if (initialQ && searchInput) searchInput.value = initialQ;

  // Filters
  if (filterPanel) {
    let anyInitialFilter = false;
    for (const { key } of visibleFilterFields) {
      for (const val of initialParams.getAll(key)) {
        if (!active[key]) continue;
        active[key].add(val);
        anyInitialFilter = true;
        const btn = filterPanel.querySelector(`.filter-btn[data-value="${CSS.escape(val)}"]`);
        if (btn) btn.classList.add("filter-btn--active");
      }
    }
    if (clearBtn) clearBtn.hidden = !anyInitialFilter;
    if (anyInitialFilter) {
      const details = document.getElementById("song-filter-details");
      if (details) details.open = true;
    }
  }

  // Optional columns — restore only when cols param is explicitly present,
  // otherwise keep the defaults already in activeCols.
  const colsParam = initialParams.get("cols");
  if (colsParam !== null) {
    activeCols.clear();
    for (const col of colsParam.split(",").filter(Boolean)) {
      if (optionalCols.some((f) => f.key === col)) activeCols.add(col);
    }
    for (const cb of meatballMenu.querySelectorAll("input[type=checkbox]")) {
      cb.checked = activeCols.has(cb.value);
    }
  }

  // Sort
  const sortParam = initialParams.get("sort");
  if (sortParam) {
    sortField = sortParam;
    sortDir = initialParams.get("dir") === "desc" ? "desc" : "asc";
  }

  // ── Event listeners ────────────────────────────────────────────────────────
  if (searchInput) searchInput.addEventListener("input", renderAll);

  // ── Initial render ─────────────────────────────────────────────────────────
  renderAll();

  // ── Core render functions ──────────────────────────────────────────────────
  function getActiveCols() {
    return [
      ...PINNED_COL_KEYS,
      ...optionalCols.filter((f) => activeCols.has(f.key)).map((f) => f.key),
    ];
  }

  function renderAll() {
    const q = searchInput ? searchInput.value : "";
    const anyFilter = Object.values(active).some((s) => s.size > 0);

    const visible = songs.filter(
      (song) =>
        matchTokens(searchByUrl.get(song.url) || "", q) &&
        songMatchesFilters(song, active)
    );
    const sorted = sortSongs(visible, sortField, sortDir);

    if (empty) empty.hidden = !((q.trim() || anyFilter) && sorted.length === 0);
    if (clearBtn) clearBtn.hidden = !anyFilter;

    const cols = getActiveCols();
    renderThead(thead, cols, sorted);
    renderTbody(tbody, sorted, cols);

    syncUrl(q, active, activeCols, sortField, sortDir);
    syncPrintSelected(selectedUrls);
    updateScrollHint();
  }

  function renderThead(thead, cols, sorted) {
    thead.innerHTML = "";
    const tr = document.createElement("tr");

    // Select-all checkbox
    const checkTh = document.createElement("th");
    checkTh.className = "song-th song-th--check";
    const selectAllCb = document.createElement("input");
    selectAllCb.type = "checkbox";
    selectAllCb.className = "row-check";
    selectAllCb.setAttribute("aria-label", "Select all visible songs");
    const visibleSelected = sorted.filter((s) => selectedUrls.has(s.url)).length;
    selectAllCb.checked = sorted.length > 0 && visibleSelected === sorted.length;
    selectAllCb.indeterminate = visibleSelected > 0 && visibleSelected < sorted.length;
    selectAllCb.addEventListener("click", (e) => e.stopPropagation());
    selectAllCb.addEventListener("change", () => {
      if (selectAllCb.checked) {
        for (const s of sorted) selectedUrls.add(s.url);
      } else {
        for (const s of sorted) selectedUrls.delete(s.url);
      }
      renderAll();
    });
    checkTh.appendChild(selectAllCb);
    tr.appendChild(checkTh);

    for (const col of cols) {
      const th = document.createElement("th");
      th.className = "song-th";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sort-btn";
      btn.textContent = colLabels[col] || col;

      if (sortField === col) {
        btn.classList.add(sortDir === "asc" ? "sort-asc" : "sort-desc");
        btn.setAttribute("aria-sort", sortDir === "asc" ? "ascending" : "descending");
      }

      btn.addEventListener("click", () => {
        if (sortField === col) {
          // asc → desc → unsorted
          if (sortDir === "asc") {
            sortDir = "desc";
          } else {
            sortField = null;
            sortDir = "asc";
          }
        } else {
          sortField = col;
          sortDir = "asc";
        }
        renderAll();
      });

      if (activeCols.has(col)) {
        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "col-remove-btn";
        removeBtn.setAttribute("aria-label", `Remove ${colLabels[col] || col} column`);
        removeBtn.textContent = "[X]";
        removeBtn.addEventListener("click", () => {
          activeCols.delete(col);
          const cb = meatballMenu.querySelector(`input[value="${CSS.escape(col)}"]`);
          if (cb) cb.checked = false;
          renderAll();
        });
        th.appendChild(removeBtn);
      }

      th.appendChild(btn);
      tr.appendChild(th);
    }
    thead.appendChild(tr);
  }

  function renderTbody(tbody, songs, cols) {
    tbody.innerHTML = "";
    for (const song of songs) {
      const tr = document.createElement("tr");
      const hasLyrics = song.has_lyrics !== false;
      tr.className = hasLyrics ? "song-tr" : "song-tr song-tr--no-lyrics";
      if (hasLyrics) {
        tr.addEventListener("click", (e) => {
          if (e.target.closest("a")) return;
          if (e.target.closest("input[type=checkbox]")) return;
          window.location.href = pathPrefix + song.url.replace(/^\//, "");
        });
      }

      // Row checkbox (omitted for songs without lyrics — nothing to print)
      const checkTd = document.createElement("td");
      checkTd.className = "song-td song-td--check";
      if (hasLyrics) {
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.className = "row-check";
        cb.checked = selectedUrls.has(song.url);
        cb.setAttribute("aria-label", `Select ${song.title || song.url}`);
        cb.addEventListener("click", (e) => e.stopPropagation());
        cb.addEventListener("change", () => {
          if (cb.checked) selectedUrls.add(song.url);
          else selectedUrls.delete(song.url);
          renderAll();
        });
        checkTd.appendChild(cb);
      }
      tr.appendChild(checkTd);

      for (const col of cols) {
        const td = document.createElement("td");
        td.className = col === "title" ? "song-td song-td--title" : "song-td";
        if (col === "title") {
          if (hasLyrics) {
            const a = document.createElement("a");
            a.href = pathPrefix + song.url.replace(/^\//, "");
            a.textContent = song.title || "(untitled)";
            td.appendChild(a);
          } else {
            td.appendChild(document.createTextNode(song.title || "(untitled)"));
          }
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
  }

  function renderCellContent(td, song, col) {
    const val = song[col];
    if (val === undefined || val === null) return;
    const indexUrl = song.indexUrls?.[col];
    if (Array.isArray(val)) {
      const wrap = document.createElement("span");
      wrap.className = "cell-chips";
      for (let i = 0; i < val.length; i++) {
        const itemUrl = Array.isArray(indexUrl) ? indexUrl[i] : null;
        const chip = itemUrl
          ? makeIndexLink(itemUrl, String(val[i]))
          : document.createElement("span");
        chip.className = "cell-chip";
        if (!itemUrl) chip.textContent = humanizeVal(String(val[i]));
        wrap.appendChild(chip);
      }
      td.appendChild(wrap);
    } else if (typeof val === "boolean") {
      td.textContent = val ? "yes" : "no";
    } else if (indexUrl) {
      td.appendChild(makeIndexLink(indexUrl, String(val)));
    } else {
      td.textContent = humanizeVal(String(val));
    }
  }

  function makeIndexLink(url, val) {
    const a = document.createElement("a");
    a.href = pathPrefix + url.replace(/^\//, "");
    a.textContent = humanizeVal(val);
    return a;
  }
})();

// ── Pure helpers (module-level) ────────────────────────────────────────────
// sortSongs and getSortVal live in sort.js (imported above).
// buildSearchParams lives in url-state.js (imported above).

function syncUrl(q, active, activeCols, sortField, sortDir) {
  const params = buildSearchParams(q, active, activeCols, REMOVABLE_DEFAULT_COL_KEYS, sortField, sortDir);
  const qs = params.toString();
  history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
  const printLink = document.getElementById("table-print-link");
  if (printLink) {
    const base = printLink.dataset.hrefBase || "";
    printLink.href = base + (qs ? `?${qs}` : "");
  }
}

function syncPrintSelected(selectedUrls) {
  const btn = document.getElementById("song-print-selected");
  if (!btn) return;
  const count = selectedUrls.size;
  btn.hidden = count === 0;
  if (count > 0) {
    btn.textContent = `Print ${count} selected →`;
    const params = new URLSearchParams();
    for (const url of selectedUrls) params.append("song", url);
    const multiPrintBase = btn.dataset.hrefBase || `${pathPrefix}multi-print/`;
    btn.href = `${multiPrintBase}?${params.toString()}`;
  }
}

function buildFilterUI(panel, fields, filterByUrl, active, onUpdate) {
  // Collect distinct values actually present in songs for each field.
  const fieldValSets = {};
  for (const { key } of fields) {
    const seen = new Set();
    for (const song of filterByUrl.values()) {
      const v = song[key];
      if (v === undefined || v === null) continue;
      const vals = Array.isArray(v) ? v : [v];
      for (const item of vals) seen.add(String(item));
    }
    fieldValSets[key] = seen;
  }

  // "Clear filters" button — starts hidden, shown when any filter is active.
  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "filter-clear";
  clearBtn.textContent = "Clear filters";
  clearBtn.hidden = true;
  clearBtn.addEventListener("click", () => {
    for (const key of Object.keys(active)) active[key].clear();
    panel.querySelectorAll(".filter-btn--active").forEach((b) =>
      b.classList.remove("filter-btn--active")
    );
    onUpdate();
  });
  panel.appendChild(clearBtn);

  for (const field of fields) {
    const { key, label, valueOrder } = field;
    const seen = fieldValSets[key];
    if (!seen || seen.size === 0) continue;

    // Use enum-defined order when provided; fall back to alphabetical.
    let vals;
    if (valueOrder) {
      vals = valueOrder.filter((v) => seen.has(v));
      for (const v of seen) if (!vals.includes(v)) vals.push(v);
    } else {
      vals = [...seen].sort();
    }

    const row = document.createElement("div");
    row.className = "filter-row";

    const lbl = document.createElement("span");
    lbl.className = "filter-label";
    lbl.textContent = label + ":";
    row.appendChild(lbl);

    const btns = document.createElement("span");
    btns.className = "filter-btns";

    for (const val of vals) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "filter-btn";
      btn.textContent = humanizeVal(val);
      btn.dataset.value = val;
      btn.addEventListener("click", () => {
        if (active[key].has(val)) {
          active[key].delete(val);
          btn.classList.remove("filter-btn--active");
        } else {
          active[key].add(val);
          btn.classList.add("filter-btn--active");
        }
        onUpdate();
      });
      btns.appendChild(btn);
    }

    row.appendChild(btns);
    panel.appendChild(row);
  }

  return clearBtn;
}

function humanizeVal(val) {
  if (val === "true") return "yes";
  if (val === "false") return "no";
  return val.replace(/[_-]/g, " ");
}
