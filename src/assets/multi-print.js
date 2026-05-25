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

  for (let i = 0; i < valid.length; i++) {
    const section = document.createElement("section");
    if (i < valid.length - 1) section.className = "multi-print-song--break";
    section.innerHTML = valid[i];
    wrap.appendChild(section);
  }
})();
