import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import graphsRouter from './routes/graphs.js';
import tasksRouter from './routes/tasks.js';
import edgesRouter from './routes/edges.js';
import batchRouter from './routes/batch.js';
import graphViewRouter from './routes/graphView.js';
import diagramRouter from './routes/diagram.js';
import presenceRouter from './routes/presence.js';
import membersRouter from './routes/members.js';
import meRouter from './routes/me.js';
import graphPrefsRouter from './routes/graphPrefs.js';
import selectionRouter from './routes/selection.js';
import uploadsRouter from './routes/uploads.js';
import reportsRouter from './routes/reports.js';
import refreshRouter from './routes/refresh.js';
import refreshesAllRouter from './routes/refreshesAll.js';
import searchRouter from './routes/search.js';
import searchAllRouter from './routes/searchAll.js';
import reportsAllRouter from './routes/reportsAll.js';
import contextRouter from './routes/context.js';
import frontierRouter from './routes/frontier.js';
import decisionsAtRiskRouter from './routes/decisionsAtRisk.js';
import doubtRouter from './routes/doubt.js';
import branchPointsRouter from './routes/branchPoints.js';
import changesRouter from './routes/changes.js';
import inconsistencyRouter from './routes/inconsistency.js';
import structureRouter from './routes/structure.js';
import exportRouter from './routes/export.js';
import { eventsLogHandler } from './routes/eventsLog.js';
import { startSse, subscribe, unsubscribe, tryReserveSlot, releaseSlot, broadcastPresence } from './sse.js';
import { writerType } from './writerType.js';
import { getAdapter } from './auth/index.js';
import { verifyAuth } from './auth/middleware.js';
import { requireGraph, requireGraphForMethod } from './auth/require.js';
import * as presence from './presence.js';
import * as selectionState from './selectionState.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// JSON body cap. Express's own default is 100 KB, which is too small for this
// API's legitimate payloads: a /batch write of a few hundred nodes and their
// edges, or a PUT of a long-form report, both exceed it and 413 before the
// handler runs. Reports are the hard case — a report is one PUT that replaces
// the whole body, so unlike /batch it cannot be split into smaller requests.
// 2 MB clears both with headroom while still bounding a hostile body; the real
// work limits live downstream (batch caps nodes/edges per call), so this is a
// transport guard, not a throughput one. Self-hosters can override via
// MULTITAP_JSON_MAX_BYTES (raw bytes), mirroring MULTITAP_UPLOAD_MAX_BYTES.
const DEFAULT_JSON_MAX_BYTES = 2 * 1024 * 1024;
const JSON_MAX_BYTES = (() => {
  const raw = process.env.MULTITAP_JSON_MAX_BYTES ?? process.env.GRAPHTASK_JSON_MAX_BYTES; // former name still read
  if (!raw) return DEFAULT_JSON_MAX_BYTES;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_JSON_MAX_BYTES;
  return parsed;
})();
app.use(express.json({ limit: JSON_MAX_BYTES }));
app.use(writerType);

// Auth wiring. The adapter is selected once at boot from AUTH_PROVIDER; its
// middlewares (e.g. Clerk's session reader) run before verifyAuth so that
// verifyAuth can attribute the request to a user row. With AUTH_PROVIDER=none
// (the default) verifyAuth itself is a no-op: req.user stays null.
const authAdapter = await getAdapter();
for (const mw of authAdapter.middlewares()) app.use(mw);
app.use(verifyAuth);

app.use(express.static(path.join(__dirname, '..', 'public')));

// Frontend bootstrap: tells the browser whether to load Clerk JS and which
// publishable key to use. Auth-off deployments get `{auth_enabled: false}` and
// render no sign-in chrome.
app.get('/api/config', (req, res) => {
  const provider = authAdapter.provider;
  res.json({
    auth_enabled: provider !== 'none',
    provider,
    publishable_key: authAdapter.publishableKey?.() ?? null,
    // The frontend needs the internal user UUID (not Clerk's user_xxx id)
    // to partition the sidebar by `graph.owner_user_id`. Exposed only when
    // the request resolved to a signed-in user; null otherwise.
    viewer_user_id: req.user?.id ?? null,
  });
});

// Server-sent events for live graph updates. Pushes one event per task/edge
// mutation, payload `{ graph_id, kind, op }`. Browser subscribes via
// EventSource and refetches the graph on each event. canRead-gated so that
// auth-on instances don't leak private graph traffic to anonymous viewers.
app.get('/api/graphs/:gid/events', requireGraph('read'), (req, res, next) => {
  // E18.1 STEP 6 — the same path, read as an append-only LOG rather than
  // subscribed to as a stream. The locked spec spells the read API
  // `GET /events?since=`, and this route was registered first, so the branch
  // lives here instead of the path being renamed. It MUST stay the first
  // statement: after tryReserveSlot() a connection slot is held, and after
  // flushHeaders() the response is irreversibly an event-stream. The browser's
  // EventSource opens the path bare, so SSE is untouched; `?format=json` reads
  // the head of the log without passing a `since`.
  if (req.query.since !== undefined || req.query.format === 'json') return eventsLogHandler(req, res, next);

  const { gid } = req.params;
  // Cap concurrent SSE connections to stay below the process fd ceiling.
  // Browsers using EventSource will retry automatically after Retry-After.
  if (!tryReserveSlot()) {
    res.set('Retry-After', '10').status(503).json({ error: 'too many concurrent viewers; please retry' });
    return;
  }
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
  res.write(`: connected\n\n`);
  subscribe(gid, res);
  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch {}
  }, 25000);
  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe(gid, res);
    releaseSlot();
    try { res.end(); } catch {}
  });
});

// :gid is an opaque short string; no format validation here. A bad id just
// won't match any row and the guard returns 404. Each sub-router carries the
// guard that matches its access shape: tasks/edges use the method-pick
// (GET=read, write=edit); the graph view + presence are read-only surfaces;
// the graphs router applies per-route guards internally because PATCH/DELETE
// require `manage`, not `edit`.
app.use('/api/graphs', graphsRouter);
app.use('/api/graphs/:gid/tasks', requireGraphForMethod, tasksRouter);
app.use('/api/graphs/:gid/edges', requireGraphForMethod, edgesRouter);
// Batch upsert (E14.1): nodes + edges in one transactional, idempotent call for
// dynamic-workflow write-back. A write surface, so method-pick guard (edit).
app.use('/api/graphs/:gid/batch', requireGraphForMethod, batchRouter);
app.use('/api/graphs/:gid/graph', requireGraph('read'), graphViewRouter);
// Server-derived report diagram (inline SVG): pure derivation over the same
// rows as /graph, never mutates — read-gated so report drafters (read-only
// agents) can fetch a finished figure and paste it verbatim.
app.use('/api/graphs/:gid/diagram', requireGraph('read'), diagramRouter);
// Search reads the graph's nodes and never mutates, so it's read-scoped even
// though it's a POST (the query rides in the body). A viewer can search.
app.use('/api/graphs/:gid/search', requireGraph('read'), searchRouter);
// Cross-graph search has no :gid to guard — it derives its own scope (owned +
// member graphs) from req.user inside the handler, and 401s anonymous callers.
app.use('/api/search', searchAllRouter);
// Cross-graph report rail (E16.5): like the graph LIST, it derives its own
// scope (owned + member graphs that have a report) from req.user and returns []
// for anonymous callers — no :gid to guard, and no 401 (an anon viewer simply
// owns nothing, exactly as the sidebar shows them).
app.use('/api/reports', reportsAllRouter);
// Context-pack (#457/E13): one-call k-hop neighborhood WITH bodies. Reads the
// graph + reuses the pooled search model; read-scoped like /search even though
// it's a POST (the query/seeds ride in the body).
app.use('/api/graphs/:gid/context', requireGraph('read'), contextRouter);
app.use('/api/graphs/:gid/frontier', requireGraph('read'), frontierRouter);
app.use('/api/graphs/:gid/decisions/at-risk', requireGraph('read'), decisionsAtRiskRouter);
// E18.5 — decision branch points: options + overlays + the confrontation view.
// MOUNTED AFTER the at-risk router on purpose: Express matches in registration
// order and `/decisions/at-risk` is an exact prefix of this mount's path, so it
// must be tried first. Read-gated, and both handlers are SELECT-only — they hold
// no transaction, emit no event and flip no status.
app.use('/api/graphs/:gid/decisions', requireGraph('read'), branchPointsRouter);
// E18.3 — the transitive doubt front. Read gate, and it could not mutate if it
// tried: the handler issues four SELECTs and holds no transaction.
app.use('/api/graphs/:gid/doubt', requireGraph('read'), doubtRouter);
// E18.3 — the personal change feed. The PUT writes the USER'S OWN ROW, not the
// graph, so a viewer-member may mark as read on a graph they cannot edit —
// deliberate, and it matches graphPrefs.js's existing comment.
app.use('/api/graphs/:gid/changes', requireGraph('read'), changesRouter);
app.use('/api/graphs/:gid/inconsistencies', requireGraph('read'), inconsistencyRouter);
app.use('/api/graphs/:gid/structure', requireGraph('read'), structureRouter);
// OKF v0.2 bundle export: a read-only snapshot of the whole graph as markdown
// + YAML frontmatter (JSON envelope by default, ?format=tar for a ustar
// download). Read-scoped like /graph — a viewer or anon-viewer can export.
app.use('/api/graphs/:gid/export', requireGraph('read'), exportRouter);
app.use('/api/graphs/:gid/presence', requireGraph('read'), presenceRouter);
app.use('/api/graphs/:gid/selection', requireGraph('read'), selectionRouter);
app.use('/api/graphs/:gid/prefs', requireGraph('read'), graphPrefsRouter);
app.use('/api/graphs/:gid/uploads', requireGraphForMethod, uploadsRouter);
// The graph's human-readable report (E16). A write surface (GET=read report,
// PUT=upsert report), so the method-pick guard: a viewer/anon reads, an editor
// writes. The report lives outside tasks/edges, so this never mutates the graph.
app.use('/api/graphs/:gid/report', requireGraphForMethod, reportsRouter);
// Scheduled refresh (3834): per-graph schedule + purpose prompt. Same
// isolation rule as /report — config writes never touch the graph itself.
// Method-pick guard: a viewer reads the schedule, an editor sets/completes it.
app.use('/api/graphs/:gid/refresh', requireGraphForMethod, refreshRouter);
// The executor poll surface: which of MY graphs are due? Derives its own
// scope (owned + member) from req.user like /api/reports; anon gets [].
app.use('/api/refreshes', refreshesAllRouter);
app.use('/api/graphs/:gid/members', membersRouter);
app.use('/api/me', meRouter);

startSse();
presence.startReaper();
presence.startActiveSweep();
presence.onChange((graphId, op, writer) => {
  broadcastPresence(graphId, { graph_id: graphId, kind: 'presence', op, writer });
  // When a writer leaves (Stop hook DELETE, sendBeacon on unload, idle reaper),
  // wipe their selection state so peers' colored outlines and cursor labels
  // disappear in the same SSE round-trip rather than lingering.
  if (op === 'depart') selectionState.clearSelection(graphId, writer.id);
});

// Fan out per-writer selection changes. The frame shape rides on
// broadcastPresence (it's a generic per-graph SSE channel; clients route
// by `kind`). Payload from selectionState includes writer_id + the
// node_ids/edge_ids/editing/cursor_anchor snapshot.
selectionState.onChange((graphId, op, payload) => {
  broadcastPresence(graphId, { graph_id: graphId, kind: 'selection', op, ...payload });
});

// Single-node permalink — ONE naming system for nodes (owner decision
// 2026-08-07): /g/:gid?node=<id> IS the node link, and it renders the
// standalone reading page (public/node.html), NOT the SPA — a shared node
// link opens as readable markdown for everyone, whatever view the sender was
// in. It shows one node's markdown off a single API read instead of booting
// cytoscape + the editor bundle + SSE. Any explicit ?view= (graph, reader)
// means "open the SPA in that view" — the reading page's "Open graph" mints
// ?node=<id>&view=graph, and the canvas keeps that shape in the bar while a
// node is selected so refresh stays on the canvas. Non-numeric ?node= values
// fall through to the SPA too, whose deep-link handler just won't match them.
// Must sit above the SPA fallback below. Access control is unchanged: the
// page is a shell, and the /api reads it makes are gated exactly as before
// (a viewer with no access gets a 403 and the page says so).
app.get('/g/:gid', (req, res, next) => {
  const nodeId = req.query.node;
  if (typeof nodeId === 'string' && /^[0-9]+$/.test(nodeId) && !req.query.view) {
    return res.sendFile(path.join(__dirname, '..', 'public', 'node.html'));
  }
  next();
});

// The retired /g/:gid/n/:id path shape. Permanent redirect so links minted
// before the query shape (old tabs, pasted chats, bookmarks) keep landing on
// the same reading page.
app.get('/g/:gid/n/:id', (req, res) => {
  res.redirect(301, `/g/${encodeURIComponent(req.params.gid)}?node=${encodeURIComponent(req.params.id)}`);
});

// SPA fallback: client-side routes like /g/:gid only exist in the frontend.
// On a fresh page load (paste URL, refresh, bookmark) the browser does a real
// GET and would otherwise 404. Serve index.html instead so the JS can read
// the URL and resolve the active graph. Only triggers for HTML navigations
// — asset requests (which advertise Accept: */* or specific MIME types) fall
// through to a normal 404 so a missing /style.css doesn't silently get HTML.
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  if (req.path.startsWith('/api/')) return next();
  const accept = req.headers.accept || '';
  if (!accept.includes('text/html')) return next();
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

export default app;
