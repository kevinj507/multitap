import { describe, it, expect } from 'vitest';
import { mergeFields } from '../src/merge.js';

describe('mergeFields', () => {
  it('writer-only change applies writer value', () => {
    const base = { title: 'A', status: 'todo' };
    const writer = { title: 'A new', status: 'todo' };
    const current = { title: 'A', status: 'todo' };
    const { merged, conflicts } = mergeFields(base, writer, current, { writerType: 'human', currentWriterType: null });
    expect(merged).toEqual({ title: 'A new', status: 'todo' });
    expect(conflicts).toEqual([]);
  });

  it('other-only change preserves current', () => {
    const base = { title: 'A', status: 'todo' };
    const writer = { title: 'A', status: 'todo' };
    const current = { title: 'A', status: 'done' };
    const { merged, conflicts } = mergeFields(base, writer, current, { writerType: 'human', currentWriterType: 'agent' });
    expect(merged).toEqual({ title: 'A', status: 'done' });
    expect(conflicts).toEqual([]);
  });

  it('disjoint fields merge cleanly', () => {
    const base = { title: 'A', status: 'todo' };
    const writer = { title: 'A new', status: 'todo' };  // writer changed title
    const current = { title: 'A', status: 'done' };       // other changed status
    const { merged, conflicts } = mergeFields(base, writer, current, { writerType: 'human', currentWriterType: 'agent' });
    expect(merged).toEqual({ title: 'A new', status: 'done' });
    expect(conflicts).toEqual([]);
  });

  it('same field, human writer beats agent already applied', () => {
    const base = { status: 'todo' };
    const writer = { status: 'in_progress' };  // human says in_progress
    const current = { status: 'done' };         // agent already wrote done
    const { merged, conflicts } = mergeFields(base, writer, current, { writerType: 'human', currentWriterType: 'agent' });
    expect(merged.status).toBe('in_progress');
    expect(conflicts).toEqual(['status']);
  });

  it('same field, agent writer loses to human already applied', () => {
    const base = { status: 'todo' };
    const writer = { status: 'done' };           // agent says done
    const current = { status: 'in_progress' };   // human already wrote in_progress
    const { merged, conflicts } = mergeFields(base, writer, current, { writerType: 'agent', currentWriterType: 'human' });
    expect(merged.status).toBe('in_progress');
    expect(conflicts).toEqual(['status']);
  });

  it('same field, both human → writer wins (last-write-wins)', () => {
    const base = { title: 'A' };
    const writer = { title: 'A from tab 2' };
    const current = { title: 'A from tab 1' };
    const { merged, conflicts } = mergeFields(base, writer, current, { writerType: 'human', currentWriterType: 'human' });
    expect(merged.title).toBe('A from tab 2');
    expect(conflicts).toEqual(['title']);
  });

  it('same field, both agent → writer wins (last-write-wins)', () => {
    const base = { status: 'todo' };
    const writer = { status: 'review' };
    const current = { status: 'done' };
    const { merged, conflicts } = mergeFields(base, writer, current, { writerType: 'agent', currentWriterType: 'agent' });
    expect(merged.status).toBe('review');
    expect(conflicts).toEqual(['status']);
  });

  it('same field, identical values from both → not a conflict', () => {
    const base = { status: 'todo' };
    const writer = { status: 'done' };
    const current = { status: 'done' };
    const { merged, conflicts } = mergeFields(base, writer, current, { writerType: 'human', currentWriterType: 'agent' });
    expect(merged.status).toBe('done');
    expect(conflicts).toEqual([]);
  });

  it('mix of disjoint + same-field conflict resolves field-by-field', () => {
    const base = { title: 'A', status: 'todo', body: 'old body' };
    const writer = { title: 'A new', status: 'in_progress', body: 'old body' };
    const current = { title: 'A', status: 'done', body: 'agent updated body' };
    const { merged, conflicts } = mergeFields(base, writer, current, { writerType: 'human', currentWriterType: 'agent' });
    expect(merged).toEqual({
      title: 'A new',
      status: 'in_progress',
      body: 'agent updated body',
    });
    expect(conflicts).toEqual(['status']);
  });

  it('deep object value (settings JSONB) handled by deep equality', () => {
    const base = { settings: { font: 'inter' } };
    const writer = { settings: { font: 'inter' } };
    const current = { settings: { font: 'inter' } };
    const { merged, conflicts } = mergeFields(base, writer, current, { writerType: 'human', currentWriterType: null });
    expect(merged.settings).toEqual({ font: 'inter' });
    expect(conflicts).toEqual([]);
  });

  it('deep object diff: writer changes nested settings', () => {
    const base = { settings: { font: 'inter' } };
    const writer = { settings: { font: 'garamond' } };
    const current = { settings: { font: 'inter' } };
    const { merged, conflicts } = mergeFields(base, writer, current, { writerType: 'human', currentWriterType: null });
    expect(merged.settings).toEqual({ font: 'garamond' });
    expect(conflicts).toEqual([]);
  });

  it('writer adds a new key not in base or current', () => {
    const base = { title: 'A' };
    const writer = { title: 'A', description: 'a desc' };
    const current = { title: 'A' };
    const { merged, conflicts } = mergeFields(base, writer, current, { writerType: 'human', currentWriterType: null });
    expect(merged).toEqual({ title: 'A', description: 'a desc' });
    expect(conflicts).toEqual([]);
  });

  it('other adds a new key not in base or writer', () => {
    const base = { title: 'A' };
    const writer = { title: 'A new' };
    const current = { title: 'A', description: 'agent added' };
    const { merged, conflicts } = mergeFields(base, writer, current, { writerType: 'human', currentWriterType: 'agent' });
    expect(merged).toEqual({ title: 'A new', description: 'agent added' });
    expect(conflicts).toEqual([]);
  });

  describe('owner-agent precedence (agent-vs-agent)', () => {
    const OWNER = '11111111-1111-1111-1111-111111111111';
    const OTHER = '22222222-2222-2222-2222-222222222222';
    const ELSE = '33333333-3333-3333-3333-333333333333';
    const base = { title: 'A' };
    const writer = { title: 'W' };
    const current = { title: 'C' };

    it('writer is graph-owner agent → writer wins', () => {
      const { merged } = mergeFields(base, writer, current, {
        writerType: 'agent', currentWriterType: 'agent',
        writerOwnerId: OWNER, currentOwnerId: OTHER, graphOwnerId: OWNER,
      });
      expect(merged.title).toBe('W');
    });

    it('current is graph-owner agent → current preserved (writer drops)', () => {
      const { merged } = mergeFields(base, writer, current, {
        writerType: 'agent', currentWriterType: 'agent',
        writerOwnerId: OTHER, currentOwnerId: OWNER, graphOwnerId: OWNER,
      });
      expect(merged.title).toBe('C');
    });

    it('both agents are owner → last-write-wins (writer)', () => {
      const { merged } = mergeFields(base, writer, current, {
        writerType: 'agent', currentWriterType: 'agent',
        writerOwnerId: OWNER, currentOwnerId: OWNER, graphOwnerId: OWNER,
      });
      expect(merged.title).toBe('W');
    });

    it('neither agent is owner → last-write-wins (writer)', () => {
      const { merged } = mergeFields(base, writer, current, {
        writerType: 'agent', currentWriterType: 'agent',
        writerOwnerId: OTHER, currentOwnerId: ELSE, graphOwnerId: OWNER,
      });
      expect(merged.title).toBe('W');
    });

    it('graphOwnerId unknown → falls through to last-write-wins (back-compat)', () => {
      const { merged } = mergeFields(base, writer, current, {
        writerType: 'agent', currentWriterType: 'agent',
        writerOwnerId: OWNER, currentOwnerId: OTHER, graphOwnerId: null,
      });
      expect(merged.title).toBe('W');
    });

    it('owner ids do not affect human-vs-agent rule (human still wins)', () => {
      const { merged } = mergeFields(base, writer, current, {
        writerType: 'human', currentWriterType: 'agent',
        writerOwnerId: OTHER, currentOwnerId: OWNER, graphOwnerId: OWNER,
      });
      // Even though current is the owner-agent, the human writer wins.
      expect(merged.title).toBe('W');
    });
  });

  describe('protectedFromAgentRemoval', () => {
    it('agent omitting a protected key preserves current value', () => {
      // The drag-then-loop scenario: base had x=100, user dragged so
      // current.x=250, agent rebuilds frontmatter without x.
      const base = { title: 'A', status: 'todo', x: 100, y: 200 };
      const writer = { title: 'A', status: 'in_progress' };
      const current = { title: 'A', status: 'todo', x: 250, y: 380 };
      const { merged, conflicts } = mergeFields(base, writer, current, {
        writerType: 'agent',
        currentWriterType: 'human',
        protectedFromAgentRemoval: ['x', 'y', 'color'],
      });
      expect(merged.x).toBe(250);
      expect(merged.y).toBe(380);
      expect(merged.status).toBe('in_progress');
      expect(conflicts).toEqual([]);
    });

    it('agent explicitly setting protected key to null bypasses protection', () => {
      // Escape hatch: an agent that really does want to clear x sends null
      // explicitly. `w === null` is defined, so the protection short-circuit
      // doesn't fire and the merge applies the clear.
      const base = { x: 100 };
      const writer = { x: null };
      const current = { x: 100 };
      const { merged } = mergeFields(base, writer, current, {
        writerType: 'agent',
        currentWriterType: 'human',
        protectedFromAgentRemoval: ['x'],
      });
      expect(merged.x).toBe(null);
    });

    it('human writer is not protected — omission still removes the key', () => {
      // Protection only applies to writerType === 'agent'. Humans always
      // know what they're sending (the canvas always includes x/y).
      const base = { x: 100 };
      const writer = {};
      const current = { x: 100 };
      const { merged } = mergeFields(base, writer, current, {
        writerType: 'human',
        currentWriterType: 'human',
        protectedFromAgentRemoval: ['x'],
      });
      expect(merged.x).toBe(undefined);
    });

    it('unprotected key omission still removes (normal merge)', () => {
      // Only keys in the protected list are special. Custom frontmatter
      // keys the agent drops are still treated as removals.
      const base = { custom: 'value' };
      const writer = {};
      const current = { custom: 'value' };
      const { merged } = mergeFields(base, writer, current, {
        writerType: 'agent',
        currentWriterType: 'human',
        protectedFromAgentRemoval: ['x', 'y'],
      });
      expect(merged.custom).toBe(undefined);
    });

    it('protection no-ops when base also did not have the key', () => {
      // Agent omits x AND base had no x — nothing to protect. Falls
      // through to normal merge (writerChanged is false, current wins).
      const base = { title: 'A' };
      const writer = { title: 'A new' };
      const current = { title: 'A', x: 999 };
      const { merged } = mergeFields(base, writer, current, {
        writerType: 'agent',
        currentWriterType: 'human',
        protectedFromAgentRemoval: ['x'],
      });
      expect(merged.x).toBe(999);
      expect(merged.title).toBe('A new');
    });

    it('agent explicitly updating a protected key still wins (when no human conflict)', () => {
      // Protection prevents *implicit removal*, not normal field updates.
      // Agent sending an explicit new x value should land normally.
      const base = { x: 100 };
      const writer = { x: 500 };
      const current = { x: 100 };
      const { merged } = mergeFields(base, writer, current, {
        writerType: 'agent',
        currentWriterType: 'agent',
        protectedFromAgentRemoval: ['x'],
      });
      expect(merged.x).toBe(500);
    });
  });
});
