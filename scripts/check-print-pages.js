#!/usr/bin/env node
// Reports each song's print page that overflows to 2+ pages of A5
// paper. Renders each print page through headless Chrome → PDF, then
// counts /Type /Page objects in the PDF binary (no external PDF tooling).
//
// Usage: npm run check-print-pages
//   (the npm script runs `npm run build` first so _site/ is fresh)
//
// Set CHROME_BIN to override the auto-detected Chrome path.

import { createServer } from "node:http";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE = join(__dirname, "..", "_site");

// Auto-detect path: macOS defaults. Override via CHROME_BIN env var
// (e.g. CHROME_BIN=/usr/bin/google-chrome npm run check-print-pages).
const DEFAULT_CHROME = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

function findChrome() {
  if (process.env.CHROME_BIN) {
    if (existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
    throw new Error(`CHROME_BIN=${process.env.CHROME_BIN} does not exist.`);
  }
  for (const p of DEFAULT_CHROME) {
    if (existsSync(p)) return p;
  }
  throw new Error(
    "Chrome not found. Install Google Chrome or set CHROME_BIN to its path."
  );
}

// Tiny static server serving _site/ on a random port. We can't use
// file:// URLs because the song pages reference /assets/style.css as
// an absolute path, which only resolves under http(s)://.
function startServer(rootDir) {
  const server = createServer(async (req, res) => {
    let pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (pathname.endsWith("/")) pathname += "index.html";
    const filePath = join(rootDir, pathname);
    try {
      const data = await readFile(filePath);
      res.setHeader(
        "Content-Type",
        MIME[extname(filePath)] || "application/octet-stream"
      );
      res.end(data);
    } catch {
      res.statusCode = 404;
      res.end("Not found");
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () =>
      resolve({ server, port: server.address().port })
    );
  });
}

// Chrome-generated PDFs have one `/Type /Page` object per output page
// plus a single `/Type /Pages` parent. The `(?!s)` lookahead excludes
// the parent. This sidesteps needing poppler / pdf-lib.
function pdfPageCount(buffer) {
  const str = buffer.toString("latin1");
  const matches = str.match(/\/Type\s*\/Page(?!s)/g);
  return matches ? matches.length : 0;
}

async function main() {
  if (!existsSync(SITE)) {
    console.error("No _site/ directory found. Run `npm run build` first.");
    process.exit(1);
  }
  const chrome = findChrome();
  const songsDir = join(SITE, "songs");
  const slugs = readdirSync(songsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((s) => existsSync(join(songsDir, s, "print", "index.html")))
    .sort();

  if (slugs.length === 0) {
    console.error("No print pages found under _site/songs/*/print/.");
    process.exit(1);
  }

  const { server, port } = await startServer(SITE);
  const tmpDir = await mkdtemp(join(tmpdir(), "song-pages-"));
  const results = [];

  try {
    for (const slug of slugs) {
      process.stdout.write(`  rendering ${slug}…`);
      const url = `http://127.0.0.1:${port}/songs/${slug}/print/`;
      const pdfPath = join(tmpDir, `${slug}.pdf`);
      await execFileP(chrome, [
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        `--print-to-pdf=${pdfPath}`,
        "--virtual-time-budget=5000",
        url,
      ]);
      const pdfBuf = await readFile(pdfPath);
      const pages = pdfPageCount(pdfBuf);
      results.push({ slug, pages });
      process.stdout.write(` ${pages} page${pages === 1 ? "" : "s"}\n`);
    }
  } finally {
    server.close();
    await rm(tmpDir, { recursive: true, force: true });
  }

  const multi = results.filter((r) => r.pages >= 2);
  console.log();
  if (multi.length === 0) {
    console.log(`All ${results.length} songs fit on a single A5 page. ✓`);
    return;
  }

  console.log("Songs spanning 2+ A5 pages:");
  for (const r of multi.sort(
    (a, b) => b.pages - a.pages || a.slug.localeCompare(b.slug)
  )) {
    console.log(`  ${r.pages} pages — ${r.slug}`);
  }
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
