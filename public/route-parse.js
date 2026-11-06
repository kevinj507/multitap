// Client route resolution. Pure, DOM-free ES module — same single-home
// contract as reader-toc.js / reader-pick.js: the browser loads it via a
// <script type="module"> shim onto window.RouteParse (see index.html) and
// vitest imports it directly.
//
// Canonical graph URL: /g/<id>. Human-guessable aliases (/graph/<id>,
// /graphs/<id>) resolve to the same graph with `canonical` set so the caller
// can replaceState the bar to the real shape. Everything else is 'root' or
// 'unknown' — and the caller must NOT quietly treat 'unknown' as root-with-
// fallback while leaving the bogus path in the bar: that's the silent
// misdirection where /graph/<id> (pre-alias) showed the last-active graph
// under an unrelated URL.
const GRAPH_ROUTE_RE = /^\/(g|graph|graphs)\/([a-z0-9]+)\/?$/;

export function resolveRoute(pathname) {
  if (pathname === '/' || pathname === '') return { kind: 'root' };
  const m = GRAPH_ROUTE_RE.exec(pathname || '');
  if (m) return { kind: 'graph', gid: m[2], canonical: `/g/${m[2]}` };
  return { kind: 'unknown' };
}

// Single-node permalink: /g/<gid>?node=<id> — ONE naming system for nodes
// (owner decision 2026-08-07; the /g/<gid>/n/<id> path shape is retired and
// 301-redirects here). The bare shape always renders the standalone reading
// page (public/node.html) — a shared node link opens as readable markdown for
// everyone, regardless of which view the sender was in. Appending &view=graph
// is the same node IN the SPA canvas, selected — that's what the reading
// page's "Open graph" mints, and what the canvas keeps in the bar while a
// node is selected so refresh stays on the canvas.
//
// Deliberately a SEPARATE function rather than another `resolveRoute` branch:
// resolveRoute drives the SPA's boot, which never runs on the reading page,
// and teaching it a fourth `kind` would put a new case in front of
// bootSidebar for no gain. Ids are numeric (tasks.id is SERIAL) and gids are
// [a-z0-9] — same shape GRAPH_ROUTE_RE pins.
const LEGACY_NODE_ROUTE_RE = /^\/g\/([a-z0-9]+)\/n\/([0-9]+)\/?$/;
const NODE_GID_RE = /^\/g\/([a-z0-9]+)\/?$/;

export function resolveNodeRoute(pathname, search) {
  // Legacy path shape — still resolved client-side so a stale tab or cached
  // page that missed the server redirect canonicalizes instead of erroring.
  const legacy = LEGACY_NODE_ROUTE_RE.exec(pathname || '');
  if (legacy) return { gid: legacy[1], id: legacy[2], canonical: `/g/${legacy[1]}?node=${legacy[2]}` };
  const g = NODE_GID_RE.exec(pathname || '');
  if (!g) return null;
  let id = null;
  try { id = new URLSearchParams(search || '').get('node'); } catch { return null; }
  if (!id || !/^[0-9]+$/.test(id)) return null;
  return { gid: g[1], id, canonical: `/g/${g[1]}?node=${id}` };
}

// The shareable permalink for a node — always the reading page.
export function nodeHref(gid, id) {
  return `/g/${encodeURIComponent(gid)}?node=${encodeURIComponent(id)}`;
}

// The same node opened in the SPA canvas, selected. `view=graph` is what
// tells the server to serve the SPA instead of the reading page.
export function nodeGraphHref(gid, id) {
  return `${nodeHref(gid, id)}&view=graph`;
}
