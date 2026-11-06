// SearchPipeline — the pure executor of the composition spine (#173 §11).
// Holds already-constructed stages (retrievers, a joiner, ordered
// postprocessors, a final top-K) and runs them:
//
//   parallel retrievers → fuse → ordered postprocessors → top-K
//
// It imports NO concrete backend — service.js assembles instances from config
// and hands them in. Two cross-cutting guarantees live here, per the spec:
//
//   • Graceful degradation: a stage that throws (or a retriever that yields
//     nothing) drops to the lower tier instead of failing the search. Lexical
//     always answers, so search never hard-fails (#173 §7/§11). The error is
//     recorded in the timings, not swallowed silently.
//   • Observability: every stage is timed; the pipeline returns per-stage
//     p50/p95-ready numbers that feed the latency gate and the eval (#173 §8).

import { getJoiner } from './fusion.js';

function now() {
  return (typeof performance !== 'undefined' && performance.now)
    ? performance.now()
    : Date.now();
}

export class SearchPipeline {
  /**
   * @param {{
   *   retrievers: import('./types.js').Retriever[],
   *   joiner?: import('./types.js').Joiner,
   *   fusionOpts?: Object,
   *   postprocessors?: import('./types.js').Postprocessor[],
   *   topK?: number,
   * }} parts
   */
  constructor({ retrievers, joiner, fusionOpts = {}, postprocessors = [], topK = 10 } = {}) {
    if (!Array.isArray(retrievers) || retrievers.length === 0) {
      throw new Error('SearchPipeline needs at least one retriever');
    }
    this.retrievers = retrievers;
    this.joiner = joiner || getJoiner('rrf');
    this.fusionOpts = fusionOpts;
    this.postprocessors = postprocessors;
    this.topK = topK;
  }

  /**
   * Run the pipeline for one query.
   * @returns {Promise<{candidates: Object[], timings: Object}>}
   */
  async run(query, ctx = {}) {
    const t0 = now();
    const timings = { retrievers: {}, fusion: 0, postprocessors: {}, total: 0, errors: [] };

    // 1. Retrievers in parallel. Each is isolated: a throw becomes [] + a
    //    recorded error, so one broken leg can't sink the others.
    const lists = await Promise.all(
      this.retrievers.map(async (r) => {
        const rt0 = now();
        try {
          const out = (await r.retrieve(query, ctx)) || [];
          timings.retrievers[r.name] = round(now() - rt0);
          return out;
        } catch (err) {
          timings.retrievers[r.name] = round(now() - rt0);
          timings.errors.push({ stage: `retriever:${r.name}`, message: err.message });
          return [];
        }
      }),
    );

    // 2. Fuse. Drop empty lists so a disabled/unconfigured retriever (the
    //    `none` provider path) contributes nothing rather than skewing ranks.
    const ft0 = now();
    const nonEmpty = lists.filter((l) => l.length > 0);
    let candidates;
    try {
      candidates = nonEmpty.length <= 1
        ? (nonEmpty[0] || [])           // single leg: no fusion needed, order is already correct
        : this.joiner.fuse(nonEmpty, this.fusionOpts);
    } catch (err) {
      timings.errors.push({ stage: `fusion:${this.joiner.name}`, message: err.message });
      candidates = nonEmpty[0] || [];   // degrade to the strongest single list
    }
    timings.fusion = round(now() - ft0);

    // 3. Ordered postprocessors. A failing/unconfigured one is skipped (the
    //    list passes through unchanged) — the lower-tier result still stands.
    for (const pp of this.postprocessors) {
      const pt0 = now();
      try {
        const out = await pp.postprocess(query, candidates, ctx);
        if (Array.isArray(out)) candidates = out;
        timings.postprocessors[pp.name] = round(now() - pt0);
      } catch (err) {
        timings.postprocessors[pp.name] = round(now() - pt0);
        timings.errors.push({ stage: `postprocessor:${pp.name}`, message: err.message });
        // leave `candidates` as-is — graceful degradation
      }
    }

    // 4. Final top-K.
    const sliced = candidates.slice(0, this.topK);
    timings.total = round(now() - t0);
    return { candidates: sliced, timings };
  }
}

function round(ms) {
  return Math.round(ms * 1000) / 1000;
}

export default { SearchPipeline };
