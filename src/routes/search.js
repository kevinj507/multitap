// POST /api/graphs/:gid/search — the UI's front door to the KB search engine
// (graph #172 Cmd+F bar → #171 hybrid+graph backend). Mounted under
// requireGraph('read') in app.js: search READS the graph's nodes, so a viewer
// can run it; it never mutates. The same SearchService the eval harness uses
// runs here, so the ranking the user sees is the ranking we measure (#173 §11).
//
// Progressive rendering (#173 §7) is a CLIENT concern — the server returns the
// full computed order plus per-stage timings in one response; in P2.0 that's
// the instant lexical leg. When dense/rerank land (P2.1+), the heavy legs move
// behind a streamed/second response, but this endpoint's contract is stable:
// { query, results, timings }.

import { Router } from 'express';
import pool from '../db.js';
import { SearchService } from '../search/service.js';
import { configFromEnv, assertConfig } from '../search/config.js';
import { compileFilter } from '../metaFilter.js';

const router = Router({ mergeParams: true });

// One service per process for the default (env-derived) config — assembly is
// cheap but pointless to repeat per request. A request that overrides the
// config builds an ad-hoc service (validation may reject it → 400).
// Shared with the cross-graph route (searchAll.js): ONE service per process
// means ONE copy of the ONNX models — a second instance would double model
// memory AND make the first cross-graph search pay its own multi-second lazy
// load that the boot warmup below already paid for this one.
let defaultService = null;
export function getDefaultService() {
  if (!defaultService) defaultService = new SearchService({ config: configFromEnv(), pool });
  return defaultService;
}

// Boot-time model warmup. The route's service loads its ONNX models lazily, so
// without this the FIRST search after a deploy pays the load (~1.4s measured on
// one core — #198 review) and blows the interactive latency budget. A throwaway
// in-memory search exercises the exact production path (embed + rerank when
// configured); with no model backends configured it's a no-op-cheap lexical run.
export function warmupDefaultService() {
  return getDefaultService().search('warmup', {
    corpus: [{ id: 'warmup', title: 'warmup', description: '', body: 'warmup' }],
  });
}

// IN-PROCESS backends and the fields that identify one pooled instance. These
// hold their weights in THIS process: local-onnx an ONNX session, static a
// quantized embedding table (a 31MB artifact + tokenizer read from disk).
// Constructing a second one per request is the #436 OOM shape — and for
// `static` it also throws away the exact property that backend exists for,
// instant availability after a worker wake, by paying the artifact read on
// every single request. HTTP-contract backends hold no weights and are cheap
// to build per request, so they are deliberately absent here.
const POOLED_BACKENDS = {
  'local-onnx': ['model', 'dtype'],
  static: ['model', 'staticDir'],
};

// OOM guard (#436 incident, 2026-06-12): a per-request `config` naming an
// in-process backend used to make the ad-hoc SearchService load a SECOND copy
// of the weights inside the serving process — on the 2.9GB box that
// OOM-killed the app mid-request. This process pools exactly one in-memory
// copy per provider (the default service's). An ad-hoc config asking for one
// gets that pooled instance when it matches the deployed identity, and a 400
// when it doesn't — a different model can't be served from this process; use
// an http backend for that experiment.
//
// Pass the MERGED config (see the route below), not the raw request body: once
// a partial config inherits the deployment's provider block, that inherited
// backend is exactly what must resolve to the pooled instance rather than a
// fresh load.
export function pooledAdHocDeps(config, def = getDefaultService()) {
  const deps = {};
  const kinds = [['embedding', 'embeddingProvider'], ['rerank', 'rerankProvider']];
  for (const [kind, depKey] of kinds) {
    const requested = config?.providers?.[kind];
    const identityKeys = requested && POOLED_BACKENDS[requested.backend];
    if (!identityKeys) continue;
    const deployed = def.config.providers?.[kind] || {};
    const samePooledModel = deployed.backend === requested.backend
      && identityKeys.every((k) => (requested[k] ?? null) === (deployed[k] ?? null));
    if (!samePooledModel) {
      const err = new Error(
        `providers.${kind}: ad-hoc ${requested.backend} configs can only reuse the deployed model `
        + '(one pooled in-process copy; loading another risks OOM) — '
        + 'omit the override or use an http backend',
      );
      err.status = 400;
      err.errors = [err.message];
      throw err;
    }
    deps[depKey] = def.providers[kind];
  }
  return deps;
}

// Build the service for one request. With no `config` that's the pooled
// default service; with one, an ad-hoc service whose config is normalized over
// the DEPLOYED config — never the library default, which would silently strip
// this deployment's dense leg, graph expansion and tuned top-K and hand back
// keyword-only results with no error (the bug fixed 2026-08-08). Providers are
// pooled off the merged config so inheriting the deployed backend costs no
// second copy of the weights.
export function serviceForRequest(config, pool) {
  const def = getDefaultService();
  if (!config) return def;
  const merged = assertConfig(config, def.config);
  return new SearchService({ config: merged, pool, deps: pooledAdHocDeps(merged, def) });
}

router.post('/', async (req, res, next) => {
  const { gid } = req.params;
  const { query, config, filter } = req.body || {};
  if (typeof query !== 'string' || query.trim() === '') {
    return res.status(400).json({ error: 'query is required' });
  }

  // E15.B1 — optional metadata post-filter. Compiled up front so a malformed
  // filter is a 400 before we spend a search. Absent filter → match-all, and
  // the response below is byte-identical to the pre-B1 contract.
  const compiled = compileFilter(filter);
  if (compiled.error) return res.status(400).json({ error: `invalid filter: ${compiled.error}` });

  let service;
  try {
    service = serviceForRequest(config, pool);
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message, errors: err.errors });
    return next(err);
  }

  try {
    let { candidates, timings } = await service.search(query, { gid, user: req.user });
    if (filter !== undefined && filter !== null) {
      // Post-filter on CURRENT node meta (one query — the index copy can lag a
      // recent write; the filter must reflect live values). Ranking is left
      // exactly as the retriever produced it; we only drop non-matching hits.
      const ids = candidates.map((c) => Number(c.taskId)).filter(Number.isFinite);
      const metaById = new Map();
      if (ids.length) {
        const { rows } = await pool.query(
          'SELECT id, meta FROM tasks WHERE graph_id = $1 AND id = ANY($2)',
          [gid, ids],
        );
        for (const r of rows) metaById.set(Number(r.id), r.meta || {});
      }
      candidates = candidates.filter((c) => compiled.match(metaById.get(Number(c.taskId)) || {}));
    }
    res.json({ query, results: candidates, timings });
  } catch (err) {
    next(err);
  }
});

export default router;
