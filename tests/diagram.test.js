// Server-derived report diagrams (src/diagram.js). Pure unit tests: layout
// determinism, sanitizer safety, theme-token discipline, caps, and the error
// contract the route maps to 404s.
import { buildDiagram, wrapTitle, KINDS, DEFAULT_MAX } from '../src/diagram.js';

const node = (id, title, extra = {}) => ({ id, title, status: 'todo', meta: {}, ...extra });
const edge = (source, target, purpose) => ({ source, target, purpose });

// A small evidence neighborhood around node 1.
const FAN_NODES = [
  node(1, 'Entity as query', { meta: { significance: 0.9 } }),
  node(2, 'Read-time resolution wins', { meta: { significance: 0.8 } }),
  node(3, 'Materialization is cheap', { status: 'done' }),
  node(4, 'Cache-aware routing'),
  node(5, 'Downstream claim'),
];
const FAN_LINKS = [
  edge(2, 1, 'supports'),
  edge(3, 1, 'contradicts'),
  edge(1, 5, 'supports'),
  edge(4, 1, 'related to'), // never drawn — fan is supports/contradicts only
];

const CHAIN_NODES = [1, 2, 3, 4, 5].map((i) => node(i, `Step ${i}`));
const CHAIN_LINKS = [
  edge(1, 2, 'required for'),
  edge(2, 3, 'required for'),
  edge(3, 4, 'required for'),
  edge(4, 5, 'required for'),
];

describe('wrapTitle', () => {
  it('wraps greedily and ellipsizes overflow', () => {
    expect(wrapTitle('one two three', 10, 2)).toEqual(['one two', 'three']);
    const lines = wrapTitle('a'.repeat(50), 20, 2);
    expect(lines).toHaveLength(1);
    expect(lines[0].endsWith('…')).toBe(true);
    expect(lines[0].length).toBeLessThanOrEqual(20);
  });
  it('never returns empty', () => {
    expect(wrapTitle('', 20, 2)).toEqual(['—']);
  });
});

describe('buildDiagram — shared contract', () => {
  const builds = [
    ['fan', { kind: 'fan', nodes: FAN_NODES, links: FAN_LINKS, seed: 1, gid: 'gabc1234' }],
    ['chain', { kind: 'chain', nodes: CHAIN_NODES, links: CHAIN_LINKS, seed: 3, gid: 'gabc1234' }],
    [
      'cluster',
      {
        kind: 'cluster',
        nodes: FAN_NODES,
        links: [edge(2, 1, 'supports'), edge(3, 1, 'contradicts'), edge(4, 1, 'required for')],
        seed: 1,
        gid: 'gabc1234',
      },
    ],
  ];

  it.each(builds)('%s: well-formed themed figure with no sanitizer-hostile content', (_, args) => {
    const { markdown, stats, error } = buildDiagram(args);
    expect(error).toBeUndefined();
    expect(markdown.startsWith('<figure class="gt-fig">')).toBe(true);
    expect(markdown.endsWith('</figure>')).toBe(true);
    expect(markdown).toMatch(/<svg viewBox="0 0 \d+ \d+(\.\d)?" width="100%" role="img" aria-label="/);
    expect(markdown).toContain('<figcaption>');
    // No blank lines — a blank line splits the CommonMark html block.
    expect(markdown).not.toMatch(/\n\s*\n/);
    // Sanitizer-hostile tags never emitted (svg <title> dies by tag name).
    expect(markdown).not.toMatch(/<(style|script|title|defs|marker)\b/i);
    // Theme discipline: no literal hex; every stroke/fill is a token or none.
    expect(markdown).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    for (const m of markdown.matchAll(/(?:stroke|fill)="([^"]+)"/g)) {
      expect(m[1]).toMatch(/^(var\(--chart-[\w-]+\)|none)$/);
    }
    expect(stats.kind).toBe(args.kind);
  });

  it.each(builds)('%s: deterministic', (_, args) => {
    expect(buildDiagram(args)).toEqual(buildDiagram(args));
  });

  it('escapes hostile titles', () => {
    const hostile = [node(1, 'x<b>&"y"'), node(2, 'other')];
    const { markdown } = buildDiagram({
      kind: 'fan',
      nodes: hostile,
      links: [edge(2, 1, 'supports')],
      seed: 1,
    });
    expect(markdown).not.toContain('<b>');
    expect(markdown).toContain('x&lt;b&gt;&amp;&quot;y&quot;');
  });

  it('links node titles when gid is provided, plain text otherwise', () => {
    const args = { kind: 'fan', nodes: FAN_NODES, links: FAN_LINKS, seed: 1 };
    expect(buildDiagram({ ...args, gid: 'gabc1234' }).markdown).toContain('<a href="/g/gabc1234?node=1">');
    expect(buildDiagram(args).markdown).not.toContain('<a ');
  });

  it('rejects unknown kinds', () => {
    expect(buildDiagram({ kind: 'pie', nodes: [], links: [], seed: 1 }).error).toMatch(/kind must be/);
    expect(KINDS).toEqual(['fan', 'chain', 'cluster']);
  });
});

describe('fan', () => {
  it('draws supports solid and contradicts dashed, skips related-to', () => {
    const { markdown, stats } = buildDiagram({ kind: 'fan', nodes: FAN_NODES, links: FAN_LINKS, seed: 1 });
    expect(markdown).toContain('stroke="var(--chart-3)"'); // supports
    expect(markdown).toMatch(/stroke="var\(--chart-6\)"[^/]*stroke-dasharray="6 4"/); // contradicts
    expect(markdown).not.toContain('Cache-aware routing'); // related to → excluded
    expect(stats.byPurpose).toEqual({ supports: 2, contradicts: 1 });
    expect(markdown).toContain('gt-legend');
  });

  it('caps with +N more and reports omissions', () => {
    const many = [node(1, 'hub')];
    const links = [];
    for (let i = 2; i <= 20; i++) {
      many.push(node(i, `Evidence ${i}`, { meta: { significance: i / 100 } }));
      links.push(edge(i, 1, 'supports'));
    }
    const { markdown, stats } = buildDiagram({ kind: 'fan', nodes: many, links, seed: 1 });
    expect(stats.shown).toBe(DEFAULT_MAX.fan);
    expect(stats.omitted).toBe(19 - (DEFAULT_MAX.fan - 1));
    expect(markdown).toContain(`+${stats.omitted} more`);
    // Highest-significance evidence survives the cut.
    expect(markdown).toContain('Evidence 20');
    expect(markdown).not.toContain('Evidence 2<');
  });

  it('errors on missing seed and on a seed with no evidence edges', () => {
    expect(buildDiagram({ kind: 'fan', nodes: FAN_NODES, links: FAN_LINKS, seed: 99 }).error).toMatch(/not found/);
    expect(
      buildDiagram({ kind: 'fan', nodes: FAN_NODES, links: [edge(4, 1, 'related to')], seed: 1 }).error
    ).toMatch(/no supports\/contradicts/);
  });
});

describe('chain', () => {
  it('walks the full chain through the seed, top to bottom', () => {
    const { markdown, stats } = buildDiagram({ kind: 'chain', nodes: CHAIN_NODES, links: CHAIN_LINKS, seed: 3 });
    expect(stats.shown).toBe(5);
    const order = [...markdown.matchAll(/>Step (\d)<\/tspan>/g)].map((m) => m[1]);
    expect(order).toEqual(['1', '2', '3', '4', '5']);
  });

  it('clips a long chain around the seed with earlier/later notes', () => {
    const nodes = Array.from({ length: 14 }, (_, i) => node(i + 1, `Step ${i + 1}`));
    const links = nodes.slice(0, -1).map((n, i) => edge(i + 1, i + 2, 'required for'));
    const { markdown, stats } = buildDiagram({ kind: 'chain', nodes, links, seed: 7 });
    expect(stats.shown).toBe(DEFAULT_MAX.chain);
    expect(stats.clipped).toBe(true);
    expect(markdown).toMatch(/\+\d+ earlier ↑/);
    expect(markdown).toMatch(/\+\d+ later ↓/);
    expect(markdown).toContain('Step 7'); // seed always survives the window
  });

  it('terminates on a cycle and flags it', () => {
    const nodes = [1, 2, 3].map((i) => node(i, `C${i}`));
    const links = [edge(1, 2, 'required for'), edge(2, 3, 'required for'), edge(3, 1, 'required for')];
    const { stats } = buildDiagram({ kind: 'chain', nodes, links, seed: 1 });
    expect(stats.cycle).toBe(true);
    expect(stats.shown).toBeLessThanOrEqual(3);
  });

  it('finds a seed→to path and errors when none exists', () => {
    const ok = buildDiagram({ kind: 'chain', nodes: CHAIN_NODES, links: CHAIN_LINKS, seed: 1, to: 4 });
    expect(ok.error).toBeUndefined();
    expect(ok.stats.shown).toBe(4);
    expect(
      buildDiagram({ kind: 'chain', nodes: CHAIN_NODES, links: CHAIN_LINKS, seed: 4, to: 1 }).error
    ).toMatch(/no required-for path/);
  });

  it('errors on a seed with no dependency edges', () => {
    expect(
      buildDiagram({ kind: 'chain', nodes: CHAIN_NODES, links: [], seed: 3 }).error
    ).toMatch(/no required-for edges/);
  });
});

describe('cluster', () => {
  const nodes = [
    node(1, 'Adopt bitemporal core', { meta: { type: 'decision' } }),
    node(2, 'Datomic precedent'),
    node(3, 'Query-cost analysis'),
    node(4, 'Ops complexity concern'),
  ];
  const links = [
    edge(2, 1, 'supports'),
    edge(3, 1, 'required for'),
    edge(4, 1, 'contradicts'),
    edge(4, 2, 'contradicts'), // tension between displayed grounds
  ];

  it('draws grounds plus member-member tensions', () => {
    const { markdown, stats } = buildDiagram({ kind: 'cluster', nodes, links, seed: 1 });
    expect(stats.byPurpose).toEqual({ supports: 1, 'required for': 1, contradicts: 1 });
    expect(stats.seedType).toBe('decision');
    // Two contradicts lines: ground→decision AND ground→ground tension.
    expect([...markdown.matchAll(/stroke-dasharray="6 4"/g)].length).toBeGreaterThanOrEqual(2);
  });

  it('builds for a non-decision seed and records its type', () => {
    const plain = nodes.map((n) => ({ ...n, meta: {} }));
    const { stats, error } = buildDiagram({ kind: 'cluster', nodes: plain, links, seed: 1 });
    expect(error).toBeUndefined();
    expect(stats.seedType).toBeNull();
  });

  it('errors on a seed with no incoming grounds', () => {
    expect(buildDiagram({ kind: 'cluster', nodes, links: [], seed: 1 }).error).toMatch(/no incoming/);
  });
});
