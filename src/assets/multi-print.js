// Multi-song print page. Reads ?song= params (repeated, one per song URL),
// fetches each song's pre-built print page, extracts the <main> content,
// and stitches them together with page breaks between songs.
(async () => {
  const wrap = document.getElementById("multi-print-wrap");
  if (!wrap) return;

  const songUrls = new URLSearchParams(location.search).getAll("song");

  if (songUrls.length === 0) {
    wrap.textContent = "No songs selected.";
    return;
  }

  const parser = new DOMParser();

  const results = await Promise.all(
    songUrls.map(async (url) => {
      const printUrl = url.replace(/\/?$/, "") + "/print/";
      try {
        const r = await fetch(printUrl);
        if (!r.ok) return null;
        const doc = parser.parseFromString(await r.text(), "text/html");
        return doc.querySelector("main")?.innerHTML?.trim() ?? null;
      } catch {
        return null;
      }
    })
  );

  const valid = results.filter(Boolean);
  if (valid.length === 0) {
    wrap.textContent = "Could not load any selected songs.";
    return;
  }

  const sections = valid.map((html, i) => {
    const section = document.createElement("section");
    section.className =
      i < valid.length - 1 ? "multi-print-song multi-print-song--break" : "multi-print-song";
    section.innerHTML = html;
    wrap.appendChild(section);
    return section;
  });

  // A5 content height: 210mm paper − 24mm top+bottom @page margins = 186mm.
  // At 96 CSS px/inch and 25.4 mm/inch: 186 × 96 / 25.4 ≈ 703 px.
  const PAGE_PX = Math.round((186 / 25.4) * 96);

  const pageCounts = sections.map(s => Math.ceil(s.offsetHeight / PAGE_PX));

  // Give each song section a unique named CSS page so the page counter resets
  // to 1 at the start of each song and reads "x/<total>" rather than counting
  // through the whole document. Font and color cascade from the global @page rule.
  // CSS counter-reset cannot reliably restart per section in Chrome:
  // @page name:first only matches the document's first page, and element-level
  // counter-reset fires before the page auto-increment rather than after it.
  // Instead, use named pages only to suppress the global @bottom-right counter
  // for song pages, then inject absolutely-positioned label divs into each
  // section at PAGE_PX intervals to show the per-song page numbers.
  const cssRules = sections.map((section, i) => {
    section.classList.add(`multi-print-song-${i}`);
    return [
      `.multi-print-song-${i} { page: song-${i}; }`,
      `@page song-${i} { @bottom-right { content: none; } }`,
    ].join("\n");
  }).join("\n\n");

  const styleEl = document.createElement("style");
  styleEl.textContent = cssRules;
  document.head.appendChild(styleEl);

  // Each label div spans one print page in height and floats its text to the
  // bottom-right, mirroring the position of @bottom-right margin content.
  //
  // Songs 1+ are forced to the top of a new print page by the preceding
  // break-after, so their section-relative positions map directly to page
  // positions. Song 0 starts partway into page 1 (body padding, etc.), so
  // its first label must be shorter by that offset so it still ends at the
  // page boundary rather than overshooting into the next page.
  sections.forEach((section, i) => {
    const total = pageCounts[i];
    const pageOffset = i === 0 ? section.offsetTop % PAGE_PX : 0;
    const firstPageHeight = PAGE_PX - pageOffset;

    for (let k = 1; k <= total; k++) {
      const label = document.createElement("div");
      label.className = "song-page-label";
      label.style.top = k === 1 ? "0px" : `${firstPageHeight + (k - 2) * PAGE_PX}px`;
      label.style.height = k === 1 ? `${firstPageHeight}px` : `${PAGE_PX}px`;
      label.textContent = `${k}/${total}`;
      section.appendChild(label);
    }
  });
})();
