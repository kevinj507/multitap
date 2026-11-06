import { describe, it, expect } from 'vitest';
import {
  resolveSource, tagFor, matchTypeFor, mapServerResults, locateApprox, isWeakResultSet,
} from '../public/search-kb.js';

const cand = (over = {}) => ({ taskId: 1, score: 0.5, source: 'lexical', meta: {}, ...over });

describe('resolveSource', () => {
  it('passes plain sources through', () => {
    expect(resolveSource(cand({ source: 'dense' }))).toBe('dense');
    expect(resolveSource(cand({ source: 'graph' }))).toBe('graph');
  });
  it('looks through the reranker to the original source', () => {
    expect(resolveSource(cand({ source: 'rerank', meta: { rerankedFrom: 'dense' } }))).toBe('dense');
    expect(resolveSource(cand({ source: 'rerank', meta: { rerankedFrom: 'graph' } }))).toBe('graph');
    expect(resolveSource(cand({ source: 'rerank', meta: {} }))).toBe('lexical');
  });
});

describe('tagFor / matchTypeFor', () => {
  it('lexical hits keep their field; title flashes, body highlights the word', () => {
    const title = cand({ meta: { field: 'title' } });
    const body = cand({ meta: { field: 'body' } });
    const desc = cand({ meta: { field: 'description' } });
    expect([tagFor(title), matchTypeFor(title)]).toEqual(['title', 'title']);
    expect([tagFor(body), matchTypeFor(body)]).toEqual(['body', 'word']);
    // description lives in frontmatter — nothing in the panel body to mark.
    expect([tagFor(desc), matchTypeFor(desc)]).toEqual(['description', 'none']);
  });
  it('dense → semantic/chunk, graph → related/none, through rerank too', () => {
    const dense = cand({ source: 'rerank', meta: { rerankedFrom: 'dense' } });
    const graph = cand({ source: 'graph' });
    expect([tagFor(dense), matchTypeFor(dense)]).toEqual(['semantic', 'chunk']);
    expect([tagFor(graph), matchTypeFor(graph)]).toEqual(['related', 'none']);
  });
});

describe('mapServerResults', () => {
  const docs = [
    { id: 1, title: 'Alpha' },
    { id: 2, title: 'Beta' },
  ];
  it('joins titles from the doc cache and keeps the server order', () => {
    const rows = mapServerResults(
      [
        cand({ taskId: 2, source: 'dense', snippet: { text: 'chunk text', ranges: [] } }),
        cand({ taskId: 1, meta: { field: 'title' }, snippet: { text: 'Alpha', ranges: [[0, 5]] } }),
      ],
      docs,
    );
    expect(rows.map((r) => r.id)).toEqual([2, 1]);
    expect(rows[0].doc.title).toBe('Beta');
    expect(rows[0].field).toBe('semantic');
    expect(rows[1].snippet.ranges).toEqual([[0, 5]]);
  });
  it('drops candidates whose node is no longer in the doc cache', () => {
    const rows = mapServerResults([cand({ taskId: 99 })], docs);
    expect(rows).toEqual([]);
  });
  it('falls back to the candidate title for cross-graph hits and attributes the graph', () => {
    const rows = mapServerResults(
      [cand({ taskId: 99, title: 'Foreign note', graphId: 'g2' })],
      docs,
      { graphs: { g2: 'Other graph' } },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].doc.title).toBe('Foreign note');
    expect(rows[0].gid).toBe('g2');
    expect(rows[0].graphName).toBe('Other graph');
  });
  it('still drops candidates with neither a cached doc nor a title', () => {
    expect(mapServerResults([cand({ taskId: 99, graphId: 'g2' })], docs, { graphs: { g2: 'x' } })).toEqual([]);
  });
  it('treats empty snippets as absent', () => {
    const rows = mapServerResults([cand({ taskId: 1, snippet: { text: '', ranges: [] } })], docs);
    expect(rows[0].snippet).toBeNull();
  });
});

describe('isWeakResultSet', () => {
  it('flags a list whose best rerank score is below the threshold', () => {
    const weak = [cand({ meta: { rerankScore: 0.02 } }), cand({ meta: { rerankScore: 0.001 } })];
    const strong = [cand({ meta: { rerankScore: 0.91 } }), cand({ meta: { rerankScore: 0.003 } })];
    expect(isWeakResultSet(weak)).toBe(true);
    expect(isWeakResultSet(strong)).toBe(false);
  });
  it('never flags when rerank did not run (no scores present)', () => {
    expect(isWeakResultSet([cand(), cand()])).toBe(false);
    expect(isWeakResultSet([])).toBe(false);
  });
});

describe('locateApprox', () => {
  it('finds raw-markdown chunk text inside rendered text (syntax stripped)', () => {
    const rendered = 'Power constraints\nDatacenter buildout is gated by grid interconnect queues and transformer lead times in every region.';
    const chunk = '## Power constraints\n\n- Datacenter buildout is **gated** by grid interconnect queues';
    const loc = locateApprox(rendered, chunk);
    expect(loc).not.toBeNull();
    expect(rendered.slice(loc.start, loc.end)).toBe(
      'Power constraints\nDatacenter buildout is gated by grid interconnect queues',
    );
  });
  it('shrinks the anchor when the chunk start is missing from the render', () => {
    const rendered = 'totally different heading. queues and transformer lead times dominate.';
    const chunk = 'queues and transformer lead times';
    const loc = locateApprox(rendered, chunk);
    expect(rendered.slice(loc.start, loc.end)).toBe('queues and transformer lead times');
  });
  it('is case- and punctuation-insensitive', () => {
    const loc = locateApprox('The NVIDIA H100, at scale.', 'nvidia h100 at SCALE');
    expect(loc).not.toBeNull();
    expect('The NVIDIA H100, at scale.'.slice(loc.start, loc.end)).toBe('NVIDIA H100, at scale');
  });
  it('returns null when nothing matches or inputs are empty', () => {
    expect(locateApprox('alpha beta', 'gamma delta epsilon zeta')).toBeNull();
    expect(locateApprox('', 'x')).toBeNull();
    expect(locateApprox('x', '')).toBeNull();
  });
});
