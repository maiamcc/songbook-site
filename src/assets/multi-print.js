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

  // `break-after: right` (CSS recto page break) is not reliably implemented
  // in current browsers. Instead, measure each non-last section's rendered
  // height, calculate its page count, and insert a blank page after any section
  // that ends on an odd page so the next song starts on an odd page.
  //
  // A5 content height: 210mm paper − 24mm top+bottom @page margins = 186mm.
  // At 96 CSS px/inch and 25.4 mm/inch: 186 × 96 / 25.4 ≈ 703 px.
  const PAGE_PX = Math.round((186 / 25.4) * 96);

  for (let i = 0; i < sections.length - 1; i++) {
    const pages = Math.ceil(sections[i].offsetHeight / PAGE_PX);
    if (pages % 2 === 1) {
      const blank = document.createElement("div");
      blank.className = "multi-print-blank";
      sections[i].after(blank);
    }
  }
})();
