# Modal Track B — hosted GPU embedding backend

This directory holds the **hosted** embedding backend for Multitap's KB search
(graph task #192). It serves **BGE-M3** (1024-dim) on a Modal **T4** GPU behind
one HTTP endpoint that speaks the exact contract the Wafer already uses
(`src/search/providers/http.js`), so turning it on is an **env change, no code
change**.

You only need this for the **hosted** deployment. Self-hosters run the local
backend (`EMBEDDING_BACKEND=local-onnx`, no account, no GPU) — see #173 §9.

---

## One-time setup (the operator does this)

### 1. Create a Modal account + install the CLI
```bash
pip install modal          # Python 3.10+; a fresh virtualenv is fine
modal setup                # opens the browser, links this machine to your account
```
Modal gives free monthly credits; our volume bills ≈ $0.

### 2. Deploy the app
From the project root (`/data/workspace/multitap`):
```bash
modal deploy modal/embeddings_app.py
```
First deploy bakes the model into the image (a few minutes). When it finishes,
Modal prints a **web endpoint URL** like:
```
https://<your-workspace>--multitap-embeddings-embedder-embed.modal.run
```
**Copy that URL** — it becomes `EMBEDDING_URL`.

### 3. Create a proxy-auth token
The endpoint is protected (`requires_proxy_auth=True`), so unauthorized requests
are rejected at Modal's edge and **never start a GPU container** (you don't pay
for randoms hitting the URL).

In the Modal dashboard: **Settings → Proxy Auth Tokens → Create**. You get:
- a **token id**  → this is `MODAL_KEY`
- a **token secret** → this is `MODAL_SECRET`

(Copy the secret immediately — Modal shows it once.)

### 4. Hand three values to Claude / set them as Wafer secrets
- the endpoint **URL** (`EMBEDDING_URL`)
- `MODAL_KEY`
- `MODAL_SECRET`

These go into the Wafer's environment as secrets — **never commit them**. The
Wafer then runs with:
```
EMBEDDING_BACKEND=http
EMBEDDING_URL=<the URL from step 2>
EMBEDDING_MODEL=BAAI/bge-m3
EMBEDDING_DIM=1024
MODAL_KEY=<from step 3>
MODAL_SECRET=<from step 3>
```

---

## Smoke test (optional, before wiring the Wafer)
```bash
curl -s -X POST "$EMBEDDING_URL" \
  -H 'Content-Type: application/json' \
  -H "Modal-Key: $MODAL_KEY" \
  -H "Modal-Secret: $MODAL_SECRET" \
  -d '{"texts":["hello world"],"model":"BAAI/bge-m3"}' | head -c 300
```
Expect `{"embeddings":[[...]],"model":"BAAI/bge-m3","dim":1024}`. The first call
after idle pays a cold start (~tens of seconds to load weights); subsequent
calls within 5 minutes are warm.

## Recording the eval row (Claude does this once keys are set)
The existing harness A/Bs whatever backend the env points at — no new code:
```bash
EMBEDDING_BACKEND=http EMBEDDING_URL=... EMBEDDING_MODEL=BAAI/bge-m3 \
EMBEDDING_DIM=1024 MODAL_KEY=... MODAL_SECRET=... \
  node eval/run-eval.js
```
That produces the "**+ Modal dense+RRF**" accuracy + latency row for the
local-vs-Modal comparison (#193).

---

## Notes
- **Serving engine:** uses `sentence-transformers` rather than the TEI server
  named in #173 §10 — same model, GPU, and response contract, but no
  CUDA-tag-per-GPU footgun on first deploy. TEI is a later drop-in upgrade
  behind the identical endpoint; the Wafer side never changes.
- **Cost control:** `scaledown_window=300` scales the GPU to zero 5 minutes
  after the last request; proxy auth blocks unbilled cold starts from strangers.
- **Pins:** if `modal deploy` fails on pip resolution, drop the version pins in
  `embeddings_app.py` to let pip pick the latest compatible set.
- **Reranker (Tier 2):** Phase 3. It'll add a second endpoint to this same app
  behind a `RerankProvider`; out of scope for #192.
