"""
Modal Track B — hosted GPU embedding backend for Multitap KB search.
(graph task #192; spec in #173 §10. Pairs with the local Track A / #191.)

Serves BGE-M3 (1024-dim, cosine-normalized) on a Modal T4 behind a single HTTP
endpoint that speaks Multitap's EmbeddingProvider contract VERBATIM:

    POST  ->  { "texts": ["...", "..."], "model": "<id>" }
    200   <-  { "embeddings": [[...], [...]], "model": "<id>", "dim": 1024 }

That is exactly what `src/search/providers/http.js` sends and parses, so the
Wafer swaps the local backend for this one with an ENV CHANGE ONLY — no code
change (the whole point of the provider abstraction, #173 §10):

    EMBEDDING_BACKEND=http
    EMBEDDING_URL=<the deployed endpoint URL>     # printed by `modal deploy`
    EMBEDDING_MODEL=BAAI/bge-m3
    EMBEDDING_DIM=1024
    MODAL_KEY=<proxy-auth token id>
    MODAL_SECRET=<proxy-auth token secret>

Cost: T4 at ~$0.000164/s, scale-to-zero between requests. ~10k searches/mo
≈ $0.30–2, comfortably under Modal's free monthly credits → effectively $0.

SERVING ENGINE — deliberate deviation from #173 §10: the plan named TEI
(text-embeddings-inference) as the ideal server. This file uses
sentence-transformers instead — SAME model, SAME GPU, SAME response contract —
because TEI needs a CUDA image tag matched to the exact GPU (turing vs ampere
vs hopper) and gets brittle on a first deploy. sentence-transformers runs on
whatever GPU Modal assigns. TEI is a drop-in performance upgrade later behind
the identical endpoint contract; nothing on the Wafer side changes when we swap.

Deploy: `modal deploy modal/embeddings_app.py`  (full steps in modal/README.md)
"""

import modal

MODEL_ID = "BAAI/bge-m3"
RERANKER_ID = "BAAI/bge-reranker-v2-m3"  # Tier-2 cross-encoder (#173 §10 Modal track)
CACHE_DIR = "/cache"  # model weights are baked into the image at this path
GPU = "T4"


def _download_model():
    from sentence_transformers import SentenceTransformer, CrossEncoder

    SentenceTransformer(MODEL_ID, cache_folder=CACHE_DIR)
    # CrossEncoder has no cache_folder arg; it honors the HF cache (HF_HOME, set
    # on the image to CACHE_DIR) so its weights bake into the image layer too.
    CrossEncoder(RERANKER_ID)


# Pins are known-good as of authoring; if pip resolution fails on deploy, relax
# them to the latest compatible versions (see modal/README.md troubleshooting).
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "sentence-transformers==3.3.1",
        # torch >= 2.6 is REQUIRED: newer transformers refuses torch.load on
        # older torch (CVE-2025-32434) when a model ships .bin weights, which
        # blocks baking BGE-M3. 2.6+ lifts the restriction.
        "torch==2.6.0",
        "hf_transfer==0.1.8",
        "fastapi[standard]==0.115.5",
    )
    # Faster weight downloads + a stable HF cache path so the reranker (which
    # has no cache_folder arg) bakes into the image alongside the embed model.
    .env({"HF_HUB_ENABLE_HF_TRANSFER": "1", "HF_HOME": CACHE_DIR})
    # Bake the weights INTO the image so cold-start containers never re-download
    # from HuggingFace (#173 §10: ".run_function(download_model)").
    .run_function(_download_model)
)

app = modal.App("multitap-embeddings", image=image)


@app.cls(
    gpu=GPU,
    scaledown_window=300,  # stay warm 5 min after the last call, then scale to zero
    max_containers=4,      # cap fan-out; bump only if you batch-reindex a huge graph
)
@modal.concurrent(max_inputs=10)  # one warm GPU serves several concurrent searches
class Embedder:
    @modal.enter()
    def load(self):
        from sentence_transformers import SentenceTransformer

        self.model = SentenceTransformer(MODEL_ID, cache_folder=CACHE_DIR, device="cuda")
        # Warm-up forward pass so the first real request doesn't eat JIT/alloc time.
        self.model.encode(["warm up"], normalize_embeddings=True)

    @modal.fastapi_endpoint(method="POST", requires_proxy_auth=True)
    def embed(self, data: dict):
        # Body matches the Wafer's http provider (src/search/providers/http.js):
        # { "texts": [...], "model": "<id>" }. Typing the param as `dict` lets
        # FastAPI parse the JSON body WITHOUT importing pydantic at module load,
        # which `modal deploy` runs locally (pydantic isn't in the CLI env).
        texts = data.get("texts") or []
        model = data.get("model") or MODEL_ID
        # Empty batch is valid — the client never sends one, but stay defensive.
        if not texts:
            return {"embeddings": [], "model": model, "dim": 1024}

        # normalize_embeddings=True → cosine == dot product downstream, matching
        # the EmbeddingProvider contract (the Wafer L2-normalizes again anyway).
        vectors = self.model.encode(
            texts,
            normalize_embeddings=True,
            batch_size=64,
            convert_to_numpy=True,
        )
        embeddings = [v.tolist() for v in vectors]
        return {
            "embeddings": embeddings,
            "model": model,
            "dim": len(embeddings[0]),
        }


@app.cls(
    gpu=GPU,
    scaledown_window=300,
    max_containers=4,
)
@modal.concurrent(max_inputs=10)
class Reranker:
    """Tier-2 cross-encoder. Separate scale-to-zero container so it's only billed
    when a search actually reranks. Speaks the Wafer's RerankProvider contract
    (src/search/providers/rerank.js): { query, documents, model } -> { scores }."""

    @modal.enter()
    def load(self):
        from sentence_transformers import CrossEncoder

        self.model = CrossEncoder(RERANKER_ID, device="cuda")
        # Warm-up so the first real query doesn't pay JIT/alloc.
        self.model.predict([("warm", "up")])

    @modal.fastapi_endpoint(method="POST", requires_proxy_auth=True)
    def rerank(self, data: dict):
        query = data.get("query") or ""
        docs = data.get("documents") or []
        model = data.get("model") or RERANKER_ID
        if not docs:
            return {"scores": [], "model": model}
        # CrossEncoder scores each (query, doc) pair jointly; default activation
        # for this single-logit model is sigmoid → [0,1], matching the local path.
        pairs = [(query, d) for d in docs]
        scores = self.model.predict(pairs, batch_size=32, convert_to_numpy=True)
        return {"scores": [float(s) for s in scores], "model": model}
