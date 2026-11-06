// Route resolution (the /graph/<id> silent-misdirection fix). Pins the
// contract of public/route-parse.js: alias shapes resolve to the same graph
// with a canonical path the caller replaceStates into the bar, and unknown
// paths are told apart from root so the boot fallback can't leave a bogus
// path displayed over an unrelated graph.
import { describe, it, expect } from 'vitest';
import { resolveRoute, resolveNodeRoute, nodeHref, nodeGraphHref } from '../public/route-parse.js';

describe('resolveRoute', () => {
  it('canonical /g/<id> resolves, canonical path round-trips', () => {
    expect(resolveRoute('/g/abc123')).toEqual({ kind: 'graph', gid: 'abc123', canonical: '/g/abc123' });
    expect(resolveRoute('/g/abc123/')).toEqual({ kind: 'graph', gid: 'abc123', canonical: '/g/abc123' });
  });

  it('alias shapes /graph/<id> and /graphs/<id> resolve to the same canonical', () => {
    expect(resolveRoute('/graph/j4kw7xvzvaxqugcu')).toEqual({
      kind: 'graph', gid: 'j4kw7xvzvaxqugcu', canonical: '/g/j4kw7xvzvaxqugcu',
    });
    expect(resolveRoute('/graphs/abc123')).toEqual({ kind: 'graph', gid: 'abc123', canonical: '/g/abc123' });
  });

  it('root is root, not unknown', () => {
    expect(resolveRoute('/')).toEqual({ kind: 'root' });
    expect(resolveRoute('')).toEqual({ kind: 'root' });
  });

  it('everything else is unknown — never quietly treated as a graph or root', () => {
    expect(resolveRoute('/gr/abc')).toEqual({ kind: 'unknown' });
    expect(resolveRoute('/g/')).toEqual({ kind: 'unknown' });
    expect(resolveRoute('/g/ABC')).toEqual({ kind: 'unknown' }); // ids are [a-z0-9]
    expect(resolveRoute('/g/abc/extra')).toEqual({ kind: 'unknown' });
    expect(resolveRoute('/reports')).toEqual({ kind: 'unknown' });
  });
});

describe('resolveNodeRoute (single-node permalink)', () => {
  it('resolves the canonical query shape /g/<gid>?node=<id>', () => {
    expect(resolveNodeRoute('/g/abc123', '?node=3171'))
      .toEqual({ gid: 'abc123', id: '3171', canonical: '/g/abc123?node=3171' });
    expect(resolveNodeRoute('/g/abc123/', '?node=3171'))
      .toEqual({ gid: 'abc123', id: '3171', canonical: '/g/abc123?node=3171' });
    // Other params don't confuse it.
    expect(resolveNodeRoute('/g/abc123', '?utm=x&node=7'))
      .toEqual({ gid: 'abc123', id: '7', canonical: '/g/abc123?node=7' });
  });

  it('still recognizes the retired /n/ path shape, canonicalizing to the query shape', () => {
    expect(resolveNodeRoute('/g/abc123/n/3171'))
      .toEqual({ gid: 'abc123', id: '3171', canonical: '/g/abc123?node=3171' });
    expect(resolveNodeRoute('/g/abc123/n/3171/'))
      .toEqual({ gid: 'abc123', id: '3171', canonical: '/g/abc123?node=3171' });
  });

  it('returns null for anything else, so a bad URL can never render a node page', () => {
    expect(resolveNodeRoute('/g/abc123')).toBeNull();            // no node param
    expect(resolveNodeRoute('/g/abc123', '')).toBeNull();
    expect(resolveNodeRoute('/g/abc123', '?node=')).toBeNull();
    expect(resolveNodeRoute('/g/abc123', '?node=abc')).toBeNull(); // ids are numeric
    expect(resolveNodeRoute('/g/ABC', '?node=1')).toBeNull();      // gids are [a-z0-9]
    expect(resolveNodeRoute('/graph/abc123', '?node=1')).toBeNull(); // canonical /g only
    expect(resolveNodeRoute('/g/abc123/n/')).toBeNull();
    expect(resolveNodeRoute('/g/abc123/n/abc')).toBeNull();
    expect(resolveNodeRoute('/g/abc/n/1/extra')).toBeNull();
    expect(resolveNodeRoute('')).toBeNull();
  });

  it('a graph PATH is only a node link when the node param rides along', () => {
    // The same pathname serves both surfaces; the query decides. The server
    // (src/app.js) additionally requires NO explicit ?view= to serve the
    // reading page — ?view=graph/reader open the SPA.
    for (const p of ['/g/abc123', '/graph/abc123', '/', '/nope']) {
      const asGraph = resolveRoute(p).kind === 'graph';
      const asNode = resolveNodeRoute(p) !== null;
      expect(asNode).toBe(false);
      void asGraph; // pathname-level: node pages never claim a bare path
    }
    expect(resolveNodeRoute('/g/abc123/n/7')).not.toBeNull(); // legacy path still claims
  });
});

describe('nodeHref / nodeGraphHref', () => {
  it('nodeHref builds the shareable permalink — always the reading page', () => {
    expect(nodeHref('abc123', 3171)).toBe('/g/abc123?node=3171');
  });

  it('nodeGraphHref is the same node opened in the SPA canvas, selected', () => {
    expect(nodeGraphHref('abc123', 3171)).toBe('/g/abc123?node=3171&view=graph');
  });

  it('encodes its inputs', () => {
    expect(nodeHref('a b', '1&2')).toBe('/g/a%20b?node=1%262');
  });
});
