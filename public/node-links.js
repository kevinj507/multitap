// Wiki-link tokenizer for the node page. Pure, DOM-free ES module — same
// single-home contract as route-parse.js: node.js imports it in the browser,
// vitest imports it directly.
//
// Graph-authored node bodies reference other nodes with [[3417]] (a task id)
// or [[todo:fanout-claim-lease]] (an external_id). These are the graph's OWN
// linking convention — distinct from the reader's [[cite:123]] citation
// markers (reader-cite.js), which belong to generated reports and are left
// untouched here so the two systems can never shadow each other.
//
// This module only SPLITS text into segments; turning refs into anchors is the
// caller's job (node.js does it against createElement/textContent, so no
// markup is ever assembled from graph content).

// Inner text: anything but brackets or a newline, so a stray "[[" never eats
// the rest of the document looking for its closer.
const WIKI_SOURCE = '\\[\\[([^\\[\\]\\n]+)\\]\\]';

// A ref is linkable as-is when it's all digits (tasks.id is SERIAL — same
// shape route-parse.js pins for /n/<id>). Anything else is an external_id
// that needs resolving against the graph read before it can become a link.
const NUMERIC_RE = /^[0-9]+$/;

// Split `text` into ordered segments:
//   { type: 'text', value }              — literal text, emit as-is
//   { type: 'ref', ref, numeric, raw }   — a wiki-link; `ref` is the trimmed
//     inner value, `raw` the original [[...]] source (kept as the display
//     text so the authoring convention stays visible), `numeric` whether it
//     can link without external_id resolution.
// [[cite:...]] markers and empty [[ ]] stay inside plain text segments.
// Concatenating value/raw over the result always reproduces the input.
export function splitWikiLinks(text) {
  const s = String(text ?? '');
  const re = new RegExp(WIKI_SOURCE, 'g');
  const out = [];
  let last = 0;
  let m;
  while ((m = re.exec(s))) {
    const ref = m[1].trim();
    if (!ref || /^cite:/i.test(ref)) continue; // stays in the text run
    if (m.index > last) out.push({ type: 'text', value: s.slice(last, m.index) });
    out.push({ type: 'ref', ref, numeric: NUMERIC_RE.test(ref), raw: m[0] });
    last = m.index + m[0].length;
  }
  if (last < s.length || out.length === 0) out.push({ type: 'text', value: s.slice(last) });
  return out;
}
