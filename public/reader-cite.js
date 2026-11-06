// Reader citation parser (E16 citations). Pure, DOM-free ES module — same
// single-home contract as public/reader-toc.js: the browser loads it via a
// <script type="module"> shim that hangs the exports on window.ReaderCite, and
// vitest imports it directly. The generator emits [[cite:<id>]] markers in the
// report markdown; app.js turns them into small numbered footnote superscripts
// (hover → node title/description, click → open the node in the graph), and the
// numbering is assigned HERE, in first-appearance order, so it re-derives fresh
// on every render (a report re-generated with different citations re-numbers).

// [[cite:123]] or [[cite:123, 456]] — one or more numeric node ids. Kept as a
// source string so app.js can build its own stateful RegExp for DOM splitting
// (one source of truth for the marker format).
export const CITE_MARKER_SOURCE = '\\[\\[cite:\\s*([0-9]+(?:\\s*,\\s*[0-9]+)*)\\s*\\]\\]';
export const CITE_MARKER = new RegExp(CITE_MARKER_SOURCE, 'g');

// Cited node ids in first-appearance order, de-duplicated. The array index + 1
// is the citation number a node gets, so this defines the numbering.
export function extractCiteIds(markdown) {
  const ids = [];
  const seen = new Set();
  const re = new RegExp(CITE_MARKER_SOURCE, 'g');
  let m;
  while ((m = re.exec(String(markdown || '')))) {
    for (const raw of m[1].split(',')) {
      const id = raw.trim();
      if (id && !seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
  }
  return ids;
}

// id → citation number (1-based, first-appearance order). The map app.js uses to
// stamp both the inline superscripts and the References list, keeping them in sync.
export function numberMap(markdown) {
  const ids = extractCiteIds(markdown);
  return new Map(ids.map((id, i) => [id, i + 1]));
}

// --- Source URLs -----------------------------------------------------------
// A cited `type: reference` node keeps its source URL in its markdown BODY —
// there is no url column and no url meta key. The research workflow writes the
// body as literally `${s.url || ''}`, and hand-written sources use a normal
// markdown link or a bare URL in prose. So the citation tooltip digs the URL
// back out of the body to offer a direct click-through to the source itself.
//
// `|| ''` in that generator is load-bearing context: a source with NO url is a
// normal state (a first-party table, an interview, an internal doc), which is
// why this returns null rather than throwing or guessing.

// Leftmost match of any URL shape markdown can carry, in one pass so the
// EARLIEST url in the body wins regardless of which form it took:
//   1. a markdown link target — [label](https://…)
//   2. an angle autolink      — <https://…>
//   3. a bare url in prose    — https://…
// Every branch is anchored on `https?://`, so a `javascript:` payload can never
// match; validateHttpUrl below is belt-and-braces on top of that.
//
// Branches 1 and 3 deliberately ADMIT parentheses and let balanceParens below
// decide where the URL ends. Excluding `)` outright looks safer but silently
// truncates the single most common research-source shape there is —
// https://en.wikipedia.org/wiki/Foo_(bar) — to `…/Foo_(bar`, producing a
// plausible link that 404s. Branch 2 needs no such care: `<…>` is explicitly
// delimited, so everything up to `>` is the URL.
const URL_IN_MARKDOWN = new RegExp(
  '\\]\\(\\s*(https?://[^\\s]+)'
  + '|<(https?://[^\\s>]+)>'
  + '|(https?://[^\\s<>\\[\\]"\'`]+)',
);

// Cut a candidate at the first `)` that has no matching `(` — that paren is the
// markdown link's closer (or prose's), not part of the URL. Parens that DO
// balance stay, which is what keeps the Wikipedia shape intact.
function balanceParens(url) {
  let depth = 0;
  for (let i = 0; i < url.length; i++) {
    if (url[i] === '(') depth += 1;
    else if (url[i] === ')') {
      if (depth === 0) return url.slice(0, i);
      depth -= 1;
    }
  }
  return url;
}

// Fenced code blocks are illustrative, not the source — a ```curl https://…```
// example must not become the tooltip's "go to the source" link. Same
// line-by-line fence toggle extractToc uses, so both agree on what "inside a
// fence" means.
function stripFences(text) {
  const kept = [];
  let inFence = false;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      inFence = !inFence;
      continue;
    }
    if (!inFence) kept.push(line);
  }
  return kept.join('\n');
}

// Trailing sentence punctuation is prose, not part of the URL ("see https://x.com.").
function trimTrailingPunctuation(url) {
  return url.replace(/[.,;:!?]+$/, '');
}

// Re-parse before trusting: only http/https survive, and a URL the platform
// parser rejects outright is dropped rather than rendered as an href.
function validateHttpUrl(raw) {
  try {
    const u = new URL(raw);
    return u.protocol === 'http:' || u.protocol === 'https:' ? raw : null;
  } catch {
    return null;
  }
}

// The first http(s) URL in a node body, or null when it has none. Used for the
// citation tooltip's direct-to-source link.
export function extractFirstUrl(markdown) {
  const m = URL_IN_MARKDOWN.exec(stripFences(String(markdown || '')));
  if (!m) return null;
  // The angle-autolink branch is already delimited by `>` — trimming it would
  // corrupt a URL that legitimately ends in a paren or a period.
  const raw = m[2] !== undefined
    ? m[2]
    : trimTrailingPunctuation(balanceParens(m[1] ?? m[3]));
  return validateHttpUrl(raw);
}
