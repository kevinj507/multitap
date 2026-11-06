// Resolve the Multitap agent token the way the SKILL.md bash identity block
// does — env var FIRST, else scan repo-local secrets files — so Node eval /
// script tooling behaves like the skill: a token sitting in .env or
// .wafer/session.env is found even when the shell never `source`d it. Without
// this, `node eval/foo.js` in a fresh shell reads an empty
// process.env.MULTITAP_AGENT_TOKEN and silently makes unauthenticated calls
// (403s on owned graphs, orphan creates) — the exact false "no token" bug the
// skill resolver fixes for bash.
//
// Parity with the bash resolver (SKILL.md): same file list, same key anchor
// (matches `MULTITAP_AGENT_TOKEN=`, or the former `GRAPHTASK_AGENT_TOKEN=`, but NOT
// `MULTITAP_AGENT_TOKEN_BACKUP=`),
// tolerates an `export ` prefix, single/double quotes, leading whitespace,
// CRLF, and a trailing `# comment`; last matching assignment in a file wins.
// It ALSO walks up parent directories (the eval scripts run from the repo dir
// while the token commonly lives one level up in the workspace's
// .wafer/session.env), which the cwd-relative bash snippet doesn't need because
// the agent runs it from the workspace root.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const KEY = 'MULTITAP_AGENT_TOKEN';
// The app was called graphtask before; a token saved under that name still resolves.
const LEGACY_KEY = 'GRAPHTASK_AGENT_TOKEN';
const KEY_PATTERN = `(?:${KEY}|${LEGACY_KEY})`;
const SECRETS_FILES = ['.env', '.env.local', '.dev.vars', '.wafer/session.env', '.multitap/session.env', '.graphtask/session.env'];
const KEY_LINE = new RegExp(`^\\s*(?:export\\s+)?${KEY_PATTERN}=`);

// Extract the value from a matched assignment line. The value itself is an
// opaque token (no spaces), so a `# comment` is only stripped when preceded by
// whitespace, and `=` inside the value (e.g. base64 padding) is preserved
// because we strip only up to the FIRST `=`.
export function parseTokenLine(line) {
  let v = String(line).replace(/\r$/, '');
  v = v.replace(new RegExp(`^\\s*(?:export\\s+)?${KEY_PATTERN}=\\s*`), '');
  v = v.replace(/\s+#.*$/, '');
  v = v.replace(/^["']/, '').replace(/["']$/, '');
  return v.trim();
}

function tokenFromFile(path) {
  let text;
  try { text = readFileSync(path, 'utf8'); } catch { return null; }
  const matches = text.split('\n').filter((l) => KEY_LINE.test(l));
  if (matches.length === 0) return null;
  const val = parseTokenLine(matches[matches.length - 1]); // last wins (bash `tail -n1`)
  return val || null;
}

// Returns the resolved token string, or null. When found in a file (not already
// in the env), also sets process.env.MULTITAP_AGENT_TOKEN so later
// process.env reads and any child processes inherit it. Idempotent.
export function resolveAgentToken({ cwd = process.cwd(), maxUp = 6 } = {}) {
  const fromEnv = process.env[KEY] || process.env[LEGACY_KEY];
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();

  let dir = cwd;
  for (let up = 0; up <= maxUp; up++) {
    for (const rel of SECRETS_FILES) {
      const path = join(dir, rel);
      if (!existsSync(path)) continue;
      const val = tokenFromFile(path);
      if (val) { process.env[KEY] = val; return val; }
    }
    const parent = dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }
  return null;
}

export default resolveAgentToken;
