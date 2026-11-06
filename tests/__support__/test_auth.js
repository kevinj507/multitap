// Test-only auth adapter. Reads `X-Test-User-Id: <providerUserId>` and turns
// that into a verified user, exercising the same verifyAuth → upsert-users
// path that production runs in `clerk` mode. Letting tests run through the
// real middleware chain catches more integration bugs than mocking req.user.
export function makeHeaderAuthAdapter() {
  return {
    provider: 'test-header',
    middlewares: () => [],
    verify: async (req) => {
      const pid = req.headers['x-test-user-id'];
      if (!pid) return null;
      return {
        providerUserId: pid,
        email: `${pid}@test.local`,
        displayName: pid,
      };
    },
    publishableKey: () => null,
  };
}
