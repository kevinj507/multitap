#!/usr/bin/env node
// E13.7 prep (#464) — deterministic build of the blind answer-quality benchmark
// inputs. For each question it renders the A-pack (search-only @ matched token
// budget) and the C-pack (/context tuned defaults) as OPAQUE TEXT, plus a frozen
// gold-answer key. The packs are what blind agents answer from; the gold key is
// for the independent judge ONLY (never shown to the answering agent).
//
// Writes one JSON object to stdout: { meta, questions:[{id,kind,question,packA,packC,gold}] }.
// Run: MULTITAP_BASE_URL=http://127.0.0.1:3000 node eval/context-bench-prep.js > /tmp/e13-bench.json
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { countTokens } from './metrics.js';
import { resolveAgentToken } from './resolve-token.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.MULTITAP_BASE_URL || process.env.GRAPHTASK_BASE_URL || 'http://127.0.0.1:3000';
const TOKEN = resolveAgentToken();
const HJSON = { 'Content-Type': 'application/json', ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) };
const BODY = 1500, SEEDTOPK = 3, HOPS = 2, ALPHA = 0.5;
// Node budget is configurable so the answer-quality benchmark can test both the
// tuned default (30) and a TIGHT regime (~10) that simulates a small pack over a
// large KB — the realistic context-pack use case (#464 tight-budget E2E).
const MAXN = Number(process.env.BENCH_MAXNODES || 30);
// Direct sample for the regression tie-check (keep the blind run bounded).
const DIRECT_SAMPLE = ['dir-q1', 'dir-q9', 'dir-q10', 'dir-q26', 'dir-q35', 'dir-q39'];

const multihop = JSON.parse(fs.readFileSync(path.join(__dirname, 'dataset-context-multihop.json'), 'utf-8'));
const coverageDs = JSON.parse(fs.readFileSync(path.join(__dirname, 'dataset-context-coverage.json'), 'utf-8'));
const GID = multihop.gid_default;

async function post(u, b) { const r = await fetch(`${BASE}${u}`, { method: 'POST', headers: HJSON, body: JSON.stringify(b) }); if (!r.ok) throw new Error(`${u} ${r.status} ${await r.text()}`); return r.json(); }
async function get(u) { const r = await fetch(`${BASE}${u}`, { headers: HJSON }); if (!r.ok) throw new Error(`${u} ${r.status}`); return r.json(); }

// Body cache
const map = await get(`/api/graphs/${GID}/graph`);
const cache = new Map();
for (const n of map.nodes) {
  const t = await get(`/api/graphs/${GID}/tasks/${n.id}`);
  cache.set(Number(n.id), { title: n.title || t.meta?.title || '', body: (t.content || '').replace(/^---[\s\S]*?---\n?/, '') });
}
const clip = (s) => (s.length > BODY ? s.slice(0, BODY) : s);
const tokOf = (id) => countTokens(`${cache.get(id).title}\n${clip(cache.get(id).body)}`);
const render = (ids) => ids.map((id) => `### [node ${id}] ${cache.get(id).title}\n${clip(cache.get(id).body)}`).join('\n\n');

async function packs(query) {
  // C: tuned-default context pack (query-seeded).
  const cRes = await post(`/api/graphs/${GID}/context`, { query, hops: HOPS, maxNodes: MAXN, maxBodyChars: BODY, alpha: ALPHA, seedTopK: SEEDTOPK, edgeTypes: ['related'] });
  const cIds = cRes.nodes.map((n) => Number(n.id));
  const cTok = cIds.reduce((s, id) => s + tokOf(id), 0);
  // A: search-only top hits hydrated to C's token budget (equal-budget).
  const { results } = await post(`/api/graphs/${GID}/search`, { query });
  const ranked = results.map((r) => Number(r.taskId));
  const aIds = []; let t = 0;
  for (const id of ranked) { aIds.push(id); t += tokOf(id); if (t >= cTok) break; }
  return { aIds, cIds, packA: render(aIds), packC: render(cIds) };
}

const out = [];
for (const c of multihop.cases) {
  const p = await packs(c.query);
  out.push({
    id: c.id, kind: 'multihop', question: c.query,
    packA: p.packA, packC: p.packC,
    gold: { canonical: c.rationale, must_mention: c.gold_nodes.map((g) => cache.get(g)?.title).filter(Boolean) },
  });
}
for (const c of coverageDs.cases.filter((x) => DIRECT_SAMPLE.includes(x.id))) {
  const p = await packs(c.query);
  out.push({
    id: c.id, kind: 'direct', question: c.query,
    packA: p.packA, packC: p.packC,
    gold: { canonical: `The direct answer names: ${c.gold_nodes.map((g) => cache.get(g)?.title).filter(Boolean).join('; ')}.`, must_mention: c.gold_nodes.map((g) => cache.get(g)?.title).filter(Boolean) },
  });
}
// Write per-pack files (answer agents read their OWN pack — no gold leakage) +
// a slim manifest (question + gold key, for the judge only). The blind-benchmark
// workflow reads ${PACK_DIR}/<id>-<A|C>.txt and ${PACK_DIR}/manifest.json.
const PACK_DIR = process.env.BENCH_PACK_DIR || '/tmp/e13-packs';
fs.mkdirSync(PACK_DIR, { recursive: true });
for (const q of out) {
  fs.writeFileSync(path.join(PACK_DIR, `${q.id}-A.txt`), q.packA);
  fs.writeFileSync(path.join(PACK_DIR, `${q.id}-C.txt`), q.packC);
}
const manifest = {
  meta: { gid: GID, base: BASE, hops: HOPS, maxNodes: MAXN, alpha: ALPHA, bodyChars: BODY, packDir: PACK_DIR },
  questions: out.map((q) => ({ id: q.id, kind: q.kind, question: q.question, gold: q.gold })),
};
fs.writeFileSync(path.join(PACK_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`wrote ${out.length * 2} pack files + manifest.json to ${PACK_DIR} (maxNodes=${MAXN}, ${out.filter((q) => q.kind === 'multihop').length} multihop + ${out.filter((q) => q.kind === 'direct').length} direct)`);
