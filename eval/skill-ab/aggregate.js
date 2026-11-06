#!/usr/bin/env node
// E13.10 (#470) — fold one arm's measurements into a summary: deterministic
// coverage/precision/reachability (mean±std across runs) + blind answer-quality
// (strict & lenient accuracy from the judge verdicts) + build self-reports.
// Run: node eval/skill-ab/aggregate.js --manifest m.json --verdicts v.json [--build b.json] --out s.json
import fs from 'fs';
import { arg, mean, std } from './lib.js';

const m = JSON.parse(fs.readFileSync(arg('manifest', null), 'utf-8'));
const verdicts = arg('verdicts', null) ? JSON.parse(fs.readFileSync(arg('verdicts', null), 'utf-8')) : [];
const build = arg('build', null) ? JSON.parse(fs.readFileSync(arg('build', null), 'utf-8')) : [];
const OUT = arg('out', null);
const r3 = (x) => +Number(x).toFixed(3);
const ms = (a) => ({ mean: r3(mean(a)), std: r3(std(a)), n: a.length, vals: a.map(r3) });

// ── coverage (screen runs carry .coverage) ──
const cov = m.runs.filter((r) => r.coverage);
const coverage = cov.length ? {
  covN10: ms(cov.map((r) => r.coverage.context_pack.maxNodes10.coverage)),
  precN10: ms(cov.map((r) => r.coverage.context_pack.maxNodes10.precision)),
  covN30: ms(cov.map((r) => r.coverage.context_pack.maxNodes30.coverage)),
  precN30: ms(cov.map((r) => r.coverage.context_pack.maxNodes30.precision)),
  bridgeReach: ms(cov.map((r) => r.coverage.reachability_hops2.bridge)),
  goldReach: ms(cov.map((r) => r.coverage.reachability_hops2.gold)),
  relEdges: ms(cov.map((r) => r.coverage.related_edges)),
  edgeDensity: ms(cov.map((r) => r.coverage.edge_density)),
} : null;

// ── answer-quality (verdicts: correct/partial/incorrect) ──
const score = (v) => (v.verdict === 'correct' ? 1 : 0);
const lenient = (v) => (v.verdict === 'correct' || v.verdict === 'partial' ? 1 : 0);
let aq = null;
if (verdicts.length) {
  const strict = verdicts.map(score);
  const len = verdicts.map(lenient);
  // per-run strict means -> across-run std (build-to-build variance)
  const byRun = {};
  for (const v of verdicts) (byRun[v.runIdx] ||= []).push(v);
  const perRunStrict = Object.values(byRun).map((vs) => mean(vs.map(score)));
  aq = {
    n: verdicts.length,
    strict: r3(mean(strict)),
    lenient: r3(mean(len)),
    perRunStrict: perRunStrict.map(r3),
    perRunStrictStd: r3(std(perRunStrict)),
    insufficientRate: r3(mean(verdicts.map((v) => (v.insufficient ? 1 : 0)))),
    breakdown: { correct: strict.filter((x) => x).length, partial: verdicts.filter((v) => v.verdict === 'partial').length, incorrect: verdicts.filter((v) => v.verdict === 'incorrect').length },
  };
}

// ── build self-reports ──
const buildSummary = build.length ? {
  nodesAdded: ms(build.map((b) => b.nodesAdded || 0)),
  edgesAdded: ms(build.map((b) => b.edgesAdded || 0)),
  bridgeNodesAdded: ms(build.map((b) => b.bridgeNodesAdded || 0)),
  summaries: build.map((b) => `r${b.runIdx}: ${b.summary}`),
} : null;

const summary = { arm: m.arm, track: m.track, p: m.p, bias: m.bias, nRuns: m.runs.length, coverage, aq, build: buildSummary, gids: m.runs.map((r) => r.gid) };
if (OUT) fs.writeFileSync(OUT, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
