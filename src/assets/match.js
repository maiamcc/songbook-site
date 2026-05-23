// Pure matcher used by src/assets/search.js to filter the home-page
// song list. The query is split on whitespace into tokens, each token
// is lowercased, and a record matches iff its text contains every
// token as a substring (AND, not OR). An empty query matches anything.
//
// Lives alongside search.js in src/assets/ so the browser can import
// it as a sibling module, and is also imported directly by
// test/search.test.js so the match logic is tested without a DOM.
export function matchTokens(text, query) {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = text.toLowerCase();
  return tokens.every((t) => haystack.includes(t));
}
