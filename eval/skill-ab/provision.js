#!/usr/bin/env node
// E13.10.1 (#470) — MAIN-LOOP provisioner (control plane). Creates the throwaway
// graphs an arm will build on, and writes a run-manifest the build/AQ workflows
// consume. NEVER touches the real graphs except read-only (the copy reads stock).
//   screen : N copies of stock, each DEGRADED (seeded, bridge-biased) so there is
//            real connective-tissue work. Keeps the title-keyed remap for scoring.
//   confirm: N empty graphs; the build agent fills them blank-slate from the corpus.
// Run: node eval/skill-ab/provision.js --track screen --arm c1 --runs 3 --seedBase 42 --out /tmp/ab/c1.manifest.json
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { post, arg } from './lib.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TRACK = arg('track', 'screen');
const ARM = arg('arm', 'baseline');
const RUNS = Number(arg('runs', '3'));
const SEED_BASE = Number(arg('seedBase', '42'));
const P = arg('p', '0.45');
const BIAS = arg('bias', '4');
const OUT = arg('out', null);
const SRC = process.env.SKILLAB_SRC || 'fwmhe8ysfrnx9fw7';
const CACHE = path.join(__dirname, 'frozen/stock-snapshot.json');
const node = (script, a) => execFileSync('node', [path.join(__dirname, script), ...a], { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });

const runDir = OUT ? path.dirname(OUT) : '/tmp/ab';
fs.mkdirSync(runDir, { recursive: true });
const stamp = `${TRACK}-${ARM}`;

const runs = [];
for (let k = 0; k < RUNS; k++) {
  const seed = SEED_BASE + k;
  const packDir = path.join(runDir, `${stamp}-r${k}-packs`);
  if (TRACK === 'screen') {
    const remapPath = path.join(runDir, `${stamp}-r${k}.remap.json`);
    // DB-level copy (instant, no re-embedding, no server memory spike — #436)
    const copyOut = JSON.parse(node('db-copy.js', ['--src', SRC, '--name', `AB-${stamp}-r${k}`, '--out', remapPath]).trim().split('\n').pop());
    const deg = JSON.parse(node('degrade.js', ['--gid', copyOut.newGid, '--remap', remapPath, '--p', P, '--bias', BIAS, '--seed', String(seed)]).trim());
    runs.push({ runIdx: k, gid: copyOut.newGid, remap: remapPath, seed, packDir, degrade: deg });
    process.stderr.write(`provisioned screen ${stamp} r${k}: gid=${copyOut.newGid} seed=${seed} edgesAfter=${deg.edgesAfter} bridgeReachAfter=${deg.reachAfter.bridge}\n`);
  } else {
    const gid = (await post(`/api/graphs`, { name: `AB-${stamp}-r${k}`, description: `throwaway confirm build, arm ${ARM}` })).id;
    runs.push({ runIdx: k, gid, seed, packDir, corpusPath: path.join(__dirname, 'frozen/corpus.md') });
    process.stderr.write(`provisioned confirm ${stamp} r${k}: gid=${gid}\n`);
  }
}

const manifest = { arm: ARM, track: TRACK, src: SRC, p: P, bias: BIAS, runs };
if (OUT) fs.writeFileSync(OUT, JSON.stringify(manifest, null, 2));

// emit the ab-build workflow args (skillPath + task come from CLI for parameterization)
const SKILL_PATH = arg('skillPath', null);
const TASK_FILE = arg('taskFile', null);
if (SKILL_PATH && TASK_FILE && OUT) {
  const buildArgs = {
    arm: ARM, track: TRACK,
    task: fs.readFileSync(TASK_FILE, 'utf-8'),
    skillPath: SKILL_PATH,
    runs: runs.map((r) => ({ gid: r.gid, runIdx: r.runIdx, ...(r.corpusPath ? { corpusPath: r.corpusPath } : {}) })),
    base: process.env.MULTITAP_BASE_URL || process.env.GRAPHTASK_BASE_URL || 'http://127.0.0.1:3000',
    writerName: process.env.MULTITAP_WRITER_NAME || "Kevin's Claude",
    builderModel: arg('builderModel', 'sonnet'),
  };
  fs.writeFileSync(OUT.replace(/\.manifest\.json$/, '.buildargs.json'), JSON.stringify(buildArgs));
}
console.log(JSON.stringify({ arm: ARM, track: TRACK, gids: runs.map((r) => r.gid), out: OUT }));
