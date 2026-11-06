// OKF export — pure bundle builder (src/okfExport.js). No DB: rows are built
// inline in the shape the route's SQL returns. Conformance assertions reuse
// parseMarkdown so "parses as frontmatter" means the same thing the app means.
import { buildOkfBundle, slugify, taskPath } from '../src/okfExport.js';
import { parseMarkdown, serializeMarkdown } from '../src/markdown.js';

const NOW = new Date('2026-08-24T12:00:00.000Z');

function task(id, meta, body = '', row = {}) {
  const full = { title: `Task ${id}`, status: 'todo', ...meta };
  return {
    id,
    meta: full,
    content: serializeMarkdown(full, body),
    version: 1,
    updated_at: new Date('2026-08-20T09:30:00.000Z'),
    last_modified_by: 'human',
    ...row,
  };
}

function bundle(overrides = {}) {
  return buildOkfBundle({
    graph: { id: 'g1abcdef', name: 'Rollout plan', description: 'The plan', version: 42 },
    tasks: [
      task(1, { title: 'Design schema', status: 'done', type: 'decision' }, 'Chose Postgres.'),
      task(2, { title: 'Ship: API', description: 'v1 surface' }, 'Body text.'),
    ],
    edges: [{ id: 1, source_id: 1, target_id: 2, purpose: 'required for' }],
    report: null,
    now: NOW,
    ...overrides,
  });
}

function byPath(files) {
  return Object.fromEntries(files.map((f) => [f.path, f.content]));
}

describe('slugify / taskPath', () => {
  it('lowercases, strips diacritics, dashes the rest', () => {
    expect(slugify('Résumé — Fürs Team!')).toBe('resume-furs-team');
  });
  it('caps at 60 chars without a trailing dash', () => {
    const slug = slugify('x'.repeat(59) + ' tail that gets cut');
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith('-')).toBe(false);
  });
  it('falls back to bare id for emoji-only titles', () => {
    expect(taskPath(7, '🎉🔥')).toBe('tasks/7.md');
  });
  it('keeps duplicate titles distinct via the id prefix', () => {
    expect(taskPath(1, 'Same')).not.toBe(taskPath(2, 'Same'));
  });
  it('keeps every path under the ustar 100-byte cap', () => {
    const p = taskPath(2147483647, 'A'.repeat(100));
    expect(Buffer.byteLength(p)).toBeLessThanOrEqual(100);
  });
});

describe('buildOkfBundle — conformance', () => {
  it('gives every non-reserved file parseable frontmatter with a non-empty type', () => {
    const files = bundle({
      report: { title: 'Q3 synthesis', description: null, body: 'Findings.', meta: {}, generated_at: NOW },
    });
    for (const f of files) {
      if (f.path === 'index.md' || f.path === 'log.md') continue;
      const { meta, frontmatterError } = parseMarkdown(f.content);
      expect(frontmatterError, f.path).toBeNull();
      expect(typeof meta.type, f.path).toBe('string');
      expect(meta.type.length, f.path).toBeGreaterThan(0);
    }
  });

  it('root index.md carries exactly { okf_version: "0.2" } and log.md is bare', () => {
    const files = byPath(bundle());
    const { meta } = parseMarkdown(files['index.md']);
    expect(meta).toEqual({ okf_version: '0.2' });
    expect(files['index.md']).toContain('okf_version: "0.2"');
    expect(files['log.md'].startsWith('## 2026-08-24')).toBe(true);
    expect(files['log.md']).not.toContain('---');
  });

  it('only produces index.md, log.md, report.md, and tasks/* paths', () => {
    const files = bundle({
      report: { title: 'R', description: null, body: '', meta: {}, generated_at: NOW },
    });
    for (const f of files) {
      expect(/^(index\.md|log\.md|report\.md|tasks\/[a-z0-9-]+\.md)$/.test(f.path), f.path).toBe(true);
    }
  });

  it('every body link and every edges[].to resolves to a produced file', () => {
    const files = bundle({
      report: { title: 'R', description: 'd', body: 'See stuff.', meta: {}, generated_at: NOW },
    });
    const paths = new Set(files.map((f) => f.path));
    for (const f of files) {
      for (const m of f.content.matchAll(/\]\((\/[^)]+)\)/g)) {
        expect(paths.has(m[1].slice(1)), `${f.path} links ${m[1]}`).toBe(true);
      }
      if (f.path.startsWith('tasks/')) {
        const { meta } = parseMarkdown(f.content);
        for (const e of meta.edges || []) {
          expect(paths.has(e.to + '.md'), `${f.path} edge to ${e.to}`).toBe(true);
        }
      }
    }
  });

  it('is deterministic for identical input', () => {
    expect(bundle()).toEqual(bundle());
  });
});

describe('buildOkfBundle — meta mapping', () => {
  it('maps type, status, task_status, generated as specified', () => {
    const files = byPath(bundle());
    const done = parseMarkdown(files['tasks/1-design-schema.md']).meta;
    expect(done.type).toBe('decision'); // existing E15 type preserved
    expect(done.status).toBe('stable'); // done → stable
    expect(done.task_status).toBe('done'); // lossless original
    const todo = parseMarkdown(files['tasks/2-ship-api.md']).meta;
    expect(todo.type).toBe('task'); // absent → task
    expect(todo.status).toBe('draft');
    expect(todo.task_status).toBe('todo');
    expect(todo.generated).toEqual({ by: 'human', at: '2026-08-20T09:30:00.000Z' });
  });

  it('passes custom keys through and falls back generated.by to multitap', () => {
    const files = byPath(
      bundle({
        tasks: [
          task(
            1,
            { title: 'Custom', confidence: 0.7, 'background-image': 'https://x/y.png' },
            'b',
            { last_modified_by: null, updated_at: null }
          ),
        ],
        edges: [],
      })
    );
    const meta = parseMarkdown(files['tasks/1-custom.md']).meta;
    expect(meta.confidence).toBe(0.7);
    expect(meta['background-image']).toBe('https://x/y.png');
    expect(meta.generated).toEqual({ by: 'multitap', at: NOW.toISOString() });
  });

  it('emits edges frontmatter for outgoing only, omitted when none', () => {
    const files = byPath(bundle());
    expect(parseMarkdown(files['tasks/1-design-schema.md']).meta.edges).toEqual([
      { to: 'tasks/2-ship-api', purpose: 'required for' },
    ]);
    expect(parseMarkdown(files['tasks/2-ship-api.md']).meta.edges).toBeUndefined();
  });

  it('falls back to row.meta when content frontmatter is broken', () => {
    const files = byPath(
      bundle({
        tasks: [
          task(1, { title: 'Broken' }, '', {
            content: '---\ntitle: [unclosed\n---\nSurviving body.',
          }),
        ],
        edges: [],
      })
    );
    const { meta, body } = parseMarkdown(files['tasks/1-broken.md']);
    expect(meta.title).toBe('Broken'); // from row.meta, not the broken YAML
    expect(body).toContain('Surviving body.');
  });
});

describe('buildOkfBundle — bodies and links', () => {
  it('phrases outgoing vs incoming links by purpose and direction', () => {
    const files = byPath(bundle());
    expect(files['tasks/1-design-schema.md']).toContain(
      '* Required for: [Ship: API](/tasks/2-ship-api.md)'
    );
    expect(files['tasks/2-ship-api.md']).toContain(
      '* Requires: [Design schema](/tasks/1-design-schema.md)'
    );
  });

  it('escapes [ and ] in link text', () => {
    const files = byPath(
      bundle({
        tasks: [
          task(1, { title: '[P0] fix' }, ''),
          task(2, { title: 'Other' }, ''),
        ],
        edges: [{ id: 1, source_id: 1, target_id: 2, purpose: 'supports' }],
      })
    );
    expect(files['tasks/2-other.md']).toContain('* Supported by: [\\[P0\\] fix](/tasks/1-p0-fix.md)');
  });

  it('skips edges with endpoints outside the graph', () => {
    const files = byPath(
      bundle({
        edges: [
          { id: 1, source_id: 1, target_id: 2, purpose: 'required for' },
          { id: 2, source_id: 1, target_id: 999, purpose: 'supports' },
        ],
      })
    );
    expect(files['tasks/1-design-schema.md']).not.toContain('999');
    expect(parseMarkdown(files['tasks/1-design-schema.md']).meta.edges).toHaveLength(1);
  });
});

describe('buildOkfBundle — index, report, empty graph', () => {
  it('groups the index by type with descriptions, report section only when present', () => {
    const noReport = byPath(bundle());
    expect(noReport['index.md']).toContain('# Rollout plan');
    expect(noReport['index.md']).toContain('## Decision');
    expect(noReport['index.md']).toContain('## Task');
    expect(noReport['index.md']).toContain('* [Ship: API](/tasks/2-ship-api.md) - v1 surface');
    expect(noReport['index.md']).not.toContain('## Report');
    expect(Object.keys(noReport)).not.toContain('report.md');

    const withReport = byPath(
      bundle({
        report: { title: 'Q3 synthesis', description: 'Summary', body: 'Text.', meta: {}, generated_at: NOW },
      })
    );
    expect(withReport['index.md']).toContain('## Report');
    expect(withReport['index.md']).toContain('* [Q3 synthesis](/report.md) - Summary');
  });

  it('report body with --- lines survives round-trip with intact frontmatter', () => {
    const files = byPath(
      bundle({
        report: {
          title: 'R',
          description: null,
          body: 'Intro\n\n---\n\nAfter the break.',
          meta: {},
          generated_at: NOW,
        },
      })
    );
    const { meta, body, frontmatterError } = parseMarkdown(files['report.md']);
    expect(frontmatterError).toBeNull();
    expect(meta.type).toBe('report');
    expect(meta.title).toBe('R');
    expect(body).toContain('After the break.');
  });

  it('empty graph still yields a valid index.md + log.md', () => {
    const files = buildOkfBundle({
      graph: { id: 'gempty12', name: 'Empty', description: null, version: 1 },
      tasks: [],
      edges: [],
      report: null,
      now: NOW,
    });
    expect(files.map((f) => f.path)).toEqual(['index.md', 'log.md']);
    expect(parseMarkdown(files[0].content).meta).toEqual({ okf_version: '0.2' });
  });
});
