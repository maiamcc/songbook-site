import { test } from "node:test";
import assert from "node:assert/strict";
import { relativeUrl } from "../lib/url.js";

// Resolve a relative href against a page URL the same way a browser
// would when the user clicks the link or loads an asset. Returns the
// pathname of the resulting absolute URL.
function resolveFrom(page, href) {
  return new URL(href, "http://x.test" + page).pathname;
}

test("relativeUrl: every page→target pair round-trips and stays relative", () => {
  // Realistic set of URLs the site emits: home, song view, song print
  // view, and a deep index page. The TARGETS cover every kind of
  // internal link the templates produce: the home link, the stylesheet,
  // a song page, its print sibling, an index page, and a slugified
  // multi-word topic.
  const PAGES = [
    "/",
    "/songs/foo/",
    "/songs/foo/print/",
    "/index/mood/uplifting/",
  ];
  const TARGETS = [
    "/",
    "/assets/style.css",
    "/songs/foo/",
    "/songs/foo/print/",
    "/index/mood/uplifting/",
    "/index/topics/beta-gamma/",
  ];

  for (const page of PAGES) {
    for (const target of TARGETS) {
      const rel = relativeUrl(target, page);
      // Must be relative — a leading "/" would break subpath deploys
      // (e.g. /<repo>/ on a GitHub project page).
      assert.ok(
        !rel.startsWith("/"),
        `from ${page} to ${target}: got "${rel}" which is still absolute`
      );
      // And the browser must resolve it back to the original target.
      assert.equal(
        resolveFrom(page, rel),
        target,
        `from ${page} to ${target}: "${rel}" resolved to a different URL`
      );
    }
  }
});

test("relativeUrl: external and already-relative URLs pass through", () => {
  assert.equal(
    relativeUrl("https://example.com/x", "/songs/foo/"),
    "https://example.com/x"
  );
  assert.equal(relativeUrl("print/", "/songs/foo/"), "print/");
  assert.equal(relativeUrl("#anchor", "/songs/foo/"), "#anchor");
});

test("relativeUrl: returns input unchanged when currentUrl is missing", () => {
  // The unit-test renderer in test/views.test.js relies on this so its
  // existing href assertions keep matching the original absolute paths
  // without needing to wire up a fake page.url in every fixture.
  assert.equal(relativeUrl("/assets/style.css"), "/assets/style.css");
  assert.equal(relativeUrl("/songs/foo/", ""), "/songs/foo/");
});
