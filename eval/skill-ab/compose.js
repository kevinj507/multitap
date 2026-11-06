#!/usr/bin/env node
// E13.10 (#471) — compose a skill version: the LIVE SKILL.md (baseline, read fresh
// so it never drifts) + a selected subset of the 4 candidate write-side changes,
// appended under a "Write-side structure doctrine" heading. The changeset is the
// only thing that varies across A/B arms; everything else is held fixed.
// Run: node eval/skill-ab/compose.js --changes 1,2,3   (empty => baseline)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { arg } from './lib.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_PATH = path.resolve(__dirname, '../../.claude/skills/multitap/SKILL.md');

export function composeSkill(changeIds) {
  const base = fs.readFileSync(SKILL_PATH, 'utf-8');
  if (!changeIds || !changeIds.length) return base;
  const blocks = changeIds.map((i) => fs.readFileSync(path.join(__dirname, 'skill', `change${i}.md`), 'utf-8').trim());
  return `${base}\n\n## Write-side structure doctrine (how to build a graph that stays navigable)\n\nThe sections above cover the READ side (search + traversal). These rules govern the WRITE side — how to author nodes and edges so the graph is a faithful, navigable map:\n\n${blocks.join('\n\n')}\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const changes = (arg('changes', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
  process.stdout.write(composeSkill(changes));
}
