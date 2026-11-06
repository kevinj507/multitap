#!/usr/bin/env node
// Fetch + convert a sentence-transformers StaticEmbedding model into compact
// GTSE artifacts for the `static` embedding backend (staticEmbedding.js).
//
// Why a converter instead of loading safetensors at runtime: the raw matrix is
// fp32 30522×1024 (125 MB). Per-row absmax int8 quantization cuts that 4× and
// MRL truncation (the model is Matryoshka-trained; prefix-slice is the
// documented truncation) cuts dim 1024→256 for another 4× — 7.8 MB loads in
// well under a second on the 1-core box, which is the whole cold-start win.
//
// Source weights are pinned to an exact HF revision and checked against sha256
// digests (MANIFEST below) — downloads, warm caches, and --src files all go
// through the same check. A mismatch aborts before anything is written.
//
// Usage:
//   node scripts/fetch-static-model.mjs                # default variants
//   node scripts/fetch-static-model.mjs --variants int8-d1024,int8-d256
//   node scripts/fetch-static-model.mjs --src /path/with/model.safetensors
//   node scripts/fetch-static-model.mjs --allow-unverified   # downgrade digest
//                                       # failures to warnings (deliberate use
//                                       # of other weights; not for normal runs)
//
// Writes models/static/<base>-<variant>.gtse + models/static/tokenizer.json.
// models/ is gitignored — run this once per deployment (or CI cache).

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { fileURLToPath } from 'url';
import { buildGtse } from '../src/search/providers/staticEmbedding.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HF_MODEL = 'sentence-transformers/static-retrieval-mrl-en-v1';
const BASE_NAME = 'static-retrieval-mrl-en-v1';
const OUT_DIR = path.join(REPO, 'models', 'static');

// Pinned revision + content digests. `resolve/main` follows whatever the repo
// owner uploads next: these weights ARE the semantic search index, so a silent
// re-upload would silently change every retrieval result under an unchanged
// modelId. Nothing else here is fetched unpinned — npm deps are lockfile-pinned
// and OSV-gated pre-push (SECURITY.md) — so this closed the last gap.
//
// The digests, not the revision, are the real check: a revision pin alone still
// trusts HF to serve the same bytes for that SHA. model.safetensors' sha256 is
// HF's LFS oid for this revision; tokenizer.json is not LFS, so its digest was
// taken from the pinned download and confirmed byte-identical to the copy the
// shipped .gtse artifacts were built from (verified 2026-08-05).
const HF_REVISION = 'f60985c706f192d45d218078e49e5a8b6f15283a'; // uploaded 2025-01-17
const HF_BASE = `https://huggingface.co/${HF_MODEL}/resolve/${HF_REVISION}`;
const MANIFEST = {
  'model.safetensors': {
    sha256: '164fc63ee9f9267be7378fcbd7df99d09788a2f45244c92aa99ae5a574925716',
    size: 125018208,
  },
  'tokenizer.json': {
    sha256: 'd241a60d5e8f04cc1b2b3e9ef7a4921b27bf526d9f6050ab90f9267a1f9e5c66',
    size: 711396,
  },
};

const sha256Buf = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

async function sha256File(file) {
  // Streamed: model.safetensors is 125 MB and this runs on a 1-core, ~3 GB box.
  const h = crypto.createHash('sha256');
  await pipeline(fs.createReadStream(file), h);
  return h.digest('hex');
}

/** Throws unless (sha256, size) match MANIFEST[name]. Unlisted names pass. */
function assertDigest(name, got, size, allowUnverified) {
  const want = MANIFEST[name];
  if (!want) return;
  if (got === want.sha256 && size === want.size) return;
  const detail = `expected sha256 ${want.sha256} (${want.size} bytes), got ${got} (${size} bytes)`;
  if (allowUnverified) {
    console.warn(`  WARNING: using UNVERIFIED ${name} — ${detail}`);
    return;
  }
  throw new Error(
    `integrity check FAILED for ${name} — ${detail}\n` +
      `  Pinned revision is ${HF_REVISION}. If you intend different weights, update\n` +
      `  MANIFEST in this script; to bypass deliberately, re-run with --allow-unverified.`,
  );
}

function parseArgs(argv) {
  const args = {
    variants: ['int8-d1024', 'int8-d256', 'f32-d1024', 'f32-d256'],
    src: null,
    allowUnverified: false,
  };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--variants') args.variants = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (argv[i] === '--src') args.src = argv[++i];
    else if (argv[i] === '--allow-unverified') args.allowUnverified = true;
    else throw new Error(`unknown arg ${argv[i]}`);
  }
  return args;
}

async function download(url, dest, name, { allowUnverified }) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    // The cache is verified too, not just presence-checked: a poisoned or
    // half-replaced file on disk must not ride through to the artifacts just
    // because it exists and is non-empty. A bad cache is re-downloaded.
    try {
      assertDigest(name, await sha256File(dest), fs.statSync(dest).size, allowUnverified);
      console.log(`  cached (verified): ${dest}`);
      return;
    } catch (err) {
      console.warn(`  cached ${name} failed verification — re-downloading. ${err.message}`);
      fs.rmSync(dest, { force: true });
    }
  }
  console.log(`  downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed HTTP ${res.status}: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // Verify length when the server declares it, and write atomically
  // (tmp + rename) — a partially-written file must never be mistaken for a
  // valid cache by the size>0 check above.
  const declared = Number(res.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > 0 && buf.length !== declared) {
    throw new Error(`download truncated: got ${buf.length} of ${declared} bytes for ${url}`);
  }
  // Digest BEFORE the rename, so an artifact that fails the check never lands
  // at `dest` where the next run would treat it as a warm cache.
  assertDigest(name, sha256Buf(buf), buf.length, allowUnverified);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.tmp`;
  fs.writeFileSync(tmp, buf);
  fs.renameSync(tmp, dest);
  console.log(`  saved ${dest} (${(buf.length / 1e6).toFixed(1)} MB, sha256 ok)`);
}

/** Minimal safetensors reader for the single-tensor StaticEmbedding file. */
function readSafetensors(file) {
  const buf = fs.readFileSync(file);
  const headerLen = Number(buf.readBigUInt64LE(0));
  const header = JSON.parse(buf.subarray(8, 8 + headerLen).toString('utf8'));
  const info = header['embedding.weight'];
  if (!info) throw new Error(`embedding.weight not found; tensors: ${Object.keys(header).join(', ')}`);
  if (info.dtype !== 'F32') throw new Error(`expected F32 tensor, got ${info.dtype}`);
  const [vocabSize, dim] = info.shape;
  const [start, end] = info.data_offsets;
  const bytes = buf.subarray(8 + headerLen + start, 8 + headerLen + end);
  // Copy into an aligned Float32Array (Buffer pool offsets aren't 4-aligned).
  const mat = new Float32Array(vocabSize * dim);
  for (let i = 0; i < mat.length; i++) mat[i] = bytes.readFloatLE(i * 4);
  return { mat, vocabSize, dim };
}

function writeGtse(file, { mat, vocabSize, srcDim }, dim, dtype) {
  const buf = buildGtse(mat, {
    model: `${BASE_NAME}-${dtype}-d${dim}`,
    sourceModel: HF_MODEL,
    vocabSize,
    srcDim,
    dim,
    dtype,
  });
  fs.writeFileSync(file, buf);
  console.log(`  wrote ${file} (${(fs.statSync(file).size / 1e6).toFixed(1)} MB)`);
}

async function main() {
  const args = parseArgs(process.argv);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const srcDirDefault = path.join(OUT_DIR, 'raw');
  const stFile = args.src
    ? path.join(args.src, 'model.safetensors')
    : path.join(srcDirDefault, 'model.safetensors');
  const tokSrc = args.src
    ? path.join(args.src, 'tokenizer.json')
    : path.join(srcDirDefault, 'tokenizer.json');

  console.log(`model: ${HF_MODEL} @ ${HF_REVISION}`);
  if (!args.src) {
    await download(`${HF_BASE}/0_StaticEmbedding/model.safetensors`, stFile, 'model.safetensors', args);
    await download(`${HF_BASE}/0_StaticEmbedding/tokenizer.json`, tokSrc, 'tokenizer.json', args);
  } else {
    // --src bypasses the download, so verify the supplied files here instead —
    // otherwise the flag would be a silent hole straight past the digest check.
    for (const [file, name] of [[stFile, 'model.safetensors'], [tokSrc, 'tokenizer.json']]) {
      assertDigest(name, await sha256File(file), fs.statSync(file).size, args.allowUnverified);
    }
    console.log(`  --src files verified against the pinned manifest`);
  }

  fs.copyFileSync(tokSrc, path.join(OUT_DIR, 'tokenizer.json'));
  console.log(`  tokenizer → ${path.join(OUT_DIR, 'tokenizer.json')}`);

  const { mat, vocabSize, dim: srcDim } = readSafetensors(stFile);
  console.log(`  matrix: ${vocabSize}×${srcDim} f32`);

  for (const variant of args.variants) {
    const m = variant.match(/^(int8|f32)-d(\d+)$/);
    if (!m) throw new Error(`bad variant "${variant}" — expected e.g. int8-d256`);
    const dtype = m[1];
    const dim = Number(m[2]);
    if (dim < 1 || dim > srcDim) throw new Error(`dim ${dim} out of range 1..${srcDim}`);
    writeGtse(path.join(OUT_DIR, `${BASE_NAME}-${dtype}-d${dim}.gtse`), { mat, vocabSize, srcDim }, dim, dtype);
  }
  console.log('done');
}

main().catch((e) => { console.error(e); process.exit(1); });
