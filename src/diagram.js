// Server-derived report diagrams — pure functions, no db/express, mirroring
// edgePurpose.js's testability rule. Turns the same rows GET /graph serves
// into a finished `.gt-fig` markdown block: themed inline SVG that the report
// reader renders as-is (the sanitizer admits svg; the SVG reads the --chart-*
// tokens so it recolors with the theme).
//
// Why a SERVER derivation: the diagram IS the live edge list. A drafting agent
// pastes the returned markdown verbatim, so there is zero fidelity risk — the
// same property the E16.16 eval already checks on prose is structural here.
//
// Sanitizer contract (the reader's DOMPurify config):
// - No <style>, no <script>, and NO svg <title> — FORBID_TAGS kills `title`
//   by tag name, HTML or SVG. aria-label alone carries accessibility.
// - No <defs>/<marker> arrowheads: marker ids collide when a report holds
//   several diagrams and url(#…) references are sanitizer-fragile. Arrowheads
//   are explicit rotated <polygon>s instead.
// - Emitted tags only: figure, figcaption, div, span, i, svg, rect, line,
//   polygon, text, tspan, a.
// - Output contains NO blank lines — a blank line would split the CommonMark
//   html block and the tail would render as escaped text.

export const KINDS = ['fan', 'chain', 'cluster'];
export const MAX_NODES_CEILING = 16;
export const DEFAULT_MAX = { fan: 12, chain: 8, cluster: 9 };

// Purpose → stroke. Colors come ONLY from the chart ramp (house rule: a
// literal hex is right in one theme and wrong in the other).
const EDGE_STYLE = {
  'required for': { stroke: 'var(--chart-1)', dash: null },
  supports: { stroke: 'var(--chart-3)', dash: null },
  contradicts: { stroke: 'var(--chart-6)', dash: '6 4' },
  'related to': { stroke: 'var(--chart-grid)', dash: '2 4' },
  // E18.4, DEFENSIVE ONLY. `edgeLine` already falls back to 'related to' and no
  // diagram selector admits a supersedes edge, so this entry can never be the
  // difference between a drawn and an undrawn line today. Per design/DESIGN.md
  // the canvas draws off the DERIVED `type`, where supersedes is `related` like
  // supports and contradicts; giving it a distinct visual treatment would be a
  // new design decision and is deliberately not taken here — which is why it is
  // NOT added to any `kind` selector or to the legend order below.
  supersedes: { stroke: 'var(--chart-grid)', dash: '2 4' },
};

const STATUS_FILL = {
  done: 'var(--chart-3)',
  in_progress: 'var(--chart-5)',
  review: 'var(--chart-4)',
};

// Layout constants. The reading measure is 68ch (~620–650px) and .gt-fig
// scales the SVG to width:100%, so effective text size = 12 × container/viewBox
// width — keeping viewBox width ≤ 700 keeps labels ≥ ~10.5px effective. This
// is also why `chain` is laid out vertically.
const PAD = 20;
const BOX_W = 160;
const BOX_H = 46;
const FAN_GAP_X = 90;
const FAN_ROW_H = 64;
const CHAIN_W = 300;
const CHAIN_STEP = 86;
const CL_BOX_W = 260;
const CL_ROW = 66;
const CL_COL_X = [60, 380];

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const f = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

// Greedy word-wrap into ≤ maxLines lines of ≤ maxChars chars; overflow ends in
// an ellipsis. SVG has no auto-wrap, so the budget is chars-per-line at
// font-size 12 (~6.5–7px/glyph).
export function wrapTitle(title, maxChars, maxLines) {
  const words = String(title ?? '').trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  let i = 0;
  while (i < words.length && lines.length < maxLines) {
    let w = words[i];
    if (w.length > maxChars) w = w.slice(0, maxChars - 1) + '…';
    if (!line) {
      line = w;
      i++;
    } else if (line.length + 1 + w.length <= maxChars) {
      line += ' ' + w;
      i++;
    } else {
      lines.push(line);
      line = '';
    }
  }
  if (line) lines.push(line);
  if (i < words.length) {
    let last = lines[lines.length - 1];
    if (last.length >= maxChars - 1) last = last.slice(0, maxChars - 1);
    lines[lines.length - 1] = last + '…';
  }
  return lines.length ? lines : ['—'];
}

const sig = (node) => {
  const v = Number(node?.meta?.significance);
  return Number.isFinite(v) ? v : -1;
};

// One node box: bordered rect, status accent, centered wrapped title —
// optionally an svg <a> permalink (same-tab, like citation click-throughs;
// if a stricter sanitizer ever strips the anchor, the text child survives).
function nodeBox({ x, y, w, node, accent, gid, lineChars }) {
  const lines = wrapTitle(node.title ?? String(node.id), lineChars, 2);
  const cx = x + w / 2;
  const stroke = accent
    ? 'stroke="var(--chart-1)" stroke-width="2"'
    : 'stroke="var(--chart-grid)"';
  const parts = [
    `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${BOX_H}" rx="6" fill="none" ${stroke}/>`,
  ];
  const statusFill = STATUS_FILL[node.status] || 'var(--chart-grid)';
  parts.push(
    `<rect x="${f(x + 1)}" y="${f(y + 1)}" width="3" height="${BOX_H - 2}" fill="${statusFill}"/>`
  );
  const firstBaseline = lines.length === 1 ? y + 27 : y + 20;
  const tspans = lines
    .map((l, idx) => `<tspan x="${f(cx)}" ${idx === 0 ? `y="${f(firstBaseline)}"` : 'dy="14"'}>${esc(l)}</tspan>`)
    .join('');
  const text = `<text text-anchor="middle" font-size="12" fill="var(--chart-label)">${tspans}</text>`;
  parts.push(gid ? `<a href="/g/${esc(gid)}?node=${node.id}">${text}</a>` : text);
  return parts.join('');
}

// Explicit arrowhead at (x2,y2), pointing along the (x1,y1)→(x2,y2) segment.
function arrowHead(x1, y1, x2, y2, color) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const L = 8;
  const W = 4;
  const bx = x2 - L * Math.cos(ang);
  const by = y2 - L * Math.sin(ang);
  const ox = W * Math.sin(ang);
  const oy = -W * Math.cos(ang);
  return `<polygon points="${f(x2)},${f(y2)} ${f(bx + ox)},${f(by + oy)} ${f(bx - ox)},${f(by - oy)}" fill="${color}"/>`;
}

function edgeLine(x1, y1, x2, y2, purpose) {
  const { stroke, dash } = EDGE_STYLE[purpose] || EDGE_STYLE['related to'];
  const dashAttr = dash ? ` stroke-dasharray="${dash}"` : '';
  return (
    `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${stroke}" stroke-width="1.6"${dashAttr}/>` +
    arrowHead(x1, y1, x2, y2, stroke)
  );
}

// Point on the border of an axis-aligned box, from its center toward (tx,ty).
function borderPoint(cx, cy, w, h, tx, ty) {
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return [cx, cy];
  const sx = dx !== 0 ? w / 2 / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? h / 2 / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return [cx + dx * s, cy + dy * s];
}

const noteText = (x, y, label, anchor = 'middle') =>
  `<text x="${f(x)}" y="${f(y)}" text-anchor="${anchor}" font-size="11" fill="var(--chart-label)">${esc(label)}</text>`;

function legend(purposes) {
  const order = ['supports', 'required for', 'contradicts', 'related to'];
  const items = order
    .filter((p) => purposes.has(p))
    .map(
      (p) =>
        `<span><i style="background:${EDGE_STYLE[p].stroke}"></i>${esc(p)}</span>`
    );
  return items.length ? `<div class="gt-legend">${items.join('')}</div>` : '';
}

// Assemble the final markdown block. Joined with single \n; NO blank lines.
function figure({ W, H, body, ariaLabel, caption, purposes }) {
  const lines = [`<figure class="gt-fig">`];
  const leg = legend(purposes);
  if (leg) lines.push(leg);
  lines.push(
    `<svg viewBox="0 0 ${W} ${f(H)}" width="100%" role="img" aria-label="${esc(ariaLabel)}">`,
    body,
    `</svg>`,
    `<figcaption>${esc(caption)}</figcaption>`,
    `</figure>`
  );
  return lines.join('\n');
}

function byId(nodes) {
  return new Map(nodes.map((n) => [n.id, n]));
}

// Deterministic member ordering: purpose bucket, significance desc, id asc.
function memberSort(purposeRank) {
  return (a, b) =>
    (purposeRank[a.purpose] ?? 9) - (purposeRank[b.purpose] ?? 9) ||
    sig(b.node) - sig(a.node) ||
    a.node.id - b.node.id;
}

/* ---------------------------------------------------------------- fan ---- */
// Evidence around a hub: incoming supports/contradicts on the left, outgoing
// on the right, hub centered. Columns vertically centered against each other.
function buildFan({ nodes, links, seed, maxNodes, gid }) {
  const map = byId(nodes);
  const hub = map.get(seed);
  if (!hub) return { error: `node ${seed} not found` };

  const qual = links.filter(
    (l) =>
      (l.purpose === 'supports' || l.purpose === 'contradicts') &&
      (l.source === seed || l.target === seed) &&
      map.has(l.source) &&
      map.has(l.target) &&
      l.source !== l.target
  );
  if (qual.length === 0) return { error: `node ${seed} has no supports/contradicts edges` };

  const rank = { supports: 0, contradicts: 1 };
  const incoming = qual
    .filter((l) => l.target === seed)
    .map((l) => ({ node: map.get(l.source), purpose: l.purpose }))
    .sort(memberSort(rank));
  const outgoing = qual
    .filter((l) => l.source === seed)
    .map((l) => ({ node: map.get(l.target), purpose: l.purpose }))
    .sort(memberSort(rank));

  // Cap: total boxes incl. hub. Split the budget between the columns
  // proportionally, favoring incoming (the evidence FOR/AGAINST the claim).
  const budget = maxNodes - 1;
  let keepIn = Math.min(incoming.length, Math.ceil(budget / 2));
  let keepOut = Math.min(outgoing.length, budget - keepIn);
  keepIn = Math.min(incoming.length, budget - keepOut);
  const shownIn = incoming.slice(0, keepIn);
  const shownOut = outgoing.slice(0, keepOut);
  const omitted = incoming.length - keepIn + (outgoing.length - keepOut);

  const maxRows = Math.max(shownIn.length, shownOut.length, 1);
  const colH = maxRows * FAN_ROW_H - (FAN_ROW_H - BOX_H);
  const noteH = omitted > 0 ? 20 : 0;
  const H = 2 * PAD + colH + noteH;
  const W = 700;
  const hubX = 270;
  const hubY = PAD + (colH - BOX_H) / 2;

  const yStart = (k) => PAD + ((maxRows - k) * FAN_ROW_H) / 2;
  const parts = [];
  const purposes = new Set();

  shownIn.forEach((m, i) => {
    const y = yStart(shownIn.length) + i * FAN_ROW_H;
    parts.push(nodeBox({ x: PAD, y, w: BOX_W, node: m.node, gid, lineChars: 20 }));
    parts.push(edgeLine(PAD + BOX_W, y + BOX_H / 2, hubX, hubY + BOX_H / 2, m.purpose));
    purposes.add(m.purpose);
  });
  parts.push(nodeBox({ x: hubX, y: hubY, w: BOX_W, node: hub, accent: true, gid, lineChars: 20 }));
  shownOut.forEach((m, i) => {
    const y = yStart(shownOut.length) + i * FAN_ROW_H;
    const x = hubX + BOX_W + FAN_GAP_X;
    parts.push(edgeLine(hubX + BOX_W, hubY + BOX_H / 2, x, y + BOX_H / 2, m.purpose));
    parts.push(nodeBox({ x, y, w: BOX_W, node: m.node, gid, lineChars: 20 }));
    purposes.add(m.purpose);
  });
  if (omitted > 0) parts.push(noteText(W / 2, H - 8, `+${omitted} more`));

  const count = (arr, p) => arr.filter((m) => m.purpose === p).length;
  const clauses = [];
  const totInS = count(incoming, 'supports');
  const totInC = count(incoming, 'contradicts');
  const totOutS = count(outgoing, 'supports');
  const totOutC = count(outgoing, 'contradicts');
  if (totInS || totInC) {
    clauses.push(
      `${[totInS && `${totInS} supporting`, totInC && `${totInC} contradicting`].filter(Boolean).join(' and ')} node${totInS + totInC === 1 ? '' : 's'} point at it`
    );
  }
  if (totOutS) clauses.push(`it supports ${totOutS} other${totOutS === 1 ? '' : 's'}`);
  if (totOutC) clauses.push(`it contradicts ${totOutC} other${totOutC === 1 ? '' : 's'}`);
  const title = hub.title ?? String(hub.id);
  const ariaLabel = `Evidence around "${title}": ${clauses.join('; ')}.`;
  const capBits = [totInS && `${totInS} supporting`, totInC && `${totInC} contradicting`].filter(Boolean);
  const caption =
    `Evidence fan around "${title}" (#${hub.id})` +
    (capBits.length ? `: ${capBits.join(', ')}` : '') +
    (omitted ? `, +${omitted} not shown.` : '.');

  return {
    markdown: figure({ W, H, body: parts.join('\n'), ariaLabel, caption, purposes }),
    stats: {
      kind: 'fan',
      seed,
      shown: shownIn.length + shownOut.length + 1,
      omitted,
      edges: qual.length,
      byPurpose: { supports: totInS + totOutS, contradicts: totInC + totOutC },
      clipped: omitted > 0,
    },
  };
}

/* -------------------------------------------------------------- chain ---- */
// Vertical required-for chain: deepest prerequisite at top, arrows pointing
// down along edge direction. Deterministic pick among branches (significance
// desc, id asc); a shared visited set turns a cycle into termination.
function buildChain({ nodes, links, seed, to, maxNodes, gid }) {
  const map = byId(nodes);
  if (!map.has(seed)) return { error: `node ${seed} not found` };
  const deps = links.filter(
    (l) => l.purpose === 'required for' && map.has(l.source) && map.has(l.target) && l.source !== l.target
  );

  let chain;
  let cycle = false;

  if (to != null) {
    if (!map.has(to)) return { error: `node ${to} not found` };
    if (to === seed) return { error: `no required-for path from ${seed} to ${to}` };
    // BFS over directed edges, neighbors ascending → deterministic shortest
    // path with smallest-id tie-break.
    const adj = new Map();
    for (const l of deps) {
      if (!adj.has(l.source)) adj.set(l.source, []);
      adj.get(l.source).push(l.target);
    }
    for (const list of adj.values()) list.sort((a, b) => a - b);
    const prev = new Map([[seed, null]]);
    const queue = [seed];
    while (queue.length && !prev.has(to)) {
      const cur = queue.shift();
      for (const nxt of adj.get(cur) || []) {
        if (!prev.has(nxt)) {
          prev.set(nxt, cur);
          queue.push(nxt);
        }
      }
    }
    if (!prev.has(to)) return { error: `no required-for path from ${seed} to ${to}` };
    chain = [];
    for (let cur = to; cur != null; cur = prev.get(cur)) chain.unshift(cur);
  } else {
    const visited = new Set([seed]);
    const pick = (cands) =>
      cands.sort((a, b) => sig(map.get(b)) - sig(map.get(a)) || a - b)[0];
    const up = [];
    for (let cur = seed; ; ) {
      const preds = deps.filter((l) => l.target === cur && !visited.has(l.source)).map((l) => l.source);
      if (deps.some((l) => l.target === cur && visited.has(l.source))) cycle = true;
      if (!preds.length) break;
      const p = pick(preds);
      visited.add(p);
      up.push(p);
      cur = p;
    }
    const down = [];
    for (let cur = seed; ; ) {
      const succs = deps.filter((l) => l.source === cur && !visited.has(l.target)).map((l) => l.target);
      if (deps.some((l) => l.source === cur && visited.has(l.target))) cycle = true;
      if (!succs.length) break;
      const s = pick(succs);
      visited.add(s);
      down.push(s);
      cur = s;
    }
    if (!up.length && !down.length) {
      return { error: `node ${seed} has no required-for edges` };
    }
    chain = [...up.reverse(), seed, ...down];
  }

  // Window-clip around the seed so the seed always survives.
  const seedIdx = chain.indexOf(seed);
  let start = 0;
  let clipped = false;
  if (chain.length > maxNodes) {
    clipped = true;
    start = Math.max(0, Math.min(seedIdx - Math.floor((maxNodes - 1) / 2), chain.length - maxNodes));
  }
  const windowIds = chain.slice(start, start + Math.min(maxNodes, chain.length));
  const before = start;
  const after = chain.length - (start + windowIds.length);

  const W = 640;
  const topNote = before > 0 ? 20 : 0;
  const bottomNote = after > 0 ? 20 : 0;
  const n = windowIds.length;
  const H = 2 * PAD + (n - 1) * CHAIN_STEP + BOX_H + topNote + bottomNote;
  const parts = [];
  if (before > 0) parts.push(noteText(W / 2, PAD - 6 + topNote, `+${before} earlier ↑`));
  windowIds.forEach((id, i) => {
    const y = PAD + topNote + i * CHAIN_STEP;
    parts.push(
      nodeBox({ x: 170, y, w: CHAIN_W, node: map.get(id), accent: id === seed, gid, lineChars: 40 })
    );
    if (i < n - 1) {
      parts.push(edgeLine(320, y + BOX_H, 320, y + CHAIN_STEP, 'required for'));
    }
  });
  if (after > 0) parts.push(noteText(W / 2, H - 8, `+${after} later ↓`));

  const seedTitle = map.get(seed).title ?? String(seed);
  const first = map.get(windowIds[0]).title ?? '';
  const last = map.get(windowIds[n - 1]).title ?? '';
  const ariaLabel = `Dependency chain of ${chain.length} nodes through "${seedTitle}", from "${first}" down to "${last}".`;
  const caption =
    `Required-for chain through "${seedTitle}" (#${seed}): ${chain.length} node${chain.length === 1 ? '' : 's'}` +
    (clipped ? `, ${n} shown.` : '.') +
    (cycle ? ' A dependency cycle was cut at its revisit point.' : '');

  return {
    markdown: figure({
      W,
      H,
      body: parts.join('\n'),
      ariaLabel,
      caption,
      purposes: new Set(n > 1 ? ['required for'] : []),
    }),
    stats: {
      kind: 'chain',
      seed,
      shown: n,
      omitted: before + after,
      edges: Math.max(n - 1, 0),
      byPurpose: { 'required for': Math.max(chain.length - 1, 0) },
      clipped,
      cycle,
    },
  };
}

/* ------------------------------------------------------------ cluster ---- */
// A decision and its grounds: incoming supports / required-for / contradicts
// edges into the seed, 2-up grid under the decision box, plus any contradicts
// edges BETWEEN displayed grounds (drawn dashed — honest tension display).
function buildCluster({ nodes, links, seed, maxNodes, gid }) {
  const map = byId(nodes);
  const decision = map.get(seed);
  if (!decision) return { error: `node ${seed} not found` };

  const qual = links.filter(
    (l) =>
      l.target === seed &&
      l.source !== seed &&
      map.has(l.source) &&
      (l.purpose === 'supports' || l.purpose === 'required for' || l.purpose === 'contradicts')
  );
  if (qual.length === 0) {
    return { error: `node ${seed} has no incoming supports/required-for/contradicts edges` };
  }

  const rank = { supports: 0, 'required for': 1, contradicts: 2 };
  const members = qual
    .map((l) => ({ node: map.get(l.source), purpose: l.purpose }))
    .sort(memberSort(rank));
  const shown = members.slice(0, maxNodes - 1);
  const omitted = members.length - shown.length;

  const rows = Math.ceil(shown.length / 2);
  const noteH = omitted > 0 ? 20 : 0;
  const W = 700;
  const gridTop = 116;
  const H = gridTop + rows * CL_ROW - (CL_ROW - BOX_H) + PAD + noteH;

  const parts = [
    nodeBox({ x: 200, y: PAD, w: CHAIN_W, node: decision, accent: true, gid, lineChars: 40 }),
  ];
  const purposes = new Set();
  const posById = new Map();
  shown.forEach((m, i) => {
    const x = CL_COL_X[i % 2];
    const y = gridTop + Math.floor(i / 2) * CL_ROW;
    posById.set(m.node.id, { x, y });
    // Ground → decision, anchored along the decision's bottom edge so lines
    // spread instead of piling onto one point.
    const ax = 200 + (CHAIN_W * (i + 1)) / (shown.length + 1);
    parts.push(edgeLine(x + CL_BOX_W / 2, y, ax, PAD + BOX_H, m.purpose));
    parts.push(nodeBox({ x, y, w: CL_BOX_W, node: m.node, gid, lineChars: 34 }));
    purposes.add(m.purpose);
  });
  // Tensions between displayed grounds.
  const shownIds = new Set(shown.map((m) => m.node.id));
  for (const l of links) {
    if (l.purpose !== 'contradicts') continue;
    if (!shownIds.has(l.source) || !shownIds.has(l.target) || l.source === l.target) continue;
    const a = posById.get(l.source);
    const b = posById.get(l.target);
    const [x1, y1] = borderPoint(a.x + CL_BOX_W / 2, a.y + BOX_H / 2, CL_BOX_W, BOX_H, b.x + CL_BOX_W / 2, b.y + BOX_H / 2);
    const [x2, y2] = borderPoint(b.x + CL_BOX_W / 2, b.y + BOX_H / 2, CL_BOX_W, BOX_H, a.x + CL_BOX_W / 2, a.y + BOX_H / 2);
    parts.push(edgeLine(x1, y1, x2, y2, 'contradicts'));
    purposes.add('contradicts');
  }
  if (omitted > 0) parts.push(noteText(W / 2, H - 8, `+${omitted} more grounds`));

  const count = (p) => members.filter((m) => m.purpose === p).length;
  const nS = count('supports');
  const nR = count('required for');
  const nC = count('contradicts');
  const title = decision.title ?? String(decision.id);
  const bits = [
    nS && `${nS} support${nS === 1 ? 's' : ''}`,
    nR && `${nR} prerequisite${nR === 1 ? '' : 's'}`,
    nC && `${nC} contradiction${nC === 1 ? '' : 's'}`,
  ].filter(Boolean);
  const ariaLabel = `Grounds for decision "${title}": ${bits.join(', ')}.`;
  const caption =
    `Grounds for "${title}" (#${decision.id}): ${bits.join(', ')}` +
    (omitted ? `, +${omitted} not shown.` : '.');

  return {
    markdown: figure({ W, H, body: parts.join('\n'), ariaLabel, caption, purposes }),
    stats: {
      kind: 'cluster',
      seed,
      shown: shown.length + 1,
      omitted,
      edges: qual.length,
      byPurpose: { supports: nS, 'required for': nR, contradicts: nC },
      clipped: omitted > 0,
      seedType: decision.meta?.type ?? null,
    },
  };
}

/* -------------------------------------------------------------- entry ---- */
// nodes/links in the GET /graph row shape ({id,title,status,meta}, {source,
// target,purpose}). Returns { markdown, stats } or { error } — the route maps
// error → 404 ("no such diagram exists here").
export function buildDiagram({ kind, nodes, links, seed, to = null, maxNodes = null, gid = null }) {
  if (!KINDS.includes(kind)) return { error: `kind must be one of ${KINDS.join('|')}` };
  const max = Math.max(3, Math.min(MAX_NODES_CEILING, maxNodes ?? DEFAULT_MAX[kind]));
  const args = { nodes, links, seed, to, maxNodes: max, gid };
  if (kind === 'fan') return buildFan(args);
  if (kind === 'chain') return buildChain(args);
  return buildCluster(args);
}
