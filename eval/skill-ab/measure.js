#!/usr/bin/env node
// E13.10 (#470) — MAIN-LOOP deterministic measurement (control plane, NO agents).
// After the build workflow has enriched/built each run's graph, this:
//   1. scores coverage/precision/reachability via score-coverage.js (deterministic)
//   2. renders the answer-quality packs via render-packs.js (deterministic)
// and writes them back into the manifest so the AQ workflow can consume packDirs.
// Run: node eval/skill-ab/measure.js --manifest /tmp/ab/c1.manifest.json [--maxNodes 10]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { arg } from './lib.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST = arg('manifest', null);
const MAXN = arg('maxNodes', '10');
const QUESTIONS = path.join(__dirname, 'frozen/questions.json');
const GOLDCLASS = path.join(__dirname, 'frozen/goldclass.json');
if (!MANIFEST) { console.error('need --manifest'); process.exit(1); }
const node = (script, a) => execFileSync('node', [path.join(__dirname, script), ...a], { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });

const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf-8'));
for (const run of m.runs) {
  // coverage/precision/reachability — screen has a remap+goldclass; confirm has neither
  if (run.remap) {
    const sc = JSON.parse(node('score-coverage.js', ['--gid', run.gid, '--remap', run.remap, '--goldclass', GOLDCLASS]).trim());
    run.coverage = sc;
  }
  // render the AQ packs (both tracks)
  const rp = JSON.parse(node('render-packs.js', ['--gid', run.gid, '--questions', QUESTIONS, '--out', run.packDir, '--maxNodes', MAXN]).trim());
  run.packRender = rp;
  process.stderr.write(`measured ${m.arm} r${run.runIdx}: ${run.coverage ? `covN${MAXN}=${run.coverage.context_pack['maxNodes' + MAXN].coverage} prec=${run.coverage.context_pack['maxNodes' + MAXN].precision} bridgeReach=${run.coverage.reachability_hops2.bridge} relEdges=${run.coverage.related_edges}` : `(confirm) nodes/edges via packRender avgPackNodes=${rp.avgPackNodes}`}\n`);
}
fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2));

// emit the ab-aq workflow args (questions subset + run packDirs)
const QIDS = (arg('qids', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
const PASSES = Number(arg('passes', '1'));
const allQ = JSON.parse(fs.readFileSync(QUESTIONS, 'utf-8')).questions;
const qsubset = (QIDS.length ? allQ.filter((q) => QIDS.includes(q.id)) : allQ).map((q) => ({ id: q.id, question: q.query, gold: q.gold }));
const aqArgs = {
  arm: m.arm,
  runs: m.runs.map((r) => ({ runIdx: r.runIdx, packDir: r.packDir })),
  questions: qsubset, passes: PASSES, answerModel: 'sonnet', judgeModel: 'opus',
};
fs.writeFileSync(MANIFEST.replace(/\.manifest\.json$/, '.aqargs.json'), JSON.stringify(aqArgs));
console.log(JSON.stringify({ arm: m.arm, track: m.track, measured: m.runs.length, maxNodes: MAXN, aqQuestions: qsubset.length }));
