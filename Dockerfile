# Wafer deployment image: the app only. The database is the project's
# production PostgreSQL on the host (DATABASE_URL is injected at publish),
# so no Postgres is bundled here. The standalone image that bundles its own
# Postgres (docker-compose, self-hosters without a managed database) is
# Dockerfile.standalone.
FROM node:22-bookworm-slim

# curl: the platform health check runs inside the container.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src/ src/
COPY public/ public/
COPY db/ db/
COPY scripts/ scripts/
# Static embedding artifacts. models/ is gitignored and the platform builds
# from the committed tree, so the image fetches them itself: the script pins
# the Hugging Face revision and checks the source digests, and the produced
# artifact is checked here against the bytes the hosted deployment serves.
# EMBEDDING_STATIC_DIR defaults to <repo>/models/static.
RUN node scripts/fetch-static-model.mjs --variants int8-d1024 \
    && printf '%s  %s\n' \
         526bb754d31b1cd515583ed9d2087215c579de27dce34d27aa856150c1ca2617 models/static/static-retrieval-mrl-en-v1-int8-d1024.gtse \
         d241a60d5e8f04cc1b2b3e9ef7a4921b27bf526d9f6050ab90f9267a1f9e5c66 models/static/tokenizer.json \
       | sha256sum -c -

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

EXPOSE 3000

CMD ["node", "src/server.js"]
