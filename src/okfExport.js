// OKF v0.2 bundle builder — pure functions, no db/express, mirroring
// edgePurpose.js's testability rule. Turns one graph's rows into an Open
// Knowledge Format bundle (github.com/GoogleCloudPlatform/open-knowledge-format):
// a flat list of { path, content } markdown files the route serves either as a
// JSON map or a tarball.
//
// Mapping rules (the whole contract, so the exporter stays honest):
// - Multitap's E15 `type` (open string) IS OKF's one required `type` field;
//   absent → 'task'.
// - `status` collides on VALUES (todo/in_progress/review/done vs OKF's
//   draft/stable/deprecated), so the original moves losslessly to
//   `task_status` and OKF `status` is derived: done → stable, else draft.
// - `generated: {by, at}` is OKF v0.2 provenance (last_modified_by/updated_at).
// - Typed edges ride twice: a machine-readable `edges:` frontmatter key
//   (outgoing only — OKF tolerates unknown keys) AND a generated `## Links`
//   body trailer with prose-typed markdown links, because OKF links are
//   untyped and the spec says relationship kind is conveyed by prose.
// - All other meta keys pass through verbatim (legal custom keys). A task
//   whose custom meta already used `generated`/`edges`/`task_status` gets
//   those overwritten in the bundle only — the DB is never touched.
import { parseMarkdown, serializeMarkdown } from './markdown.js';

// Prose labels for the Links trailer, per purpose and edge direction
// (edges are directed source → target; see edgePurpose.js for the vocabulary).
const OUT_LABEL = {
  'required for': 'Required for',
  supports: 'Supports',
  contradicts: 'Contradicts',
  'related to': 'Related to',
  // E18.4. The bundle lists EVERY edge, so a purpose missing from these two
  // maps renders as `* undefined: [title](/path)` — which is how a vocabulary
  // addition turns into a visible export bug.
  supersedes: 'Supersedes',
};
const IN_LABEL = {
  'required for': 'Requires',
  supports: 'Supported by',
  contradicts: 'Contradicted by',
  'related to': 'Related to',
  supersedes: 'Superseded by',
};

// Lowercase ASCII slug from a title. May legitimately return '' (emoji-only or
// CJK-only titles); taskPath falls back to the bare id. Charset [a-z0-9-] means
// slug bytes == chars, so path length is bounded: 'tasks/' + id + '-' + 60 +
// '.md' stays under the ustar 100-byte name cap by construction.
export function slugify(title) {
  return String(title ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
}

// The id prefix makes every path unique regardless of duplicate titles, and —
// because every task lives under tasks/ — collisions with the reserved
// index.md / log.md names are impossible.
export function taskPath(id, title) {
  const slug = slugify(title);
  return slug ? `tasks/${id}-${slug}.md` : `tasks/${id}.md`;
}

function escapeLinkText(text) {
  return String(text).replace(/\[/g, '\\[').replace(/\]/g, '\\]');
}

function toIso(value, fallback) {
  const d = value instanceof Date ? value : value ? new Date(value) : null;
  if (d && !Number.isNaN(d.getTime())) return d.toISOString();
  return fallback.toISOString();
}

// Shallow value hygiene before YAML.stringify: drop undefined (yaml's handling
// is lossy/irregular) and convert Dates to ISO strings (yaml would emit
// timestamp scalars that parse back as Dates, not strings).
function normalizeValues(meta) {
  const out = {};
  for (const [k, v] of Object.entries(meta)) {
    if (v === undefined) continue;
    out[k] = v instanceof Date ? v.toISOString() : v;
  }
  return out;
}

// The exported OKF type for a task — also the index.md grouping key.
function okfType(meta) {
  return typeof meta.type === 'string' && meta.type.trim() !== '' ? meta.type : 'task';
}

// Source-of-truth meta for a task row: the content frontmatter when it parses,
// else the meta JSONB (authoritative — validated on every write) for legacy or
// frontmatter-broken content.
function sourceMetaAndBody(row) {
  const parsed = parseMarkdown(row.content || '');
  const hasFrontmatter = (row.content || '').startsWith('---\n') && !parsed.frontmatterError;
  return {
    meta: hasFrontmatter ? parsed.meta : row.meta || {},
    body: parsed.body,
  };
}

function taskDoc(row, outgoing, incoming, pathById, titleById, now) {
  const { meta: source, body } = sourceMetaAndBody(row);
  // Fixed insertion order (yaml preserves it) keeps output deterministic.
  const { status: sourceStatus, edges: _customEdges, ...rest } = source;
  const meta = {
    ...rest,
    type: okfType(source),
    status: sourceStatus === 'done' ? 'stable' : 'draft',
    task_status: sourceStatus || 'todo',
    generated: {
      by: row.last_modified_by || 'multitap',
      at: toIso(row.updated_at, now),
    },
  };
  if (outgoing.length) {
    meta.edges = outgoing.map((e) => ({
      to: pathById.get(e.target_id).replace(/\.md$/, ''),
      purpose: e.purpose,
    }));
  }

  const links = [
    ...outgoing.map(
      (e) =>
        `* ${OUT_LABEL[e.purpose]}: [${escapeLinkText(titleById.get(e.target_id))}](/${pathById.get(e.target_id)})`
    ),
    ...incoming.map(
      (e) =>
        `* ${IN_LABEL[e.purpose]}: [${escapeLinkText(titleById.get(e.source_id))}](/${pathById.get(e.source_id)})`
    ),
  ];
  let outBody = body ? body.replace(/\s+$/, '') : '';
  if (links.length) {
    outBody = (outBody ? outBody + '\n\n' : '') + '## Links\n\n' + links.join('\n') + '\n';
  }
  return serializeMarkdown(normalizeValues(meta), outBody);
}

// Bundle-root index.md: the only file allowed frontmatter without `type` —
// exactly { okf_version: "0.2" }. Body is the spec's progressive-disclosure
// shape: link lists (`* [Title](/path.md) - description`) grouped one section
// per exported type.
function indexDoc(graph, tasks, pathById, report) {
  const sections = new Map();
  for (const row of tasks) {
    const label = okfType(row.meta || {});
    const pretty = label.charAt(0).toUpperCase() + label.slice(1);
    if (!sections.has(pretty)) sections.set(pretty, []);
    const desc = row.meta?.description ? ` - ${row.meta.description}` : '';
    sections
      .get(pretty)
      .push(`* [${escapeLinkText(row.meta?.title ?? String(row.id))}](/${pathById.get(row.id)})${desc}`);
  }
  const parts = [`# ${graph.name}`];
  if (graph.description) parts.push(graph.description);
  for (const label of [...sections.keys()].sort()) {
    parts.push(`## ${label}\n\n${sections.get(label).join('\n')}`);
  }
  if (report) {
    const desc = report.description ? ` - ${report.description}` : '';
    parts.push(`## Report\n\n* [${escapeLinkText(report.title)}](/report.md)${desc}`);
  }
  return serializeMarkdown({ okf_version: '0.2' }, parts.join('\n\n') + '\n');
}

// log.md is reserved: NO frontmatter, `## YYYY-MM-DD` headings newest-first.
// One honest entry — this bundle was created now, from this graph version.
function logDoc(graph, now) {
  const day = now.toISOString().slice(0, 10);
  return `## ${day}\n\n* **Creation** — Bundle exported from Multitap graph \`${graph.id}\` ("${graph.name}", version ${graph.version}).\n`;
}

function reportDoc(report, now) {
  const meta = {
    ...(report.meta || {}),
    type: 'report',
    title: report.title,
  };
  if (report.description) meta.description = report.description;
  meta.generated = { by: 'multitap', at: toIso(report.generated_at, now) };
  // Body verbatim: a mid-document `---` is a thematic break, never a fence —
  // only a fence at byte 0 opens frontmatter, and ours closes first.
  return serializeMarkdown(normalizeValues(meta), report.body || '');
}

// graph: the graphs row (id, name, description, version). tasks/edges/report:
// the rows fetched by the route (report may be null). now: injected by the
// caller so output is deterministic for identical input.
export function buildOkfBundle({ graph, tasks, edges, report, now }) {
  const pathById = new Map(tasks.map((t) => [t.id, taskPath(t.id, t.meta?.title)]));
  const titleById = new Map(tasks.map((t) => [t.id, t.meta?.title ?? String(t.id)]));
  // Defensive: skip edges whose endpoints aren't in this graph's task map so
  // the bundle never contains dangling links of its own making.
  const live = edges.filter((e) => pathById.has(e.source_id) && pathById.has(e.target_id));
  const outgoing = new Map();
  const incoming = new Map();
  for (const e of live) {
    if (!outgoing.has(e.source_id)) outgoing.set(e.source_id, []);
    outgoing.get(e.source_id).push(e);
    if (!incoming.has(e.target_id)) incoming.set(e.target_id, []);
    incoming.get(e.target_id).push(e);
  }

  const files = [
    { path: 'index.md', content: indexDoc(graph, tasks, pathById, report) },
    { path: 'log.md', content: logDoc(graph, now) },
  ];
  if (report) files.push({ path: 'report.md', content: reportDoc(report, now) });
  for (const row of tasks) {
    files.push({
      path: pathById.get(row.id),
      content: taskDoc(
        row,
        outgoing.get(row.id) || [],
        incoming.get(row.id) || [],
        pathById,
        titleById,
        now
      ),
    });
  }
  return files;
}
