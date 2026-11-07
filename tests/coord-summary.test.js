// One data model, S2a — the panel's plain-words summary of a coordination
// node's document (public/coord-summary.js). Pins what the panel shows and
// that nothing token-named ever reaches the fold-out.
import { describe, it, expect } from 'vitest';
import { summarize, documentText, kindWords, COORD_NOTE } from '../public/coord-summary.js';

const T0 = Date.UTC(2026, 10, 6, 12, 0, 0);

describe('summarize', () => {
  it('a held proposition: what it is, who holds it and until when, scope, pushes, landing', () => {
    const rows = summarize({
      id: 'c1', kind: 'proposition', statement: 'uses dates', status: 'claimed',
      scope: ['src/d/**'], line: 'main', repo: 'shop',
      lease: { holder: 'agent-7', expiresAt: T0 + 60_000 },
      pushes: ['0123456789abcdef0123'], landing: { status: 'queued' }, contradicted: ['f2'],
    }, T0);
    const m = Object.fromEntries(rows.map((r) => [r.label, r.value]));
    expect(m['What it is']).toMatch(/^Proposition — /);
    expect(m['Engine id']).toBe('c1');
    expect(m["Engine's status"]).toBe('claimed');
    expect(m['Held by']).toBe('agent-7 — until 2026-11-06 12:01:00Z');
    expect(m['May change']).toBe('src/d/**');
    expect(m['Pushes']).toBe('1, last 0123456789ab');
    expect(m['Landing']).toBe('queued');
    expect(m['Contradicted by']).toBe('f2');
    expect(rows.map((r) => r.label)[0]).toBe('What it is');
  });

  it('a lease that has run out says so; an open proposition is held by nobody', () => {
    const held = summarize({ kind: 'proposition', id: 'c1', lease: { holder: 'a', expiresAt: T0 - 1 } }, T0);
    expect(held.find((r) => r.label === 'Held by').value).toMatch(/\(run out\)$/);
    const open = summarize({ kind: 'proposition', id: 'c2', status: 'open' }, T0);
    expect(open.find((r) => r.label === 'Held by').value).toBe('nobody');
  });

  it('a finding, a decision and a line each get their own rows', () => {
    const f = Object.fromEntries(summarize({ kind: 'finding', id: 'f1', effect: 'contradicts', finder: 'c1', targets: ['c2', 'c3'], where: 'c2' }, T0).map((r) => [r.label, r.value]));
    expect(f['Effect']).toBe('contradicts');
    expect(f['Targets']).toBe('c2, c3');
    expect(f['Routed to']).toBe('c2');
    const d = Object.fromEntries(summarize({ kind: 'decision', id: 'd1', deadline: T0, defaultAction: 'park-investigation', status: 'todo' }, T0).map((r) => [r.label, r.value]));
    expect(d['Deadline']).toBe('2026-11-06 12:00:00Z');
    expect(d['If nobody answers']).toBe('park-investigation');
    const l = Object.fromEntries(summarize({ name: 'main', head: 'abcdef1234567890', served: true, landing: { proposition: 'c1' } }, T0).map((r) => [r.label, r.value]));
    expect(l['What it is']).toMatch(/^Line — /);
    expect(l['Head']).toBe('abcdef123456');
    expect(l['Served']).toBe('yes');
    expect(l['Landing']).toBe('landing c1');
  });

  it('nothing and junk give no rows', () => {
    expect(summarize(null)).toEqual([]);
    expect(summarize('x')).toEqual([]);
    expect(summarize({})).toEqual([{ label: 'What it is', value: 'Coordination record' }]);
  });
});

describe('documentText', () => {
  it('pretty-prints the document and drops every token-named key at any depth', () => {
    const text = documentText({ id: 'c1', lease: { holder: 'a', token: 'SECRET', git: { tokenId: 'T1', expiresAt: 1 }, retired: [{ tokenId: 'T0' }] } });
    expect(text).toContain('"holder": "a"');
    expect(text).not.toContain('SECRET');
    expect(text).not.toContain('tokenId');
    expect(text).not.toContain('"token"');
    expect(JSON.parse(text).lease.git).toEqual({ expiresAt: 1 });
  });
});

describe('words', () => {
  it('every kind has plain words and the note names the way to steer', () => {
    for (const k of ['proposition', 'finding', 'assumption', 'decision', 'line']) expect(kindWords(k)).toMatch(/ — /);
    expect(kindWords('other')).toBe('other');
    expect(COORD_NOTE).toMatch(/finding/);
    expect(COORD_NOTE).toMatch(/decision/);
  });
});
