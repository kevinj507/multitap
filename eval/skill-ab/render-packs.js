#!/usr/bin/env node
// E13.10 (#470) — render the answer-quality packs for ONE built/enriched graph,
// mirroring context-bench-prep.js but parameterized by --gid + a --questions file.
// For each question it hits the LIVE /context endpoint (tuned defaults, tight
// maxNodes=10 — the regime where the #464 mid-tier win appears) and writes the pack
// as OPAQUE TEXT the blind answerer reads. The gold key goes ONLY into manifest.json
// (for the judge); it is never written into a pack file. Deterministic, no agents.
// Run: node eval/skill-ab/render-packs.js --gid <g> --questions frozen/questions.json --out /tmp/packs-x [--maxNodes 10]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { get, post, stripFm, arg } from './lib.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GID = arg('gid', null);
const QFILE = arg('questions', path.join(__dirname, 'frozen/questions.json'));
const OUT = arg('out', null);
const MAXN = Number(arg('maxNodes', '10'));
const HOPS = Number(arg('hops', '2')), ALPHA = Number(arg('alpha', '0.5')), BODY = Number(arg('body', '1500'));
const SEEDTOPK = 3;
if (!GID || !OUT) { console.error('need --gid and --out'); process.exit(1); }

const questions = JSON.parse(fs.readFileSync(QFILE, 'utf-8')).questions;

// body cache for this graph (title + clipped body), to render the pack text
const map = await get(`/api/graphs/${GID}/graph`);
const cache = new Map();
for (const n of map.nodes) {
  const t = await get(`/api/graphs/${GID}/tasks/${n.id}`);
  cache.set(Number(n.id), { title: t.meta?.title || n.title || '', body: stripFm(t.content) });
}
const clip = (s) => (s.length > BODY ? s.slice(0, BODY) : s);
const render = (ids) => ids.map((id) => `### [node ${id}] ${cache.get(id)?.title || ''}\n${clip(cache.get(id)?.body || '')}`).join('\n\n');

fs.mkdirSync(OUT, { recursive: true });
const manifestQs = [];
for (const q of questions) {
  const res = await post(`/api/graphs/${GID}/context`, { query: q.query, hops: HOPS, maxNodes: MAXN, maxBodyChars: BODY, alpha: ALPHA, seedTopK: SEEDTOPK, edgeTypes: ['related'] });
  const ids = res.nodes.map((n) => Number(n.id));
  fs.writeFileSync(path.join(OUT, `${q.id}.txt`), render(ids));
  manifestQs.push({ id: q.id, kind: q.kind, question: q.query, gold: q.gold, packNodes: ids.length });
}
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ meta: { gid: GID, maxNodes: MAXN, hops: HOPS, alpha: ALPHA, bodyChars: BODY, packDir: OUT }, questions: manifestQs }, null, 2));
console.log(JSON.stringify({ gid: GID, packDir: OUT, questions: manifestQs.length, avgPackNodes: +(manifestQs.reduce((s, q) => s + q.packNodes, 0) / manifestQs.length).toFixed(1) }));
