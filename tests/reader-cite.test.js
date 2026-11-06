// E16 citations — the pure citation parser. The DOM transform (superscripts,
// hover tooltip, References list, click-through) is verified in the running app
// (no jsdom harness); this covers the shared, DOM-free logic: which ids get
// cited, in what order, and the numbering.
import { extractCiteIds, numberMap, extractFirstUrl } from '../public/reader-cite.js';

describe('extractCiteIds (E16 citations)', () => {
  it('extracts cited ids in first-appearance order, de-duplicated', () => {
    const md = 'A[[cite:3171]] B[[cite:3200]] C[[cite:3171]] D[[cite:3164]]';
    expect(extractCiteIds(md)).toEqual(['3171', '3200', '3164']);
  });

  it('handles multi-id markers like [[cite:10, 20]]', () => {
    expect(extractCiteIds('x[[cite:10, 20]] y[[cite:20,30]]')).toEqual(['10', '20', '30']);
  });

  it('ignores non-numeric or malformed markers', () => {
    expect(extractCiteIds('[[cite:abc]] [[cite:]] [[cite: 42 ]]')).toEqual(['42']);
  });

  it('returns [] for empty / marker-less / bad input', () => {
    expect(extractCiteIds('no citations here')).toEqual([]);
    expect(extractCiteIds('')).toEqual([]);
    expect(extractCiteIds(null)).toEqual([]);
  });
});

describe('numberMap (E16 citations)', () => {
  it('assigns 1-based numbers in first-appearance order; reused ids keep their number', () => {
    const m = numberMap('a[[cite:9]] b[[cite:5]] c[[cite:9]] d[[cite:7]]');
    expect(m.get('9')).toBe(1);
    expect(m.get('5')).toBe(2);
    expect(m.get('7')).toBe(3);
    expect(m.size).toBe(3);
  });
});

describe('extractFirstUrl (citation tooltip source link)', () => {
  it('reads the bare-url body the research workflow writes for a source node', () => {
    // research.workflow.js writes a reference node's body as literally `${s.url || ''}`.
    const body = '---\ntitle: TSMC Q1 2026 call\ntype: reference\n---\nhttps://investor.tsmc.com/q1-2026';
    expect(extractFirstUrl(body)).toBe('https://investor.tsmc.com/q1-2026');
  });

  it('prefers a markdown link target over its label text', () => {
    expect(extractFirstUrl('See [the filing](https://sec.gov/x.htm) for detail.'))
      .toBe('https://sec.gov/x.htm');
  });

  it('reads angle autolinks', () => {
    expect(extractFirstUrl('Source: <https://example.com/a>')).toBe('https://example.com/a');
  });

  it('takes the EARLIEST url whichever form it took', () => {
    expect(extractFirstUrl('https://first.com then [second](https://second.com)'))
      .toBe('https://first.com');
    expect(extractFirstUrl('[first](https://first.com) then https://second.com'))
      .toBe('https://first.com');
  });

  it('drops trailing sentence punctuation but keeps a link target’s parens', () => {
    expect(extractFirstUrl('see https://example.com/page.')).toBe('https://example.com/page');
    expect(extractFirstUrl('[wiki](https://en.wikipedia.org/wiki/Foo_(bar))'))
      .toBe('https://en.wikipedia.org/wiki/Foo_(bar)');
  });

  it('keeps balanced parens in a BARE url but drops prose’s closing paren', () => {
    expect(extractFirstUrl('see https://en.wikipedia.org/wiki/Foo_(bar) for more'))
      .toBe('https://en.wikipedia.org/wiki/Foo_(bar)');
    expect(extractFirstUrl('(see https://example.com/page)')).toBe('https://example.com/page');
  });

  it('leaves an angle autolink exactly as delimited', () => {
    // `>` ends it, so a trailing period inside really is part of the URL.
    expect(extractFirstUrl('<https://example.com/a.>')).toBe('https://example.com/a.');
  });

  it('ignores urls inside fenced code blocks', () => {
    const body = '```\ncurl https://example.com/api\n```\nReal source: https://real.com';
    expect(extractFirstUrl(body)).toBe('https://real.com');
  });

  it('returns null for a source with no url — a normal state, not an error', () => {
    // `${s.url || ''}` yields an empty body for e.g. a first-party derived table.
    expect(extractFirstUrl('---\ntitle: Whop trial-length table\ntype: reference\n---\n')).toBeNull();
    expect(extractFirstUrl('An interview with the founder, no link.')).toBeNull();
    expect(extractFirstUrl('')).toBeNull();
    expect(extractFirstUrl(null)).toBeNull();
  });

  it('never yields a non-http scheme — no javascript: payload can become an href', () => {
    expect(extractFirstUrl('[click](javascript:alert(1))')).toBeNull();
    expect(extractFirstUrl('javascript:alert(1)')).toBeNull();
    expect(extractFirstUrl('[f](file:///etc/passwd)')).toBeNull();
    expect(extractFirstUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
  });
});
