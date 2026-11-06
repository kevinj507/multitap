#!/usr/bin/env node
// E13.10.1 (#470) — Graph-copy utility. Clone a SOURCE graph into a fresh
// throwaway graph: replicate every node (POST /tasks with its content) and every
// edge (POST /edges/bulk, remapped), producing an old->new node-ID REMAP keyed on
// title so the existing node-ID gold (#463/#464) transfers to the copy. Verifies
// node/edge parity. NOTHING here mutates the source (we only GET it).
//
// Run: node eval/skill-ab/graph-copy.js --src fwmhe8ysfrnx9fw7 [--name "..."] [--out remap.json] [--cache f.json]
//   prints { newGid, nodeCount, edgeCount, remap:[{oldId,newId,title}] } to stdout.
// --cache: reuse a frozen dump of the source's node contents+edges across many
// provisionings (skips 73 GETs/run). First run with --cache writes it.
import fs from 'fs';
import { get, post, arg, pool } from './lib.js';

const SRC = arg('src', 'fwmhe8ysfrnx9fw7');
const NAME = arg('name', `AB-copy-${SRC}`);
const OUT = arg('out', null);
const CACHE = arg('cache', null);
const CONC = Number(arg('conc', '4'));

// source snapshot (cached if available): [{oldId,title,content}] + edges
let snapshot;
if (CACHE && fs.existsSync(CACHE)) {
  snapshot = JSON.parse(fs.readFileSync(CACHE, 'utf-8'));
} else {
  const map = await get(`/api/graphs/${SRC}/graph`);
  const srcEdges = await get(`/api/graphs/${SRC}/edges`);
  const nodes = await pool(map.nodes, CONC, async (n) => {
    const t = await get(`/api/graphs/${SRC}/tasks/${n.id}`);
    return { oldId: Number(n.id), title: t.meta?.title || '', content: t.content };
  });
  snapshot = { src: SRC, nodes, edges: srcEdges.map((e) => ({ source_id: Number(e.source_id), target_id: Number(e.target_id), type: e.type, meta: e.meta || {} })) };
  if (CACHE) fs.writeFileSync(CACHE, JSON.stringify(snapshot));
}

// fresh throwaway graph; anon_role default viewer is fine (token-owned)
const newGid = (await post(`/api/graphs`, { name: NAME, description: `throwaway A/B copy of ${SRC}` })).id;

// nodes — replicate content verbatim (positions/colors copy too), record old->new
const idMap = new Map();
const remap = await pool(snapshot.nodes, CONC, async (n) => {
  const created = await post(`/api/graphs/${newGid}/tasks`, { content: n.content });
  const newId = Number(created.id);
  idMap.set(n.oldId, newId);
  return { oldId: n.oldId, newId, title: n.title };
});
const srcEdges = snapshot.edges;

// edges — remap source/target, bulk insert (transactional, all-or-nothing)
const edges = srcEdges
  .map((e) => ({ source_id: idMap.get(Number(e.source_id)), target_id: idMap.get(Number(e.target_id)), type: e.type, meta: e.meta || {} }))
  .filter((e) => e.source_id && e.target_id);
if (edges.length) await post(`/api/graphs/${newGid}/edges/bulk`, { edges });

// verify parity
const newMap = await get(`/api/graphs/${newGid}/graph`);
const newEdges = await get(`/api/graphs/${newGid}/edges`);
const parity = {
  nodes_src: snapshot.nodes.length, nodes_new: newMap.nodes.length,
  edges_src: srcEdges.length, edges_new: newEdges.length,
  remap_covers_all: remap.length === snapshot.nodes.length,
};
if (parity.nodes_src !== parity.nodes_new || parity.edges_src !== parity.edges_new) {
  console.error(`PARITY FAIL: ${JSON.stringify(parity)}`);
  process.exit(1);
}

const result = { newGid, src: SRC, nodeCount: newMap.nodes.length, edgeCount: newEdges.length, parity, remap };
if (OUT) fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
