// E16.7 — STATIC test for the report-generation workflow.
//
// CRITICAL: report.workflow.js is NOT an importable ES module. It ends in a
// top-level `return` and reads runtime-INJECTED globals (`args`, `agent`,
// `parallel`, `phase`, `log`), so `await import()` of it throws
// `SyntaxError: Illegal return statement` (and, even wrapped, would
// ReferenceError on the globals). So this test reads the file as TEXT and
// asserts statically — it never imports/executes the workflow.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKFLOW = path.join(
  __dirname, '..', '.claude', 'skills', 'multitap', 'workflows', 'report.workflow.js',
);
const src = fs.readFileSync(WORKFLOW, 'utf-8');

// acorn ships transitively with some vitest toolchains but not others (vitest 4
// bundles oxc/rolldown, not acorn). Resolve it if present; otherwise the parse
// assertion below falls back to a regex-only structural scan, per the spec.
const require = createRequire(import.meta.url);
let acorn = null;
try { acorn = require('acorn'); } catch { acorn = null; }

// Remove comments so write-verb scans see only executable code. The workflow
// uses `//` line comments only (no `/* */` in the code region), but we strip
// both defensively. An inline `//` is only treated as a comment when preceded by
// whitespace, so URL schemes like `http://` inside code strings are preserved.
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
    .split('\n')
    .map((line) => (line.trimStart().startsWith('//') ? '' : line.replace(/\s+\/\/.*$/, '')))
    .join('\n');
}
const code = stripComments(src);

describe('E16.7 report.workflow.js (static)', () => {
  it('parses with allowReturnOutsideFunction via acorn (or a regex structural scan when acorn is absent)', () => {
    if (acorn) {
      expect(() => acorn.parse(src, {
        sourceType: 'module',
        ecmaVersion: 'latest',
        allowReturnOutsideFunction: true,
      })).not.toThrow();
    } else {
      // Fallback: acorn is not available in this repo's toolchain, so assert the
      // load-bearing structural anchors by regex instead of by AST.
      expect(/export const meta = \{/.test(src)).toBe(true);
      expect(/const \{ gid, base, focus, audience \} = args;/.test(src)).toBe(true);
      expect(/\nreturn \{/.test(src)).toBe(true); // the top-level return
    }
  });

  it('declares meta.name = multitap-report and phases covering Index/Outline/Draft/Stitch/Critic', () => {
    expect(/name:\s*'multitap-report'/.test(src)).toBe(true);
    for (const p of ['Index', 'Outline', 'Draft', 'Stitch', 'Critic']) {
      expect(new RegExp(`title:\\s*'${p}'`).test(src)).toBe(true);
    }
  });

  it('destructures the documented args and bounds the critic re-draft at MAX_ROUNDS = 2', () => {
    expect(/const \{ gid, base, focus, audience \} = args;/.test(src)).toBe(true);
    expect(/const MAX_ROUNDS = 2\b/.test(src)).toBe(true);
  });

  it('contains NO write-verb curl in executable code — no PUT to /report, no POST to /batch', () => {
    // No PUT curl anywhere (reads never PUT; the single PUT is the main loop's,
    // and it appears only in comments as prose).
    expect(/-X\s+PUT/.test(code)).toBe(false);
    // Never writes INTO the graph: the /batch endpoint is not referenced in code.
    expect(/\/batch/.test(code)).toBe(false);
    // Belt-and-suspenders: no POST aimed at /report either.
    expect(/-X\s+POST[^\n]*\/report/.test(code)).toBe(false);
    // Sanity: the /batch + PUT-to-/report mentions DO survive in the comments
    // (the main-loop contract), proving the scan is looking at stripped code.
    expect(/\/batch/.test(src)).toBe(true);
    expect(/PUT \/api\/graphs\/:gid\/report/.test(src)).toBe(true);
  });

  it('RETURNS the report contract: title, description, markdown, source_graph_version, coverage', () => {
    const ret = src.slice(src.lastIndexOf('return {'));
    expect(ret).not.toBe('');
    for (const key of ['title', 'description', 'markdown', 'source_graph_version', 'coverage']) {
      expect(new RegExp(`\\b${key}\\b`).test(ret)).toBe(true);
    }
  });
});
