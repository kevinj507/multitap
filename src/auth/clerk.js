// Clerk adapter. Only loaded when AUTH_PROVIDER=clerk. The module-level
// import of @clerk/express does not contact the network or require env vars
// — those are needed when clerkMiddleware() is constructed and when verify()
// resolves a user — so importing this file is safe even before env vars are
// validated.
import { clerkMiddleware, getAuth, clerkClient } from '@clerk/express';

export function middlewares() {
  if (!process.env.CLERK_SECRET_KEY) {
    throw new Error(
      'AUTH_PROVIDER=clerk requires CLERK_SECRET_KEY (and CLERK_PUBLISHABLE_KEY for the frontend)',
    );
  }
  return [clerkMiddleware()];
}

export async function verify(req) {
  const auth = getAuth(req);
  if (!auth?.userId) return null;
  // Clerk's session JWT only carries the userId; email + name require a
  // round-trip to the Clerk API. Acceptable per-request cost for v1; a cache
  // keyed on (userId, updated_at) can be layered on later if needed.
  const user = await clerkClient.users.getUser(auth.userId);
  return {
    providerUserId: auth.userId,
    email: user.primaryEmailAddress?.emailAddress ?? null,
    displayName: user.fullName ?? user.username ?? null,
  };
}

export function publishableKey() {
  return process.env.CLERK_PUBLISHABLE_KEY;
}
