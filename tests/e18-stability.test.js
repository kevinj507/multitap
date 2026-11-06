// E18.2 STEP 3 — the stability model, unit-tested with NO DATABASE.
//
// src/events/stability.js and src/events/kinds.js are PURE modules (they import
// nothing), which is why this file may import them statically — the house rule
// is that a test file must not statically reach src/db.js, and neither of these
// does. Nothing here touches Postgres, express, or a fixture graph: the whole
// decay model is a fold and a curve, and this file pins both.
import { describe, it, expect } from 'vitest';
import {
  STABILITY_DEFAULTS,
  DEFAULT_R_THRESHOLD,
  applyCheck,
  checkFromEvent,
  checksFor,
  dueAt,
  dueDays,
  dueFactor,
  emptyStability,
  foldChecks,
  foldStability,
  isDue,
  retrievability,
  stabilityFor,
} from '../src/events/stability.js';
import { isDecayEligible, weakening } from '../src/events/kinds.js';

const DAY = 86400000;
const P = { sInitDays: 90 };
const hold = (at, subjectId = 1, deliberate = false) => ({ subjectId, at, outcome: 'held', deliberate });
const fail = (at, subjectId = 1, deliberate = false) => ({ subjectId, at, outcome: 'failed', deliberate });

// Fold a list of checks and read one node's S back.
function sAfter(checks, params = P, nodeId = 1) {
  return stabilityFor(foldChecks(emptyStability(), checks, params), nodeId, params);
}

describe('E18.2 stability — S responds to SPACING, not to repetition', () => {
  it('rises on spaced holds: 90 -> 108 -> 129.6 -> 155.52', () => {
    // Each hold lands exactly S days after the previous one, i.e. at R = 0.9.
    // The reward is then S * (1 + growth * (1 - 0.9)) = S * 1.2 every time.
    let state = emptyStability();
    let t = Date.parse('2026-01-01T00:00:00Z');
    const traj = [];
    for (let i = 0; i < 4; i += 1) {
      state = applyCheck(state, hold(t), P);
      const s = stabilityFor(state, 1, P);
      traj.push(Number(s.toFixed(2)));
      t += s * DAY;
    }
    expect(traj).toEqual([90, 108, 129.6, 155.52]);
    // strictly monotone
    for (let i = 1; i < traj.length; i += 1) expect(traj[i]).toBeGreaterThan(traj[i - 1]);
  });

  it('is ~FLAT on unspaced holds: five checks 60 s apart buy 0.001 days', () => {
    // THE LOAD-BEARING PROPERTY. This is why the model never has to branch on
    // `payload.intent`: an agent that incidentally rewrites `verified_at` five
    // times in one session cannot inflate its stability. The spacing term IS
    // the defence against incidental inflation, so `intent` stays an audit
    // fact rather than becoming a policy input.
    let state = emptyStability();
    let t = 0;
    const traj = [];
    for (let i = 0; i < 5; i += 1) {
      state = applyCheck(state, hold(t), P);
      traj.push(Number(stabilityFor(state, 1, P).toFixed(3)));
      t += 60000;
    }
    expect(traj).toEqual([90, 90, 90, 90, 90.001]);
    expect(stabilityFor(state, 1, P) - 90).toBeLessThan(0.001);
  });

  it('collapses on a fail: 108 -> 9, and 9 with no prior hold', () => {
    const twoHolds = [hold(0), hold(90 * DAY)];
    expect(sAfter(twoHolds, P)).toBeCloseTo(108, 9);
    expect(sAfter([...twoHolds, fail(200 * DAY)], P)).toBe(9);
    // A claim that has never been verified can still FAIL — that is the whole
    // reason `refuted_at` is a scalar of its own.
    expect(sAfter([fail(0)], P)).toBe(9);
  });

  it('a long-earned window does not survive a fail: min(S, S_INIT) first', () => {
    // Six well-spaced holds earn ~268 days; one failure must not leave 26.8.
    let state = emptyStability();
    let t = 0;
    for (let i = 0; i < 6; i += 1) {
      state = applyCheck(state, hold(t), P);
      t += stabilityFor(state, 1, P) * DAY;
    }
    expect(stabilityFor(state, 1, P)).toBeGreaterThan(200);
    state = applyCheck(state, fail(t), P);
    expect(stabilityFor(state, 1, P)).toBe(9);
  });

  it('clamps at sMinDays and sMaxDays, and growth: 0 freezes S', () => {
    const tiny = { sInitDays: 5, lapseFactor: 0.0001, sMinDays: 1 };
    expect(sAfter([hold(0), fail(10 * DAY)], tiny)).toBe(1);

    const capped = { sInitDays: 90, growth: 1000, sMaxDays: 100 };
    expect(sAfter([hold(0), hold(90 * DAY)], capped)).toBe(100);

    const frozen = { sInitDays: 90, growth: 0 };
    expect(sAfter([hold(0), hold(500 * DAY), hold(2000 * DAY)], frozen)).toBe(90);
  });

  it('a LAPSE never RAISES S — the sMinDays floor cannot outrank staleDays', () => {
    // REGRESSION (E18.2 review, D2). `sMinDays` is an absolute 1-day floor and
    // `sInitDays` is `staleDays`, a caller parameter with `min: 0`. Below
    // `staleDays: 1` the floor used to exceed the pre-lapse window, so a FAILED
    // check came out with a LONGER leash than an unchecked node — the precise
    // opposite of what a failure means. Reproduced before the fix at every
    // staleDays < 1 (S_failed = 1 against S_unchecked = 0.1 / 0.25 / 0.5 / 0.99)
    // and at none >= 1.
    for (const sInitDays of [0, 0.1, 0.25, 0.5, 0.9, 0.99, 1, 1.01, 2, 5, 9, 10, 30, 90]) {
      const params = { sInitDays };
      const unchecked = stabilityFor(emptyStability(), 999, params);
      const failedCold = sAfter([fail(0)], params);
      const failedWarm = sAfter([hold(0), fail(5 * DAY)], params);
      // A failure may leave the claim more urgent, or equally urgent. NEVER
      // less: a bigger S is a longer leash, which is a LATER due date.
      expect(failedCold).toBeLessThanOrEqual(unchecked);
      expect(failedWarm).toBeLessThanOrEqual(unchecked);
      // ...and the fix moves nothing at every parameter the design contemplated.
      if (sInitDays >= 1) {
        expect(failedCold).toBe(Math.max(1, sInitDays * 0.1));
        expect(failedWarm).toBe(Math.max(1, sInitDays * 0.1));
      }
    }
  });

  it('an unseen node gets S_INIT exactly — no clamping, so staleDays: 0 survives', () => {
    expect(stabilityFor(emptyStability(), 999, P)).toBe(90);
    expect(stabilityFor(emptyStability(), 999, { sInitDays: 0 })).toBe(0);
    // The FIRST hold is S_INIT exactly too. Clamping it to sMinDays would turn
    // `staleDays: 0` into `staleDays: 1` and break v1 parity at that boundary.
    expect(sAfter([hold(0)], { sInitDays: 0 })).toBe(0);
    expect(STABILITY_DEFAULTS.sInitDays).toBe(90);
  });
});

describe('E18.2 stability — the fold is pure and incrementally composable', () => {
  it('applyCheck never mutates the state it was handed', () => {
    const base = foldChecks(emptyStability(), [hold(0)], P);
    const before = JSON.stringify(base);
    applyCheck(base, hold(90 * DAY), P);
    applyCheck(base, fail(90 * DAY), P);
    expect(JSON.stringify(base)).toBe(before);
  });

  it('fold(a, [x, y]) === fold(fold(a, [x]), [y]) — the incremental path', () => {
    const a = emptyStability();
    const x = hold(0);
    const y = hold(120 * DAY);
    const z = fail(300 * DAY);
    const whole = foldChecks(a, [x, y, z], P);
    const piecewise = foldChecks(foldChecks(foldChecks(a, [x], P), [y], P), [z], P);
    expect(JSON.stringify(whole)).toBe(JSON.stringify(piecewise));
  });

  it('keeps nodes independent and counts held/failed/deliberate per node', () => {
    const state = foldChecks(emptyStability(), [
      hold(0, 1, true),
      hold(0, 2, false),
      fail(10 * DAY, 1, true),
      hold(20 * DAY, 1, false),
    ], P);
    expect(checksFor(state, 1)).toEqual({
      held: 2, failed: 1, deliberate: 2,
      last_at: new Date(20 * DAY).toISOString(), last_outcome: 'held',
    });
    expect(checksFor(state, 2).held).toBe(1);
    expect(checksFor(state, 2).failed).toBe(0);
    // A node with no checks at all — every node on the frontier's PATH A.
    expect(checksFor(state, 3)).toEqual({
      held: 0, failed: 0, deliberate: 0, last_at: null, last_outcome: null,
    });
    expect(checksFor(null, 1).held).toBe(0);
  });

  it('foldStability tracks the highest seq it folded', () => {
    const ev = (seq, kinds) => ({
      seq, subject_kind: 'node', subject_id: 7, happened_at: '2026-01-01T00:00:00.000Z',
      payload: { kinds, changes: {} },
    });
    const state = foldStability(emptyStability(), [
      ev(3, ['claim.verified']),
      ev(9, ['node.patched']),
      ev(12, ['claim.refuted']),
    ], P);
    expect(state.atSeq).toBe(12);
    expect(checksFor(state, 7)).toMatchObject({ held: 1, failed: 1 });
  });
});

describe('E18.2 checkFromEvent — the scalar declares WHEN the check happened', () => {
  const ev = (over = {}) => ({
    seq: 1,
    subject_kind: 'node',
    subject_id: 42,
    happened_at: '2026-09-01T00:00:00.000Z',
    payload: { kinds: ['claim.verified'], changes: {}, ...(over.payload ?? {}) },
    ...over,
  });

  it('prefers changes["meta.verified_at"].to over happened_at', () => {
    // An ordinary PATCH writing `verified_at: 2026-03-01` TODAY is asserting a
    // MARCH check; the event's happened_at is September. The scalar wins.
    const check = checkFromEvent(ev({
      payload: {
        kinds: ['claim.verified'],
        changes: { 'meta.verified_at': { from: null, to: '2026-03-01T00:00:00.000Z' } },
      },
    }));
    expect(check.at).toBe(Date.parse('2026-03-01T00:00:00.000Z'));
    expect(check.outcome).toBe('held');
    expect(check.subjectId).toBe(42);
  });

  it('clamps a FUTURE-dated scalar to happened_at — recency cannot be bought', () => {
    const check = checkFromEvent(ev({
      payload: {
        kinds: ['claim.verified'],
        changes: { 'meta.verified_at': { from: null, to: '2027-01-01T00:00:00.000Z' } },
      },
    }));
    expect(check.at).toBe(Date.parse('2026-09-01T00:00:00.000Z'));
  });

  it('falls back to happened_at on a refute and on an unparseable scalar', () => {
    // The verify route's FAIL shape: refuted_at set, verified_at REMOVED, so
    // `.to` is null and there is nothing to prefer.
    const refute = checkFromEvent(ev({
      payload: {
        kinds: ['claim.refuted', 'field.set'],
        changes: {
          'meta.refuted_at': { from: null, to: '2026-09-01T00:00:00.000Z' },
          'meta.verified_at': { from: '2026-01-01', to: null, to_present: false },
        },
      },
    }));
    expect(refute.outcome).toBe('failed');
    expect(refute.at).toBe(Date.parse('2026-09-01T00:00:00.000Z'));

    const junk = checkFromEvent(ev({
      payload: {
        kinds: ['claim.verified'],
        changes: { 'meta.verified_at': { from: null, to: 'not-a-date' } },
      },
    }));
    expect(junk.at).toBe(Date.parse('2026-09-01T00:00:00.000Z'));
  });

  it('reads deliberateness off payload.intent, present only on the verify route', () => {
    expect(checkFromEvent(ev()).deliberate).toBe(false);
    expect(checkFromEvent(ev({ payload: { kinds: ['claim.verified'], intent: 'claim.verified' } })).deliberate).toBe(true);
    expect(checkFromEvent(ev({ payload: { kinds: ['claim.refuted'], intent: 'claim.refuted' } })).deliberate).toBe(true);
    // intent cannot fabricate anything: a non-check event is still not a check.
    expect(checkFromEvent(ev({ payload: { kinds: ['node.patched'], intent: 'claim.verified' } }))).toBeNull();
  });

  it('returns null for anything that is not a node check', () => {
    expect(checkFromEvent(null)).toBeNull();
    expect(checkFromEvent({})).toBeNull();
    expect(checkFromEvent(ev({ payload: { kinds: ['status.changed'] } }))).toBeNull();
    expect(checkFromEvent(ev({ subject_kind: 'edge' }))).toBeNull();
    expect(checkFromEvent(ev({ subject_id: null, payload: { kinds: ['claim.verified'] } }))).toBeNull();
    // Nothing places it in time -> it cannot move S.
    expect(checkFromEvent(ev({ happened_at: null, payload: { kinds: ['claim.verified'] } }))).toBeNull();
  });

  it('refuted beats verified when a single change asserts both', () => {
    const check = checkFromEvent(ev({
      payload: { kinds: ['claim.refuted', 'claim.verified'], changes: {} },
    }));
    expect(check.outcome).toBe('failed');
  });
});

describe('E18.2 retrievability — the curve, for ranking and display', () => {
  it('R(0, S) === 1 and R(9S, S) === 0.5', () => {
    for (const s of [1, 7, 30, 90, 365]) {
      expect(retrievability(0, s)).toBe(1);
      expect(retrievability(9 * s, s)).toBeCloseTo(0.5, 12);
    }
  });

  it('is strictly decreasing in age', () => {
    let prev = Infinity;
    for (const age of [0, 1, 10, 45, 90, 180, 365, 3650]) {
      const r = retrievability(age, 90);
      expect(r).toBeLessThan(prev);
      prev = r;
    }
  });

  it('degenerates safely: S <= 0 means "stale the instant it is not now"', () => {
    expect(retrievability(0, 0)).toBe(1);
    expect(retrievability(1, 0)).toBe(0);
    expect(retrievability(-5, 90)).toBe(1);
  });
});

describe('E18.2 the float64 boundary — WHY THE GATE IS IN THE TIME DOMAIN', () => {
  it('R(t = S) is BELOW 0.9 in IEEE-754 double — measured, not assumed', () => {
    // node -e "console.log(1/(1+90/(9*90)))"  ->  0.8999999999999999
    // Today's SQL uses a strict interval comparison, so a node verified
    // EXACTLY staleDays ago is NOT stale. Evaluating the gate in the R domain
    // would flip that node: a one-row, silent back-compat break.
    expect(1 / (1 + 90 / 810)).toBe(0.8999999999999999);
    for (const s of [1, 7, 30, 90, 180, 365]) {
      expect(retrievability(s, s) < 0.9).toBe(true);   // the trap, in every size
    }
  });

  it('dueFactor(0.9) === 1 EXACTLY — pinned as a literal, never recomputed', () => {
    // Both float64 spellings of the general formula are off by ulps:
    expect(9 * (1 / 0.9 - 1)).toBe(1.0000000000000004);
    expect((9 * (1 - 0.9)) / 0.9).toBe(0.9999999999999998);
    // ...and at the default this factor multiplies staleDays straight into
    // today's `NOW() - ($3 || ' days')::interval`. So it is a literal.
    expect(dueFactor(0.9)).toBe(1);
    expect(dueFactor()).toBe(1);
    expect(DEFAULT_R_THRESHOLD).toBe(0.9);
  });

  it('isDue(S, S) is false and isDue(S + 1e-9, S) is true, for every S', () => {
    for (const s of [1, 7, 30, 90, 180, 365]) {
      expect(isDue(s, s, P)).toBe(false);            // exactly staleDays ago: NOT stale
      expect(isDue(s + 1e-9, s, P)).toBe(true);
      expect(isDue(s - 1e-9, s, P)).toBe(false);
    }
  });

  it('a non-default rThreshold moves the window in the time domain', () => {
    expect(dueFactor(0.5)).toBeCloseTo(9, 12);
    expect(dueDays(90, P, 0.5)).toBeCloseTo(810, 9);
    expect(isDue(800, 90, P, 0.5)).toBe(false);
    expect(isDue(900, 90, P, 0.5)).toBe(true);
    // Degenerate ends: 0 never surfaces, 1 surfaces immediately.
    expect(dueFactor(0)).toBe(Infinity);
    expect(isDue(1e9, 90, P, 0)).toBe(false);
    expect(dueFactor(1)).toBe(0);
    expect(isDue(1e-9, 90, P, 1)).toBe(true);
  });

  it('dueAt is the time-to-surface handle, and null when nothing to project', () => {
    const held = Date.parse('2026-01-01T00:00:00.000Z');
    expect(dueAt(held, 90, P)).toBe(new Date(held + 90 * DAY).toISOString());
    expect(dueAt(held, 155.52, P)).toBe(new Date(held + 155.52 * DAY).toISOString());
    expect(dueAt(null, 90, P)).toBeNull();
    expect(dueAt(held, 90, P, 0)).toBeNull();   // never due
  });
});

describe('E18.2 isDecayEligible — the population gate, not a type allowlist', () => {
  // Measured on the production corpus before this was written: there is NO
  // `claim` type at all, 2983 of 4103 nodes are untyped, and 1043 of the 1298
  // nodes carrying verified_at are untyped. A type allowlist would key the
  // feature on a field 73% of the relevant nodes lack.
  it('is true for a confidence-bearing node and for a reference', () => {
    expect(isDecayEligible(null, { confidence: 0.8 })).toBe(true);
    expect(isDecayEligible(null, { confidence: 0 })).toBe(true);
    expect(isDecayEligible(null, { type: 'reference' })).toBe(true);
    // Untyped + confidence is the house definition of a claim, and is exactly
    // the population /frontier has always used.
    expect(isDecayEligible(null, { confidence: 0.5, type: undefined })).toBe(true);
  });

  it('is false for a plain work node and for an explicit decay: false', () => {
    expect(isDecayEligible(null, { title: 'build the thing', status: 'todo' })).toBe(false);
    expect(isDecayEligible(null, { type: 'plan' })).toBe(false);
    // The opt-out wins over confidence: a fixed MEASUREMENT does not rot.
    expect(isDecayEligible(null, { decay: false, confidence: 0.8 })).toBe(false);
    expect(isDecayEligible(null, { decay: false, type: 'reference' })).toBe(false);
    // `decay: true` is the default spelled out, not a second opt-in.
    expect(isDecayEligible(null, { decay: true, confidence: 0.8 })).toBe(true);
    expect(isDecayEligible(null, { decay: true })).toBe(false);
  });

  it('answers from an event alone via payload.node_kind, tri-state', () => {
    expect(isDecayEligible({ payload: { node_kind: 'reference' } })).toBe(true);
    // "E18 takes no position" — a caller can tell this from "not eligible".
    expect(isDecayEligible({ payload: { node_kind: null } })).toBeNull();
    expect(isDecayEligible({ payload: { node_kind: 'plan' } })).toBeNull();
    expect(isDecayEligible({})).toBeNull();
    expect(isDecayEligible(null)).toBeNull();
  });
});

describe('E18.2 weakening — the E18.3 seed, with no propagation weight baked in', () => {
  const ev = (payload) => ({ seq: 5, subject_id: 11, happened_at: '2026-05-05T00:00:00.000Z', payload });

  it('turns claim.refuted into a refutation of magnitude 1', () => {
    expect(weakening(ev({ kinds: ['claim.refuted'], changes: {} }))).toEqual({
      kind: 'refutation', magnitude: 1, seq: 5, subject_id: 11, happened_at: '2026-05-05T00:00:00.000Z',
    });
  });

  it('turns a confidence DROP into a magnitude, and ignores a rise', () => {
    const drop = weakening(ev({ kinds: ['field.set'], changes: { 'meta.confidence': { from: 0.9, to: 0.3 } } }));
    expect(drop.kind).toBe('confidence_drop');
    expect(drop.magnitude).toBeCloseTo(0.6, 12);   // 0.9 - 0.3 is 0.6000000000000001 in float64
    expect(weakening(ev({ kinds: ['field.set'], changes: { 'meta.confidence': { from: 0.3, to: 0.9 } } }))).toBeNull();
    expect(weakening(ev({ kinds: ['field.set'], changes: { 'meta.confidence': { from: null, to: 0.3 } } }))).toBeNull();
    expect(weakening(ev({ kinds: ['field.set'], changes: { 'meta.confidence': { from: 0.9, to: null } } }))).toBeNull();
  });

  it('returns null for a plain patch, and refutation OUTRANKS a confidence drop', () => {
    expect(weakening(ev({ kinds: ['node.patched'], changes: { content: {} } }))).toBeNull();
    expect(weakening(null)).toBeNull();
    expect(weakening(ev({
      kinds: ['claim.refuted', 'field.set'],
      changes: { 'meta.confidence': { from: 0.9, to: 0.2 } },
    }))).toMatchObject({ kind: 'refutation', magnitude: 1 });
  });
});
