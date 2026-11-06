// Auth provider selector. AUTH_PROVIDER picks the adapter at process start;
// the rest of the app calls getAdapter() and never imports concrete adapter
// files. Clerk is loaded via dynamic import so that AUTH_PROVIDER=none never
// pays the cost of @clerk/express being on disk or in the module graph.
import * as none from './none.js';

let cached;

export async function getAdapter() {
  if (cached) return cached;
  const provider = process.env.AUTH_PROVIDER || 'none';
  if (provider === 'none') {
    cached = { ...none, provider: 'none' };
  } else if (provider === 'clerk') {
    const clerk = await import('./clerk.js');
    cached = {
      middlewares: clerk.middlewares,
      verify: clerk.verify,
      publishableKey: clerk.publishableKey,
      provider: 'clerk',
    };
  } else {
    throw new Error(`unknown AUTH_PROVIDER: ${provider}`);
  }
  return cached;
}

// Whether this deployment has accounts enabled — i.e. any provider other than
// `none`. Reads the currently-installed adapter (set at boot by getAdapter, or
// swapped in by tests), so it stays correct under test adapter swaps. Returns
// false before any adapter is cached. Synchronous on purpose: hot-path callers
// (e.g. the POST /api/graphs orphan guard) shouldn't await.
export function authEnabled() {
  return !!cached && cached.provider !== 'none';
}

// Test-only: drop the cached adapter so a different AUTH_PROVIDER env can be
// picked up. Production never calls this.
export function _resetAdapterCacheForTests() {
  cached = undefined;
}

// Test-only: install a fully-formed adapter object directly. Used by route
// tests to simulate a signed-in user via a request header, bypassing Clerk
// entirely. The adapter object must implement `provider`, `middlewares()`,
// `verify(req)`, and `publishableKey()`.
export function _setAdapterForTests(adapter) {
  cached = adapter;
}
