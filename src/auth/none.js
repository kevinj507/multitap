// "No auth" adapter. Default for local and self-hosted deployments. Every
// request is anonymous; nothing is mounted; nothing is verified.
export function middlewares() {
  return [];
}

export async function verify(_req) {
  return null;
}

export function publishableKey() {
  return undefined;
}
