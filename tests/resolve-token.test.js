// Unit tests for the shared agent-token resolver (eval/resolve-token.js), the
// Node-side twin of the SKILL.md bash identity-block scan. Verifies env
// precedence, the .env parse rules (export prefix, quotes, whitespace, CRLF,
// trailing comment, last-wins), the exact key anchor (no _BACKUP false match),
// and parent-directory walk-up.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveAgentToken, parseTokenLine } from '../eval/resolve-token.js';

const KEY = 'MULTITAP_AGENT_TOKEN';
const LEGACY_KEY = 'GRAPHTASK_AGENT_TOKEN'; // the app's former name; still accepted
let savedEnv;
let savedLegacyEnv;
let root;

beforeEach(() => {
  savedEnv = process.env[KEY];
  savedLegacyEnv = process.env[LEGACY_KEY];
  delete process.env[KEY];
  delete process.env[LEGACY_KEY];
  root = mkdtempSync(join(tmpdir(), 'gt-tok-'));
});
afterEach(() => {
  if (savedEnv === undefined) delete process.env[KEY];
  else process.env[KEY] = savedEnv;
  if (savedLegacyEnv === undefined) delete process.env[LEGACY_KEY];
  else process.env[LEGACY_KEY] = savedLegacyEnv;
  rmSync(root, { recursive: true, force: true });
});

describe('parseTokenLine', () => {
  const cases = [
    ['MULTITAP_AGENT_TOKEN=gt_plain', 'gt_plain'],
    ['export MULTITAP_AGENT_TOKEN=gt_export', 'gt_export'],
    ['MULTITAP_AGENT_TOKEN="gt_dq"', 'gt_dq'],
    ["   MULTITAP_AGENT_TOKEN='gt_sq'", 'gt_sq'],
    ['MULTITAP_AGENT_TOKEN=gt_cmt   # trailing', 'gt_cmt'],
    ['MULTITAP_AGENT_TOKEN=gt_crlf\r', 'gt_crlf'],
    ['MULTITAP_AGENT_TOKEN=gt_pad==', 'gt_pad=='], // '=' inside value preserved
    ['GRAPHTASK_AGENT_TOKEN=gt_former', 'gt_former'], // former variable name
    ['export GRAPHTASK_AGENT_TOKEN="gt_former_dq"', 'gt_former_dq'],
  ];
  for (const [line, expected] of cases) {
    it(`parses ${JSON.stringify(line)} -> ${expected}`, () => {
      expect(parseTokenLine(line)).toBe(expected);
    });
  }
});

describe('resolveAgentToken', () => {
  it('prefers the environment variable and does no file I/O', () => {
    process.env[KEY] = 'gt_fromEnv';
    // No files written under root; env must win regardless.
    expect(resolveAgentToken({ cwd: root })).toBe('gt_fromEnv');
  });

  it('trims a whitespace-padded env value', () => {
    process.env[KEY] = '  gt_padded  ';
    expect(resolveAgentToken({ cwd: root })).toBe('gt_padded');
  });

  it('reads .env in cwd and populates process.env', () => {
    writeFileSync(join(root, '.env'), 'FOO=1\nMULTITAP_AGENT_TOKEN=gt_fromFile\n');
    expect(resolveAgentToken({ cwd: root })).toBe('gt_fromFile');
    expect(process.env[KEY]).toBe('gt_fromFile'); // side effect for child procs
  });

  it('does NOT match MULTITAP_AGENT_TOKEN_BACKUP or other keys', () => {
    writeFileSync(join(root, '.env'), 'MULTITAP_AGENT_TOKEN_BACKUP=gt_decoy\nSOME_TOKEN=gt_other\n');
    expect(resolveAgentToken({ cwd: root })).toBeNull();
  });

  it('takes the LAST matching assignment (bash tail -n1 parity)', () => {
    writeFileSync(join(root, '.env'), 'MULTITAP_AGENT_TOKEN=gt_first\nMULTITAP_AGENT_TOKEN=gt_last\n');
    expect(resolveAgentToken({ cwd: root })).toBe('gt_last');
  });

  it('honors the file precedence order (.env before .wafer/session.env)', () => {
    writeFileSync(join(root, '.env'), 'MULTITAP_AGENT_TOKEN=gt_dotenv\n');
    mkdirSync(join(root, '.wafer'));
    writeFileSync(join(root, '.wafer', 'session.env'), 'MULTITAP_AGENT_TOKEN=gt_wafer\n');
    expect(resolveAgentToken({ cwd: root })).toBe('gt_dotenv');
  });

  it('walks UP parent dirs — finds .wafer/session.env from a repo subdir', () => {
    mkdirSync(join(root, '.wafer'));
    writeFileSync(join(root, '.wafer', 'session.env'), 'MULTITAP_AGENT_TOKEN=gt_parent\n');
    const sub = join(root, 'repo', 'nested');
    mkdirSync(sub, { recursive: true });
    expect(resolveAgentToken({ cwd: sub })).toBe('gt_parent');
  });

  it('accepts the former GRAPHTASK_AGENT_TOKEN name from the environment', () => {
    process.env[LEGACY_KEY] = 'gt_formerEnv';
    expect(resolveAgentToken({ cwd: root })).toBe('gt_formerEnv');
  });

  it('prefers MULTITAP_AGENT_TOKEN over the former name in the environment', () => {
    process.env[LEGACY_KEY] = 'gt_formerEnv';
    process.env[KEY] = 'gt_currentEnv';
    expect(resolveAgentToken({ cwd: root })).toBe('gt_currentEnv');
  });

  it('reads the former name from a secrets file and exports the current one', () => {
    writeFileSync(join(root, '.env'), 'GRAPHTASK_AGENT_TOKEN=gt_formerFile\n');
    expect(resolveAgentToken({ cwd: root })).toBe('gt_formerFile');
    expect(process.env[KEY]).toBe('gt_formerFile');
  });

  it('still ignores GRAPHTASK_AGENT_TOKEN_BACKUP', () => {
    writeFileSync(join(root, '.env'), 'GRAPHTASK_AGENT_TOKEN_BACKUP=gt_decoy\n');
    expect(resolveAgentToken({ cwd: root })).toBeNull();
  });

  it('returns null when no token is anywhere', () => {
    writeFileSync(join(root, '.env'), 'FOO=bar\n');
    expect(resolveAgentToken({ cwd: root, maxUp: 0 })).toBeNull();
  });
});
