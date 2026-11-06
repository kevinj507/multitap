// Single-node reading page (/g/<gid>?node=<id>) — see public/node.html.
//
// One naming system for nodes (owner decision 2026-08-07): the bare query
// shape IS the node link and always renders THIS page, whatever view the
// sender was in. &view=graph is the same node opened in the SPA canvas,
// selected — that's what the "Open graph" action mints. Why a separate page
// at all: booting the whole SPA (cytoscape, the 534KB editor bundle, the
// graphs list, SSE, presence) paints three visible stages before showing the
// one node you asked for; this page answers off ONE read, with no canvas.
//
// Reads only. Nothing here writes to the graph, joins presence, or opens SSE.
import { resolveNodeRoute, nodeHref, nodeGraphHref } from '/route-parse.js';
import { withReaderParam } from '/reader-pick.js';
import { splitWikiLinks } from '/node-links.js';
import { extractCiteIds } from '/reader-cite.js';

const FENCE = '---';

// Node bodies are stored as frontmatter + markdown. The parsed fields come back
// from the API as `meta`, so this only has to drop the fence — the fuller
// sibling that also parses the YAML is parseFrontmatter() in app.js.
function stripFrontmatter(text) {
  if (!text || !text.startsWith(FENCE + '\n')) return text || '';
  const end = text.indexOf('\n' + FENCE, FENCE.length);
  if (end === -1) return text;
  return text.slice(end + FENCE.length + 2);
}

const STATUS_LABELS = {
  todo: 'To do', in_progress: 'In progress', review: 'Review', done: 'Done',
};

// Edge purpose → how it reads from THIS node's side. The stored purpose is
// directed source→target (src/edgePurpose.js), so an incoming edge has to be
// phrased in the passive/inverse or the page would claim the opposite of what
// the graph says. 'related to' is symmetric enough to read the same both ways.
const OUTGOING_LABEL = {
  'required for': 'Required for',
  supports: 'Supports',
  contradicts: 'Contradicts',
  'related to': 'Related to',
  // E18.4. An unmapped purpose produces an `undefined` group heading on this
  // page, so the five-value vocabulary must be complete here.
  supersedes: 'Supersedes',
};
const INCOMING_LABEL = {
  'required for': 'Requires',
  supports: 'Supported by',
  contradicts: 'Contradicted by',
  'related to': 'Related to',
  supersedes: 'Superseded by',
};
// Evidence first, then dependency, then the catch-all — the order a reader
// arriving from a citation cares about.
const GROUP_ORDER = [
  'Supports', 'Supported by', 'Contradicts', 'Contradicted by',
  'Supersedes', 'Superseded by',
  'Required for', 'Requires', 'Related to',
];

const $ = (id) => document.getElementById(id);

function showStatus(message) {
  const el = $('node-status');
  el.querySelector('p').textContent = message;
  el.classList.remove('hidden');
}

// Every string from the API lands via textContent or the Viewer's sanitizer —
// this page never assembles markup from graph content.
function setText(id, value) {
  const el = $(id);
  el.textContent = value || '';
  return el;
}

function formatUtc(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

// Field explainers, shown as a small tooltip on hover/focus. The copy is the
// reserved-field vocabulary from the skill's schema table — graph jargon a
// reader arriving from a shared link has never met, so the page teaches what
// it renders. Keep these in step with SKILL.md if the vocabulary shifts.
const META_TIPS = {
  status: 'Where this node sits in the workflow: to do → in progress → review → done. Review means finished and awaiting human confirmation.',
  confidence: 'How sure we are this claim holds, from 0 to 1 (on a source: its reliability). Only claims and sources carry confidence — open questions never do.',
  significance: 'How much this node matters to the graph, from 0 to 1. Weighs into what surfaces first for attention and re-checking.',
  verified: 'When this claim was last deliberately re-checked against its sources. Distinct from Updated, which any edit bumps.',
  decided: 'When this decision was committed.',
  updated: 'When this node last changed, for any reason.',
};

// One meta field as a row: a glyph (Phosphor icon — or the status dot, which
// is the one field whose colour IS its meaning) + "Label: value". The glyph
// slot is fixed-width so the dot and the icons align down the list.
function metaRow({ status, icon, label, value, tip }) {
  const row = document.createElement('div');
  row.className = 'node-meta-row';
  if (tip) {
    row.dataset.tip = tip;
    row.tabIndex = 0; // keyboard users get the explainer on focus
  }
  const glyph = document.createElement('span');
  glyph.className = 'node-meta-glyph';
  if (status) {
    const dot = document.createElement('span');
    dot.className = 'node-status-dot';
    dot.dataset.status = status;
    glyph.appendChild(dot);
  } else if (icon) {
    const i = document.createElement('i');
    i.className = `ph ph-${icon}`;
    i.setAttribute('aria-hidden', 'true');
    glyph.appendChild(i);
  }
  row.appendChild(glyph);
  const text = document.createElement('span');
  // "Confidence: 0.8" — a bare 0.8 reads as a version number; the label says
  // which vocabulary the number belongs to. Status skips the label: its value
  // ("Review") already names the field.
  text.textContent = label ? `${label}: ${value}` : String(value);
  row.appendChild(text);
  return row;
}

function renderMeta(meta, task) {
  const el = $('node-meta');
  el.textContent = '';
  // Two semantic columns, not row-flow: the left column is what the node IS
  // (status + the 0–1 scores), the right column is WHEN things happened (the
  // datetime fields, all in one place and one format).
  const state = document.createElement('div');
  state.className = 'node-meta-col';
  const dates = document.createElement('div');
  dates.className = 'node-meta-col';

  if (meta.status) {
    state.appendChild(metaRow({
      status: meta.status,
      value: STATUS_LABELS[meta.status] || meta.status,
      tip: META_TIPS.status,
    }));
  }
  if (meta.confidence != null && meta.confidence !== '') {
    state.appendChild(metaRow({ icon: 'gauge', label: 'Confidence', value: meta.confidence, tip: META_TIPS.confidence }));
  }
  if (meta.significance != null && meta.significance !== '') {
    state.appendChild(metaRow({ icon: 'star', label: 'Significance', value: meta.significance, tip: META_TIPS.significance }));
  }
  const verified = formatUtc(meta.verified_at);
  if (verified) dates.appendChild(metaRow({ icon: 'seal-check', label: 'Verified', value: verified, tip: META_TIPS.verified }));
  const decided = formatUtc(meta.decided_at);
  if (decided) dates.appendChild(metaRow({ icon: 'scales', label: 'Decided', value: decided, tip: META_TIPS.decided }));
  const updated = formatUtc(task.updated_at);
  if (updated) dates.appendChild(metaRow({ icon: 'clock', label: 'Updated', value: updated, tip: META_TIPS.updated }));

  if (state.childNodes.length) el.appendChild(state);
  if (dates.childNodes.length) el.appendChild(dates);
}

// Wiki-links in the rendered body ([[3417]], [[todo:fanout-claim-lease]] —
// the graph's authoring convention) become links to those nodes' permalinks.
// Runs AFTER the Viewer has sanitized and rendered: we walk the emitted text
// nodes and swap matches for elements built with createElement/textContent,
// so this stays inside the page's no-markup-from-content contract. Code and
// pre are skipped — a [[ref]] inside a fence is illustration, not a link
// (same stance reader-cite.js takes on fenced URLs).
//
// Numeric refs link immediately (the permalink is derivable from the id
// alone). External-id refs can't resolve without the /graph read, so they're
// wrapped in a marker span and upgraded by hydrateWikiRefs once it lands —
// the body must not wait on the heavier read (see the fetch comment below).
function linkifyWikiRefs(root, gid) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const candidates = [];
  while (walker.nextNode()) {
    const n = walker.currentNode;
    if (!n.nodeValue || !n.nodeValue.includes('[[')) continue;
    if (n.parentElement && n.parentElement.closest('code, pre, a')) continue;
    candidates.push(n);
  }
  for (const n of candidates) {
    const parts = splitWikiLinks(n.nodeValue);
    if (!parts.some((p) => p.type === 'ref')) continue;
    const frag = document.createDocumentFragment();
    for (const p of parts) {
      if (p.type === 'text') {
        frag.appendChild(document.createTextNode(p.value));
      } else if (p.numeric) {
        const a = document.createElement('a');
        a.className = 'node-wiki-link';
        a.href = nodeHref(gid, p.ref);
        a.dataset.wikiId = p.ref; // hydrateWikiRefs adds the title tooltip
        a.textContent = p.raw;
        frag.appendChild(a);
      } else {
        const span = document.createElement('span');
        span.dataset.wikiExt = p.ref;
        span.textContent = p.raw;
        frag.appendChild(span);
      }
    }
    n.parentNode.replaceChild(frag, n);
  }
}

// Second pass, once /graph is in: external-id refs that resolve become links,
// and every wiki-link gains the target's title as its tooltip. Refs that don't
// resolve (deleted node, typo, a name that only exists in another graph) stay
// plain text — a link that 404s on click would be worse than no link.
function hydrateWikiRefs(root, graph, gid) {
  const titles = new Map();
  const byExt = new Map();
  for (const n of graph.nodes || []) {
    titles.set(String(n.id), n.title);
    if (n.external_id) byExt.set(n.external_id, String(n.id));
  }
  for (const a of root.querySelectorAll('a[data-wiki-id]')) {
    const t = titles.get(a.dataset.wikiId);
    if (t) a.title = t;
  }
  for (const span of root.querySelectorAll('span[data-wiki-ext]')) {
    const id = byExt.get(span.dataset.wikiExt);
    if (!id) continue;
    const a = document.createElement('a');
    a.className = 'node-wiki-link';
    a.href = nodeHref(gid, id);
    a.textContent = span.textContent;
    const t = titles.get(id);
    if (t) a.title = t;
    span.parentNode.replaceChild(a, span);
  }
}

// The node's edges as text rows. `graph` is one /graph read: nodes carry the
// titles, links carry the edges, so no per-neighbour fetch is needed.
function renderConnections(graph, id, gid) {
  const section = $('node-connections');
  const titles = new Map((graph.nodes || []).map((n) => [String(n.id), n.title]));
  const groups = new Map();
  for (const link of graph.links || []) {
    const source = String(link.source);
    const target = String(link.target);
    const isOut = source === id;
    const isIn = target === id;
    // A self-edge can't exist (schema CHECK source_id != target_id), so these
    // are genuinely exclusive.
    if (!isOut && !isIn) continue;
    const otherId = isOut ? target : source;
    // Legacy edges predating the locked `purpose` vocabulary fall back to the
    // catch-all rather than being dropped from the page.
    const label = (isOut ? OUTGOING_LABEL : INCOMING_LABEL)[link.purpose] || 'Related to';
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push({ id: otherId, title: titles.get(otherId) || `Node #${otherId}` });
  }
  if (groups.size === 0) return;

  const h = document.createElement('h2');
  h.textContent = 'Connections';
  section.appendChild(h);
  const ordered = [...groups.keys()].sort(
    (a, b) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b),
  );
  for (const label of ordered) {
    const group = document.createElement('div');
    group.className = 'node-conn-group';
    const eyebrow = document.createElement('div');
    eyebrow.className = 'node-conn-label';
    eyebrow.textContent = label;
    group.appendChild(eyebrow);
    const ul = document.createElement('ul');
    for (const entry of groups.get(label)) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = nodeHref(gid, entry.id);
      a.appendChild(document.createTextNode(entry.title)); // textContent — XSS-safe
      li.appendChild(a);
      ul.appendChild(li);
    }
    group.appendChild(ul);
    section.appendChild(group);
  }
  section.classList.remove('hidden');
}

// "Open report" appears only when this graph's report exists AND cites this
// node — membership is derived from the report body's [[cite:...]] markers
// (reader-cite.js, the same parser the reader numbers footnotes with), not
// from navigation history. A reader-originated click and a cold-pasted link
// therefore get the identical page: if the node is part of the report, the
// way back to it is always offered.
async function offerReportLink(gid, id) {
  let report = null;
  try {
    const r = await fetch(`/api/graphs/${encodeURIComponent(gid)}/report`);
    if (r.ok) report = await r.json();
  } catch { /* no report link on network failure — the page still works */ }
  if (!report || !extractCiteIds(report.body).includes(String(id))) return;
  const a = $('node-open-report');
  // Built through reader-pick, the single home for `view=reader` — a second
  // hand-written copy of that literal drifts the moment the param changes.
  a.href = `/g/${encodeURIComponent(gid)}${withReaderParam('', true)}`;
  a.classList.remove('hidden');
}

async function main() {
  const route = resolveNodeRoute(location.pathname, location.search);
  if (!route) {
    showStatus('That isn’t a node link.');
    return;
  }
  const { gid, id } = route;
  // A tab still on the retired /n/ path shape canonicalizes to the query
  // shape without a reload (the server 301s cold hits; this covers bfcache).
  if (location.pathname !== `/g/${gid}`) {
    history.replaceState(history.state, '', route.canonical);
  }

  $('node-open-graph').href = nodeGraphHref(gid, id);
  offerReportLink(gid, id);

  // All reads go out together: the body paints as soon as the task lands and
  // the connections fill in behind it, so the heavier /graph read never gates
  // the thing the reader actually clicked for.
  const taskReq = fetch(`/api/graphs/${encodeURIComponent(gid)}/tasks/${encodeURIComponent(id)}`);
  const graphReq = fetch(`/api/graphs/${encodeURIComponent(gid)}/graph`)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);

  let res;
  try {
    res = await taskReq;
  } catch {
    showStatus('Could not load this node — check your connection.');
    return;
  }
  // 403 = the graph is readable but this viewer isn't allowed; 404 = no such
  // node, OR the read gate refusing a graph they can't see at all. Same split
  // the reader draws for reports.
  if (res.status === 403) { showStatus('You don’t have access to this node.'); return; }
  if (res.status === 404) { showStatus('That node no longer exists.'); return; }
  if (!res.ok) { showStatus('Could not load this node.'); return; }

  const task = await res.json();
  const meta = task.meta || {};
  const title = meta.title || `Node #${id}`;

  document.title = `${title} — Multitap`;
  if (meta.type) {
    setText('node-eyebrow', meta.type).classList.remove('hidden');
  }
  setText('node-title', title);
  setText('node-desc', meta.description);
  renderMeta(meta, task);
  $('node-header').classList.remove('hidden');

  const body = stripFrontmatter(task.content || '');
  if (body.trim()) {
    // `toastui.Editor` IS the Viewer class in the viewer-only bundle (the full
    // bundle's Editor.factory({viewer:true}) doesn't exist here). Same bundled
    // sanitizer either way.
    new toastui.Editor({
      el: $('node-body'),
      initialValue: body,
      usageStatistics: false,
    });
    linkifyWikiRefs($('node-body'), gid);
  } else {
    const empty = document.createElement('p');
    empty.className = 'node-body-empty';
    empty.textContent = 'This node has no body yet.';
    $('node-body').appendChild(empty);
  }

  const graph = await graphReq;
  if (graph) {
    hydrateWikiRefs($('node-body'), graph, gid);
    renderConnections(graph, id, gid);
  }
}

main();
