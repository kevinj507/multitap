// Choice (f) on the one-data-model design, amended (#11339): what the canvas
// tells a person who draws, changes or deletes an edge touching one of the
// coordination engine's nodes, and which of the engine's moves it becomes
// (public/coord-edges.js).
import { describe, it, expect } from 'vitest';
import { decide } from '../public/coord-edges.js';

describe('decide', () => {
  it('an edge between ordinary nodes is nobody\'s business but the person\'s', () => {
    expect(decide({ op: 'create', purpose: 'required for' })).toEqual({ case: 'plain' });
    expect(decide({ op: 'change', purpose: 'related to' })).toEqual({ case: 'plain' });
    expect(decide({ op: 'delete', purpose: 'required for' })).toEqual({ case: 'plain' });
  });

  it('drawing assumption → proposition as "required for" is an amendment of what the prop rests on', () => {
    const d = decide({ op: 'create', sourceKind: 'assumption', targetKind: 'proposition', purpose: 'required for', restsOn: ['a1'], assumptionId: 'a2', propWords: 'prop c1 (“uses dates”)' });
    expect(d.case).toBe('rests');
    expect(d.restsOn).toEqual(['a1', 'a2']);
    expect(d.title).toBe('Add to what the prop rests on?');
    expect(d.body).toContain('prop c1 (“uses dates”) rests on');
    expect(d.body).toContain('filed as an amendment on your authority');
    expect(d.body).toContain('turns stale');
    expect(d.okText).toBe('File the amendment');
  });

  it('drawing a rests-on edge that already exists files nothing', () => {
    expect(decide({ op: 'create', sourceKind: 'assumption', targetKind: 'proposition', purpose: 'required for', restsOn: ['a1'], assumptionId: 'a1' })).toEqual({ case: 'rests', restsOn: ['a1'], already: true });
  });

  it('deleting the engine\'s rests-on edge is the amendment that removes the assumption', () => {
    const d = decide({ op: 'delete', sourceKind: 'assumption', targetKind: 'proposition', purpose: 'required for', engineEdge: true, restsOn: ['a1', 'a2'], assumptionId: 'a1' });
    expect(d.case).toBe('rests');
    expect(d.restsOn).toEqual(['a2']);
    expect(d.title).toBe('Remove from what the prop rests on?');
  });

  it('the engine\'s other edges are not changed or deleted here, and the modal says what they record', () => {
    const sup = decide({ op: 'delete', sourceKind: 'proposition', targetKind: 'proposition', purpose: 'supersedes', engineEdge: true });
    expect(sup.case).toBe('record');
    expect(sup.body).toContain('records a revision of the prop');
    expect(sup.body).toContain('not deleted here');
    const con = decide({ op: 'change', sourceKind: 'finding', targetKind: 'proposition', purpose: 'contradicts', engineEdge: true });
    expect(con.case).toBe('record');
    expect(con.body).toContain('records a finding');
    expect(con.body).toContain('not changed here');
    // Retyping the engine's rests-on edge is not an amendment either: only
    // drawing or deleting it is.
    const rests = decide({ op: 'change', sourceKind: 'assumption', targetKind: 'proposition', purpose: 'related to', engineEdge: true, restsOn: ['a1'], assumptionId: 'a1' });
    expect(rests.case).toBe('record');
  });

  it('a "related to" edge from an assumption, or any edge from an ordinary node to an engine node, stays the person\'s — drawn or changed only once they say so', () => {
    const rel = decide({ op: 'create', sourceKind: 'assumption', targetKind: 'proposition', purpose: 'related to', assumptionId: 'a1' });
    expect(rel.case).toBe('own');
    expect(rel.body).toContain("the engine won't see it");
    expect(rel.okText).toBe('Draw it');
    const task = decide({ op: 'create', sourceKind: null, targetKind: 'proposition', purpose: 'required for' });
    expect(task.case).toBe('own');
    const chg = decide({ op: 'change', sourceKind: null, targetKind: 'finding', purpose: 'related to' });
    expect(chg.case).toBe('own');
    expect(chg.okText).toBe('Change it');
  });

  it('deleting a person\'s own edge that touches an engine node needs no word from the engine', () => {
    expect(decide({ op: 'delete', sourceKind: null, targetKind: 'proposition', purpose: 'related to' })).toEqual({ case: 'plain' });
    expect(decide({ op: 'delete', sourceKind: 'assumption', targetKind: 'proposition', purpose: 'required for', engineEdge: false, assumptionId: 'a1' })).toEqual({ case: 'plain' });
  });
});
