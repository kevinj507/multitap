// Shared HTTP plumbing for the model-backend providers (graph task #194, P2.1).
// One contract covers local TEI and Modal — they differ only by URL + model +
// auth header (#173 §10), so the transport lives here once and embedding.js /
// rerank.js just shape the request/response.

export const DEFAULT_TIMEOUT_MS = 10_000;
export const DEFAULT_RETRIES = 2;

/**
 * Auth header is chosen by which credential is configured — NOT by a separate
 * "is this Modal?" flag — so swapping local⇄Modal stays a pure env change
 * (#173 §10: "swap = env change, no code change"). Modal proxy-auth wins when
 * both key+secret are present; otherwise a bearer token; otherwise no auth.
 */
export function authHeaders(cfg = {}) {
  const h = { 'Content-Type': 'application/json' };
  if (cfg.modalKey && cfg.modalSecret) {
    h['Modal-Key'] = cfg.modalKey;
    h['Modal-Secret'] = cfg.modalSecret;
  } else if (cfg.token) {
    h['Authorization'] = `Bearer ${cfg.token}`;
  }
  return h;
}

/**
 * POST JSON with a timeout and bounded retry. Retries network errors, timeouts,
 * and 5xx (the provider is warming / scaled-to-zero); fails fast on 4xx (a 4xx
 * is our bug — bad auth or payload — and retrying won't fix it).
 */
export async function postJson(fetchFn, url, payload, headers, { timeoutMs = DEFAULT_TIMEOUT_MS, retries = DEFAULT_RETRIES } = {}) {
  const body = JSON.stringify(payload);
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res;
    // Network errors / timeouts are retryable — keep them inside the catch.
    try {
      res = await fetchFn(url, { method: 'POST', headers, body, signal: ctrl.signal });
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt >= retries) throw err;
      continue;
    }
    clearTimeout(timer);
    if (res.ok) return await res.json();
    // HTTP-status failures are handled here, OUTSIDE the network catch, so a
    // 4xx fails fast (our bug — bad auth/payload) instead of being retried.
    const httpErr = new Error(`provider responded HTTP ${res.status}`);
    httpErr.status = res.status;
    if (res.status >= 500 && attempt < retries) { lastErr = httpErr; continue; }
    throw httpErr;
  }
  throw lastErr;
}

/** L2-normalize so cosine == dot product downstream (the EmbeddingProvider
 *  contract promises normalized vectors regardless of server-side settings). */
export function l2normalize(vec) {
  let sum = 0;
  for (const x of vec) sum += x * x;
  const norm = Math.sqrt(sum) || 1;
  return vec.map((x) => x / norm);
}

export default { authHeaders, postJson, l2normalize, DEFAULT_TIMEOUT_MS, DEFAULT_RETRIES };
