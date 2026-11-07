// One data model, S2b — which of the engine's actions the panel offers a
// person on a coordination node (public/coord-actions.js), and how an engine
// error reads.
import { describe, it, expect } from 'vitest';
import { actionsFor, errorWords } from '../public/coord-actions.js';

const ids = (coord) => actionsFor(coord).map((a) => a.id);

describe('actionsFor', () => {
  it('a finished proposition can be landed or rechecked, sent back only when its landing failed; an open or held one can be amended or called wrong', () => {
    expect(ids({ kind: 'proposition', id: 'c1', status: 'done' })).toEqual(['land', 'recheck']);
    expect(ids({ kind: 'proposition', id: 'c1', status: 'done', landing: { status: 'failed' } })).toEqual(['land', 'reopen', 'recheck']);
    expect(ids({ kind: 'proposition', id: 'c1', status: 'open' })).toEqual(['amend', 'finding']);
    expect(ids({ kind: 'proposition', id: 'c1', status: 'claimed' })).toEqual(['recheck', 'amend', 'finding']);
    expect(ids({ kind: 'proposition', id: 'c1', status: 'landed' })).toEqual(['recheck']);
    expect(ids({ kind: 'proposition', id: 'c1', status: 'stale' })).toEqual(['amend', 'finding']);
    const finding = actionsFor({ kind: 'proposition', id: 'c1', status: 'open' }).find((a) => a.id === 'finding');
    expect(finding).toMatchObject({ path: '/findings/owner', ask: 'finding', body: { effect: 'contradicts', where: ['c1'] } });
    expect(actionsFor({ kind: 'proposition', id: 'c1', status: 'open' }).find((a) => a.id === 'amend')).toMatchObject({ path: '/propositions/c1/amend', ask: 'statement' });
    const land = actionsFor({ kind: 'proposition', id: 'c1', status: 'done' })[0];
    expect(land).toMatchObject({ method: 'POST', path: '/propositions/c1/land' });
  });

  it('an unverified finding can be confirmed or refuted; a settled one offers nothing', () => {
    expect(ids({ kind: 'finding', id: 'f1', status: 'unverified' })).toEqual(['verify', 'refute']);
    expect(ids({ kind: 'finding', id: 'f1', status: 'verified' })).toEqual([]);
    expect(actionsFor({ kind: 'finding', id: 'f1', status: 'unverified' })[1].path).toBe('/findings/f1/refute');
  });

  it('an open decision takes one of the two answers, with a reason asked for; a closed one nothing', () => {
    const acts = actionsFor({ kind: 'decision', id: 'd1', status: 'todo' });
    expect(acts.map((a) => a.id)).toEqual(['answer:continue-investigation', 'answer:park-investigation']);
    expect(acts[0]).toMatchObject({ path: '/decisions/d1/answer', body: { answer: 'continue-investigation' }, ask: 'reason' });
    expect(ids({ kind: 'decision', id: 'd1', status: 'done' })).toEqual([]);
  });

  it('lines, assumptions, junk: nothing', () => {
    expect(ids({ name: 'main', head: 'x' })).toEqual([]);
    expect(ids({ kind: 'assumption', id: 'a1', status: 'holding' })).toEqual([]);
    expect(ids(null)).toEqual([]);
    expect(ids({ kind: 'proposition', status: 'done' })).toEqual([]); // no id, no path
  });
});

describe('errorWords', () => {
  it('reads the engine\'s refusals in plain words', () => {
    expect(errorWords(403, { error: 'forbidden', message: 'no access to this graph' })).toBe('You may not do that on this graph (no access to this graph)');
    expect(errorWords(404, null)).toMatch(/does not know/);
    expect(errorWords(409, { message: 'proposition is not done' })).toBe('The engine refused: proposition is not done');
    expect(errorWords(503, {})).toMatch(/could not do it right now/);
    expect(errorWords(400, { message: 'bad body' })).toBe('bad body');
  });
});
