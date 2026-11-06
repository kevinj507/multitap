import * as selectionState from '../src/selectionState.js';

beforeEach(() => {
  selectionState._resetForTest();
});

describe('selectionState module (unit)', () => {
  it('setSelection sanitizes id arrays and emits a changed event', () => {
    const events = [];
    selectionState.onChange((g, op, p) => events.push({ g, op, w: p.writer_id, n: p.node_ids }));
    const r = selectionState.setSelection('g1', 'w1', {
      node_ids: [1, 2, 'bad', 0, -3, 4.5, 5],
      edge_ids: [],
      editing: { kind: 'node', id: 1 },
    });
    expect(r.node_ids).toEqual([1, 2, 5]); // strings/zero/negatives/floats dropped
    expect(r.editing).toEqual({ kind: 'node', id: 1 });
    expect(events).toEqual([{ g: 'g1', op: 'changed', w: 'w1', n: [1, 2, 5] }]);
  });

  it('rejects malformed editing/cursor_anchor shapes as null', () => {
    const r = selectionState.setSelection('g1', 'w1', {
      editing: { kind: 'banana', id: 1 },
      cursor_anchor: { kind: 'node', id: 'nope' },
    });
    expect(r.editing).toBeNull();
    expect(r.cursor_anchor).toBeNull();
  });

  it('rate-limits updates within 50ms from the same writer', async () => {
    const a = selectionState.setSelection('g1', 'w1', { node_ids: [1] });
    const b = selectionState.setSelection('g1', 'w1', { node_ids: [9] });
    expect(b).toBe(a); // dropped: returned the previous row, not a new one
    expect(selectionState.getSnapshot('g1')[0].node_ids).toEqual([1]);
  });

  it('clearSelection returns true once and false thereafter (idempotent)', () => {
    selectionState.setSelection('g1', 'w1', { node_ids: [1] });
    expect(selectionState.clearSelection('g1', 'w1')).toBe(true);
    expect(selectionState.clearSelection('g1', 'w1')).toBe(false);
  });

  it('clearSelection emits a cleared event', () => {
    const events = [];
    selectionState.setSelection('g1', 'w1', { node_ids: [1] });
    selectionState.onChange((g, op, p) => events.push({ op, w: p.writer_id }));
    selectionState.clearSelection('g1', 'w1');
    expect(events).toEqual([{ op: 'cleared', w: 'w1' }]);
  });

  it('getSnapshot returns one entry per writer with the right shape', () => {
    selectionState.setSelection('g1', 'w1', { node_ids: [1] });
    // Different graph keeps separate state.
    selectionState.setSelection('g2', 'w1', { node_ids: [99] });
    const s1 = selectionState.getSnapshot('g1');
    const s2 = selectionState.getSnapshot('g2');
    expect(s1).toHaveLength(1);
    expect(s2).toHaveLength(1);
    expect(s1[0]).toMatchObject({ writer_id: 'w1', node_ids: [1] });
    expect(s2[0]).toMatchObject({ writer_id: 'w1', node_ids: [99] });
  });

  it('returns null when called without writerId or graphId', () => {
    expect(selectionState.setSelection('', 'w1', {})).toBeNull();
    expect(selectionState.setSelection('g1', '', {})).toBeNull();
  });
});
