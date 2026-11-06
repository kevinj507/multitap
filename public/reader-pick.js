// Reader URL-param helpers. Pure, DOM-free ES module — same single-home
// contract as reader-toc.js: the browser loads it via a <script type="module">
// shim onto window.ReaderPick (see index.html) and vitest imports it directly.
//
// The reader is an alternate VIEW of the active graph, never a cross-graph
// reader app (owner decision 2026-07-25): it always renders the active graph's
// own report, and a graph with no readable report bounces back to the canvas.
// What lives here is the shareable-view plumbing for that model.

// --- ?view=reader share param -----------------------------------------------
// A shared link should carry the sender's view: reader mode itself is a
// per-browser localStorage flag, so without a URL signal a receiver always
// lands on the canvas. The param is per-load INTENT, not a preference — the
// receiver's sticky flag is never written by honoring it.

export function readerRequestedInSearch(search) {
  try { return new URLSearchParams(search || '').get('view') === 'reader'; } catch { return false; }
}

// Return `search` with view=reader set (on) or removed (off), preserving every
// other param. Returns '' (not '?') when nothing remains, so callers can
// always write pathname + result.
export function withReaderParam(search, on) {
  const p = new URLSearchParams(search || '');
  if (on) p.set('view', 'reader'); else p.delete('view');
  const s = p.toString();
  return s ? `?${s}` : '';
}
