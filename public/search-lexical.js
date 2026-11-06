// Tier-0 lexical search — the model-free floor of the KB search engine
// (graph tasks #171 "retrieval recipe → lexical leg" and #172 "this graph"
// search). Pure, DOM-free, dependency-free ES module so it has ONE home:
//   - the browser loads it via a <script type="module"> shim that hangs the
//     exports on window.LexicalSearch (see public/index.html / app.js);
//   - Node imports it directly from vitest tests and the eval harness
//     (eval/run-eval.js), so the thing we ship is the exact thing we measure.
//
// Ranking contract (README "Find / search bar" + task #172):
//   substring match over title / description / body, TIERED BY FIELD
//   (title hits rank above description hits, which rank above body hits);
//   within a tier order by match frequency desc; newest-first tie-break.
//   A node ranks by its STRONGEST field only — one row per node.
//
// This is also the matcher the backend's BM25 stage later formalizes; keeping
// it pure means the eval harness can A/B it against every richer tier.

/** Field priority — earlier = stronger tier. A node is placed in the tier of
 *  its strongest matching field. */
export const FIELD_ORDER = ['title', 'description', 'body'];

/** Split a raw query into lowercased terms. Whitespace-separated; a doc must
 *  contain EVERY term (AND) in a single field for that field to match, which
 *  makes single-word queries behave like a plain substring find and
 *  multi-word queries behave like "all of these words appear here". */
export function tokenize(query) {
  return String(query || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

/** Count non-overlapping occurrences of `term` in already-lowercased `hay`. */
function countOccurrences(hay, term) {
  if (!term) return 0;
  let count = 0;
  let i = hay.indexOf(term);
  while (i !== -1) {
    count++;
    i = hay.indexOf(term, i + term.length);
  }
  return count;
}

/** Match `terms` against one field's text.
 *  Returns { matched, freq, firstIndex } where freq is the total occurrence
 *  count across all terms and firstIndex is the earliest match offset (for
 *  snippet anchoring). Requires every term to be present (AND semantics). */
export function fieldMatch(text, terms) {
  const hay = String(text || '').toLowerCase();
  if (!hay || terms.length === 0) return { matched: false, freq: 0, firstIndex: -1 };
  let freq = 0;
  let firstIndex = Infinity;
  for (const term of terms) {
    const c = countOccurrences(hay, term);
    if (c === 0) return { matched: false, freq: 0, firstIndex: -1 };
    freq += c;
    const idx = hay.indexOf(term);
    if (idx < firstIndex) firstIndex = idx;
  }
  return { matched: true, freq, firstIndex: firstIndex === Infinity ? -1 : firstIndex };
}

/** Compute [start,end) match ranges for the given terms within `text`
 *  (case-insensitive, against the original-cased string so the UI can render
 *  <mark> over the real text). Ranges are sorted and merged. Pure. */
export function matchRanges(text, terms) {
  const src = String(text || '');
  const hay = src.toLowerCase();
  const ranges = [];
  for (const term of terms) {
    if (!term) continue;
    let i = hay.indexOf(term);
    while (i !== -1) {
      ranges.push([i, i + term.length]);
      i = hay.indexOf(term, i + term.length);
    }
  }
  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  return merged;
}

/** Build a short, centered-on-first-match snippet with highlight ranges
 *  re-based into the snippet's coordinate space. Pure; the UI turns ranges
 *  into <mark> spans. */
export function buildSnippet(text, terms, max = 140) {
  const src = String(text || '').replace(/\s+/g, ' ').trim();
  if (!src) return { text: '', ranges: [] };
  const ranges = matchRanges(src, terms);
  const first = ranges.length ? ranges[0][0] : 0;
  // Window the snippet around the first hit, leaving a little lead-in.
  let start = Math.max(0, first - 24);
  // Snap start to a word boundary so we don't slice mid-word.
  if (start > 0) {
    const sp = src.indexOf(' ', start);
    if (sp !== -1 && sp - start < 16) start = sp + 1;
  }
  let end = Math.min(src.length, start + max);
  let snippet = src.slice(start, end);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < src.length ? '…' : '';
  const offset = prefix.length - start;
  const rebased = ranges
    .map(([s, e]) => [s + offset, e + offset])
    .filter(([s, e]) => e > prefix.length && s < snippet.length + prefix.length)
    .map(([s, e]) => [Math.max(prefix.length, s), Math.min(snippet.length + prefix.length, e)]);
  return { text: prefix + snippet + suffix, ranges: rebased };
}

/** Newest-first comparator: prefer a later createdAt, else a higher id. */
function newerFirst(a, b) {
  const ta = a.createdAt != null ? new Date(a.createdAt).getTime() : NaN;
  const tb = b.createdAt != null ? new Date(b.createdAt).getTime() : NaN;
  if (!Number.isNaN(ta) && !Number.isNaN(tb) && ta !== tb) return tb - ta;
  return Number(b.id) - Number(a.id);
}

/**
 * Rank `docs` against `query` with the tiered lexical contract above.
 * @param {string} query
 * @param {Array<{id:(number|string), title?:string, description?:string, body?:string, createdAt?:(string|number)}>} docs
 * @param {{limit?:number, snippetMax?:number}} [opts]
 * @returns {Array<{id, doc, field, freq, tier, snippet:{text,ranges}}>}
 */
export function lexicalSearch(query, docs, opts = {}) {
  const terms = tokenize(query);
  if (terms.length === 0) return [];
  const limit = opts.limit ?? Infinity;
  const snippetMax = opts.snippetMax ?? 140;

  const hits = [];
  for (const doc of docs || []) {
    let best = null;
    for (let tier = 0; tier < FIELD_ORDER.length; tier++) {
      const field = FIELD_ORDER[tier];
      const m = fieldMatch(doc[field], terms);
      if (m.matched) {
        // First (strongest) matching field wins — title beats description beats body.
        best = { field, tier, freq: m.freq };
        break;
      }
    }
    if (!best) continue;
    const snippetField = best.field === 'title' ? (doc.description || doc.body || doc.title)
      : doc[best.field];
    hits.push({
      id: doc.id,
      doc,
      field: best.field,
      tier: best.tier,
      freq: best.freq,
      snippet: buildSnippet(snippetField, terms, snippetMax),
    });
  }

  hits.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;       // tier: title > desc > body
    if (a.freq !== b.freq) return b.freq - a.freq;        // frequency desc
    return newerFirst(a.doc, b.doc);                      // newest-first tie-break
  });

  return Number.isFinite(limit) ? hits.slice(0, limit) : hits;
}

// ───────────────────────────── BM25 (Tier 0b, #228) ─────────────────────────
// Real BM25 scoring as an ALTERNATIVE ranker behind the same contract:
// IDF + per-field length normalization + OR-with-saturation semantics,
// combined BM25F-style with field weights (title > description > body).
// No stemming, no typo tolerance (separate experiment arms). The tiered
// substring ranker above stays the default for the instant typing preview;
// the pipeline picks a ranker via config (LEXICAL_RANKER env).

const BM25_K1 = 1.2;
const BM25_B = 0.75;
const BM25_FIELD_WEIGHTS = { title: 4, description: 2, body: 1 };

/** Word tokens (alphanumeric runs) — BM25 scores token equality, unlike the
 *  substring matcher above. */
export function wordTokens(text) {
  return String(text || '').toLowerCase().match(/[a-z0-9]+/g) || [];
}

// Per-corpus index cache: tokenizing every doc per keystroke/query would be
// wasteful, and the eval/route reuse one corpus array across many queries.
const bm25IndexCache = new WeakMap();

function buildBm25Index(docs) {
  const fields = FIELD_ORDER;
  const perDoc = []; // [{ tf: {field: Map(term->count)}, len: {field: n} }]
  const df = new Map(); // term -> docs containing it (any field)
  const totalLen = { title: 0, description: 0, body: 0 };
  for (const doc of docs || []) {
    const entry = { doc, tf: {}, len: {} };
    const seen = new Set();
    for (const f of fields) {
      const toks = wordTokens(doc[f]);
      const tf = new Map();
      for (const t of toks) tf.set(t, (tf.get(t) || 0) + 1);
      entry.tf[f] = tf;
      entry.len[f] = toks.length;
      totalLen[f] += toks.length;
      for (const t of tf.keys()) seen.add(t);
    }
    for (const t of seen) df.set(t, (df.get(t) || 0) + 1);
    perDoc.push(entry);
  }
  const n = perDoc.length || 1;
  const avgLen = {};
  for (const f of fields) avgLen[f] = totalLen[f] / n || 1;
  return { perDoc, df, avgLen, n };
}

function getBm25Index(docs) {
  let idx = bm25IndexCache.get(docs);
  if (!idx) {
    idx = buildBm25Index(docs);
    bm25IndexCache.set(docs, idx);
  }
  return idx;
}

/**
 * Rank `docs` against `query` with BM25F-style scoring. Same return shape as
 * lexicalSearch so the retriever/UI can swap rankers: strongest contributing
 * field reported as `field`/`tier`, snippet anchored on the matched terms.
 * OR semantics: any term may be absent; docs matching more/rarer terms score
 * higher via IDF, with k1 saturation replacing the old hard AND.
 */
export function bm25Search(query, docs, opts = {}) {
  const terms = tokenize(query);
  if (terms.length === 0) return [];
  const limit = opts.limit ?? Infinity;
  const snippetMax = opts.snippetMax ?? 140;
  const { perDoc, df, avgLen, n } = getBm25Index(docs || []);

  const hits = [];
  for (const entry of perDoc) {
    let score = 0;
    const fieldScore = { title: 0, description: 0, body: 0 };
    for (const term of terms) {
      const d = df.get(term) || 0;
      if (d === 0) continue;
      const idf = Math.log(1 + (n - d + 0.5) / (d + 0.5));
      for (const f of FIELD_ORDER) {
        const tf = entry.tf[f].get(term) || 0;
        if (tf === 0) continue;
        const norm = 1 - BM25_B + BM25_B * (entry.len[f] / avgLen[f]);
        const s = BM25_FIELD_WEIGHTS[f] * idf * ((tf * (BM25_K1 + 1)) / (tf + BM25_K1 * norm));
        fieldScore[f] += s;
        score += s;
      }
    }
    if (score <= 0) continue;
    let bestField = FIELD_ORDER[0];
    for (const f of FIELD_ORDER) if (fieldScore[f] > fieldScore[bestField]) bestField = f;
    const snippetField = bestField === 'title'
      ? (entry.doc.description || entry.doc.body || entry.doc.title)
      : entry.doc[bestField];
    hits.push({
      id: entry.doc.id,
      doc: entry.doc,
      field: bestField,
      tier: FIELD_ORDER.indexOf(bestField),
      freq: score, // carried in the freq slot so consumers stay agnostic
      score,
      snippet: buildSnippet(snippetField, terms, snippetMax),
    });
  }

  hits.sort((a, b) => (b.score !== a.score ? b.score - a.score : newerFirst(a.doc, b.doc)));
  return Number.isFinite(limit) ? hits.slice(0, limit) : hits;
}

export default { lexicalSearch, bm25Search, fieldMatch, matchRanges, buildSnippet, tokenize, wordTokens, FIELD_ORDER };
