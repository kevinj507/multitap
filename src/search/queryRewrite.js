// Query rewriter (E11, #436 follow-up) — an OPTIONAL pre-retrieval stage that
// rewrites the user's natural-language query into a keyword-rich search query
// BEFORE the lexical + dense legs run. It exists for the one failure both legs
// share: a "reasoning-gap" query whose literal surface topic differs from the
// intended answer (e.g. "which firms keep the AI server farms powered up" — a
// human means utility/energy companies; similarity retrieval keys off "server
// farms"). Neither lexical nor dense bridges that inference (measured on #436);
// rewriting the query at the source does — it turns the failing phrasing into
// one the retrievers already handle. See #231/#436 for why a reranker can't
// (it only reorders found candidates) and why a bigger embedder only narrows
// the gap.
//
// OFF BY DEFAULT. The stage adds an LLM round-trip to every search, so it only
// makes sense behind a flag and on a fast model. Three backends:
//   • none    (default) — no rewriter; the raw query goes straight to retrieval.
//   • fixture — a precomputed {query -> rewrite} map. No network. This is what
//               the eval harness and tests use, so the retrieval LIFT can be
//               measured deterministically without a live key.
//   • llm     — a hosted chat API (raw fetch, matching the project's other HTTP
//               providers — no SDK dep). Two wire formats are supported, picked
//               by `provider`:
//                 - anthropic (default) — Messages API; needs ANTHROPIC_API_KEY.
//                 - groq      — OpenAI-compatible chat/completions; needs
//                               GROQ_API_KEY. Same body shape as any OpenAI-style
//                               endpoint, so this also covers other compatible
//                               hosts by overriding QUERY_REWRITE_BASE_URL.
//               Defaults to a fast model because this runs inline before every
//               search; a slow model would blow the interactive latency budget.
//
// Contract: rewrite(query) -> Promise<string>. On ANY failure (no key, timeout,
// empty/garbage response) it returns the ORIGINAL query — rewriting is an
// enhancement, never a gate, exactly like the rerank/expand postprocessors.

import { postJson } from './providers/http.js';

const DEFAULT_MAX_TOKENS = 120;

// Wire-format adapters. The rewrite request is identical in spirit across hosts
// (a system prompt + the user query, capped short); they differ only in URL,
// auth header, where the system prompt goes, the token-cap field name, and how
// the reply text is dug out. Keeping each provider as a tiny shape keeps
// "switch provider = env change" true (mirrors providers/http.js §10).
const PROVIDERS = {
  anthropic: {
    url: 'https://api.anthropic.com/v1/messages',
    // Inline latency budget: default to the fast model. Override per deployment
    // with QUERY_REWRITE_MODEL.
    defaultModel: 'claude-haiku-4-5',
    tokenEnv: 'ANTHROPIC_API_KEY',
    headers: (token) => ({
      'Content-Type': 'application/json',
      'x-api-key': token,
      'anthropic-version': '2023-06-01',
    }),
    payload: (model, maxTokens, q) => ({
      model,
      max_tokens: maxTokens,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: q }],
    }),
    // Messages API: content is a block array; pull the first text block.
    parse: (data) => (Array.isArray(data?.content)
      ? data.content.find((b) => b && b.type === 'text')?.text
      : null),
  },
  groq: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    // 8b-instant is the fastest/cheapest Groq model and plenty for rewriting.
    defaultModel: 'llama-3.1-8b-instant',
    tokenEnv: 'GROQ_API_KEY',
    headers: (token) => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }),
    // OpenAI-compatible: system goes in the message list, and the cap is
    // max_completion_tokens (max_tokens is deprecated on Groq).
    payload: (model, maxTokens, q) => ({
      model,
      max_completion_tokens: maxTokens,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: q },
      ],
    }),
    parse: (data) => data?.choices?.[0]?.message?.content ?? null,
  },
};

// The rewrite prompt. Kept terse and example-led: expand the INTENT into the
// search terms a keyword+vector index would match, and — critically — return
// the query UNCHANGED when it's already a good search query, so the stage can't
// hurt the direct queries that retrieval already nails.
const SYSTEM_PROMPT = [
  'You rewrite a user\'s search query for a hybrid keyword + vector search engine over a knowledge base.',
  'Output ONE rewritten query and nothing else — no preamble, no quotes, no explanation.',
  'Goal: surface the documents the user actually wants. If the query\'s literal words point at a different topic than the user\'s intent, translate the intent into the concrete terms the relevant documents would use (e.g. "keep the servers powered up" -> energy, electricity, utilities, grid, power).',
  'If the query is already a clear, specific keyword query, return it essentially unchanged — do not pad it.',
  'Keep it short: a phrase or comma-separated terms, not a sentence.',
].join('\n');

/**
 * @param {{backend?:string, map?:Object, model?:string, token?:string,
 *          maxTokens?:number, timeoutMs?:number, retries?:number}} [cfg]
 * @param {{fetchImpl?:Function}} [deps]
 * @returns {{ rewrite(query:string):Promise<string> } | null}
 */
export function createQueryRewriter(cfg = {}, deps = {}) {
  const backend = cfg.backend || 'none';
  if (backend === 'none') return null;
  if (backend === 'fixture') return createFixtureRewriter(cfg);
  if (backend === 'llm') return createLlmRewriter(cfg, deps);
  throw new Error(`unknown query-rewrite backend "${backend}"`);
}

// Deterministic map-based rewriter for eval + tests. Unknown queries pass
// through unchanged, so a partial map only rewrites the queries it covers.
function createFixtureRewriter(cfg) {
  const map = cfg.map || {};
  return {
    async rewrite(query) {
      const q = String(query || '');
      const hit = map[q] ?? map[q.trim()];
      return (typeof hit === 'string' && hit.trim()) ? hit : q;
    },
  };
}

function createLlmRewriter(cfg, { fetchImpl } = {}) {
  const fetchFn = fetchImpl || globalThis.fetch;
  const providerName = cfg.provider || 'anthropic';
  const provider = PROVIDERS[providerName];
  if (!provider) throw new Error(`unknown query-rewrite provider "${providerName}"`);
  const url = cfg.baseUrl || provider.url;
  const model = cfg.model || provider.defaultModel;
  const token = cfg.token || process.env[provider.tokenEnv];
  const maxTokens = cfg.maxTokens ?? DEFAULT_MAX_TOKENS;
  const opts = { timeoutMs: cfg.timeoutMs ?? 4000, retries: cfg.retries ?? 1 };

  return {
    async rewrite(query) {
      const q = String(query || '').trim();
      if (!q) return query;
      if (!token) return query; // unconfigured → no-op, never throw the search
      try {
        const headers = provider.headers(token);
        const payload = provider.payload(model, maxTokens, q);
        const data = await postJson(fetchFn, url, payload, headers, opts);
        const rewritten = (provider.parse(data) || '').trim();
        return rewritten || q;
      } catch {
        return q; // any failure → fall back to the raw query
      }
    },
  };
}

export default { createQueryRewriter };
