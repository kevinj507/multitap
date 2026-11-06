// Authoritative display name for a writer on the live canvas.
//
// The token owner (or signed-in user) is the source of truth for WHO is
// acting. The client-supplied name (X-Writer-Name) is only a fallback for
// anonymous / no-auth writers. This matters because the agent skill seeds its
// local name from `git config user.name` — which on a shared/cloned repo is
// the project AUTHOR, not the person currently driving the agent. The server
// already knows the operator from the token owner's `users` row, so it names
// the avatar from that and ignores the (possibly wrong) client name.
//
// Harness-agnostic by design: the OPERATOR comes from the server (token →
// user), while the AGENT LABEL ("Claude", "Codex", …) comes from the client
// name, so a different harness names itself without server changes.

const MAX = 64;

function clampName(s) {
  if (typeof s !== 'string') return null;
  const t = s.trim();
  if (!t) return null;
  return t.length > MAX ? t.slice(0, MAX) : t;
}

// Derive a friendly name from an email's local part. Take the first segment
// before a separator and capitalize it: "ada.lovelace@example.com" → "Ada",
// "grace42@example.com" → "Grace42". Uniqueness is the email's job; two
// people who collapse to the same name are told apart by avatar color on the
// canvas, so we don't try to make this globally unique.
export function nameFromEmail(email) {
  if (typeof email !== 'string') return null;
  const local = email.split('@')[0] || '';
  const seg = (local.split(/[.+_-]/)[0] || local).trim();
  if (!seg) return null;
  return seg.charAt(0).toUpperCase() + seg.slice(1);
}

// The operator (human) behind a request: prefer an explicitly set display
// name, fall back to the email local part. Null when there's no authed user.
export function operatorName(user) {
  if (!user) return null;
  return clampName(user.display_name) || nameFromEmail(user.email) || null;
}

// Pull the agent product label out of a client-supplied "<x>'s Claude" name so
// the harness names itself (Claude / Codex / …). Defaults to "Claude".
export function agentLabelFromClientName(clientName) {
  if (typeof clientName === 'string') {
    const m = clientName.match(/['’]s\s+(.+?)\s*$/);
    if (m) return clampName(m[1]) || 'Claude';
  }
  return 'Claude';
}

// Authoritative name for an AGENT writer. When we know the operator, the name
// is "<Operator>'s <Label>"; otherwise fall back to whatever the client sent
// (e.g. "Quiet Otter's Claude" on a no-auth instance), then a bare "Agent".
export function resolveAgentName({ user, clientName } = {}) {
  const op = operatorName(user);
  if (op) return `${op}'s ${agentLabelFromClientName(clientName)}`;
  return clampName(clientName) || 'Agent';
}
