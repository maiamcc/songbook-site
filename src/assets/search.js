// Client-side search and filter for the home page.
// Fetches /search-index.json (text blobs for substring search) and
// /filter-index.json (structured per-field values for faceted filtering),
// then builds the filter UI and wires both up to the song list.
//
// Filter state (and search text) are reflected in the URL as query
// params so the current view is shareable: ?q=searchterm&mood=rousing&mood=fun
// Each active filter value is a separate repeated param; fields with no
// active values are omitted. history.replaceState keeps the URL current
// without creating back-navigation entries.
//
// Token AND-matching for text search lives in match.js so it can be
// unit-tested without a DOM.
import { matchTokens } from "./match.js";
import { songMatchesFilters } from "./filter-match.js";

(async () => {
  const searchInput = document.getElementById("song-search");
  const list = document.getElementById("song-list");
  const empty = document.getElementById("song-search-empty");
  if (!searchInput || !list) return;

  const configEl = document.getElementById("filter-config");
  const filterFields = configEl ? JSON.parse(configEl.textContent).fields : [];

  let searchByUrl, filterByUrl;
  try {
    const sr = await fetch("search-index.json");
    if (!sr.ok) throw new Error(sr.status);
    const searchEntries = await sr.json();
    searchByUrl = new Map(searchEntries.map((e) => [e.url, e.text]));
  } catch {
    searchInput.disabled = true;
    searchInput.placeholder = "Search unavailable";
    return;
  }

  try {
    const fr = await fetch("filter-index.json");
    if (fr.ok) {
      const filterEntries = await fr.json();
      filterByUrl = new Map(filterEntries.map((e) => [e.url, e]));
    }
  } catch {
    // Filter index unavailable; search still works, filter UI is skipped.
  }

  const items = [...list.querySelectorAll("li[data-url]")];
  if (items.length === 0) {
    searchInput.disabled = true;
    return;
  }

  // active: { fieldKey -> Set<string of selected values> }
  const active = Object.fromEntries(filterFields.map((f) => [f.key, new Set()]));

  let clearBtn = null;
  const panel = document.getElementById("filter-panel");
  if (panel && filterByUrl && filterFields.length > 0) {
    clearBtn = buildFilterUI(panel, filterFields, filterByUrl, active, updateVisibility);
  }

  // Restore state from URL params on load.
  const initialParams = new URLSearchParams(location.search);
  const initialQ = initialParams.get("q");
  if (initialQ) searchInput.value = initialQ;
  if (panel) {
    let anyInitialFilter = false;
    for (const { key } of filterFields) {
      for (const val of initialParams.getAll(key)) {
        if (!active[key]) continue;
        active[key].add(val);
        anyInitialFilter = true;
        const btn = panel.querySelector(`.filter-btn[data-value="${CSS.escape(val)}"]`);
        if (btn) btn.classList.add("filter-btn--active");
      }
    }
    if (clearBtn) clearBtn.hidden = !anyInitialFilter;
    // Open the filter panel if any filters are active from the URL.
    if (anyInitialFilter) {
      const details = document.getElementById("song-filter-details");
      if (details) details.open = true;
    }
  }

  function updateVisibility() {
    const q = searchInput.value;
    const anyFilter = Object.values(active).some((s) => s.size > 0);
    let visible = 0;
    for (const li of items) {
      const url = li.dataset.url;
      const text = searchByUrl.get(url) || "";
      const data = filterByUrl ? filterByUrl.get(url) : null;
      const show = matchTokens(text, q) && songMatchesFilters(data, active);
      li.hidden = !show;
      if (show) visible++;
    }
    if (empty) empty.hidden = !((q.trim() || anyFilter) && visible === 0);
    if (clearBtn) clearBtn.hidden = !anyFilter;
    syncUrl(q, active);
  }

  // Apply initial URL state to visibility.
  updateVisibility();

  searchInput.addEventListener("input", updateVisibility);
})();

function syncUrl(q, active) {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q);
  for (const [key, selected] of Object.entries(active)) {
    for (const val of selected) params.append(key, val);
  }
  const qs = params.toString();
  history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
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
