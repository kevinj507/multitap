-- E18.1 — attribute this file's own DML. applySchema() (src/db.js:15-20) runs
-- the WHOLE file as one multi-statement query, i.e. one implicit transaction,
-- so is_local=true covers every statement below and leaks nothing onto the
-- pooled connection afterwards. Without these two lines the boot-time
-- backfills (the edge curve migration, the purpose backfill, the short-id
-- rotation DO block) would append events with no actor at all.
-- The GUC prefix is `gt.`, never `app.`: this Postgres instance is shared with
-- the Wafer system DB and an `app.*` collision would misattribute silently.
SELECT set_config('gt.actor_type', 'system', true);
SELECT set_config('gt.actor_name', 'schema-migration', true);

DO $$ BEGIN
  CREATE TYPE edge_type AS ENUM ('dependency', 'related');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- graphs.id is a random string. 16 chars from a 31-char alphabet
-- (lowercase letters + digits, minus 0/1/i/l/o to avoid visual ambiguity).
-- ~31^16 ≈ 2^79 combinations — unguessable in practice, which is the whole
-- privacy model: the URL is the bearer token. The route still retries on the
-- negligible chance of a unique-violation collision.
CREATE OR REPLACE FUNCTION generate_short_graph_id() RETURNS TEXT AS $$
DECLARE
  alphabet TEXT := 'abcdefghjkmnpqrstuvwxyz23456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..16 LOOP
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS graphs (
  id TEXT PRIMARY KEY DEFAULT generate_short_graph_id(),
  name TEXT NOT NULL,
  description TEXT,
  -- Per-graph overrides for font / font_color / bg_color. Missing keys
  -- fall back to the viewer's app-level Defaults at render time. Stored
  -- as JSONB so future per-graph settings can be added without a schema
  -- change. Always an object — never NULL — so client code can do
  -- `graph.settings.font || appDefault.font` without a null check.
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT graph_id_format
    CHECK (id ~ '^[a-z0-9]{4,32}$'),
  CONSTRAINT graph_name_required
    CHECK (length(trim(name)) > 0),
  CONSTRAINT graph_name_length
    CHECK (length(name) <= 80),
  CONSTRAINT graph_description_length
    CHECK (description IS NULL OR length(description) <= 500),
  CONSTRAINT graph_settings_object
    CHECK (jsonb_typeof(settings) = 'object')
);

ALTER TABLE graphs ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;
DO $$ BEGIN
  ALTER TABLE graphs DROP CONSTRAINT IF EXISTS graph_settings_object;
  ALTER TABLE graphs ADD CONSTRAINT graph_settings_object CHECK (jsonb_typeof(settings) = 'object');
END $$;

CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  graph_id TEXT NOT NULL REFERENCES graphs(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT title_required
    CHECK (meta->>'title' IS NOT NULL AND meta->>'title' != ''),
  CONSTRAINT title_length
    CHECK (length(meta->>'title') <= 100),
  CONSTRAINT description_length
    CHECK (length(meta->>'description') <= 200 OR meta->>'description' IS NULL),
  CONSTRAINT valid_status
    CHECK (meta->>'status' IN ('todo', 'in_progress', 'review', 'done'))
);

CREATE INDEX IF NOT EXISTS tasks_graph_id_idx ON tasks(graph_id);

CREATE TABLE IF NOT EXISTS edges (
  id SERIAL PRIMARY KEY,
  graph_id TEXT NOT NULL REFERENCES graphs(id) ON DELETE CASCADE,
  source_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  target_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  type edge_type NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_id, target_id),
  CHECK(source_id != target_id)
);

CREATE INDEX IF NOT EXISTS edges_graph_id_idx ON edges(graph_id);

-- Migrate the valid_status CHECK on tasks to include 'review' on existing
-- DBs (CREATE TABLE IF NOT EXISTS won't alter constraints on tables that
-- already exist). Idempotent: drops and re-adds the constraint.
DO $$ BEGIN
  ALTER TABLE tasks DROP CONSTRAINT IF EXISTS valid_status;
  ALTER TABLE tasks
    ADD CONSTRAINT valid_status
    CHECK (meta->>'status' IN ('todo', 'in_progress', 'review', 'done'));
END $$;

-- Raise the title/description length caps (50→100, 150→200) on existing DBs.
-- CREATE TABLE IF NOT EXISTS won't relax constraints on tables that already
-- exist. Idempotent: drops and re-adds. Widening only, so existing rows pass.
DO $$ BEGIN
  ALTER TABLE tasks DROP CONSTRAINT IF EXISTS title_length;
  ALTER TABLE tasks
    ADD CONSTRAINT title_length
    CHECK (length(meta->>'title') <= 100);
  ALTER TABLE tasks DROP CONSTRAINT IF EXISTS description_length;
  ALTER TABLE tasks
    ADD CONSTRAINT description_length
    CHECK (length(meta->>'description') <= 200 OR meta->>'description' IS NULL);
END $$;

-- Bump graphs.updated_at whenever any task or edge in a graph changes, AND
-- emit a pg_notify event so SSE subscribers can push the change to live
-- viewers. Payload: { graph_id, kind: 'tasks'|'edges', op: 'INSERT'|...,
-- id: <affected row id> }. The id lets the client follow the agent visually
-- (pan camera, open side panel) instead of just refetching blindly.
CREATE OR REPLACE FUNCTION bump_graph_updated_at() RETURNS TRIGGER AS $$
DECLARE
  gid TEXT := COALESCE(NEW.graph_id, OLD.graph_id);
BEGIN
  -- Bump both updated_at and version on any task/edge change so `version` is a
  -- real "graph activity" counter (E16 report source_graph_version reads it).
  -- OCC-safe: the graphs PATCH path treats a version mismatch as a 3-way field
  -- MERGE (graphs.js), not a reject — and a content change never touches the
  -- graph-row fields (name/description/settings), so the merge is a no-op.
  UPDATE graphs SET updated_at = NOW(), version = version + 1 WHERE id = gid;
  PERFORM pg_notify(
    'graph_change',
    json_build_object(
      'graph_id', gid,
      'kind', TG_TABLE_NAME,
      'op', TG_OP,
      'id', COALESCE(NEW.id, OLD.id)
    )::text
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bump_on_task_change ON tasks;
CREATE TRIGGER bump_on_task_change
  AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH ROW EXECUTE FUNCTION bump_graph_updated_at();

DROP TRIGGER IF EXISTS bump_on_edge_change ON edges;
CREATE TRIGGER bump_on_edge_change
  AFTER INSERT OR UPDATE OR DELETE ON edges
  FOR EACH ROW EXECUTE FUNCTION bump_graph_updated_at();

-- The original FKs on graph_id were ON DELETE CASCADE only. ID rotation
-- (POST /api/graphs/:id/rotate-id) needs ON UPDATE CASCADE so changing
-- graphs.id automatically propagates to tasks.graph_id and edges.graph_id.
-- Idempotent: drops the existing constraints by name and re-adds them.
DO $$ BEGIN
  ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_graph_id_fkey;
  ALTER TABLE tasks
    ADD CONSTRAINT tasks_graph_id_fkey
    FOREIGN KEY (graph_id) REFERENCES graphs(id)
    ON DELETE CASCADE ON UPDATE CASCADE;

  ALTER TABLE edges DROP CONSTRAINT IF EXISTS edges_graph_id_fkey;
  ALTER TABLE edges
    ADD CONSTRAINT edges_graph_id_fkey
    FOREIGN KEY (graph_id) REFERENCES graphs(id)
    ON DELETE CASCADE ON UPDATE CASCADE;
END $$;

-- Resolve any pre-existing duplicate normalized names by suffixing later
-- copies with " (2)", " (3)", etc., so the unique index below can be built.
-- Truncate the base name to leave room for the suffix within the 80-char
-- name length cap. Idempotent / safe to re-run.
DO $$
DECLARE
  r RECORD;
  base TEXT;
  suffix TEXT;
BEGIN
  FOR r IN
    SELECT id, name,
           row_number() OVER (
             PARTITION BY lower(regexp_replace(name, '\s+', '', 'g'))
             ORDER BY created_at, id
           ) AS rn
      FROM graphs
  LOOP
    IF r.rn > 1 THEN
      suffix := ' (' || r.rn || ')';
      base := substr(r.name, 1, 80 - length(suffix));
      UPDATE graphs SET name = base || suffix WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

-- The previous global unique-on-normalized-name index was dropped: in a no-auth
-- bearer-token model it let anyone probe whether a graph by a given name
-- existed via the 409 response on POST. The dedup-suffix backfill above is
-- left in place since it's idempotent on existing DBs (and a no-op on fresh
-- ones) — we don't undo prior renames because users may have come to identify
-- their graph as "X (2)".
DROP INDEX IF EXISTS graphs_name_norm_uniq;

-- Edge curve metadata used to be a single signed number (perpendicular
-- offset; weight implicitly 0.5). It's now an object {distance, weight}
-- so users can slide the bezier control point along the edge as well as
-- perpendicular. Convert any existing number-form curve to the object form
-- with weight=0.5 (the previous implicit default). Idempotent.
UPDATE edges
   SET meta = jsonb_set(
         meta,
         '{curve}',
         jsonb_build_object('distance', meta->'curve', 'weight', 0.5)
       )
 WHERE jsonb_typeof(meta->'curve') = 'number';

-- Optimistic concurrency + writer provenance. `version` is bumped on every
-- write; clients send the version they read so the server can detect and
-- merge concurrent edits. `last_modified_by` records whether the most recent
-- write came from a human (browser) or an agent (skill / API client) — used
-- for conflict resolution (human wins on same-field collision) and for
-- future audit / UI affordances. Both default to safe values for existing
-- rows: version=0 means "no write tracked yet", last_modified_by=NULL means
-- "unknown".
ALTER TABLE tasks  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tasks  ADD COLUMN IF NOT EXISTS last_modified_by VARCHAR(16);
ALTER TABLE edges  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE edges  ADD COLUMN IF NOT EXISTS last_modified_by VARCHAR(16);
ALTER TABLE graphs ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE graphs ADD COLUMN IF NOT EXISTS last_modified_by VARCHAR(16);

DO $$ BEGIN
  ALTER TABLE tasks  DROP CONSTRAINT IF EXISTS tasks_last_modified_by_valid;
  ALTER TABLE tasks  ADD  CONSTRAINT tasks_last_modified_by_valid
    CHECK (last_modified_by IS NULL OR last_modified_by IN ('human', 'agent'));
  ALTER TABLE edges  DROP CONSTRAINT IF EXISTS edges_last_modified_by_valid;
  ALTER TABLE edges  ADD  CONSTRAINT edges_last_modified_by_valid
    CHECK (last_modified_by IS NULL OR last_modified_by IN ('human', 'agent'));
  ALTER TABLE graphs DROP CONSTRAINT IF EXISTS graphs_last_modified_by_valid;
  ALTER TABLE graphs ADD  CONSTRAINT graphs_last_modified_by_valid
    CHECK (last_modified_by IS NULL OR last_modified_by IN ('human', 'agent'));
END $$;

-- Pluggable auth (Phase B1): users + graph ownership. Both are opt-in at
-- runtime — `AUTH_PROVIDER=none` (the default) never writes to `users` and
-- leaves `graphs.owner_user_id` NULL. Legacy graphs (owner NULL) preserve the
-- URL-bearer access semantics from Phase A forever — see docs/auth.md.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_user_id)
);
CREATE INDEX IF NOT EXISTS users_email_idx ON users (lower(email));

ALTER TABLE graphs
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS graphs_owner_idx ON graphs (owner_user_id)
  WHERE owner_user_id IS NOT NULL;

-- Phase B5c (Google-Docs-faithful refactor): the graph's general-access tier.
-- 'none' = Restricted (only owner + explicit members); 'viewer' = anyone with
-- the URL can read; 'editor' = anyone with the URL can edit. The graph URL
-- /g/<gid> IS the share link — there is no separate invite-token URL.
-- Default is 'none': a new graph is private to its owner and the people they
-- invite until the owner opens it (Kevin, 2026-11-06: "new graphs should
-- default to private"; it was 'viewer' before that day — existing graphs keep
-- whatever they have). The owner opens a graph via the Access section in the
-- graph-modal or `PATCH /api/graphs/:id {"anon_role": "viewer"}`. A graph
-- with no owner (an instance without accounts) is unaffected: anyone holding
-- its id may do anything, as before.
ALTER TABLE graphs
  ADD COLUMN IF NOT EXISTS anon_role TEXT NOT NULL DEFAULT 'none';
DO $$ BEGIN
  ALTER TABLE graphs DROP CONSTRAINT IF EXISTS graphs_anon_role_check;
  ALTER TABLE graphs ADD CONSTRAINT graphs_anon_role_check
    CHECK (anon_role IN ('none', 'viewer', 'editor'));
  -- Set the column default on an existing table too. Idempotent.
  ALTER TABLE graphs ALTER COLUMN anon_role SET DEFAULT 'none';
END $$;

-- Phase B5c also drops the old `is_public` column. Its two jobs (anonymous
-- read access, home-page directory listing) collapse into `anon_role`, the
-- per-graph tier for people who hold only the URL. Idempotent: existing
-- DBs lose the column on next boot; fresh DBs never had it.
DO $$ BEGIN
  -- Drop the partial index first so the column drop succeeds.
  DROP INDEX IF EXISTS graphs_is_public_idx;
  ALTER TABLE graphs DROP COLUMN IF EXISTS is_public;
END $$;

-- Phase B2/B5c: graph membership. The Share modal's "Add by email" form
-- inserts here directly when the invitee already has a Clerk account;
-- otherwise their row sits in `pending_members` until they sign in.
CREATE TABLE IF NOT EXISTS graph_members (
  graph_id TEXT NOT NULL REFERENCES graphs(id) ON DELETE CASCADE ON UPDATE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('viewer', 'editor')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (graph_id, user_id)
);
CREATE INDEX IF NOT EXISTS graph_members_user_idx ON graph_members (user_id);
-- Loosen the legacy CHECK to allow 'viewer' on existing DBs that already
-- have the 'editor'-only constraint.
DO $$ BEGIN
  ALTER TABLE graph_members DROP CONSTRAINT IF EXISTS graph_members_role_check;
  ALTER TABLE graph_members ADD CONSTRAINT graph_members_role_check
    CHECK (role IN ('viewer', 'editor'));
END $$;

-- Phase B5c: pending invites by email. Owner adds an email + role in the
-- Share modal; when that email signs in via Clerk, verifyAuth auto-converts
-- the pending row into a real `graph_members` row.
-- Email is stored lower-cased and matched case-insensitively against Clerk's
-- primary email address.
CREATE TABLE IF NOT EXISTS pending_members (
  graph_id TEXT NOT NULL REFERENCES graphs(id) ON DELETE CASCADE ON UPDATE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('viewer', 'editor')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (graph_id, email)
);
CREATE INDEX IF NOT EXISTS pending_members_email_idx ON pending_members (email);

-- Phase B3: invite tokens (Pattern B — GitHub-style click-to-claim links).
-- Owner POSTs to mint one; the plaintext token is returned ONCE and stored as
-- SHA-256 only. Recipient hits /api/invites/:token/claim, which becomes a
-- graph_members row and deletes the invite (single-use). Revocation is a
-- soft-delete via revoked_at so a leaked token can be killed without losing
-- audit context.
CREATE TABLE IF NOT EXISTS invite_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id TEXT NOT NULL REFERENCES graphs(id) ON DELETE CASCADE ON UPDATE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('editor')),
  -- anon_role: what holders WITHOUT a Clerk session get when they click the
  -- link. Default 'viewer' mirrors Google Docs' "Anyone with the link can
  -- view". Set to 'none' for strict "must sign in to view" mode, 'editor'
  -- for fully-open collaboration. `role` is what signed-in claimers become.
  anon_role TEXT NOT NULL DEFAULT 'none'
    CHECK (anon_role IN ('none', 'viewer', 'editor')),
  token_hash TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE invite_tokens
  ADD COLUMN IF NOT EXISTS anon_role TEXT NOT NULL DEFAULT 'none';
DO $$ BEGIN
  ALTER TABLE invite_tokens DROP CONSTRAINT IF EXISTS invite_tokens_anon_role_check;
  ALTER TABLE invite_tokens
    ADD CONSTRAINT invite_tokens_anon_role_check
    CHECK (anon_role IN ('none', 'viewer', 'editor'));
END $$;
CREATE INDEX IF NOT EXISTS invite_tokens_graph_idx ON invite_tokens (graph_id)
  WHERE revoked_at IS NULL;

-- Phase B4: app-issued agent tokens. Lets a Claude Code agent (or any
-- non-browser client) authenticate as a specific user without going through
-- Clerk. The plaintext token is returned once at mint and never again;
-- token_hash is the only thing persisted. Revoking sets `revoked_at` and the
-- next bearer-auth attempt returns 401 immediately — no grace period.
CREATE TABLE IF NOT EXISTS agent_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  label TEXT,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS agent_tokens_user_idx ON agent_tokens (user_id)
  WHERE revoked_at IS NULL;

-- One-time backfill: any pre-existing graphs with shorter IDs (e.g. the old
-- 8-char format) get rotated to a fresh 16-char ID. Safe to re-run; on a
-- fresh DB it's a no-op. The cascade above carries tasks/edges along.
DO $$
DECLARE
  old_id TEXT;
  new_id TEXT;
  attempts INT;
BEGIN
  FOR old_id IN SELECT id FROM graphs WHERE length(id) < 16 LOOP
    attempts := 0;
    LOOP
      new_id := generate_short_graph_id();
      BEGIN
        UPDATE graphs SET id = new_id WHERE id = old_id;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        attempts := attempts + 1;
        IF attempts >= 5 THEN
          RAISE EXCEPTION 'failed to allocate unique graph id after % attempts', attempts;
        END IF;
      END;
    END LOOP;
  END LOOP;
END $$;

-- Per-(user, graph) follow preference for the camera-follow toggle.
-- Absent row = "use the user's default" (see user_prefs). Authed users only;
-- anons store the equivalent in localStorage (gt_follow_default and
-- gt_follow_graph_<gid>).
CREATE TABLE IF NOT EXISTS user_graph_prefs (
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  graph_id     TEXT NOT NULL REFERENCES graphs(id) ON DELETE CASCADE ON UPDATE CASCADE,
  agent_follow BOOLEAN NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, graph_id)
);

-- E18.3 — the PERSONAL "changed since I last looked" cursor.
--
-- WHY THIS TABLE AND NOT A NEW `user_graph_cursors`. The PK is already
-- (user_id, graph_id); the FK is already ON UPDATE CASCADE, so `rotate-id`
-- carries the cursor for free; and ON DELETE CASCADE is right here — a cursor
-- into a deleted graph is meaningless, unlike `events`, which deliberately
-- carries no FK so history outlives the graph. A new table would duplicate all
-- three and buy nothing.
--
-- THE `DROP NOT NULL` IS REQUIRED, NOT COSMETIC. A user who marks a graph as
-- read but has never touched the follow toggle would otherwise force the
-- INSERT ... ON CONFLICT to INVENT an `agent_follow` value — which is exactly
-- the "a partial write must never silently change a field it did not mention"
-- rule that cost 4283 live edges their meaning. It is behaviour-preserving for
-- every existing consumer: GET /prefs/me already answers `agent_follow: null`
-- for a missing row (graphPrefs.js: `r.rows[0]?.agent_follow ?? null`),
-- public/app.js resolves null against the global default, and three existing
-- tests already assert that null. PUT /prefs/me always supplies a boolean, so
-- no existing write path can produce a NULL. Widening a NOT NULL is also
-- strictly MORE PERMISSIVE, so unlike E18.4's CHECK widening it cannot fail on
-- existing rows — but the rule it learned is restated anyway: a widening goes
-- IN PLACE beside the definition, never appended after the feature's own rows
-- exist.
ALTER TABLE user_graph_prefs ALTER COLUMN agent_follow DROP NOT NULL;
ALTER TABLE user_graph_prefs ADD COLUMN IF NOT EXISTS last_seen_seq BIGINT;
ALTER TABLE user_graph_prefs ADD COLUMN IF NOT EXISTS last_seen_at  TIMESTAMPTZ;
DO $$ BEGIN
  ALTER TABLE user_graph_prefs DROP CONSTRAINT IF EXISTS ugp_last_seen_seq_sane;
  ALTER TABLE user_graph_prefs ADD CONSTRAINT ugp_last_seen_seq_sane
    CHECK (last_seen_seq IS NULL OR last_seen_seq >= 0);
END $$;

-- Per-user global default for "new graphs I haven't toggled yet". Toggling
-- on any graph also writes-through to this row, so the user's most recent
-- choice becomes the default for FUTURE graphs without changing existing
-- per-graph rows.
CREATE TABLE IF NOT EXISTS user_prefs (
  user_id              UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  agent_follow_default BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Owner of the row's most recent write — needed for owner-agent precedence
-- in mergeFields when two agents conflict on the same field. Nullable for
-- anonymous writers and for legacy rows written before this column existed.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS last_modified_by_user UUID
  REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE edges ADD COLUMN IF NOT EXISTS last_modified_by_user UUID
  REFERENCES users(id) ON DELETE SET NULL;

-- E14.1: batch-upsert idempotency key + workflow-run attribution. Both columns
-- are nullable and additive — the existing single-write paths never set them,
-- so legacy rows and the canvas are unaffected. `external_id` is a client
-- supplied stable key so re-running a dynamic-workflow round UPSERTs the same
-- node instead of duplicating; the partial-unique index enforces that per
-- graph while allowing unlimited NULLs (ad-hoc creates without a key). `run_id`
-- records the run that CREATED the row: it's set on INSERT and preserved across
-- idempotent re-runs (re-upserts don't overwrite it), so a run's additions can
-- be inspected or undone in one query — `DELETE ... WHERE run_id = :id` removes
-- exactly what that run introduced (POST /api/graphs/:gid/batch — src/routes/batch.js).
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS run_id TEXT;
ALTER TABLE edges ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE edges ADD COLUMN IF NOT EXISTS run_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS tasks_graph_external_id_uniq
  ON tasks(graph_id, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tasks_run_id_idx ON tasks(run_id) WHERE run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS edges_run_id_idx ON edges(run_id) WHERE run_id IS NOT NULL;

-- E15.A1: edge `purpose` as the canonical edge field. purpose ∈
-- {'required for','supports','contradicts','related to'} (directed source→
-- target). The existing `type` enum is KEPT as a derived-internal structural
-- column (purpose='required for' → 'dependency', everything else → 'related')
-- so every cycle-detection + dependency-traversal query keeps keying off `type`
-- with no SQL change. Additive + idempotent:
--   1. ADD COLUMN with DEFAULT 'related to' backfills every legacy row.
--   2. The UPDATE promotes the dependency rows to 'required for'. Keyed on
--      type='dependency' (and only when not already promoted) so it's a no-op
--      on every boot after the first and never churns correctly-synced rows.
ALTER TABLE edges ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'related to';
-- E18.4 widened this list IN PLACE, and it MUST stay that way. schema.sql is
-- applied as ONE multi-statement query on every boot (db.js) and a failure
-- process.exit(1)s the server. `ALTER TABLE ... ADD CONSTRAINT` VALIDATES
-- IMMEDIATELY, so a widened CHECK appended at the END of this file would still
-- let this narrow block run first and fail on the rows the new purpose created:
--   ERROR: new row for relation "edges" violates check constraint
--          "edges_purpose_valid"
-- Same outcome as the 55P04 enum trap, different mechanism, and invisible on a
-- fresh test database. Widening in place is always safe — a more permissive
-- CHECK cannot fail on rows that already satisfied the narrower one.
-- `supersedes` derives type='related' (purposeToType), an EXISTING enum label,
-- so no ALTER TYPE ... ADD VALUE is issued and 55P04 cannot apply either.
DO $$ BEGIN
  ALTER TABLE edges DROP CONSTRAINT IF EXISTS edges_purpose_valid;
  ALTER TABLE edges ADD CONSTRAINT edges_purpose_valid
    CHECK (purpose IN ('required for', 'supports', 'contradicts', 'related to',
                       'supersedes'));
END $$;
UPDATE edges SET purpose = 'required for'
 WHERE type = 'dependency' AND purpose <> 'required for';

-- Graph-scoped uploaded image bytes. Referenced by `background-image` in a
-- task's frontmatter as `/api/graphs/<gid>/uploads/<id>`. The bytes live in
-- Postgres so a self-hosted instance needs nothing beyond the existing DB.
-- Cascade on graph delete; node-level cleanup (an upload whose only
-- referencing node was deleted) is a reap-later concern tracked in the
-- roadmap rather than something we trigger inline.
CREATE TABLE IF NOT EXISTS uploads (
  id TEXT PRIMARY KEY DEFAULT generate_short_graph_id(),
  graph_id TEXT NOT NULL REFERENCES graphs(id) ON DELETE CASCADE ON UPDATE CASCADE,
  bytes BYTEA NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_user UUID REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT uploads_content_type_valid
    CHECK (content_type IN ('image/png','image/jpeg','image/gif','image/webp','image/svg+xml')),
  CONSTRAINT uploads_byte_size_positive
    CHECK (byte_size > 0)
);
CREATE INDEX IF NOT EXISTS uploads_graph_id_idx ON uploads(graph_id);

-- Graph-scoped human-readable report (E16). ONE canonical row per graph
-- (graph_id PRIMARY KEY), living OUTSIDE the tasks/edges model so generating or
-- updating a report has ZERO impact on the graph. The report is a point-in-time
-- synthesis of the graph, not a mirror of it: `source_graph_version` records the
-- graph version it was built from so the reader can surface staleness instead of
-- silently drifting. title/description/timestamps are promoted to columns so the
-- cross-graph list + staleness probe render WITHOUT loading the markdown `body`.
-- Referential integrity is DB-enforced: PRIMARY KEY forbids duplicate reports,
-- and the FK (ON DELETE CASCADE, ON UPDATE CASCADE) forbids orphans and follows
-- a rotate-id. Cleanup between tests rides `TRUNCATE graphs ... CASCADE`.
CREATE TABLE IF NOT EXISTS reports (
  graph_id TEXT PRIMARY KEY REFERENCES graphs(id) ON DELETE CASCADE ON UPDATE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  body TEXT NOT NULL DEFAULT '',
  source_graph_version INTEGER,
  run_id TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT report_title_required CHECK (length(trim(title)) > 0),
  CONSTRAINT report_title_length CHECK (length(title) <= 200),
  CONSTRAINT report_description_length CHECK (description IS NULL OR length(description) <= 500),
  CONSTRAINT report_meta_object CHECK (jsonb_typeof(meta) = 'object')
);

-- Idempotent re-add of the meta CHECK + FK for DBs where `reports` predates
-- these constraints (schema.sql re-runs every boot; CREATE TABLE IF NOT EXISTS
-- never alters an existing table). Mirrors the tasks/edges FK migration above.
DO $$ BEGIN
  ALTER TABLE reports DROP CONSTRAINT IF EXISTS report_meta_object;
  ALTER TABLE reports ADD CONSTRAINT report_meta_object
    CHECK (jsonb_typeof(meta) = 'object');

  ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_graph_id_fkey;
  ALTER TABLE reports
    ADD CONSTRAINT reports_graph_id_fkey
    FOREIGN KEY (graph_id) REFERENCES graphs(id)
    ON DELETE CASCADE ON UPDATE CASCADE;
END $$;

-- Report change notifier. Emits on the SAME `graph_change` channel the SSE
-- layer already listens on, tagged kind:'report' so a reader-mode client can
-- live-refresh — but CRUCIALLY it does NOT touch graphs.updated_at/version the
-- way bump_graph_updated_at() does for tasks/edges. That isolation is the
-- load-bearing half of "zero impact": a report write must never masquerade as a
-- graph edit (which would reorder the sidebar, ordered by updated_at DESC, and
-- disturb graph OCC). `id` is the graph_id — a report's identity IS its graph.
CREATE OR REPLACE FUNCTION notify_report_change() RETURNS TRIGGER AS $$
DECLARE
  gid TEXT := COALESCE(NEW.graph_id, OLD.graph_id);
BEGIN
  PERFORM pg_notify(
    'graph_change',
    json_build_object(
      'graph_id', gid,
      'kind', 'report',
      'op', TG_OP,
      'id', gid
    )::text
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notify_on_report_change ON reports;
CREATE TRIGGER notify_on_report_change
  AFTER INSERT OR UPDATE OR DELETE ON reports
  FOR EACH ROW EXECUTE FUNCTION notify_report_change();

-- Dense-retrieval chunk store for semantic search (graph task #190, P2.2).
-- One node → many title-prefixed passages (see src/search/chunking.js); each
-- carries its embedding for ANN search, then results collapse back to nodes by
-- task_id (max-pool) and fuse with the lexical leg via RRF.
--
-- The WHOLE block is guarded on pgvector being present. Both deploy paths now
-- ship it: the self-host image bakes in postgresql-17-pgvector (see Dockerfile)
-- and the Wafer worker image gained vector 0.8.2 (2026-06-07) — the guard
-- remains for self-hosters running their own pre-pgvector Postgres, where this
-- is a clean no-op and the dense leg falls back to in-memory ranking.
-- schema.sql is applied on every boot, so this must never error when the
-- extension is absent — or installed on the server but not creatable by this
-- role: managed databases (Wafer's project databases among them) hand the app
-- a non-superuser role, and pgvector is not a trusted extension, so CREATE
-- EXTENSION fails with insufficient_privilege until an operator creates it as
-- superuser. That case is treated like "absent"; the boot after the operator
-- adds the extension picks the store up.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS vector;
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'pgvector is installed on this server but this role may not create it; the semantic chunk store is skipped until an operator runs CREATE EXTENSION vector';
    END;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    -- DDL is EXECUTE'd so the halfvec type / hnsw opclass are only resolved
    -- after the extension is guaranteed loaded (and never parsed where absent).
    EXECUTE $ddl$
      CREATE TABLE IF NOT EXISTS task_chunks (
        id              SERIAL PRIMARY KEY,
        task_id         INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        graph_id        TEXT NOT NULL REFERENCES graphs(id) ON DELETE CASCADE ON UPDATE CASCADE,
        chunk_index     INTEGER NOT NULL,
        chunk_text      TEXT NOT NULL,
        -- sha256 of the whole node content: re-chunk only when this changes,
        -- so an unchanged node skips re-embedding entirely (#190 write path).
        content_sha     TEXT NOT NULL,
        embedding_model TEXT NOT NULL,
        -- BGE-M3 default (1024-dim) — the size-driven pick from #190. halfvec
        -- halves storage vs full float for negligible recall loss.
        embedding       halfvec(1024),
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (task_id, chunk_index)
      )
    $ddl$;
    -- task_id IS the chunk→node link; CASCADE auto-cleans chunks when a node is
    -- deleted. graph_id is the "this graph" scope filter (and the column a
    -- later cross-graph access filter rides on).
    EXECUTE 'CREATE INDEX IF NOT EXISTS task_chunks_task_id_idx ON task_chunks(task_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS task_chunks_graph_id_idx ON task_chunks(graph_id)';
    -- HNSW over cosine. m/ef are immaterial at <1k vectors (#190) but cost
    -- nothing to set now and matter once a graph grows.
    EXECUTE 'CREATE INDEX IF NOT EXISTS task_chunks_embedding_idx ON task_chunks '
         || 'USING hnsw (embedding halfvec_cosine_ops) WITH (m = 16, ef_construction = 64)';
    -- Renaming a graph (POST /api/graphs/:id/rotate-id) changes graphs.id, and
    -- the chunks must follow it as tasks and edges do (their keys got
    -- ON UPDATE CASCADE above). The table was first created with ON DELETE
    -- CASCADE only, so a rename failed on any graph that had been indexed.
    -- Correct an existing database once: only when the rule is missing, so a
    -- normal boot does not re-validate every chunk.
    IF EXISTS (SELECT 1 FROM pg_constraint
                WHERE conrelid = 'task_chunks'::regclass
                  AND conname = 'task_chunks_graph_id_fkey'
                  AND confupdtype <> 'c') THEN
      EXECUTE 'ALTER TABLE task_chunks DROP CONSTRAINT task_chunks_graph_id_fkey';
      EXECUTE 'ALTER TABLE task_chunks ADD CONSTRAINT task_chunks_graph_id_fkey '
           || 'FOREIGN KEY (graph_id) REFERENCES graphs(id) ON DELETE CASCADE ON UPDATE CASCADE';
    END IF;
  ELSE
    RAISE NOTICE 'pgvector not available — skipping task_chunks (dense store deferred; eval runs in-memory)';
  END IF;
END $$;

-- Agent claim/lease on tasks (node 3829 — fleet coordination). An atomic
-- claim flips todo → in_progress and records WHO holds the work and until
-- WHEN, so N agents pulling from /tasks/ready can't double-grab a task.
-- Claimability is DERIVED, never swept: an expired lease simply makes the
-- row match /ready's claimable predicate again (see src/routes/tasks.js).
-- All three columns are additive and NULL for every task outside a claim;
-- claimed_by is the writer id (X-Writer-Id — the presence identity), not a
-- users FK, because unauthenticated fleet agents have no user row.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS claimed_by TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS claimed_by_name TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS claim_expires_at TIMESTAMPTZ;

-- Scheduled graph refresh (node 3834): a per-graph SCHEDULE + PURPOSE PROMPT,
-- the product primitive replacing hand-rolled per-graph session crons. One row
-- per graph. Lives OUTSIDE tasks/edges (the E16 reports pattern) and has NO
-- trigger: writing a schedule must never bump graphs.updated_at/version or
-- fire SSE — a schedule change is not a graph edit. "Due" is DERIVED
-- (enabled AND last_run_at older than interval_days — see /api/refreshes/due),
-- never stored, so there is no scheduler daemon to keep honest: any harness
-- cron polls due-ness and runs the refresh checklist (frontier + decisions
-- at-risk + the purpose prompt), lands changes at review, then POSTs
-- /refresh/complete which stamps last_run_at.
CREATE TABLE IF NOT EXISTS graph_refreshes (
  graph_id TEXT PRIMARY KEY REFERENCES graphs(id) ON DELETE CASCADE ON UPDATE CASCADE,
  interval_days INTEGER NOT NULL,
  purpose TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  last_run_summary TEXT,
  last_run_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT refresh_interval_range CHECK (interval_days BETWEEN 1 AND 365),
  CONSTRAINT refresh_purpose_required CHECK (length(trim(purpose)) > 0),
  CONSTRAINT refresh_purpose_length CHECK (length(purpose) <= 2000),
  CONSTRAINT refresh_summary_length CHECK (last_run_summary IS NULL OR length(last_run_summary) <= 4000)
);

-- Refresh dismissal (owner decision 2026-08-08): the schedule's clock can be
-- silenced for one cycle WITHOUT a refresh actually running — the user saying
-- "not this month". last_run_kind keeps the two honest: 'run' = a real pass
-- happened; 'dismissed' = the user waved it off. Both move last_run_at (the
-- due-ness clock); neither is inferable from the other's absence.
ALTER TABLE graph_refreshes ADD COLUMN IF NOT EXISTS last_run_kind TEXT;
DO $$ BEGIN
  ALTER TABLE graph_refreshes DROP CONSTRAINT IF EXISTS refresh_last_run_kind_valid;
  ALTER TABLE graph_refreshes ADD CONSTRAINT refresh_last_run_kind_valid
    CHECK (last_run_kind IS NULL OR last_run_kind IN ('run', 'dismissed'));
END $$;

-- ============================================================================
-- E18.1 — append-only event log. Appended at the END of db/schema.sql.
-- Capture is at the DB (row triggers) so no write path can be missed; identity
-- rides down from the HTTP layer as transaction-local GUCs. Fails OPEN on
-- attribution (actor.type='system'), never on coverage.
-- ============================================================================

-- Every custom-GUC read goes through gt_ctx(). After a SET LOCAL txn commits,
-- PostgreSQL leaves the setting as '' (not unset) for the rest of that pooled
-- session, so a raw current_setting(k,true)::timestamptz raises 22007 on the
-- SECOND request of a recycled connection. NULLIF is the fix. VERIFIED.
CREATE OR REPLACE FUNCTION gt_ctx(k text) RETURNS text AS $$
  SELECT NULLIF(current_setting(k, true), '')
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION gt_capture_enabled() RETURNS boolean AS $$
  SELECT COALESCE(gt_ctx('gt.capture'), 'on') <> 'off'
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION gt_actor() RETURNS jsonb AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'type',    COALESCE(gt_ctx('gt.actor_type'), 'system'),
    'id',      gt_ctx('gt.actor_id'),
    'name',    gt_ctx('gt.actor_name'),
    'user_id', gt_ctx('gt.actor_user_id'),
    'via',     gt_ctx('gt.actor_via')))
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION gt_happened_at() RETURNS timestamptz AS $$
  SELECT COALESCE(gt_ctx('gt.happened_at')::timestamptz, clock_timestamp())
$$ LANGUAGE sql STABLE;

-- events.graph_id deliberately carries NO FK to graphs(id). VERIFIED: an
-- ON DELETE CASCADE FK wipes the log at the exact moment it becomes the only
-- record of a graph. Consequence: tests/setup.js must TRUNCATE events and
-- graph_snapshots explicitly (the suite's CASCADE cannot reach them), and
-- rotate-id must rewrite events.graph_id itself (gt_log_graph below).
CREATE TABLE IF NOT EXISTS events (
  graph_id    TEXT        NOT NULL,
  seq         BIGINT      NOT NULL,
  happened_at TIMESTAMPTZ NOT NULL,
  learned_at  TIMESTAMPTZ NOT NULL,
  actor       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  kind        TEXT        NOT NULL,
  subject_kind TEXT,
  subject_id  BIGINT,
  cause_id    BIGINT,
  request_id  TEXT,
  txid        BIGINT      NOT NULL,
  payload     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (graph_id, seq),
  CONSTRAINT events_seq_positive     CHECK (seq > 0),
  CONSTRAINT events_actor_object     CHECK (jsonb_typeof(actor) = 'object'),
  CONSTRAINT events_payload_object   CHECK (jsonb_typeof(payload) = 'object'),
  CONSTRAINT events_cause_precedes   CHECK (cause_id IS NULL OR cause_id < seq),
  CONSTRAINT events_happened_at_sane CHECK (happened_at >= TIMESTAMPTZ '1970-01-01'),
  CONSTRAINT events_subject_kind_valid
    CHECK (subject_kind IS NULL OR subject_kind IN ('node','edge','graph'))
);

-- E18.6 — a salted COMMITMENT to the payload, stamped at insert by
-- gt_events_stamp. Excision blanks `payload` and `payload_salt` and KEEPS
-- `payload_hash`, so an external anchor over (envelope + hash) stays valid
-- across excisions, while the erased bytes cannot be brute-forced back from
-- the hash because the salt went with them. Nullable only because rows
-- predate the column; the backfill after gt_events_append_only fills them.
ALTER TABLE events ADD COLUMN IF NOT EXISTS payload_hash TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS payload_salt TEXT;

-- kind is TEXT + CHECK, never an enum: ALTER TYPE ... ADD VALUE plus any use of
-- the new literal later in the same file fails 55P04 and rolls back the whole
-- boot apply. Migrated with the house drop/re-add DO block (schema.sql:460) so
-- E18.2/E18.4 can add a kind on an EXISTING db with a one-block edit.
-- E18.4 added 'node.superseded' IN PLACE, for the reason spelled out over
-- edges_purpose_valid above: an APPENDED widening runs after this block and
-- this block then fails on the feature's own rows (reproduced verbatim:
-- `check constraint "events_kind_valid" ... is violated by some row`).
-- E18.6 added 'node.excised' the same way.
-- 2026-11-06 (one data model, Multitap er289bkv2zkcs5w6 #11334 D5): the
-- coordination engine's own events join this log as the `coord.*` FAMILY —
-- `coord.proposition.landed`, `coord.finding.filed`, … — admitted by prefix rather
-- than one literal each, because the engine's event vocabulary is defined in
-- its own code (Go `EventType` constants) and grows with it; listing every
-- member here would make each new engine event a schema change in two repos.
-- They are ANNOTATIONS to the fold (kinds.js isCoordKind, fold.js): the state
-- of the claim's node is carried by the ordinary node.* events its row writes.
-- Written only through gt_log_coord() below.
DO $$ BEGIN
  ALTER TABLE events DROP CONSTRAINT IF EXISTS events_kind_valid;
  ALTER TABLE events ADD CONSTRAINT events_kind_valid CHECK (kind IN (
    'node.created','node.patched','node.removed',
    'status.changed','field.set','claim.verified','claim.refuted',
    'decision.made','decision.reopened','node.superseded','node.excised',
    'edge.added','edge.removed','edge.retyped','edge.rewired','edge.patched',
    'graph.id_rotated','graph.deleted')
    OR kind LIKE 'coord.%');
END $$;

CREATE INDEX IF NOT EXISTS events_graph_learned_idx  ON events (graph_id, learned_at, seq);
CREATE INDEX IF NOT EXISTS events_graph_happened_idx ON events (graph_id, happened_at, seq);
CREATE INDEX IF NOT EXISTS events_subject_idx        ON events (graph_id, subject_kind, subject_id, seq);
CREATE INDEX IF NOT EXISTS events_cause_idx          ON events (graph_id, cause_id) WHERE cause_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS events_request_idx        ON events (graph_id, request_id) WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS events_kinds_gin          ON events USING gin ((payload -> 'kinds'));

-- learned_at and txid are SERVER facts, never inputs. clock_timestamp(), NOT
-- now(): now() is the TRANSACTION timestamp, and a txn that STARTED earlier but
-- APPENDS later stamps a learned_at BEHIND a lower seq. VERIFIED (seq 1 learned
-- 06.698, seq 2 learned 06.296 under now(); monotone under clock_timestamp()).
-- Backdating is additionally flagged in the payload so it can never be disguised.
CREATE OR REPLACE FUNCTION gt_events_stamp() RETURNS TRIGGER AS $$
DECLARE
  pw text;
  pwn numeric;
BEGIN
  NEW.learned_at := clock_timestamp();
  NEW.txid := pg_current_xact_id()::text::bigint;
  IF NEW.happened_at < NEW.learned_at - INTERVAL '1 second' THEN
    NEW.payload := NEW.payload || jsonb_build_object('backdated', true);
  END IF;
  -- E18.3 — `gt.propagation_weight` -> `payload.weight`. The SEED strength of
  -- this one weakening, NOT an edge attenuation, and the distinction is the
  -- whole reason it lands here: a GUC lands on ONE EVENT, so it describes the
  -- moment a fact was weakened. The standing strength of a RELATION belongs on
  -- the relation (edges.meta.propagation). A writer who knows "this refutation
  -- is worth 0.4, not a full 1" sets the GUC; src/doubt.js's seedsFromEvents
  -- reads payload.weight and reports weight_source: 'payload'.
  --
  -- The interval is (0, 1] — E18.3's termination argument, not tidiness — and
  -- an unparseable or out-of-range value is IGNORED rather than clamped,
  -- because a silently-clamped amplifier is worse than a missing knob. Nothing
  -- is stamped when the GUC is unset, so every existing payload is byte-for-byte
  -- what it was.
  pw := current_setting('gt.propagation_weight', true);
  IF pw IS NOT NULL AND pw <> '' THEN
    BEGIN
      pwn := pw::numeric;
      IF pwn > 0 AND pwn <= 1 THEN
        NEW.payload := NEW.payload || jsonb_build_object('weight', pwn);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  -- E18.6 — the payload commitment, taken LAST so it covers `backdated` and
  -- `weight` as stamped above. gen_random_uuid() is core since PG13 and
  -- sha256() since PG11: no extension. jsonb text is canonical (keys sorted,
  -- whitespace fixed), so the digest is reproducible from the stored row.
  NEW.payload_salt := replace(gen_random_uuid()::text, '-', '');
  NEW.payload_hash := encode(sha256(convert_to(NEW.payload_salt || NEW.payload::text, 'UTF8')), 'hex');
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS gt_events_stamp_t ON events;
CREATE TRIGGER gt_events_stamp_t BEFORE INSERT ON events
  FOR EACH ROW EXECUTE FUNCTION gt_events_stamp();

-- Append-only. The ONE permitted mutation is the graph_id rewrite that
-- POST /graphs/:id/rotate-id performs (gt_log_graph does it explicitly,
-- because there is no FK to cascade it).
CREATE OR REPLACE FUNCTION gt_events_append_only() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.graph_id IS DISTINCT FROM OLD.graph_id
     AND (to_jsonb(NEW) - 'graph_id') = (to_jsonb(OLD) - 'graph_id')
  THEN RETURN NEW; END IF;

  -- E18.6 (i) — the one-time backfill of the payload commitment on rows that
  -- predate the column: hash goes from NULL to set, and NOTHING else may move.
  IF TG_OP = 'UPDATE'
     AND OLD.payload_hash IS NULL AND NEW.payload_hash IS NOT NULL
     AND (to_jsonb(NEW) - 'payload_hash' - 'payload_salt')
       = (to_jsonb(OLD) - 'payload_hash' - 'payload_salt')
  THEN RETURN NEW; END IF;

  -- E18.6 (ii) — EXCISION. The ONLY way a payload's bytes ever leave this
  -- table, and it is shaped as narrowly as the rotate-id exception above:
  --   * only `payload` (to the marker) and `payload_salt` (to NULL) change —
  --     seq, kind, both clocks, actor, cause_id, request_id, txid and
  --     `payload_hash` are byte-for-byte what they were;
  --   * the marker IS the old payload minus its content keys (`after`,
  --     `before`, `changes`, `reason`, `intent`) plus `excised: true` and
  --     `excised_by_seq` — so `kinds`, `node_kind`, `version`, `op`, `table`,
  --     `node_present`, `backdated`, `weight` all survive: history keeps its
  --     SHAPE, only the bytes go;
  --   * `excised_by_seq` must name a `node.excised` event for the SAME subject
  --     LATER in the log — every blanking is tied to a logged, dated, actored
  --     excision record, and that record can never itself be blanked past
  --     its envelope (its `after` and `reason` are content; its seq, kind,
  --     clocks, actor and counts are not);
  --   * `gt.excising` must name this graph — gt_excise_node sets it for the
  --     duration of its UPDATE and clears it, so no other code path matches
  --     even by accident. The GUC is belt; the shape checks are braces.
  -- Only node events carry bodies (edge payloads hold ids, purpose and canvas
  -- meta), so `subject_kind = 'node'` is a floor, not a gap.
  IF TG_OP = 'UPDATE'
     AND gt_ctx('gt.excising') = OLD.graph_id
     AND OLD.subject_kind = 'node'
     AND NEW.payload_salt IS NULL
     AND (to_jsonb(NEW) - 'payload' - 'payload_salt')
       = (to_jsonb(OLD) - 'payload' - 'payload_salt')
     AND NEW.payload = (OLD.payload - 'after' - 'before' - 'changes' - 'reason' - 'intent')
                       || jsonb_build_object('excised', true,
                                             'excised_by_seq', (NEW.payload ->> 'excised_by_seq')::bigint)
     AND (NEW.payload ->> 'excised_by_seq')::bigint > OLD.seq
     AND EXISTS (SELECT 1 FROM events x
                  WHERE x.graph_id = OLD.graph_id
                    AND x.seq = (NEW.payload ->> 'excised_by_seq')::bigint
                    AND x.kind = 'node.excised'
                    AND x.subject_kind = 'node'
                    AND x.subject_id = OLD.subject_id)
  THEN RETURN NEW; END IF;

  RAISE EXCEPTION 'events is append-only (attempted % on %/%)',
    TG_OP, COALESCE(OLD.graph_id, NEW.graph_id), COALESCE(OLD.seq, NEW.seq)
    USING ERRCODE = '0A000';
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS gt_events_append_only_t ON events;
CREATE TRIGGER gt_events_append_only_t BEFORE UPDATE OR DELETE ON events
  FOR EACH ROW EXECUTE FUNCTION gt_events_append_only();

-- E18.6 — backfill the commitment on rows that predate payload_hash. Goes
-- THROUGH the trigger's exception (i), so the append-only guarantee is never
-- switched off to do it; a later boot finds no NULLs and touches nothing.
-- The salt is drawn in the subquery because a SET list sees only OLD values,
-- so `payload_hash` could not otherwise read the salt being assigned.
UPDATE events e
   SET payload_salt = s.salt,
       payload_hash = encode(sha256(convert_to(s.salt || e.payload::text, 'UTF8')), 'hex')
  FROM (SELECT graph_id, seq, replace(gen_random_uuid()::text, '-', '') AS salt
          FROM events WHERE payload_hash IS NULL) s
 WHERE e.graph_id = s.graph_id AND e.seq = s.seq;

-- Per-graph seq, allocated under the graphs row lock. Holding it to commit makes
-- allocation order == commit order, so seq is GAPLESS and learned_at is MONOTONE
-- with seq. That is what makes ?since= polling safe and "derived views keyed by
-- event seq" sound — no settled-horizon / pg_stat_activity machinery is needed.
--
-- FOR NO KEY UPDATE, *never* FOR UPDATE, and the difference is a production
-- outage. `INSERT INTO tasks` takes FOR KEY SHARE on the parent graphs row for
-- the foreign key and holds it to commit. FOR UPDATE is the one row-lock mode
-- that CONFLICTS with FOR KEY SHARE, so two overlapping inserts into one graph
-- each waited on the other's FK lock — a guaranteed deadlock. Measured before
-- the fix: 10 concurrent inserts into one graph committed 1 and lost 99 to
-- 40P01; through the real route, 10 parallel POSTs returned two 500s.
-- FOR NO KEY UPDATE still conflicts with ITSELF, so writers of the same graph
-- still serialise and seq stays gapless, and it is what the UPDATE in
-- bump_graph_updated_at() already takes — which is why that UPDATE never had
-- this problem and why the earlier note here ("the lock is already held") was
-- wrong. tests/e18-concurrency.test.js pins it through the HTTP routes.
CREATE OR REPLACE FUNCTION gt_next_seq(gid text) RETURNS bigint AS $$
DECLARE s BIGINT;
BEGIN
  PERFORM 1 FROM graphs WHERE id = gid FOR NO KEY UPDATE;
  SELECT COALESCE(MAX(seq), 0) + 1 INTO s FROM events WHERE graph_id = gid;
  RETURN s;
END $$ LANGUAGE plpgsql;

-- Snapshots. LEARNED AXIS ONLY beyond genesis: a periodic snapshot at seq S
-- encodes "all events seq <= S in LEARNED order"; a backdated event learned
-- after S sorts BEFORE some of them on the happened axis, so S's last-writer
-- outcomes are wrong for that ordering. Genesis is exempt (nothing precedes it).
CREATE TABLE IF NOT EXISTS graph_snapshots (
  graph_id        TEXT        NOT NULL,
  axis            TEXT        NOT NULL DEFAULT 'learned',
  seq             BIGINT      NOT NULL,
  kind            TEXT        NOT NULL DEFAULT 'periodic',
  at              TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  max_happened_at TIMESTAMPTZ,
  state           JSONB       NOT NULL,
  state_sha       TEXT        NOT NULL,
  node_count      INTEGER     NOT NULL DEFAULT 0,
  edge_count      INTEGER     NOT NULL DEFAULT 0,
  fold_version    INTEGER     NOT NULL DEFAULT 1,
  built_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (graph_id, axis, seq),
  CONSTRAINT snapshots_axis_valid       CHECK (axis IN ('learned')),
  CONSTRAINT snapshots_kind_valid       CHECK (kind IN ('genesis','periodic')),
  CONSTRAINT snapshots_seq_nonneg       CHECK (seq >= 0),
  CONSTRAINT snapshots_state_object     CHECK (jsonb_typeof(state) = 'object'),
  CONSTRAINT snapshots_genesis_at_zero  CHECK (kind <> 'genesis' OR seq = 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS graph_snapshots_genesis_uniq
  ON graph_snapshots (graph_id, axis) WHERE kind = 'genesis';

-- Genesis for every FUTURE graph, structurally: a new graph has no rows, so its
-- seq-0 substrate is the empty state. This closes the only genesis race the
-- trigger design would otherwise have (there is no openWrite hook to seed it
-- lazily before the first write). The literal MUST equal canonicalStringify of
-- fold.emptyState() byte-for-byte — pinned by a unit test.
CREATE OR REPLACE FUNCTION gt_seed_genesis() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO graph_snapshots (graph_id, axis, seq, kind, at, max_happened_at,
                               state, state_sha, node_count, edge_count)
  VALUES (NEW.id, 'learned', 0, 'genesis', COALESCE(NEW.created_at, clock_timestamp()),
          COALESCE(NEW.created_at, clock_timestamp()),
          '{"v":1,"nodes":[],"edges":[]}'::jsonb,
          encode(sha256(convert_to('{"v":1,"nodes":[],"edges":[]}', 'UTF8')), 'hex'), 0, 0)
  ON CONFLICT DO NOTHING;
  RETURN NULL;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS gt_seed_genesis_t ON graphs;
CREATE TRIGGER gt_seed_genesis_t AFTER INSERT ON graphs
  FOR EACH ROW EXECUTE FUNCTION gt_seed_genesis();

-- ---- diff + classification -------------------------------------------------
-- `to_present` disambiguates the ONE thing `to` cannot say. `->` yields SQL
-- NULL for "key absent" and JSON null for "key present, value null", and
-- jsonb_build_object flattens both to `"to": null` — so a replay could not tell
-- a removed meta key from one explicitly set to null, and the fold guessed
-- "removed". `GET /graph` returns the RAW meta object, so the guess was visible
-- to every client whenever it was wrong. The flag is emitted ONLY on the
-- entries where `to` is JSON null, i.e. exactly the ambiguous ones: every other
-- entry keeps its historic `{from, to}` shape, no top-level column change grows
-- a constant `"to_present": true`, and an entry with no flag at all is a
-- pre-flag event that src/events/fold.js still reads exactly as it always did.
-- `from` is deliberately NOT given the same treatment: the fold never reads it
-- (fold.js header, "to-ONLY"), so a flag there would be payload weight with no
-- reader.
CREATE OR REPLACE FUNCTION gt_diff(old_j jsonb, new_j jsonb, prefix text DEFAULT '')
RETURNS jsonb AS $$
  SELECT COALESCE(jsonb_object_agg(prefix || k,
           jsonb_build_object('from', old_j -> k, 'to', new_j -> k)
           || CASE WHEN (new_j -> k) IS NULL OR jsonb_typeof(new_j -> k) = 'null'
                   THEN jsonb_build_object('to_present', new_j ? k)
                   ELSE '{}'::jsonb END), '{}'::jsonb)
  FROM (SELECT jsonb_object_keys(old_j) AS k
        UNION SELECT jsonb_object_keys(new_j)) ks
  WHERE (old_j -> k) IS DISTINCT FROM (new_j -> k)
$$ LANGUAGE sql IMMUTABLE;

-- NOTE: `ks := ks || 'literal'` fails 42804 (malformed array literal).
-- array_append is required.
CREATE OR REPLACE FUNCTION gt_classify_node(ch jsonb) RETURNS text[] AS $$
DECLARE ks text[] := '{}';
BEGIN
  IF ch ? 'meta.decided_at' THEN
    IF (ch #>> '{meta.decided_at,to}') IS NOT NULL
      THEN ks := array_append(ks, 'decision.made');
      ELSE ks := array_append(ks, 'decision.reopened'); END IF;
  END IF;
  -- claim.refuted mirrors decision.made/decision.reopened's set-vs-clear shape
  -- three lines above, and is placed BEFORE claim.verified so a change that
  -- asserts both headlines the doubt. array_append, never `ks := ks || 'lit'`
  -- (42804). E18.2.
  IF ch ? 'meta.refuted_at' AND (ch #>> '{meta.refuted_at,to}') IS NOT NULL
    THEN ks := array_append(ks, 'claim.refuted'); END IF;
  IF ch ? 'meta.verified_at' AND (ch #>> '{meta.verified_at,to}') IS NOT NULL
    THEN ks := array_append(ks, 'claim.verified'); END IF;
  IF ch ? 'meta.status' THEN ks := array_append(ks, 'status.changed'); END IF;
  IF ch ? 'meta.confidence' OR ch ? 'meta.significance'
    THEN ks := array_append(ks, 'field.set'); END IF;
  IF array_length(ks, 1) IS NULL
     OR (ch - ARRAY['meta.decided_at','meta.refuted_at','meta.verified_at',
                    'meta.status','meta.confidence','meta.significance']) <> '{}'::jsonb
    THEN ks := array_append(ks, 'node.patched'); END IF;
  RETURN ks;
END $$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION gt_classify_edge(ch jsonb) RETURNS text[] AS $$
DECLARE ks text[] := '{}';
BEGIN
  IF ch ? 'source_id' OR ch ? 'target_id' THEN ks := array_append(ks, 'edge.rewired'); END IF;
  IF ch ? 'purpose'   OR ch ? 'type'      THEN ks := array_append(ks, 'edge.retyped'); END IF;
  IF array_length(ks, 1) IS NULL
     OR (ch - ARRAY['source_id','target_id','purpose','type']) <> '{}'::jsonb
    THEN ks := array_append(ks, 'edge.patched'); END IF;
  RETURN ks;
END $$ LANGUAGE plpgsql IMMUTABLE;

-- A route may PROMOTE a mechanically-derived kind to headline; it can never
-- invent one. gt.intent='decision.made' on a status-only change is ignored.
CREATE OR REPLACE FUNCTION gt_headline(ks text[]) RETURNS text AS $$
  SELECT CASE WHEN gt_ctx('gt.intent') = ANY(ks) THEN gt_ctx('gt.intent') ELSE ks[1] END
$$ LANGUAGE sql STABLE;

-- Bodies: whole on the `to` side (forward replay is exact), digest on the
-- `from` side, capped at 128 KB.
-- convert_to(..., 'UTF8'), never `::bytea`. A text -> bytea CAST parses the
-- string as bytea ESCAPE input, so any body containing a backslash that does
-- not begin a valid escape (a `\d` regex, a `C:\Users` path, LaTeX) raises
-- 22P02 and takes the whole write down with it. Measured on production data:
-- 118 nodes across 10 of 65 graphs, including this project's own build graph.
-- convert_to() is the encoding conversion this always meant, it cannot fail,
-- it agrees byte-for-byte with the cast on every input the cast accepts
-- (ASCII and multibyte UTF-8 alike), and it is what Node's
-- createHash('sha256').update(text) already hashes on the JS side.
CREATE OR REPLACE FUNCTION gt_content_change(old_c text, new_c text) RETURNS jsonb AS $$
  SELECT jsonb_build_object(
    'from_sha',  encode(sha256(convert_to(COALESCE(old_c,''), 'UTF8')), 'hex'),
    'to',        CASE WHEN length(COALESCE(new_c,'')) <= 131072 THEN to_jsonb(new_c) ELSE 'null'::jsonb END,
    'to_sha',    encode(sha256(convert_to(COALESCE(new_c,''), 'UTF8')), 'hex'),
    'to_len',    length(COALESCE(new_c,'')),
    'truncated', length(COALESCE(new_c,'')) > 131072)
$$ LANGUAGE sql IMMUTABLE;

-- ---- row loggers -----------------------------------------------------------
-- Suppressed columns are LEASE/bookkeeping state, not graph facts. Suppressing
-- claim_* is what stops tasks.js:315 lease renewals drowning the log; ch = '{}'
-- then also absorbs rotate-id's mass graph_id rewrite and batch.js's idempotent
-- re-upserts. VERIFIED: a renewal emits nothing.
CREATE OR REPLACE FUNCTION gt_log_task() RETURNS TRIGGER AS $$
DECLARE
  gid  TEXT := COALESCE(NEW.graph_id, OLD.graph_id);
  ch   JSONB;
  ks   TEXT[];
  drop_cols TEXT[] := ARRAY['id','graph_id','created_at','updated_at','version',
    'last_modified_by','last_modified_by_user','claimed_by','claimed_by_name',
    'claim_expires_at','meta','content'];
  s BIGINT;
BEGIN
  IF NOT gt_capture_enabled() THEN RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NULL END; END IF;

  IF TG_OP = 'INSERT' THEN
    s := gt_next_seq(gid);
    INSERT INTO events (graph_id, seq, happened_at, learned_at, actor, kind,
                        subject_kind, subject_id, cause_id, request_id, txid, payload)
    VALUES (gid, s, gt_happened_at(), clock_timestamp(), gt_actor(), 'node.created',
            'node', NEW.id, NULLIF(gt_ctx('gt.cause_id'),'')::bigint, gt_ctx('gt.request_id'), 0,
            jsonb_build_object('v',1,'op','INSERT','table','tasks',
              'kinds', jsonb_build_array('node.created'),
              'node_kind', NEW.meta ->> 'type',
              'version', NEW.version,
              'after', to_jsonb(NEW) - 'graph_id'));
    RETURN NULL;
  END IF;

  IF TG_OP = 'DELETE' THEN
    -- BEFORE DELETE, so node.removed lands in the log before ON DELETE CASCADE
    -- reaches edges and the edge logger can point cause_id at it. VERIFIED.
    s := gt_next_seq(gid);
    INSERT INTO events (graph_id, seq, happened_at, learned_at, actor, kind,
                        subject_kind, subject_id, cause_id, request_id, txid, payload)
    VALUES (gid, s, gt_happened_at(), clock_timestamp(), gt_actor(), 'node.removed',
            'node', OLD.id, NULLIF(gt_ctx('gt.cause_id'),'')::bigint, gt_ctx('gt.request_id'), 0,
            jsonb_build_object('v',1,'op','DELETE','table','tasks',
              'kinds', jsonb_build_array('node.removed'),
              'node_kind', OLD.meta ->> 'type',
              'graph_deleted', gt_ctx('gt.graph_deleting') IS NOT DISTINCT FROM gid,
              'before', CASE WHEN gt_ctx('gt.graph_deleting') IS NOT DISTINCT FROM gid
                             THEN 'null'::jsonb ELSE to_jsonb(OLD) - 'graph_id' END));
    RETURN OLD;
  END IF;

  ch := gt_diff(to_jsonb(OLD) - drop_cols, to_jsonb(NEW) - drop_cols)
     || gt_diff(COALESCE(OLD.meta,'{}'::jsonb), COALESCE(NEW.meta,'{}'::jsonb), 'meta.');
  IF OLD.content IS DISTINCT FROM NEW.content THEN
    ch := ch || jsonb_build_object('content', gt_content_change(OLD.content, NEW.content));
  END IF;
  IF ch = '{}'::jsonb THEN RETURN NULL; END IF;   -- lease renewal / rotate-id / no-op

  ks := gt_classify_node(ch);
  s  := gt_next_seq(gid);
  -- NEVER jsonb_strip_nulls this payload: it recurses and erases "from": null
  -- inside changes, destroying "this field was previously unset" — exactly what
  -- E18.4 worldlines need. VERIFIED.
  INSERT INTO events (graph_id, seq, happened_at, learned_at, actor, kind,
                      subject_kind, subject_id, cause_id, request_id, txid, payload)
  VALUES (gid, s, gt_happened_at(), clock_timestamp(), gt_actor(), gt_headline(ks),
          'node', NEW.id, NULLIF(gt_ctx('gt.cause_id'),'')::bigint, gt_ctx('gt.request_id'), 0,
          jsonb_build_object('v',1,'op','UPDATE','table','tasks',
            'kinds', to_jsonb(ks), 'node_kind', NEW.meta ->> 'type',
            'version', NEW.version, 'reason', gt_ctx('gt.reason'),
            -- E18.2: `intent` DECLARES deliberateness. gt_headline() still
            -- refuses to let it fabricate a kind; recording it is what makes a
            -- deliberate verification distinguishable from an incidental one.
            'intent', gt_ctx('gt.intent'), 'changes', ch));
  RETURN NULL;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS gt_log_task_before_delete ON tasks;
CREATE TRIGGER gt_log_task_before_delete BEFORE DELETE ON tasks
  FOR EACH ROW EXECUTE FUNCTION gt_log_task();
DROP TRIGGER IF EXISTS gt_log_task_after_write ON tasks;
CREATE TRIGGER gt_log_task_after_write AFTER INSERT OR UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION gt_log_task();

-- E18.4 — the supersession ANNOTATION. `supersedes` is an ordinary edge
-- purpose and the STATE it expresses is the EDGE SET, which the fold already
-- reconstructs at any (axis, asOf, known); this second event is not that state.
-- It exists because the edge event cannot answer the questions a consumer asks:
--   * its subject_id is an EDGE id, so "show me node A's worldline" could not
--     be an index seek on events_subject_idx and a seed extractor would mix id
--     spaces;
--   * `edge.retyped`'s `changes` names purpose/type ONLY — it never says which
--     nodes the edge joins — so an event that turns a `contradicts` edge INTO a
--     supersession could not name the superseded node without folding forward;
--   * supersession can begin through three different edge kinds (added,
--     retyped, rewired) and one kind unifies them.
-- subject = the SUPERSEDED node. cause_id = the edge event's own seq, allocated
-- one gt_next_seq() call earlier and therefore strictly lower, so
-- events_cause_precedes (the strict-DAG CHECK) holds BY CONSTRUCTION.
-- It calls gt_next_seq() a second time inside the SAME transaction, where the
-- graphs-row FOR NO KEY UPDATE is already held: no new lock, so the
-- graphs-then-edges lock order tests/e18-concurrency.test.js pins is untouched.
-- `op` is 'ANNOTATE' — deliberately not INSERT/UPDATE/DELETE — so the event is
-- loudly non-row-changing even if the fold's ANNOTATION_KINDS guard is ever
-- removed.
CREATE OR REPLACE FUNCTION gt_log_supersede(
  gid TEXT, edge_id BIGINT, src BIGINT, tgt BIGINT, cause BIGINT, via TEXT
) RETURNS VOID AS $$
DECLARE s BIGINT; nk TEXT;
BEGIN
  SELECT meta ->> 'type' INTO nk FROM tasks WHERE id = tgt;
  s := gt_next_seq(gid);
  INSERT INTO events (graph_id, seq, happened_at, learned_at, actor, kind,
                      subject_kind, subject_id, cause_id, request_id, txid, payload)
  VALUES (gid, s, gt_happened_at(), clock_timestamp(), gt_actor(), 'node.superseded',
          'node', tgt, cause, gt_ctx('gt.request_id'), 0,
          jsonb_build_object('v',1,'op','ANNOTATE','table','tasks',
            'kinds', jsonb_build_array('node.superseded'),
            'node_kind', nk,
            'superseded_by', src, 'edge_id', edge_id, 'via', via,
            'reason', gt_ctx('gt.reason'), 'intent', gt_ctx('gt.intent')));
END $$ LANGUAGE plpgsql;

-- ---- E18.6 excision ----------------------------------------------------------
-- Two verbs, never one. DELETE is an event and keeps its pre-image: history is
-- the product. EXCISION is the rare, owner-only, reason-required act for bytes
-- that must not exist (a pasted key, a person's email, a defamatory claim) —
-- and, as Datomic puts it, unsuitable for corrections: a mistake is superseded.
--
-- One transaction, two effects, both enforced HERE rather than in a route:
--   1. append ONE `node.excised` event — subject = the node, actor = whoever
--      set gt.actor_*, reason recorded, counts and seq range of what is about
--      to be blanked, `node_present`, and when the node still exists `after` =
--      its current meta/version/content_sha (NEVER a body) so HEAD still folds
--      to the live row. A later excision of the same node blanks THIS event's
--      `after` and `reason` too; its seq, kind, clocks, actor and counts are
--      the audit and are not removable by anything.
--   2. blank every earlier event of that subject to the marker the append-only
--      trigger's exception (ii) admits, and nothing else. Rows already marked
--      are skipped; the event just written is excluded by `seq < s`.
-- Then drop the periodic snapshots (a cache of the log; they rebuild from the
-- marked rows). The GENESIS snapshot is the one non-derivable row and carries
-- `meta`, so a node born before the log keeps a pre-log title there — the
-- route rewrites that entry to the placeholder in the same transaction
-- (src/events/snapshot.js exciseNodeFromGenesis), because state_sha is a JS
-- canonical-JSON digest this function cannot reproduce.
--
-- Why this is cheap here and global in git: `(graph_id, seq)` is not derived
-- from content, so blanking a payload changes no identifier — cause_id
-- pointers, seq-keyed caches and asOf all keep working untouched.
CREATE OR REPLACE FUNCTION gt_excise_node(gid TEXT, nid BIGINT, why TEXT) RETURNS jsonb AS $$
DECLARE
  s BIGINT; n BIGINT; lo BIGINT; hi BIGINT;
  present BOOLEAN; after_j JSONB; nk TEXT;
BEGIN
  IF why IS NULL OR btrim(why) = '' THEN
    RAISE EXCEPTION 'excision requires a reason' USING ERRCODE = '22023';
  END IF;
  -- Same lock every writer takes first (see the lock-order notes in the
  -- routes): the graphs row, FOR NO KEY UPDATE so it does not fight the FK.
  PERFORM 1 FROM graphs WHERE id = gid FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'graph % not found', gid USING ERRCODE = 'P0002';
  END IF;

  SELECT jsonb_build_object(
           'meta', meta, 'version', version, 'external_id', external_id,
           'created_at', created_at,
           'content_sha', encode(sha256(convert_to(COALESCE(content, ''), 'UTF8')), 'hex')),
         meta ->> 'type'
    INTO after_j, nk
    FROM tasks WHERE id = nid AND graph_id = gid;
  present := FOUND;

  SELECT count(*), min(seq), max(seq) INTO n, lo, hi
    FROM events
   WHERE graph_id = gid AND subject_kind = 'node' AND subject_id = nid
     AND NOT COALESCE((payload ->> 'excised')::boolean, false);
  IF NOT present AND n = 0 THEN
    RAISE EXCEPTION 'node % is not known to graph %', nid, gid USING ERRCODE = 'P0002';
  END IF;

  s := gt_next_seq(gid);
  INSERT INTO events (graph_id, seq, happened_at, learned_at, actor, kind,
                      subject_kind, subject_id, cause_id, request_id, txid, payload)
  VALUES (gid, s, gt_happened_at(), clock_timestamp(), gt_actor(), 'node.excised',
          'node', nid, NULLIF(gt_ctx('gt.cause_id'),'')::bigint, gt_ctx('gt.request_id'), 0,
          jsonb_build_object('v',1,'op','EXCISE','table','events',
            'kinds', jsonb_build_array('node.excised'),
            'node_kind', nk,
            'reason', why,
            'node_present', present,
            'excised_count', n,
            'excised_seq_min', lo,
            'excised_seq_max', hi,
            'after', COALESCE(after_j, 'null'::jsonb)));

  PERFORM set_config('gt.excising', gid, true);
  UPDATE events
     SET payload = (payload - 'after' - 'before' - 'changes' - 'reason' - 'intent')
                   || jsonb_build_object('excised', true, 'excised_by_seq', s),
         payload_salt = NULL
   WHERE graph_id = gid AND subject_kind = 'node' AND subject_id = nid
     AND seq < s
     AND NOT COALESCE((payload ->> 'excised')::boolean, false);
  PERFORM set_config('gt.excising', '', true);

  DELETE FROM graph_snapshots
   WHERE graph_id = gid AND axis = 'learned' AND kind = 'periodic';

  RETURN jsonb_build_object('seq', s, 'node_present', present, 'excised_count', n,
                            'excised_seq_min', lo, 'excised_seq_max', hi);
END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION gt_log_edge() RETURNS TRIGGER AS $$
DECLARE
  gid  TEXT := COALESCE(NEW.graph_id, OLD.graph_id);
  ch   JSONB; ks TEXT[]; gone BIGINT; cause BIGINT; s BIGINT;
  sup_before BOOLEAN; sup_new BOOLEAN; via TEXT;
  drop_cols TEXT[] := ARRAY['id','graph_id','created_at','version',
    'last_modified_by','last_modified_by_user','meta'];
BEGIN
  IF NOT gt_capture_enabled() THEN RETURN NULL; END IF;

  IF TG_OP = 'INSERT' THEN
    s := gt_next_seq(gid);
    INSERT INTO events (graph_id, seq, happened_at, learned_at, actor, kind,
                        subject_kind, subject_id, cause_id, request_id, txid, payload)
    VALUES (gid, s, gt_happened_at(), clock_timestamp(), gt_actor(), 'edge.added',
            'edge', NEW.id, NULLIF(gt_ctx('gt.cause_id'),'')::bigint, gt_ctx('gt.request_id'), 0,
            jsonb_build_object('v',1,'op','INSERT','table','edges',
              'kinds', jsonb_build_array('edge.added'),
              'version', NEW.version, 'after', to_jsonb(NEW) - 'graph_id'));
    -- E18.4 emission rule, stated once and mechanically: emit node.superseded
    -- for NEW.target_id whenever, AFTER this write, the edge's purpose is
    -- 'supersedes' AND the pair (purpose='supersedes', target_id) is NEW
    -- relative to the before-image. On INSERT there is no before-image, so the
    -- pair is new exactly when the purpose is 'supersedes'.
    IF NEW.purpose = 'supersedes' THEN
      PERFORM gt_log_supersede(gid, NEW.id, NEW.source_id, NEW.target_id, s, 'edge.added');
    END IF;
    RETURN NULL;
  END IF;

  IF TG_OP = 'DELETE' THEN
    -- Cascade detection: a mid-statement fact only the DB has. The parent task
    -- row is already gone when the RI cascade fires. VERIFIED.
    IF NOT EXISTS (SELECT 1 FROM tasks WHERE id = OLD.source_id) THEN gone := OLD.source_id;
    ELSIF NOT EXISTS (SELECT 1 FROM tasks WHERE id = OLD.target_id) THEN gone := OLD.target_id; END IF;
    IF gone IS NOT NULL THEN
      SELECT e.seq INTO cause FROM events e
        WHERE e.graph_id = gid AND e.kind = 'node.removed' AND e.subject_id = gone
          AND e.txid = pg_current_xact_id()::text::bigint
        ORDER BY e.seq DESC LIMIT 1;
    END IF;
    s := gt_next_seq(gid);
    INSERT INTO events (graph_id, seq, happened_at, learned_at, actor, kind,
                        subject_kind, subject_id, cause_id, request_id, txid, payload)
    VALUES (gid, s, gt_happened_at(), clock_timestamp(), gt_actor(), 'edge.removed',
            'edge', OLD.id, COALESCE(cause, NULLIF(gt_ctx('gt.cause_id'),'')::bigint),
            gt_ctx('gt.request_id'), 0,
            jsonb_build_object('v',1,'op','DELETE','table','edges',
              'kinds', jsonb_build_array('edge.removed'),
              'cascade_from', gone,
              'graph_deleted', gt_ctx('gt.graph_deleting') IS NOT DISTINCT FROM gid,
              'before', CASE WHEN gt_ctx('gt.graph_deleting') IS NOT DISTINCT FROM gid
                             THEN 'null'::jsonb ELSE to_jsonb(OLD) - 'graph_id' END));
    RETURN NULL;
  END IF;

  ch := gt_diff(to_jsonb(OLD) - drop_cols, to_jsonb(NEW) - drop_cols)
     || gt_diff(COALESCE(OLD.meta,'{}'::jsonb), COALESCE(NEW.meta,'{}'::jsonb), 'meta.');
  IF ch = '{}'::jsonb THEN RETURN NULL; END IF;
  ks := gt_classify_edge(ch);
  s  := gt_next_seq(gid);
  INSERT INTO events (graph_id, seq, happened_at, learned_at, actor, kind,
                      subject_kind, subject_id, cause_id, request_id, txid, payload)
  VALUES (gid, s, gt_happened_at(), clock_timestamp(), gt_actor(), gt_headline(ks),
          'edge', NEW.id, NULLIF(gt_ctx('gt.cause_id'),'')::bigint, gt_ctx('gt.request_id'), 0,
          jsonb_build_object('v',1,'op','UPDATE','table','edges',
            'kinds', to_jsonb(ks), 'version', NEW.version,
            'reason', gt_ctx('gt.reason'),
            -- E18.4: endpoints on EVERY edge UPDATE event. `changes` for a
            -- retype names purpose/type only, so without this an event that
            -- turns an edge INTO a supersession cannot say which node was
            -- superseded without folding the whole log forward. Purely
            -- additive; ~40 bytes per edge patch.
            'endpoints', jsonb_build_object('source_id', NEW.source_id,
                                            'target_id', NEW.target_id),
            'changes', ch));

  -- Fire ONLY when the (purpose='supersedes', target_id) pair is NEW for this
  -- row. A meta-only patch on a live supersedes edge, a retype AWAY from
  -- supersedes, and a delete all leave the pair unchanged or gone, so none of
  -- them annotates. A rewire of a live supersedes edge onto a different target
  -- does produce a new pair, and annotates the NEW target.
  sup_before := (OLD.purpose = 'supersedes');
  sup_new    := (NEW.purpose = 'supersedes')
                AND (NOT sup_before OR NEW.target_id IS DISTINCT FROM OLD.target_id);
  IF sup_new THEN
    via := CASE WHEN NOT sup_before THEN 'edge.retyped' ELSE 'edge.rewired' END;
    PERFORM gt_log_supersede(gid, NEW.id, NEW.source_id, NEW.target_id, s, via);
  END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS gt_log_edge_after_write ON edges;
CREATE TRIGGER gt_log_edge_after_write AFTER INSERT OR UPDATE OR DELETE ON edges
  FOR EACH ROW EXECUTE FUNCTION gt_log_edge();

-- E18.4 exclusion probe. The bare `NOT EXISTS (... purpose='supersedes' ...)`
-- is a bitmap heap scan (measured on the largest real graph, 2289 edges:
-- 0.589 ms, 86 buffers, 2289 rows removed by filter). With this partial index
-- it is an Index Only Scan — 0.032 ms, 2 buffers, 18x faster — and the index
-- is ONE EMPTY PAGE (8192 bytes) today because no corpus row qualifies. It
-- serves /frontier's probe, /ready's per-row term and /decisions/at-risk alike.
CREATE INDEX IF NOT EXISTS edges_supersedes_idx
  ON edges (graph_id, target_id) WHERE purpose = 'supersedes';

-- E18.5 branch-point probe, built on exactly the same argument one comment up.
-- The option edges of a graph are a handful of rows among thousands, and the
-- dormancy CTE's anchor term reads only them. Measured at 16384 bytes, created
-- in 12 ms, served as an Index Only Scan (actual time 0.036..0.037, 2 buffers,
-- Execution Time 0.051 ms). It is ONE (almost) EMPTY PAGE today because no
-- corpus edge carries `meta.branch`. `source_id` is indexed rather than
-- `target_id` because the anchor joins the DECISION side — the option edge
-- points decision -> option.
CREATE INDEX IF NOT EXISTS edges_branch_idx
  ON edges (graph_id, source_id, target_id)
  WHERE purpose = 'related to' AND meta ? 'branch';

-- rotate-id: no FK carries events/snapshots, so move them explicitly, then one
-- graph.id_rotated. graph DELETE: set gt.graph_deleting so the cascaded row
-- loggers emit compact events, and write a tombstone BEFORE the cascade.
CREATE OR REPLACE FUNCTION gt_log_graph() RETURNS TRIGGER AS $$
DECLARE s BIGINT; n INT; e INT;
BEGIN
  IF NOT gt_capture_enabled() THEN RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NULL END; END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS NOT DISTINCT FROM OLD.id THEN RETURN NULL; END IF;
    UPDATE events         SET graph_id = NEW.id WHERE graph_id = OLD.id;
    UPDATE graph_snapshots SET graph_id = NEW.id WHERE graph_id = OLD.id;
    s := gt_next_seq(NEW.id);
    INSERT INTO events (graph_id, seq, happened_at, learned_at, actor, kind,
                        subject_kind, subject_id, request_id, txid, payload)
    VALUES (NEW.id, s, gt_happened_at(), clock_timestamp(), gt_actor(), 'graph.id_rotated',
            'graph', NULL, gt_ctx('gt.request_id'), 0,
            jsonb_build_object('v',1,'kinds',jsonb_build_array('graph.id_rotated'),
              'changes', jsonb_build_object('graph_id',
                jsonb_build_object('from', to_jsonb(OLD.id), 'to', to_jsonb(NEW.id)))));
    RETURN NULL;
  END IF;

  PERFORM set_config('gt.graph_deleting', OLD.id, true);
  SELECT count(*) INTO n FROM tasks WHERE graph_id = OLD.id;
  SELECT count(*) INTO e FROM edges WHERE graph_id = OLD.id;
  s := gt_next_seq(OLD.id);
  INSERT INTO events (graph_id, seq, happened_at, learned_at, actor, kind,
                      subject_kind, subject_id, request_id, txid, payload)
  VALUES (OLD.id, s, gt_happened_at(), clock_timestamp(), gt_actor(), 'graph.deleted',
          'graph', NULL, gt_ctx('gt.request_id'), 0,
          jsonb_build_object('v',1,'kinds',jsonb_build_array('graph.deleted'),
            'node_count', n, 'edge_count', e, 'name', OLD.name));
  RETURN OLD;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS gt_log_graph_rotate ON graphs;
CREATE TRIGGER gt_log_graph_rotate AFTER UPDATE OF id ON graphs
  FOR EACH ROW EXECUTE FUNCTION gt_log_graph();
DROP TRIGGER IF EXISTS gt_log_graph_delete ON graphs;
CREATE TRIGGER gt_log_graph_delete BEFORE DELETE ON graphs
  FOR EACH ROW EXECUTE FUNCTION gt_log_graph();

-- ---- coordination events (one data model, 2026-11-06) -----------------------
-- The coordination engine (Multitap's Go server; Superpose's core ported by its
-- tests) keeps its records — propositions, lines, its findings, assumptions and
-- decisions — as nodes of this record, each with the engine's whole document
-- under meta.coord (er289bkv2zkcs5w6 #11334, D1–D6). Its own log — "lease
-- taken", "push seen", "landed", "finding filed" — joins THIS log through the
-- one function below, so a graph has one history with one sequence.
--
--   kind         'coord.' || the engine's event type ('proposition.landed', …)
--   subject      the node that holds the engine record the event is mostly
--                about ('node', its tasks.id), or NULL when the event concerns
--                no single node (a line, the served reality)
--   payload      {v:1, op:'ANNOTATE', kinds:[kind], coord_seq, at, claims:
--                [engine ids], data:{…}} — `op` ANNOTATE for the same reason as
--                gt_log_supersede: the fold must never read it as a row change,
--                and says so loudly if its guard is ever removed. `coord_seq` is
--                the engine's OWN per-graph sequence (its replay and its
--                "events since" use it); the record's `seq` counts every event
--                of the graph, so the two differ and both are kept. `at` is the
--                engine's clock value for the event (milliseconds; synthetic in
--                its tests), kept apart from happened_at, which is wall time.
--   actor        gt_actor(), from the same session context the routes set, so
--                the engine's writes are attributed like any agent's
--   cause_id     NULL: the engine's causality is in `claims` and `data`
--
-- `claims` — the parameter and the payload key — holds the engine's PROPOSITION
-- ids (the unit of work was renamed on 2026-11-07, Multitap #11338). The name
-- stays for now: CREATE OR REPLACE cannot rename a parameter of a function that
-- exists ("cannot change name of input parameter"), and the Node app at 93ce2f8,
-- still running as the rollback, re-applies THIS function with this name and
-- this key at every boot; the two servers share the database. Rename both when
-- that app is retired (one line here, one in the Go store's reader).
--
-- Returns the record's seq. Append-only like every event (gt_events_append_only).
CREATE OR REPLACE FUNCTION gt_log_coord(
  gid TEXT, etype TEXT, node_id BIGINT, coord_seq BIGINT, at_ms BIGINT, claims JSONB, data JSONB
) RETURNS BIGINT AS $$
DECLARE s BIGINT; k TEXT;
BEGIN
  IF etype IS NULL OR etype = '' OR etype LIKE 'coord.%' THEN
    RAISE EXCEPTION 'gt_log_coord: etype must be the engine''s bare event type, got %', etype
      USING ERRCODE = '22023';
  END IF;
  k := 'coord.' || etype;
  s := gt_next_seq(gid);
  INSERT INTO events (graph_id, seq, happened_at, learned_at, actor, kind,
                      subject_kind, subject_id, cause_id, request_id, txid, payload)
  VALUES (gid, s, gt_happened_at(), clock_timestamp(), gt_actor(), k,
          CASE WHEN node_id IS NULL THEN NULL ELSE 'node' END, node_id,
          NULL, gt_ctx('gt.request_id'), 0,
          jsonb_build_object('v',1,'op','ANNOTATE',
            'kinds', jsonb_build_array(k),
            'coord_seq', coord_seq,
            'at', at_ms,
            'claims', COALESCE(claims, '[]'::jsonb),
            'data', COALESCE(data, '{}'::jsonb)));
  RETURN s;
END $$ LANGUAGE plpgsql;
