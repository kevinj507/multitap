// KB search — client-side glue for the SERVER pipeline (graph task #172).
// Pure, DOM-free ES module, same single-home contract as search-lexical.js:
// the browser loads it via a module shim (window.KbSearch), vitest imports it
// directly. It owns the two pieces of #172 logic that are testable without a
// browser:
//
//   1. mapServerResults — translate the POST /search candidate list (taskId/
//      source/snippet/meta, see src/search/types.js) into the row shape the
//      Cmd+F dropdown paints (id/doc/field/snippet/matchType), resolving the
//      reranked source back to where the match CAME from so the row's tag and
//      the commit-time highlight behave by ORIGINAL match type.
//
//   2. locateApprox — find a snippet/chunk's offsets inside the rendered
//      document text. Dense chunks are RAW MARKDOWN but the panel shows
//      RENDERED text (no #/*/- syntax), so exact indexOf fails; this matches
//      on a normalized token sequence and maps back to haystack offsets. Used
//      by the commit-time "highlight the chunk and scroll it into view" step.

/** The source a candidate was originally retrieved by, looking through the
 *  reranker's rewrite (source:'rerank' + meta.rerankedFrom). */
export function resolveSource(candidate) {
  if (!candidate) return 'lexical';
  if (candidate.source === 'rerank') return (candidate.meta && candidate.meta.rerankedFrom) || 'lexical';
  return candidate.source || 'lexical';
}

/** Dropdown tag for a candidate: lexical hits keep their field name
 *  (title/description/body), dense hits read "semantic", graph-expanded rows
 *  read "related" — the user-facing names for HOW each node was found. */
export function tagFor(candidate) {
  const src = resolveSource(candidate);
  if (src === 'dense') return 'semantic';
  if (src === 'graph') return 'related';
  return (candidate.meta && candidate.meta.field) || 'lexical';
}

/** How the commit step should highlight this hit in the open panel:
 *  'title' flashes the title field, 'word' highlights the matched query term
 *  in the body, 'chunk' highlights the matched chunk and scrolls to it,
 *  'none' just opens the node (description lives in frontmatter and
 *  graph-expanded rows have no matched span to show). */
export function matchTypeFor(candidate) {
  const src = resolveSource(candidate);
  if (src === 'dense') return 'chunk';
  if (src === 'graph') return 'none';
  const field = (candidate.meta && candidate.meta.field) || '';
  if (field === 'title') return 'title';
  if (field === 'body') return 'word';
  return 'none';
}

/**
 * Server candidates → dropdown rows. `docs` is the client's per-graph doc
 * cache ({id,title,...}); dense/graph candidates don't carry a title, so the
 * row borrows it from there — or, for cross-graph results, from the
 * candidate's own `title` (the /api/search route attaches it, since the
 * client can't cache docs for other graphs). Candidates with NO title source
 * (e.g. a node deleted since the cache loaded) are dropped rather than
 * painted as "Untitled" ghosts.
 *
 * `opts.graphs` (id → name, from /api/search) attributes each row to its
 * graph: rows carry `gid` and `graphName` so the dropdown can chip foreign
 * hits and the commit step knows where to navigate.
 *
 * @param {Array<Object>} results POST /search `results`
 * @param {Array<{id:*,title:string}>} docs
 * @param {{graphs?:Object}} [opts]
 * @returns {Array<{id:*, doc:Object, field:string, snippet:?Object, matchType:string, gid:?string, graphName:?string}>}
 */
export function mapServerResults(results, docs, opts = {}) {
  const byId = new Map((docs || []).map((d) => [String(d.id), d]));
  const graphs = opts.graphs || null;
  const rows = [];
  for (const c of results || []) {
    const doc = byId.get(String(c.taskId)) || (c.title != null ? { id: c.taskId, title: c.title } : null);
    if (!doc) continue;
    rows.push({
      id: c.taskId,
      doc,
      field: tagFor(c),
      snippet: c.snippet && c.snippet.text ? c.snippet : null,
      matchType: matchTypeFor(c),
      gid: c.graphId ?? null,
      graphName: graphs && c.graphId != null ? graphs[c.graphId] ?? null : null,
    });
  }
  return rows;
}

// --- Approximate text location (rendered text vs raw markdown) -------------

/** Tokenize `text` into lowercased alphanumeric runs, each with its original
 *  [start,end) offsets, so a token-level match can be mapped back to exact
 *  character offsets in the source string. */
export function tokensWithOffsets(text) {
  const out = [];
  const re = /[a-z0-9]+/gi;
  let m;
  while ((m = re.exec(String(text || ''))) !== null) {
    out.push({ t: m[0].toLowerCase(), start: m.index, end: m.index + m[0].length });
  }
  return out;
}

/**
 * Find `needle` inside `haystack` tolerating formatting differences: both are
 * reduced to token sequences and the FIRST `anchor` tokens of the needle are
 * searched as a consecutive run. When the full anchor can't be found (the
 * chunk may start mid-syntax or the renderer dropped a word) the anchor
 * shrinks down to `minAnchor` before giving up.
 *
 * Returns { start, end } — haystack character offsets spanning from the first
 * anchor token to the LAST needle token that continues the consecutive run
 * (so a fully-present chunk highlights wholly, a partial one highlights what
 * is actually there) — or null when no anchor long enough matches.
 */
export function locateApprox(haystack, needle, { anchor = 8, minAnchor = 3 } = {}) {
  const hay = tokensWithOffsets(haystack);
  const ndl = tokensWithOffsets(needle).map((x) => x.t);
  if (!hay.length || !ndl.length) return null;

  for (let len = Math.min(anchor, ndl.length); len >= Math.min(minAnchor, ndl.length); len--) {
    for (let i = 0; i + len <= hay.length; i++) {
      let ok = true;
      for (let j = 0; j < len; j++) {
        if (hay[i + j].t !== ndl[j]) { ok = false; break; }
      }
      if (!ok) continue;
      // Extend past the anchor while the needle keeps matching consecutively.
      let k = len;
      while (k < ndl.length && i + k < hay.length && hay[i + k].t === ndl[k]) k++;
      return { start: hay[i].start, end: hay[i + k - 1].end };
    }
  }
  return null;
}

/**
 * True when a reranked result list has NO strong hit — the cue for the
 * dropdown's "no strong matches" notice. Measured on the stock-graph eval
 * (#198 follow-up): real queries' TOP rerank score ≈ 0.9 median, nonsense
 * queries top out at 0.024 — but ~10% of RELEVANT docs also score ≈0, so a
 * hard floor would cost recall. Hence: hint on the max, never filter the
 * list. Returns false when rerank didn't run (no scores to judge by).
 */
export function isWeakResultSet(results, { threshold = 0.1 } = {}) {
  let sawScore = false;
  let max = -Infinity;
  for (const c of results || []) {
    const s = c && c.meta && c.meta.rerankScore;
    if (typeof s !== 'number') continue;
    sawScore = true;
    if (s > max) max = s;
  }
  return sawScore && max < threshold;
}

export default { resolveSource, tagFor, matchTypeFor, mapServerResults, tokensWithOffsets, locateApprox, isWeakResultSet };
