// Convert a root-absolute URL like "/assets/style.css" into a path
// relative to `currentUrl` (the URL of the page being rendered, e.g.
// "/songs/foo/"). Used so the built site can be served from any
// subpath — a custom domain root, a GitHub project page at
// /<repo>/, etc. — without baking the deploy path into the HTML.
//
// Pass-through behavior:
//   - external/protocol URLs and already-relative URLs are returned
//     as-is (anything not starting with "/")
//   - if `currentUrl` is falsy (e.g. unit-test renderers that don't
//     populate Eleventy's `page` object), the absolute URL is
//     returned unchanged — so existing href assertions keep working
//
// Both currentUrl and target are assumed to be directory-style URLs
// ending in "/" (which Eleventy emits by default). Depth is the
// number of path segments in currentUrl: "/" → 0, "/songs/foo/" → 2.
export function relativeUrl(targetUrl, currentUrl) {
  if (typeof targetUrl !== "string") return targetUrl;
  if (!targetUrl.startsWith("/")) return targetUrl;
  if (!currentUrl) return targetUrl;

  const depth = currentUrl.split("/").filter(Boolean).length;
  const up = "../".repeat(depth);
  const target = targetUrl.replace(/^\//, "");
  const result = up + target;
  return result === "" ? "./" : result;
}
