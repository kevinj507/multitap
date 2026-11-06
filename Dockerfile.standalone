FROM postgres:17

# Install Node.js and pgvector (the dense-retrieval chunk store, graph task
# #190). The deployed app runs its OWN Postgres, so pgvector is baked into this
# image and available on every deploy — independent of the host/Wafer image.
# postgresql-17-pgvector from the postgres image's PGDG repo is ≥0.8.2, the
# CVE-2026-3172 floor #190 requires. (Graph traversal still uses recursive CTEs
# in plain SQL — pgvector is only for the semantic search store.)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       curl \
       ca-certificates \
       postgresql-17-pgvector \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# App setup
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src/ src/
COPY public/ public/
COPY db/schema.sql db/schema.sql
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV PGDATA=/var/lib/postgresql/data

EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
