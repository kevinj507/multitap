#!/usr/bin/env node
// E13.10.4 (#473) — the mechanical KEEP/DROP gate. Compares a treatment arm to the
// running-baseline arm and applies the ASYMMETRIC rule (Kevin, 2026-06-21):
//   keep iff the change helps OR is statistically neutral; DROP only on a regression
//   beyond the error bars (the "secret harm" case — e.g. coverage up but precision or
//   answer-quality down). Small benefits and noise both -> KEEP (safe default).
// Gated metrics: context-pack coverage (N10/N30), bridge reachability, mid-tier
// answer-quality (strict). Precision is a SECRET-HARM co-signal (hairball guard).
// Run: node eval/skill-ab/compare.js --baseline base.summary.json --treatment t.summary.json
import fs from 'fs';
import { arg } from './lib.js';

const base = JSON.parse(fs.readFileSync(arg('baseline', null), 'utf-8'));
const treat = JSON.parse(fs.readFileSync(arg('treatment', null), 'utf-8'));
const OUT = arg('out', null);
const r3 = (x) => +Number(x).toFixed(3);
const pooled = (a, b) => Math.sqrt(((a || 0) ** 2 + (b || 0) ** 2) / 2);

function delta(metric, path) {
  const get = (o) => path.split('.').reduce((x, k) => (x ? x[k] : undefined), o);
  const b = get(base), t = get(treat);
  if (!b || !t || b.mean === undefined) return null;
  return { metric, base: b.mean, treat: t.mean, delta: r3(t.mean - b.mean), pooledStd: r3(pooled(b.std, t.std)) };
}
function aqDelta() {
  if (!base.aq || !treat.aq) return null;
  return { metric: 'aq.strict', base: base.aq.strict, treat: treat.aq.strict, delta: r3(treat.aq.strict - base.aq.strict), pooledStd: r3(pooled(base.aq.perRunStrictStd, treat.aq.perRunStrictStd)) };
}

const d = {
  covN10: delta('covN10', 'coverage.covN10'),
  covN30: delta('covN30', 'coverage.covN30'),
  precN10: delta('precN10', 'coverage.precN10'),
  precN30: delta('precN30', 'coverage.precN30'),
  bridgeReach: delta('bridgeReach', 'coverage.bridgeReach'),
  edgeDensity: delta('edgeDensity', 'coverage.edgeDensity'),
  relEdges: delta('relEdges', 'coverage.relEdges'),
  aqStrict: aqDelta(),
  aqLenient: base.aq && treat.aq ? { metric: 'aq.lenient', base: base.aq.lenient, treat: treat.aq.lenient, delta: r3(treat.aq.lenient - base.aq.lenient) } : null,
};

// harm tests: regression beyond max(pooledStd, floor)
const harm = (dd, floor) => dd && dd.delta < -Math.max(dd.pooledStd || 0, floor);
const flags = [];       // DROP-worthy harm
const reviewFlags = []; // non-blocking notes for Kevin
if (harm(d.covN30, 0.03)) flags.push('coverage@N30 regressed');
if (harm(d.covN10, 0.03)) flags.push('coverage@N10 regressed');
if (harm(d.bridgeReach, 0.05)) flags.push('bridge-reachability regressed');
if (harm(d.aqStrict, 0.04)) flags.push('answer-quality (strict) regressed');
// secret harm: coverage UP but precision craters or AQ drops (the #463 failure mode)
const covUp = (d.covN30 && d.covN30.delta > 0.03) || (d.covN10 && d.covN10.delta > 0.03);
const precCrater = (d.precN30 && d.precN30.delta < -0.08) || (d.precN10 && d.precN10.delta < -0.08);
const aqDrop = d.aqStrict && d.aqStrict.delta < -0.04;
const aqLenientDrop = d.aqLenient && d.aqLenient.delta < -0.08;
const secretHarm = covUp && (precCrater || aqDrop);
if (secretHarm) flags.push(`SECRET HARM: coverage up but ${precCrater ? 'precision craters' : ''}${precCrater && aqDrop ? ' & ' : ''}${aqDrop ? 'answer-quality drops' : ''}`);
// HAIRBALL WATCH: graph edge density balloons (the pack is capped at 10 nodes so
// precN10 can't see it — edge_density can). This is a TRUTHFULNESS/over-connection
// concern, but only counts as DROP-worthy harm if AQ ALSO regresses (the retrieval
// proxy that the over-connection actually hurts). Otherwise: KEEP but flag for review.
const densityBalloon = d.edgeDensity && base.coverage && d.edgeDensity.treat > 1.4 * d.edgeDensity.base;
if (densityBalloon) {
  const msg = `hairball watch: edge density ${d.edgeDensity.base}->${d.edgeDensity.treat} (${(d.edgeDensity.treat / d.edgeDensity.base).toFixed(1)}x)`;
  if (aqDrop || aqLenientDrop) flags.push(`SECRET HARM via over-connection: ${msg} AND answer-quality dropped`);
  else reviewFlags.push(`${msg} but answer-quality held — over-connection is a truthfulness concern for Kevin, not a measured retrieval harm`);
}

const verdict = flags.length ? 'DROP' : 'KEEP';
const rationale = flags.length
  ? `DROP — ${flags.join('; ')}.`
  : `KEEP — no gated metric regressed beyond error bars (help-or-neutral). ` +
    `covN30 ${d.covN30 ? d.covN30.delta : 'n/a'}, covN10 ${d.covN10 ? d.covN10.delta : 'n/a'}, bridgeReach ${d.bridgeReach ? d.bridgeReach.delta : 'n/a'}, aqStrict ${d.aqStrict ? d.aqStrict.delta : 'n/a'}.` +
    (reviewFlags.length ? ` [REVIEW: ${reviewFlags.join('; ')}]` : '');

const out = { baselineArm: base.arm, treatmentArm: treat.arm, track: treat.track, deltas: d, flags, reviewFlags, secretHarm, verdict, rationale };
if (OUT) fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
