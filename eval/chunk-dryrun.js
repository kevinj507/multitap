#!/usr/bin/env node
// Chunker dry-run for the dense store (graph task #190, P2.2).
//
// Runs splitMarkdown() over real graphs WITHOUT any embedding model and reports
// what the chunker actually produces: whole-node token sizes (the truncation
// problem) vs. post-chunk passage sizes (the fix). This is the measurement that
// validates the ~300-token target before a dollar of GPU is spent — it answers
// "how many chunks, what sizes, and is every chunk small enough for the 512-tok
// model or do we need BGE-M3's 8192 window?"
//
// Token counts are ESTIMATES (~4 chars/token); the real BGE-M3 tokenizer lands
// with P2.1 and this script will re-run against it unchanged.
//
// Usage:
//   node eval/chunk-dryrun.js                       # the two measured graphs
//   node eval/chunk-dryrun.js --gid <id> [<id> ...] # custom graphs
//   node eval/chunk-dryrun.js --target 300 --overlap 50
//   MULTITAP_BASE_URL=... MULTITAP_AGENT_TOKEN=... node eval/chunk-dryrun.js --gid <id>

import { splitMarkdown, estimateTokens } from '../src/search/chunking.js';
import { resolveAgentToken } from './resolve-token.js';

const TOKEN = resolveAgentToken();

// The two graphs #190's measurements were taken from: this KB-search graph and
// the "AI demand → semiconductors" market-research graph.
const DEFAULT_GIDS = ['safqkahqnftyef4j', 'fwmhe8ysfrnx9fw7'];
const SMALL_MODEL_LIMIT = 512; // bge-small-en-v1.5
const BGE_M3_LIMIT = 8192;

function parseArgs(argv) {
  const args = { gids: [], target: 300, overlap: 50 };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--gid') { while (argv[i + 1] && !argv[i + 1].startsWith('--')) args.gids.push(argv[++i]); }
    else if (argv[i] === '--target') args.target = parseInt(argv[++i], 10);
    else if (argv[i] === '--overlap') args.overlap = parseInt(argv[++i], 10);
  }
  if (args.gids.length === 0) args.gids = DEFAULT_GIDS;
  return args;
}

async function loadNodes(gid) {
  const base = process.env.MULTITAP_BASE_URL || process.env.GRAPHTASK_BASE_URL || 'https://context.multitap.sh';
  const headers = TOKEN
    ? { Authorization: `Bearer ${TOKEN}` }
    : {};
  const res = await fetch(`${base}/api/graphs/${gid}/tasks`, { headers });
  if (!res.ok) throw new Error(`failed to load graph ${gid}: ${res.status}`);
  return res.json();
}

function stats(nums) {
  if (nums.length === 0) return { min: 0, avg: 0, p50: 0, p95: 0, max: 0 };
  const sorted = [...nums].sort((a, b) => a - b);
  const at = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  return {
    min: sorted[0],
    avg: Math.round(nums.reduce((a, b) => a + b, 0) / nums.length),
    p50: at(0.5),
    p95: at(0.95),
    max: sorted[sorted.length - 1],
  };
}

async function analyze(gid, target, overlap) {
  const nodes = await loadNodes(gid);
  const wholeTokens = [];
  const chunkTokens = [];
  const chunksPerNode = [];
  let nodesOverSmall = 0;
  let nodesOverM3 = 0;
  let chunksOverSmall = 0;

  for (const node of nodes) {
    const content = node.content || '';
    // Whole-node size = title + body (what truncation would have embedded).
    const { title, chunks } = splitMarkdown(content, { targetTokens: target, overlapTokens: overlap });
    const wholeText = (title ? title + '\n\n' : '') + content.replace(/^---\n[\s\S]*?\n---\n?/, '');
    const wt = estimateTokens(wholeText);
    wholeTokens.push(wt);
    if (wt > SMALL_MODEL_LIMIT) nodesOverSmall++;
    if (wt > BGE_M3_LIMIT) nodesOverM3++;

    chunksPerNode.push(chunks.length);
    for (const c of chunks) {
      chunkTokens.push(c.tokens);
      if (c.tokens > SMALL_MODEL_LIMIT) chunksOverSmall++;
    }
  }

  return {
    gid,
    nodeCount: nodes.length,
    chunkCount: chunkTokens.length,
    whole: stats(wholeTokens),
    chunk: stats(chunkTokens),
    chunksPerNode: stats(chunksPerNode),
    nodesOverSmall,
    nodesOverM3,
    chunksOverSmall,
    smallModelViable: chunksOverSmall === 0,
  };
}

function fmtStats(s) {
  return `avg ${s.avg}  p50 ${s.p50}  p95 ${s.p95}  max ${s.max}`;
}

async function main() {
  const args = parseArgs(process.argv);
  console.log(`\nChunker dry-run — target ~${args.target} tok, ~${args.overlap} overlap`);
  console.log(`token counts are ESTIMATES (~4 chars/tok); real tokenizer lands with P2.1\n`);

  for (const gid of args.gids) {
    let r;
    try {
      r = await analyze(gid, args.target, args.overlap);
    } catch (err) {
      console.log(`  ${gid}: SKIPPED — ${err.message}\n`);
      continue;
    }
    console.log(`graph ${r.gid} — ${r.nodeCount} nodes → ${r.chunkCount} chunks (${(r.chunkCount / r.nodeCount).toFixed(1)}/node)`);
    console.log(`  whole-node tok : ${fmtStats(r.whole)}`);
    console.log(`    over 512 (small model): ${r.nodesOverSmall}/${r.nodeCount} nodes${r.nodesOverM3 ? `   over 8192 (BGE-M3): ${r.nodesOverM3}` : ''}`);
    console.log(`  chunk tok      : ${fmtStats(r.chunk)}`);
    console.log(`    chunks/node  : ${fmtStats(r.chunksPerNode)}`);
    console.log(`  small-model (512) viable: ${r.smallModelViable ? 'YES — every chunk ≤512' : `NO — ${r.chunksOverSmall} chunk(s) over 512`}`);
    console.log('');
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
