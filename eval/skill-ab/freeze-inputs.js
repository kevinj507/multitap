#!/usr/bin/env node
// E13.10.2 (#471) — freeze the remaining experiment inputs from the cached stock
// snapshot + the multihop dataset (no live calls):
//   - frozen/questions.json: the 12 multihop questions with entity-level gold
//     (canonical=rationale, must_mention=gold node TITLES). Title-based gold transfers
//     across independently-built graphs, so it works for BOTH tracks (screen copy +
//     confirm blank-slate). The judge scores the answer's prose against must_mention.
//   - frozen/corpus.md: a flat dossier of every stock node body with EDGES STRIPPED
//     (just the prose, titled). The confirm-track blank-slate build re-discovers the
//     structure from this, so a better write-side doctrine should show up end-to-end.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { stripFm } from './lib.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const snap = JSON.parse(fs.readFileSync(path.join(__dirname, 'frozen/stock-snapshot.json'), 'utf-8'));
const multihop = JSON.parse(fs.readFileSync(path.join(__dirname, '../dataset-context-multihop.json'), 'utf-8'));
const titleOf = new Map(snap.nodes.map((n) => [n.oldId, n.title]));

// questions.json — entity-title gold
const questions = multihop.cases.map((c) => ({
  id: c.id, kind: 'multihop', query: c.query, min_hops: c.min_hops,
  gold: {
    canonical: c.rationale,
    must_mention: c.gold_nodes.map((g) => titleOf.get(g)).filter(Boolean),
  },
}));
fs.writeFileSync(path.join(__dirname, 'frozen/questions.json'), JSON.stringify({ meta: { src: snap.src, n: questions.length, note: 'entity-title gold; works for screen (copy) + confirm (blank-slate)' }, questions }, null, 2));

// corpus.md — flat dossier, edges stripped, structure removed
const dossier = snap.nodes
  .sort((a, b) => a.oldId - b.oldId)
  .map((n) => `## ${n.title}\n\n${stripFm(n.content).trim()}`)
  .join('\n\n---\n\n');
const header = `# AI hardware / datacenter supply-chain dossier\n\nSource material on the companies, technologies, and dependencies across the AI buildout (compute, memory, fabrication, datacenters, power, networking, materials). Each section is one topic; the connections between topics are NOT given — infer them.\n\n`;
fs.writeFileSync(path.join(__dirname, 'frozen/corpus.md'), header + dossier);

console.log(JSON.stringify({
  questions: questions.length,
  must_mention_total: questions.reduce((s, q) => s + q.gold.must_mention.length, 0),
  corpus_nodes: snap.nodes.length,
  corpus_chars: (header + dossier).length,
  sample_question: questions[0],
}, null, 2));
