#!/usr/bin/env python3
"""Regenerate tests/fixtures/static-embedding-reference.json — the ground
truth the static embedding backend (src/search/providers/wordpiece.js +
staticEmbedding.js) is pinned against.

Uses the OFFICIAL HF `tokenizers` library over the model's own tokenizer.json,
and numpy over the raw safetensors matrix — the exact semantics
sentence-transformers' StaticEmbedding uses at inference (verified against the
v3.3.0 and v5.6.1 sources): encode with add_special_tokens=False, mean-pool
token rows, and (per the provider contract) L2-normalize. dim256 vectors are
the MRL prefix-slice, renormalized.

Run it only when the case battery changes; the output is committed so `npm
test`'s reference tier never depends on Python being present.

    python3 -m venv /tmp/refenv && /tmp/refenv/bin/pip install tokenizers numpy
    node scripts/fetch-static-model.mjs   # puts raw model under models/static/raw
    /tmp/refenv/bin/python eval/gen-static-embedding-reference.py
"""
import json, struct, sys, os
import numpy as np
from tokenizers import Tokenizer

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_DIR = sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO, "models", "static", "raw")
OUT = os.path.join(REPO, "tests", "fixtures", "static-embedding-reference.json")

tok = Tokenizer.from_file(f"{MODEL_DIR}/tokenizer.json")

with open(f"{MODEL_DIR}/model.safetensors", "rb") as f:
    hlen = struct.unpack("<Q", f.read(8))[0]
    header = json.loads(f.read(hlen))
    info = header["embedding.weight"]
    assert info["dtype"] == "F32"
    vocab_size, dim = info["shape"]
    start, end = info["data_offsets"]
    f.seek(8 + hlen + start)
    mat = np.frombuffer(f.read(end - start), dtype="<f4").reshape(vocab_size, dim)

def embed(text, d):
    ids = tok.encode(text, add_special_tokens=False).ids
    if len(ids) == 0:
        return [0.0] * d
    v = mat[ids, :d].mean(axis=0).astype(np.float64)
    n = np.linalg.norm(v)
    if n > 0:
        v = v / n
    return v.tolist()

# The battery: canonical examples, unicode adversaries (incl. the review's
# confirmed divergences: U+2028/29 separators, Greek Final_Sigma, unassigned
# Cn code points, zero-width-only), markdown/code/URL shapes, and realistic
# Multitap-chunk-like texts.
texts = [
    "The weather is lovely today.",
    "It's so sunny outside!",
    "He drove to the stadium.",
    "",
    "   \t\n  ",
    "Café Münchën — naïve résumé",
    "深度学习模型正在改变搜索",
    "I ❤️ embeddings \U0001F680",
    "a" * 150,
    "foo!!!bar??  baz--qux",
    "const x = fold.rtx(|views| views.count());",
    "https://example.com/path?q=1&r=2#frag",
    "3.14159 items cost $42.50 (net of 7% VAT)",
    "GraphTask node #4005 [concept/review] — RRF hybrid ranking (k=60)",
    "line1\nline2\tend",
    "“smart quotes” and — dashes…",
    "blahblahzzzqqq  � xx",
    "UPPERCASE MiXeD lower 123ABC",
    "foo bar and foo baz",
    "ΟΔΥΣΣΕΥΣ ΚΑΙ ΑΘΗΝΑΣ — ΣΑΣ",
    "ab͸cd",
    "​",
    "İstanbul İstanbul",
    # realistic multi-line markdown windows (originally sampled from live
    # task_chunks rows; frozen here so regeneration is deterministic)
    "## The thesis in one paragraph (May 2026)\n$660–725B of Big-5 capex in 2026 (~2x 2025) flows through ~73 inter-\nconnected pieces. **Bottleneck migrated**: 2024=GPUs, 2025=HBM,\n2026=power+advanced-packaging.",
    "Structural moats: **NVDA CUDA, TSMC CoWoS, SK Hynix HBM**; emerging chokepoints in **transformers & turbines**. Watch: CoWoS exit velocity, HBM4 qual, gas-turbine lead times, UEC adoption.",
    "- [ ] verify pgvector halfvec index params (m=16, ef_construction=64)\n- [x] RRF fusion k=60 shipped\n- chunking: target 512 tokens, overlap capped at `overlap`",
    "### Retraction path\nDELETE FROM task_chunks WHERE task_id = $1; then re-embed on content sha change. The dense leg max-pools chunk scores back to nodes before fusing with BM25.",
]

cases = [{"text": t, "ids": tok.encode(t, add_special_tokens=False).ids,
          "dim1024": embed(t, 1024), "dim256": embed(t, 256)} for t in texts]
with_special = [{"text": c["text"], "ids": tok.encode(c["text"], add_special_tokens=True).ids} for c in cases[:6]]
E = np.array([embed(t, 1024) for t in texts[:3]])
sims = (E @ E.T).tolist()

json.dump({
    "model": "sentence-transformers/static-retrieval-mrl-en-v1",
    "note": "ids/vectors via official HF tokenizers + numpy over raw safetensors; add_special_tokens=False (StaticEmbedding semantics); vectors L2-normalized mean-pooled; dim256 = first 256 dims then renormalized (MRL truncation)",
    "cases": cases,
    "withSpecialTokens": with_special,
    "exampleSimilarities": sims,
}, open(OUT, "w"))
print(f"wrote {OUT}: {len(cases)} cases")
