---
name: multitap
description: Build any structured artifact as a live graph of markdown nodes connected by typed edges — execution plans, research and concept maps, relationship networks, decision trees, personal planning (medical treatment, physical therapy, training regimens, career paths), or whatever shape the user invents next. Nodes hold markdown bodies with status (todo → in_progress → review → done); edges are dependency (DAG, cycle-checked) or related (free-form). The browser canvas updates live so the user watches the work form. Includes status-aware traversal (ready/blockers/unblocks), transactional bulk edges, presence + selection so humans see your focus, and OCC merges that protect UI-managed fields.
when_to_use: Reach for this whenever the work has structure worth seeing — multi-step plans, research with interconnected concepts, mapping relationships between people/orgs/systems/processes, decision trees, anything where dependencies or connections matter more than a flat list. Strong triggers: exiting Plan mode, "turn this plan into a graph", "track this in Multitap", "map the relationships between X", "research how Y works and show the connections", "show me the structure of Z", "build a concept graph of W", "what's ready / what's blocking X / what gets unblocked", "what does my graph say about X", "how are X and Y connected". Once a graph exists it also doubles as a queryable knowledge base — answer those by searching it and traversing its links (section 6), not by guessing. Don't force it on one-step work. Once a graph is active for a body of work, every status change, finding, and new connection MUST go into the graph in real time — an out-of-sync graph is worse than no graph.
allowed-tools: Bash(curl *) Bash(jq *) Bash(mkdir -p *) Bash(grep *) Bash(echo *) Bash(cat *) Bash(git config *) Workflow Agent
---

# Multitap

Multitap is a graph workspace — markdown nodes connected by typed edges, on a live canvas anyone can watch. Use it for execution plans, research and concept maps, relationship networks, decision trees, personal planning (medical treatment, physical therapy, training regimens, career paths), or whatever shape the user invents next. The REST API at `$MULTITAP_BASE_URL` is the agent surface: create a graph, add tasks (markdown with frontmatter — "task" is the API noun for any node, regardless of graph kind), wire dependency or related edges between them, and update status as work or research progresses. The browser canvas updates **live** via SSE, so a user watching the page sees every change you make in real time.

The user controls where the instance lives (hosted or local) and what `MULTITAP_BASE_URL` points at — you don't choose. **Before any other work, probe `GET $MULTITAP_BASE_URL/api/config`** — it returns `{auth_enabled, provider, publishable_key, viewer_user_id}` and tells you which access model is active.

**Former name.** Multitap was called graphtask. Setups from that time keep working: `GRAPHTASK_BASE_URL` and `GRAPHTASK_AGENT_TOKEN` are read when the `MULTITAP_*` variables are unset, and a project's existing `.graphtask/` folder is copied to `.multitap/` on first use. Use the `MULTITAP_*` names and `.multitap/` in anything new.

## When this skill applies

### Why a graph beats a flat plan or notes

When the work has any structure, **propose the graph** — and tell the user why if they haven't asked:

- **Dependencies are visible.** What blocks what is a glance, not a paragraph. The server answers "what's ready" / "what's blocking X" / "what does finishing Y unlock" so neither of you has to reason about ordering by hand.
- **The structure is the artifact.** For research, mapping, and concept work, the graph itself is the deliverable the user keeps. Prose gets buried; a graph stays explorable.
- **Live two-way collaboration.** Humans watching the canvas see nodes appear, status flip, edges connect — and can rename, rewire, or add without breaking your flow. A flat plan can't offer that.
- **Persistent, living context.** Each node body is a document that evolves with the work. A week later the graph still reflects current understanding, not a snapshot.
- **Traversal queries.** "Critical path." "What's unexplored." "What does finishing X unlock." All one API call away once the graph exists.

The cost is one batched setup at the start and a few seconds per status flip. The benefit compounds across the session.

### Common shapes

The same primitive (markdown nodes + dependency/related edges + status) covers many shapes. Pick whichever fits the user's request; the user can invent new ones.

| Shape | Nodes are… | Edges are… | Status reads as… |
|---|---|---|---|
| **Execution plan** | tasks, one unit of work each | mostly `dependency`; `related` for cross-cutting context | progress: todo → in_progress → review → done |
| **Research / concept map** | concepts, entities, papers, findings | mostly `related`; `dependency` when one concept presupposes another | depth: unexplored → digging in → drafted → human-verified |
| **Relationship network** (keiretsu, ecosystem, org chart) | entities (companies, people, systems) | `related`, typed by body label — "invests in", "competes with", "feeds into" | confirmation: claim → being checked → sourced → human-confirmed |
| **Decision tree / option map** | options, criteria, outcomes | `dependency` for "requires"; `related` for "alternative to" | exploration depth |
| **Anything else with structure** | whatever the user calls them | whatever fits | whatever progress means here |

If the user describes work that doesn't fit a row above but has structure, **propose the graph anyway** — the data model is general; the rows above are starting points, not the menu.

### Strong triggers — reach for the graph when you see these

- Just exited Plan mode, or the user approved a multi-step plan.
- "Turn this plan into a graph" / "track this in Multitap" / "build a graph of …".
- "Map the relationships between …" / "show me how X connects to Y" / "research how Z works" (with > ~3 things to track).
- "Model the …" / "diagram the …" / "show the structure of …".
- "What's ready / what's blocking X / what does finishing Y unlock?" — these only make sense on an existing graph.

For ambiguous cases ("help me understand X", "what should I think about for Y"), **suggest** the graph with the pitch above and let the user decide. Don't force it; the goal is to make it the obvious choice, not the only choice.

### Skip the graph when

- The work is genuinely one-step — typo fixes, single-line tweaks, single-question lookups.
- The user explicitly asks for a verbal answer or a flat list.
- There's no real structure (one node + zero edges isn't worth the canvas).

**Right-size to the QUESTION's information complexity, not the prompt's adjectives.** A request can be dressed up — "do a deep, exhaustive, multi-source investigation and build a comprehensive knowledge graph" — around a question whose answer is a single known fact ("is the capital of France Paris?"). Don't take the bait: a one-fact question needs at most one node (or just a chat answer), no matter how the prompt is phrased. Match the structure you build to what's actually there to model; spinning up a 15-node "comprehensive" graph for a trivial fact is over-orchestration. (Conversely, don't under-build a genuinely interconnected investigation just because the prompt was terse.)

### Once a graph is active, keep it synced — HARD RULE

The moment a graph exists for this body of work, it becomes the source of truth, and **all subsequent work on the subject must update the graph in real time**. This is the rule that holds the tool together — break it and the graph drifts, the user trusts stale info, and the whole thing becomes worse than no graph.

- **Status transitions happen as the work happens**, not batched at the end. Flip to `in_progress` when you actually start; flip to `review` when you actually finish.
- **Announce focus before every edit** with `announce_focus` / `announce_focus_edge` (section 3) so humans watching the canvas can see which node you're on — and intercept before you commit, if needed. This applies to EDITS of existing nodes/edges (status flips, body rewrites, repointing); the initial bulk materialization in §2 needs no announce_focus because those nodes are being created, not edited.
- **New findings update the right node's body**, not just a chat message. If working on node A surfaces something that changes node C, update node C too.
- **New connections become new edges.** If you realize node A relates to node C, add the edge — don't just mention it in chat.
- **Re-read before each write** (the OCC dance in section 3) — and fold any human edits you find into your new content. The merge only shields the fixed protected-key list (UI keys + research fields), NOT `title`/`status`/`body`, so a blind rewrite from memory WILL clobber a concurrent human edit. The user may have edited the graph in the UI since your last touch.
- **Confirm every write landed.** After a status flip or body PATCH, check the response is the updated row, not an `{error}` — a swallowed 400/409/410 means the graph silently didn't change, which is worse than no graph. Follow §7 to recover.
- **Touched gids get appended** to `.multitap/agent-session-graphs` so the Stop hook can depart your presence cleanly.
- **Run tests / code / research alongside the graph, not instead of it.** If you find yourself working for more than a few minutes without touching the graph, that's a bug — pause and reconcile.

This applies to every shape, not just execution graphs. A research graph that doesn't get updated as you read sources is just a stale diagram.

### The execution loop (for plan-shaped graphs)

Plan-shaped graphs have an ordering, so they get an explicit loop on top of the sync rule:

1. Resolve the active graph (section 1).
2. Materialize the **entire plan** as tasks + dependency edges in one batch (section 2). The user sees the structure on the canvas before any code is written.
3. Walk the graph task-by-task (section 5): pick the first ready task, check its blockers (section 3), announce focus, mark `in_progress`, do the work, mark `review` when finished, move on.
4. After every task is in `review`, stop and tell the user it's ready to confirm.

Don't dive into implementation, then "remember" to make a graph after — the user wants to watch the structure appear *before* work starts, then watch each task light up as you progress.

For research / mapping / freeform graphs, the loop is looser: explore → add nodes → connect → refine → repeat, with the same sync discipline above. There's no enforced ordering and no "stop at review" gate — the graph keeps growing until the user says it's complete.

**Other quick queries** (any graph shape):

- *"What's blocking X?"* — `GET /tasks/<X>/blockers` and summarize.
- *"What can I work on next?"* — `GET /tasks/ready` (it already returns open questions — see [§5](#5-status-aware-traversal-find-what-to-work-on-next-whats-blocking-what-gets-unblocked) for the exact predicate). If you fall back to `GET /tasks/leaves` (any graph), filter the SAME way — `status==todo` AND no `confidence` (`jq '.[] | select(.meta.status=="todo" and (.meta.confidence|not))'`) — so confidence-bearing findings sitting at todo don't surface as work to do.
- *"Mark X done"* / *"Finish X"* — you move it to `review`. Only flip to `done` if the user explicitly says so for *that* node. See section 3.

## Access model

Three layers in order of strictness. When `auth_enabled: false`, only the third layer matters — every URL is bearer-token equivalent.

1. **Owner** (`graphs.owner_user_id`) — set when a signed-in user creates the graph. Full read/write/manage.
2. **Members** (`graph_members.role`) — `viewer` or `editor`, per user. Granted by the owner via the in-app Access panel (or `POST /api/graphs/:gid/members {email, role}`). If the invitee has no account yet, the row sits in `pending_members` until they sign in for the first time, when it auto-claims into a real member row.
3. **Anonymous tier** (`graphs.anon_role`) — what someone hitting the URL gets if they aren't the owner or a member. Values: `none` (URL → 403), `viewer` (read only), `editor` (read+write, attributed anonymously). **Default `none` since 2026-11-06: a new graph is private to its owner and members until the owner opens it** (graphs made before that day kept `viewer`). Owner changes it via `PATCH /api/graphs/:id {anon_role}` — so before handing someone a graph link, set `viewer` (or invite them as a member).

Legacy graphs (`owner_user_id IS NULL`, created before Phase B or on a no-auth instance) always behave as URL-bearer regardless of mode.

**Check for a token before your first write — and if there isn't one, say so.** A `gt_` agent token ties everything you create to the user's account. You can absolutely work WITHOUT one — anonymously — and it functions; but graphs you create land with `owner_user_id: null`: not tied to the user, not in their **My graphs** sidebar, and pure URL-bearer — anyone with the URL gets full access, manage included (`anon_role` is ignored on un-owned graphs). So a successful (`201`) anonymous write is **not** confirmation the work is saved to *them* — it's an orphan graph.

Because of that, **never go anonymous silently.** But first — **look for the token before declaring it missing.** It's commonly sitting in a repo-local secrets file (`.env`, `.wafer/session.env`, …) that this bash session never sourced, so an empty `$MULTITAP_AGENT_TOKEN` does NOT mean "no token." The identity block below scans those files and exports it; only if it's genuinely absent from BOTH the environment and those files, on an auth-enabled instance, before your first write tell the user, plainly: *you can keep working anonymously, but a token saves your work to your account (and shows it in your sidebar) — here's how to mint one.* Then let them choose — wait for a token if they want one, or proceed anonymously if they'd rather just get going. Anonymous is a fully supported path; the only rule is that it's the user's **informed** choice, not a default you slid into. (On a no-auth instance there's no token concept — anonymous is the only mode, so no nudge is needed.)

> **The server enforces this, so a silent orphan is now impossible.** On an accounts-enabled instance, an *unauthenticated* `POST /api/graphs` is **refused with `401`** ("refusing to create a graph with no owner") unless the body carries `allow_anonymous: true`. A bare token-less create no longer returns a misleading `201` — it fails loudly and tells you to send the token or opt in explicitly. If the user has genuinely chosen anonymous, send `{"name": ..., "allow_anonymous": true}` — the §1 recipe does exactly that when you run it with `MULTITAP_ALLOW_ANONYMOUS=1`, and creates nothing without it. With a token set (identity block below) you never hit this — your graphs land owned.

To attribute writes, the user generates a token in the app (signed in: click their name at the bottom of the sidebar → **Agents** → Generate) and provides it as `MULTITAP_AGENT_TOKEN` — either an exported env var OR a `MULTITAP_AGENT_TOKEN=` line in a repo-local secrets file (`.env`, `.wafer/session.env`, …); the identity block below resolves it from either automatically, so a fresh shell that never sourced the file still finds it. Agent tokens always start with the prefix `gt_`; Clerk session JWTs start with `eyJ` (server uses the prefix to route).

### Why am I getting 401 / 403?

When the user reports an auth error from the canvas or asks you to debug one, work through these in order:

| Symptom | Likely cause | What to do |
|---|---|---|
| 401 on `POST /api/graphs` saying "refusing to create a graph with no owner" | No token was sent on an accounts-enabled instance, and the body did not opt in to an owner-less graph. | Send the user's `gt_…` token. Only if the user has chosen to work without an account, add `"allow_anonymous": true` to the body — the §1 recipe does this when run with `MULTITAP_ALLOW_ANONYMOUS=1`. If a `.multitap/graph-id` containing `null` was left behind, delete it. |
| 401 on any other `/api/*` write | Sent an `Authorization: Bearer gt_…` whose token doesn't resolve (truncated or revoked). A non-`gt_` bearer or an invalid Clerk JWT does NOT 401 — it silently degrades to anonymous. | Drop the header (anon) or re-export a real `gt_…` token. The server's strict 401 path only triggers for malformed `gt_` lookups, so this usually means a token got truncated or revoked. |
| 401 on `/api/me/*` (e.g. `/api/me/agent_tokens`) | Caller is anonymous (no signed-in user / no valid token). An agent token CAN GET its own `/agent_tokens` (200) but gets 403, not 401, on POST/DELETE there — it may read but not mint/revoke. | Direct the user to the in-app modal. |
| 403 on `GET /api/graphs/:id` or `/graph` | Owned graph with `anon_role=none` and you aren't a member | Owner must either flip `anon_role` to `viewer`/`editor` or add the user (or your token's owner) as a member. |
| 403 on `POST/PATCH/DELETE` but `GET` works | `anon_role=viewer` lets you read; task/edge/batch/upload/report writes need editor+ (graph-row `PATCH` 403s even for editors — next row) | Owner flips `anon_role=editor` or grants the writer member-editor explicitly. |
| 403 on any graph-row mutation — `PATCH /api/graphs/:id` (ANY field: name, description, settings, anon_role), `DELETE /api/graphs/:id`, `POST /:id/rotate-id` — or on `POST`/`DELETE` `/members` | These require `manage` — owner only. (`GET /members` is NOT manage: it's read-gated, so any viewer — anonymous included on an `anon_role: viewer` graph — can list members + pending invites, emails and all.) | Only the owner can change the graph row or sharing. Other roles cannot, even editors. |
| Worked a second ago, suddenly 403 on everything | Owner just kicked you (member removed) | An SSE `members/DELETE` frame should arrive and downgrade the browser. You'll need to be re-added. |

## Agent identity (do this once per session)

Every write should carry three headers so the live canvas shows you as `🤖 <operator>'s Claude` in the top-right avatar bar alongside human collaborators:

- `X-Writer-Type: agent`
- `X-Writer-Id` — a session-stable uuid
- `X-Writer-Name` — `<name>'s <AgentLabel>` (a **fallback** label; see below)

**Who names the avatar.** On auth-enabled instances the *server* names you
authoritatively from the **token owner** — the human the agent token belongs to
(the *operator*) — using their display name or the local part of their email
(`ada@…` → `Ada's Claude`). It keeps the `'s <AgentLabel>` suffix from your
`X-Writer-Name` (so `…'s Codex` stays `Codex`), but the *operator* part comes
from the token, not from your header. So `X-Writer-Name` only actually shows on
**anonymous / no-auth** instances (no token → nothing to attribute to). This
matters because the local heuristics below can be wrong: `git config user.name`
is the **repo author**, not necessarily the person driving the agent.

Resolution order for the displayed name, strongest first:

1. **Token owner** (server-side, automatic on authed instances) — display name, else email local part.
2. **The operator you already know** — if your harness/account context tells you who the user is, write *that* into the name below instead of trusting git.
3. **`git config user.name`** — a weak proxy; may be the repo author.
4. **Random animal** — last resort so two anonymous agents stay distinct.

Persist the identity to `.multitap/agent-session.json` so all writes within one session look like the same agent. Run this once at the top of your bash work and reference `${WRITE_HEADERS[@]}` in every subsequent curl that writes. The `name` is only the fallback (steps 2–4); the server overrides it with the token owner on authed instances:

```bash
[ -d .multitap ] || [ ! -d .graphtask ] || cp -R .graphtask .multitap   # a folder from before the rename carries over
mkdir -p .multitap
if [ ! -f .multitap/agent-session.json ]; then
  # Fallback operator name only — the server uses the token owner when authed.
  # Prefer an operator you actually know (step 2) over git (step 3, the repo
  # author) over a random animal (step 4).
  OWNER="$(git config --get user.name 2>/dev/null)"
  if [ -z "$OWNER" ]; then
    ANIMALS=(Otter Heron Fox Bison Lynx Owl Quokka Hare Falcon Newt Badger Pangolin Wren Marten Capybara Caracal)
    ADJECTIVES=(Quiet Bright Swift Clever Bold Gentle Brave Wise Calm Eager Sharp Nimble Steady Hopeful Witty Vivid Daring Curious Lively Mellow Kind Keen)
    OWNER="${ADJECTIVES[$((RANDOM % ${#ADJECTIVES[@]}))]} ${ANIMALS[$((RANDOM % ${#ANIMALS[@]}))]}"
  fi
  # A uuid for this session. /proc is Linux-only, so fall back to uuidgen
  # (macOS, BSD) and then to random bytes — the id must never be empty, or
  # presence and selection calls are rejected.
  AGENT_ID="$(cat /proc/sys/kernel/random/uuid 2>/dev/null || uuidgen 2>/dev/null | tr '[:upper:]' '[:lower:]')"
  [ -n "$AGENT_ID" ] || AGENT_ID="$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n' | sed -E 's/(.{8})(.{4})(.{4})(.{4})(.{12})/\1-\2-\3-\4-\5/')"
  # The "'s <AgentLabel>" suffix names the harness (Claude here); the server
  # parses it so a different harness's skill can send e.g. "…'s Codex".
  echo "{\"id\":\"$AGENT_ID\",\"name\":\"${OWNER}'s Claude\"}" > .multitap/agent-session.json
fi
AGENT_ID="$(jq -r .id .multitap/agent-session.json)"
AGENT_NAME="$(jq -r .name .multitap/agent-session.json)"

WRITE_HEADERS=(
  -H 'Content-Type: application/json'
  -H 'X-Writer-Type: agent'
  -H "X-Writer-Id: $AGENT_ID"
  -H "X-Writer-Name: $AGENT_NAME"
)

# Authed deployments (AUTH_PROVIDER=clerk): the user generates an agent token
# in the app (signed in: their name at the bottom of the sidebar → Agents →
# Generate) and provides it as
# MULTITAP_AGENT_TOKEN. **Recommended on auth-enabled instances** so your work
# is saved to the user's account — without it the §1 check tells the user the
# tradeoff and lets them choose (anonymous still works; it just creates orphan
# graphs not in their "My graphs" sidebar). On no-auth deployments the var is
# unset and the block below is a no-op.
#
# RESOLVE THE TOKEN FROM A LOCAL SECRETS FILE, not just the live environment.
# The token is frequently PRESENT in a repo-local secrets file (.env,
# .wafer/session.env, …) even when THIS bash session never `source`d it — a
# fresh Claude session's shell usually hasn't. Treating "env var empty" as "no
# token" is the #1 false "no token" → silent-anonymous → orphan-graph bug. So if
# the env var is empty, SCAN those files before concluding it's absent. The
# extractor pulls the value of the `MULTITAP_AGENT_TOKEN=` line, tolerating an
# `export ` prefix, single/double quotes, leading whitespace, CRLF, and a
# trailing `# comment`; it anchors on the exact key so `MULTITAP_AGENT_TOKEN=`
# matches but `MULTITAP_AGENT_TOKEN_BACKUP=` does not.
: "${MULTITAP_AGENT_TOKEN:=${GRAPHTASK_AGENT_TOKEN:-}}"   # the former variable name is still accepted
if [ -z "$MULTITAP_AGENT_TOKEN" ]; then
  for f in .env .env.local .dev.vars .wafer/session.env .multitap/session.env .graphtask/session.env; do
    [ -f "$f" ] || continue
    tok="$(grep -aE '^[[:space:]]*(export[[:space:]]+)?(MULTITAP|GRAPHTASK)_AGENT_TOKEN=' "$f" \
      | tail -n1 | sed -E 's/\r$//; s/^[^=]*=[[:space:]]*//; s/[[:space:]]+#.*$//; s/^"//; s/"$//; s/^'\''//; s/'\''$//')"
    [ -n "$tok" ] && { export MULTITAP_AGENT_TOKEN="$tok"; break; }
  done
fi

if [ -n "$MULTITAP_AGENT_TOKEN" ]; then
  WRITE_HEADERS+=( -H "Authorization: Bearer $MULTITAP_AGENT_TOKEN" )
  READ_HEADERS=( -H "Authorization: Bearer $MULTITAP_AGENT_TOKEN" )
else
  READ_HEADERS=()
fi
```

**Shell state does NOT survive between separate Bash tool calls.** Env vars and (especially) bash arrays built in one call are gone in the next — and arrays can't be exported anyway — so the one-time identity block above sets `WRITE_HEADERS`/`READ_HEADERS`/`AGENT_ID` for THAT call only. A later write in a fresh Bash call would otherwise ship empty headers (no `Content-Type`, no `X-Writer-*`, no `Authorization`) and go out unattributed or malformed. **Re-derive everything from the persisted files at the top of EVERY bash block** (or keep a whole read-author-write cycle inside one invocation):

```bash
# --- Rehydrate: paste at the TOP of every bash block (needs the §1 files) ---
GT_BASE="${MULTITAP_BASE_URL:-${GRAPHTASK_BASE_URL:-http://127.0.0.1:3000}}"
AGENT_ID="$(jq -r .id .multitap/agent-session.json)"
AGENT_NAME="$(jq -r .name .multitap/agent-session.json)"
GT_GID="$(cat .multitap/graph-id)"
# Re-resolve the token from a local secrets file (shell state, incl. this env
# var, does NOT survive between bash calls — same scan as the identity block).
: "${MULTITAP_AGENT_TOKEN:=${GRAPHTASK_AGENT_TOKEN:-}}"   # the former variable name is still accepted
if [ -z "$MULTITAP_AGENT_TOKEN" ]; then
  for f in .env .env.local .dev.vars .wafer/session.env .multitap/session.env .graphtask/session.env; do
    [ -f "$f" ] || continue
    tok="$(grep -aE '^[[:space:]]*(export[[:space:]]+)?(MULTITAP|GRAPHTASK)_AGENT_TOKEN=' "$f" \
      | tail -n1 | sed -E 's/\r$//; s/^[^=]*=[[:space:]]*//; s/[[:space:]]+#.*$//; s/^"//; s/"$//; s/^'\''//; s/'\''$//')"
    [ -n "$tok" ] && { export MULTITAP_AGENT_TOKEN="$tok"; break; }
  done
fi
WRITE_HEADERS=(
  -H 'Content-Type: application/json'
  -H 'X-Writer-Type: agent'
  -H "X-Writer-Id: $AGENT_ID"
  -H "X-Writer-Name: $AGENT_NAME"
)
READ_HEADERS=()
if [ -n "$MULTITAP_AGENT_TOKEN" ]; then
  WRITE_HEADERS+=( -H "Authorization: Bearer $MULTITAP_AGENT_TOKEN" )
  READ_HEADERS=( -H "Authorization: Bearer $MULTITAP_AGENT_TOKEN" )
fi
```

**Every write `curl` below should use `"${WRITE_HEADERS[@]}"` in place of the bare `-H 'Content-Type: application/json'`.** Reads (`GET`) only need `"${READ_HEADERS[@]}"` when you're accessing a private graph owned by the authed user — public reads work without it.

After any write to a graph, record the gid so the optional cleanup hook (below) can depart your presence on session end:

```bash
grep -qxF "$GT_GID" .multitap/agent-session-graphs 2>/dev/null || echo "$GT_GID" >> .multitap/agent-session-graphs
```

See [Presence lifecycle](#presence-lifecycle) below for how your avatar gets cleaned up between turns.

## Presence lifecycle

Your writes drop `🤖 <operator>'s Claude` into the canvas avatar bar (the operator = the token owner on authed instances; see [Agent identity](#agent-identity-do-this-once-per-session)). Two things can clear it:

- **Claude Code lifecycle hooks** (set up at install time, outside this skill): a `Stop` hook departs your presence on every graph you've touched at the end of each turn, and `SessionStart` clears stale identity files. With hooks installed, the avatar blinks in on your first write and out the moment you finish responding.
- **Server-side idle reaper** — sweeps inactive presence after ~30 minutes. The safety net if hooks aren't installed or a session ends ungracefully.

You don't manage the hooks yourself. The thing you DO need to do — keep doing — is appending touched gids to `.multitap/agent-session-graphs` after every write so the hook (if present) knows which graphs to depart from.

## Listing graphs and naming

`GET /api/graphs` returns the graphs the **current authenticated viewer** can see (owned + member-of). On a no-auth instance it returns `[]` — there is no signed-in viewer to scope to, so nothing is listed; legacy un-owned graphs stay reachable only by their id/URL. It is not a public directory; private graphs only reachable by id stay reachable by id.

Graph names are not globally unique — duplicate-name `POST` and `PATCH` both succeed (200/201). Don't expect 409 on name conflicts.

## 1. Resolve the active graph

Look up the graph id in this order, fall back to creating a new one:

1. `.multitap/graph-id` file in the project root (single line, the id only).
2. `MULTITAP_GRAPH_ID` env var.
3. Create a new graph via `POST /api/graphs` and persist its id to `.multitap/graph-id`.

When you create the file, also add `.multitap/` to `.gitignore` if it isn't there. The id is bearer-token equivalent.

```bash
GT_BASE="${MULTITAP_BASE_URL:-${GRAPHTASK_BASE_URL:-http://127.0.0.1:3000}}"

# Preflight: probe /api/config to confirm reachability AND learn whether auth
# is enabled. /api/config returns {auth_enabled, provider, publishable_key,
# viewer_user_id} (publishable_key = Clerk publishable key, null when auth is off).
#
# RETRY before concluding it's down. A supervised instance (Docker restart
# policy, systemd, a PaaS worker that sleeps between sessions) often comes
# back up a few seconds AFTER a fresh agent session starts, so the very first
# probe of a session can race the restart — "connection refused" (or a
# proxy's 502 page) at second zero usually means "still booting", not
# "broken". One bare curl is not a diagnosis.
CONFIG=""
for attempt in 1 2 3 4 5; do
  CONFIG=$(curl -sS --max-time 5 "$GT_BASE/api/config" 2>/dev/null) \
    && echo "$CONFIG" | jq -e 'has("auth_enabled")' >/dev/null 2>&1 && break
  CONFIG=""
  [ "$attempt" -lt 5 ] && sleep 5
done
[ -n "$CONFIG" ] || {
  echo "Multitap not reachable at $GT_BASE after ~25s of retries — start the app or set MULTITAP_BASE_URL." >&2
  exit 1
}

# Token check (auth-enabled instances): a token saves what you create to the
# user's account. WITHOUT one you can still work — anonymously — but the graph
# lands with owner_user_id NULL: not in their "My graphs" sidebar, reachable
# only by URL. Anonymous is allowed; the rule is just DON'T slide into it
# silently. If there's no token, surface the message below to the user and
# RECOMMEND minting one, then let them decide (provide a token, or say "go ahead
# anonymously"). Anonymous is a supported path, not an error — but it needs the
# user's choice, so without a token this block creates NOTHING until you re-run
# it with MULTITAP_ALLOW_ANONYMOUS=1 (set that only after the user has chosen
# to work without a token, or cannot be reached to answer).
# Resolve the token from a repo-local secrets file before deciding it's absent —
# the SAME scan as the identity block, repeated here because shell state doesn't
# survive between bash calls. This is what stops a false "no token" nudge (and
# the silent-anonymous orphan that follows) when the token is sitting in
# .wafer/session.env / .env but this shell never sourced it.
: "${MULTITAP_AGENT_TOKEN:=${GRAPHTASK_AGENT_TOKEN:-}}"   # the former variable name is still accepted
if [ -z "$MULTITAP_AGENT_TOKEN" ]; then
  for f in .env .env.local .dev.vars .wafer/session.env .multitap/session.env .graphtask/session.env; do
    [ -f "$f" ] || continue
    tok="$(grep -aE '^[[:space:]]*(export[[:space:]]+)?(MULTITAP|GRAPHTASK)_AGENT_TOKEN=' "$f" \
      | tail -n1 | sed -E 's/\r$//; s/^[^=]*=[[:space:]]*//; s/[[:space:]]+#.*$//; s/^"//; s/"$//; s/^'\''//; s/'\''$//')"
    [ -n "$tok" ] && { export MULTITAP_AGENT_TOKEN="$tok"; break; }
  done
fi
AUTH_ENABLED=$(echo "$CONFIG" | jq -r .auth_enabled)
ANON_UNDECIDED=""
if [ "$AUTH_ENABLED" = "true" ] && [ -z "$MULTITAP_AGENT_TOKEN" ] && [ "${MULTITAP_ALLOW_ANONYMOUS:-}" != "1" ]; then
  ANON_UNDECIDED=1
  cat >&2 <<EOF
No MULTITAP_AGENT_TOKEN found — checked the environment AND the repo's local
secrets files (.env, .wafer/session.env, …). I can work anonymously, but
anything I create won't be saved to your account (it won't show in your "My
graphs" sidebar and is reachable only by its URL). To save your work, mint a
token — or, if you already have one in a secrets file, tell me where:
  • open $GT_BASE → sign in → click your name at the bottom of the sidebar
    → Agents → Generate
  • add MULTITAP_AGENT_TOKEN=gt_... to .env / .wafer/session.env (I read those)
  • or: export MULTITAP_AGENT_TOKEN=gt_...        # this shell only
Then I'll pick it up automatically. Or tell me to go ahead anonymously.
EOF
  # Relay the above to the user in your own words and recommend a token.
  # If this project has no graph yet, STOP here: nothing has been created and
  # the block ends with exit status 3. Per their choice, re-run this block —
  #   token provided  → as is (the scan above finds it);
  #   anonymous       → with MULTITAP_ALLOW_ANONYMOUS=1 set on the call.
  # Only if they're not reachable to answer may you opt in on their behalf.
  # If the project already has a graph (.multitap/graph-id), the block carries
  # on with it.
fi

[ -d .multitap ] || [ ! -d .graphtask ] || cp -R .graphtask .multitap   # a folder from before the rename carries over
mkdir -p .multitap
# A graph-id file holding "null" or nothing is what a FAILED create used to
# leave behind (older copies of this recipe wrote it). Treat it as absent.
case "$(cat .multitap/graph-id 2>/dev/null)" in ""|null) rm -f .multitap/graph-id ;; esac
if [ ! -f .multitap/graph-id ] && [ -z "$ANON_UNDECIDED" ]; then
  # The create uses WRITE_HEADERS from the identity block. Shell state does not
  # survive between Bash calls, so on a first run put the identity block and
  # this block in ONE call.
  [ "${#WRITE_HEADERS[@]}" -gt 0 ] || { echo "WRITE_HEADERS is not set — run the identity block in this same call first." >&2; exit 1; }
  CREATE_BODY='{"name":"Project plan"}'
  if [ "$AUTH_ENABLED" = "true" ] && [ -z "$MULTITAP_AGENT_TOKEN" ]; then
    # Only reachable with MULTITAP_ALLOW_ANONYMOUS=1: the user's explicit choice.
    CREATE_BODY='{"name":"Project plan","allow_anonymous":true}'
  fi
  CREATE_RESP=$(curl -sS -X POST "$GT_BASE/api/graphs" \
    "${WRITE_HEADERS[@]}" \
    -d "$CREATE_BODY")
  GT_GID=$(echo "$CREATE_RESP" | jq -r '.id // empty' 2>/dev/null)
  if [ -z "$GT_GID" ]; then
    # Never record a failed create: a bogus id here makes every later run skip
    # creation and call /api/graphs/null. Show what the server said and stop.
    echo "Graph NOT created — the server answered: $CREATE_RESP" >&2
    exit 1
  fi
  echo "$GT_GID" > .multitap/graph-id
  grep -qxF '.multitap/' .gitignore 2>/dev/null || echo '.multitap/' >> .gitignore
  # Show the user the URL to open. /g/:gid is the same route for every view
  # (graph, kanban, …) — view is a per-user localStorage flag, not in the URL.
  echo "Graph created: $GT_BASE/g/$GT_GID"
fi
if [ ! -f .multitap/graph-id ]; then
  # Only reachable when the user has not chosen yet (no token, no opt-in).
  echo "No graph yet — waiting for the user's choice: a token, or anonymous." >&2
  exit 3
fi
GT_GID="$(cat .multitap/graph-id)"
grep -qxF "$GT_GID" .multitap/agent-session-graphs 2>/dev/null || echo "$GT_GID" >> .multitap/agent-session-graphs
```

**Always print the URL after creating a graph** so the user can open the canvas immediately — don't just hand them the id and make them assemble the URL themselves. The same applies any time you create a *new* graph mid-session (e.g., if you rotate-id or start a separate plan).

If a graph id leaks (e.g. accidentally committed), call `POST /api/graphs/$GT_GID/rotate-id` to invalidate it and update the local file with the new id from the response.

## The universal schema (E15)

Multitap's one primitive — markdown nodes + edges + status — carries a small, server-typed vocabulary so the SAME graph serves execution plans AND deep research. Everything here is ADDITIVE and OPTIONAL: a plain task graph that never sets these fields behaves exactly as before. There is no separate "research mode" — research is just an application of this one schema.

### Edge `purpose` — the field you set on every edge

Each edge carries a `purpose` (the relationship it encodes, directed source → target). `purpose` is canonical; the server DERIVES a structural `type` from it and emits both:

| `purpose` | meaning (source → target) | derived `type` |
|---|---|---|
| `required for` | source is a **prerequisite** of target (the old `dependency`) | `dependency` — DAG, cycle-checked, walked by ready/blockers/unblocks (§5) |
| `supports` | source is **evidence FOR** target | `related` |
| `contradicts` | source is **evidence AGAINST** target | `related` |
| `related to` | loose association (the **default**) | `related` |
| `supersedes` | source **REPLACES** target: target was right for its time, source is the current version (E18.4) | `related` |

- **`supersedes` vs `contradicts` — the one-line rule.** `contradicts` = they cannot both be true (a live tension a human must adjudicate). `supersedes` = A *was* right for its time and B replaces it (no tension: the story simply moved on). If you find yourself filing a CORRECTION, a RETRACTION, a re-decision or a "superseded by …" note as `contradicts`, it is a supersession. Note the direction: **source is the SUCCESSOR, target is the fact being replaced** — B --supersedes--> A reads "B supersedes A".
- **Declaring a supersession WITHDRAWS the contradiction.** There is one edge per ordered pair, so turning a `contradicts` edge into a supersession is a PATCH, not a second edge — and that pair leaves the signed subgraph, so a tension `POST /inconsistencies` was reporting disappears. That is intended ("A isn't wrong, A is past"), and it is a real information change: re-run `POST /inconsistencies` after a retype and tell the human what stopped being a tension.
- **A superseded node drops out of the queues.** `/frontier`, `GET /tasks/ready` and `/decisions/at-risk` exclude nodes that a `supersedes` edge points at (nobody should be handed a fact whose story ended). Pass `includeSuperseded: true` (`?includeSuperseded=1` on `/ready`) to see them anyway. Two things it deliberately does NOT do: a superseded **prerequisite still blocks** its dependents (rewire the `required for` edge onto the successor if you mean to unblock — nothing auto-flips status), and a superseded ground makes its decision MORE at risk, surfacing as the `supersededGround` reason.
- **A SUPERSESSION IS A SEED, NEVER A WALL (E18.3).** It drops the node out of the re-check *queues* — but `POST /doubt` walks straight THROUGH it to everything that rests on it, and those dependents are the most urgent thing in the graph. *A supersession ends the fact's story. It does not end the story of everything that was built on it.* The superseded node appears inside its dependents' cause chains flagged `from_superseded: true`, so a reader sees "this rests on A, and A has been replaced by B" without A occupying a row in the queue; the trigger names the successor, so the remedy — rewiring onto it — is one deliberate `edge.rewired` away. Nothing auto-flips.
- **Nothing is stored on the node.** There is no `meta.superseded_at` and you must not invent one: "is this superseded?" is derived from the EDGE SET, which is what makes `GET /graph?asOf=…` answer it correctly for any point in time. `GET /api/graphs/:gid/tasks/:id/worldline` returns the fact's generations with their `[valid_from, valid_to)` intervals.


#### The two clocks — `happened_at` and `learned_at` (E18.1)

Every change to a graph is recorded as an append-only EVENT carrying **two** timestamps, and the rest of this section's machinery is built on the distinction. They are not fields on a node; there is one row per recorded change.

| field | means | who sets it |
|---|---|---|
| `happened_at` | when it was true **in the world** | you — a `happened_at` field in the JSON body, or an `X-Happened-At` header on the body-less DELETE routes. **Backdatable.** |
| `learned_at` | when **we were told** | the database, always, at commit. A caller cannot influence it; a direct INSERT with a forged value is overwritten. |

**Backdate freely — that is what `happened_at` is for.** A correction almost always describes a world earlier than the moment you learn of it ("the terms actually changed in March"). Set `happened_at` to March and the log records both March and today, so neither question is lost. When the two differ by more than a second the event is stamped `payload.backdated: true`, so backdating is always visible and never disguisable. That asymmetry is the point: world time is a claim you make, belief time is a fact about the system.

**Reading the past — `GET /api/graphs/:gid/graph` with a time knob.** With no query parameters it is the ordinary snapshot and costs exactly what it always did. Add a knob and the same `{nodes, links}` payload is reconstructed from the log, plus an `as_of` envelope:

```bash
# by belief time (the default): what we knew then
curl "$GT_BASE/api/graphs/$GT_GID/graph?asOf=2026-03-01T00:00:00Z"
curl "$GT_BASE/api/graphs/$GT_GID/graph?asOfSeq=1400"          # pinned to an event; immutable, cacheable

# by world time: how things actually stood then, corrections included
curl "$GT_BASE/api/graphs/$GT_GID/graph?axis=happened&asOf=2026-03-01T00:00:00Z"

# both: what we would have said in June about how March looked
curl "$GT_BASE/api/graphs/$GT_GID/graph?axis=happened&asOf=2026-03-01T00:00:00Z&known=2026-06-01T00:00:00Z"
```

**The two axes are allowed to disagree, and the fold deliberately does not reconcile them.** A correction learned late applies LAST on the belief axis (that is when you found out) and IN PLACE on the world axis (that is when it was true). If they disagree, that IS the signal — do not average it away or pick one silently. `axis=happened` requires `asOf`; a seq is a belief-time handle.

The envelope reports its own limits and you should read them before quoting a reconstruction: `truncated` marks an `asOf` before this graph's log begins (you get the starting state, not a 404), `pre_history_approximation` marks a graph with no recorded starting point at all, and `anomalies` lists events the requested ordering could not place cleanly. `history_starts_at` is the left edge.

**`GET /api/graphs/:gid/events?since=<seq>`** is the raw feed — `{events, head_seq, next_since, truncated}`, oldest first, filterable by `kind`/`subject_kind`/`subject_id`. Poll it with the previous `next_since`; `seq` is gapless and commit-ordered, so a poller can never skip. Opened with no query the same path is the live SSE stream instead.

**`verified_at` and `decided_at` still exist on nodes** and still mean what they did. They are now caches of the latest event of their kind, which is why nothing that read them had to change.

#### The doubt front — `POST /api/graphs/:gid/doubt` (E18.3)

The TRANSITIVE version of `/decisions/at-risk`: what rests, at any distance, on something a weakening EVENT has since undermined and that nobody has re-checked since. `/decisions/at-risk` is unchanged and still answers the one-hop question; `scope: 'decisions'` here is its strict transitive superset, so migrating is a URL change.

- **The three seeds** are exactly what `weakening()` returns: a `claim.refuted`, a `node.superseded`, and a confidence DROP (a rise seeds nothing). `contradicts` is deliberately not a channel — it is symmetric, and propagating along it would make two mutually-contradicting claims seed each other forever.
- **Doubt flows forward along `required for` and `supports` only**, multiplying a weight per hop. `required for` defaults to **1** (hard: a dependent cannot be more believed than its prerequisite); `supports` to **0.6** (attenuated: evidence weakens, it does not refute). **Nothing is hardcoded in the walk.** Three sources, most specific first: per-edge `meta.propagation`, per-request `weights: {...}`, then the one exported `DEFAULT_PROPAGATION_WEIGHTS` in `src/doubt.js` — echoed in `params.weights` on every response. **Every weight must be in (0, 1] or the route 400s**, and that is not tidiness: it is why the walk terminates on a cyclic `supports` graph instead of depending on `maxDepth`.
- **`meta.propagation` is NOT `meta.curve.weight`.** `curve.weight` is the bezier control-point position along the edge (0.10–0.90, a rendering parameter). `propagation` is doubt attenuation, (0, 1]. They sit one key apart and mean nothing alike.
- **The gate is BELIEF time (`learned_at` ordering), not world time**, and the reason is that backdated weakenings are the NORMAL case: a correction always describes a world earlier than the moment we learn of it. A claim verified in June, weakened by a correction describing March that we learn of today, **surfaces** — the June check did not know about March. `axis: 'happened'` asks the other question and is opt-in; when they disagree, `verified_after_in_world: true` reports it and never suppresses.
- **The anchor is the POSITIVE half only** — `claim.verified` and `decision.made`. A `claim.refuted` is not a reassurance, and if it counted as one a refuted node would silence itself off the front it just triggered. Nodes whose verification predates the log anchor at `seq 0` with `anchor.source: 'scalar'`, which is honest rather than a shortcut: we do not know when we LEARNED a pre-log check.
- Read-only, four SELECTs, no transaction: `done` decisions surface and stay `done`. Re-verifying is what takes something off the front, and it is a deliberate act with its own event.

#### "What changed since I last looked" — `GET|PUT /api/graphs/:gid/changes` (E18.3)

`GET /changes` is the personal wrapper over `GET /events?since=`. First visit reports `unseen: 0` (`source: 'head'`) rather than replaying the whole history — `?since=0` is the explicit way to ask for everything. It also returns `doubt_triggers` for the same window, so "what changed" and "what that broke" are one answer.

**Reading never moves the cursor.** `PUT /changes/seen {seq}` does, under `GREATEST`, so two tabs can only move it forward and a retry is idempotent. Marking the FEED read does **not** resolve DOUBT, and re-verifying does not mark the feed read — they are two different cursors and the UI copy has to say so.

#### Decision branch points and the retrace view (E18.5)

Record the options a decision weighed, keep the ones it rejected, and later set the decision against what has happened since.

**Tagging options.** A decision's options are ordinary `related to` edges from the decision to each option node, carrying `meta.branch.role` of `chosen` or `alternative`. That is the whole vocabulary — no new node type, no copies of the graph.

```bash
curl -sS -X POST "$GT_BASE/api/graphs/$GT_GID/edges" "${WRITE_HEADERS[@]}" \
  -d '{"source_id": 42, "target_id": 57, "purpose": "related to", "meta": {"branch": {"role": "chosen"}}}'
```

**Rejected options stay in the graph and go DORMANT.** Their downstream work is kept but hidden from `/tasks/ready`, so it is not offered as something to do. Dormancy is DERIVED, never stored: it means "in an un-chosen option's closure, in no chosen option's closure, under a currently-committed decision". Shared requirements fan INTO the options, so they appear in no option's closure and stay live automatically. Reopen the decision and the dormant work comes straight back. Pass `?includeDormant=1` to `/ready` to see it anyway.

**`GET /api/graphs/:gid/decisions/:id/branches`** returns the options with their branches, the dormant set, and the CONTINGENCY closure — everything that rests on the decision, i.e. what is in play if you change your mind — each item with the chain of reasoning that reaches it.

**`POST /api/graphs/:gid/decisions/:id/confrontation`** is the retrace. It reconstructs the graph as it stood when the decision was committed (anchored on the SEQ of the commitment event, not the backdatable `decided_at` scalar), sets the grounds that were on record then against what the log has recorded since, and points at any re-runnable benchmark without running it.

**What it refuses to do, and you must not paper over it.** It does not imagine how the road not taken would have gone. An option nobody worked on returns `empty: true` with a reason, never a plausible story. Every response carries a machine-readable `limits` block — `counterfactual: false`, `benchmark_run: false`, `verdict: false`, `silence_is_not_vindication: true` — and a `context_complete` flag that goes false when it cannot locate the commitment. **A ground with no outcomes means nobody checked, NOT that the decision was vindicated**; when a cap stopped the search the response says so in `truncation` rather than letting the silence read as a clean bill of health. Quote the limits when you report a retrace to a human.

#### Excision — removing bytes from the log (E18.6)

**You do not call this.** `POST /api/graphs/:gid/tasks/:id/excise` refuses `X-Writer-Type: agent` and is owner-only. It exists for the human who owns the graph; it is documented here so you can explain it correctly and never confuse it with deletion.

- **Deletion keeps the bytes.** `DELETE /tasks/:id` records `node.removed` with the node's full pre-image, and the log is append-only — `?asOf=` reconstructs a deleted node exactly. That is the product, not a leak.
- **Excision removes them, and only an owner can.** Body `{reason}`, required. In one transaction it appends a `node.excised` event and blanks every earlier event of that node to a marker: the payload minus `after`/`before`/`changes`/`reason`/`intent`, plus `excised: true` and `excised_by_seq`. Seq, kind, both clocks, actor, `cause_id`, `kinds` and `version` all survive — history keeps its SHAPE. The database admits exactly that marker and raises `0A000` on anything else, from any code path.
- **What a reader sees.** For the seqs whose bytes are gone, `GET /graph?asOf…` shows the node as `{title: "[excised]", excised: true}`. If the node still exists, the record carries its current meta and `content_sha` (never a body), so HEAD still equals the live row. Worldline, changes and the retrace view tolerate the marker; a retrace whose rationale was excised reports `reason: "content_excised"` and no digest.
- **Not for corrections.** A wrong claim is superseded (E18.4) — that keeps the record of having been wrong. Excision is for what must not exist: a pasted credential, a person's data, a defamatory line. When the node still exists, the owner must clean the live node FIRST, because the record re-declares the present, and the record's envelope (seq, actor, clocks, counts) is permanent — only a later excision can blank its `after` and `reason`.
- **What it reaches, and what it does not.** Event payloads, the genesis snapshot's entry for the node, the periodic snapshots (dropped; they rebuild from the marked log) and the derived caches. `task_chunks` holds only live content and cascades on delete. It does NOT rewrite generated report bodies — regenerate them.


- Set `purpose` on every edge write (`POST /edges`, `/edges/bulk`, `/batch`, `PATCH /edges/:id`) — it's the only edge *relationship* field you send (the server also accepts `meta` for edge `color`/`curve`). The server stores the derived `type` and emits BOTH on reads, so the canvas and every dependency query are unchanged. A legacy `type` is no longer accepted as input. `POST /edges`, `/edges/bulk`, and `/batch` reject a write with no `purpose`; `PATCH /edges/:id` treats an omitted `purpose` as "keep the existing relationship".
- ONLY `required for` is cycle-checked and traversed by §5's status queries. `supports`/`contradicts` are directed SIGNED relations read by the inconsistency scan; `related to` is undirected association; `supersedes` is a directed succession relation read by the worldline route and the three queues — deliberately NOT cycle-checked, because a revert (B supersedes A, then later A' supersedes B) is legitimate history. Use `supports`/`contradicts` for genuine evidence relations (a `reference` --supports--> a claim; a finding --contradicts--> another); reserve `required for` for real prerequisites.

### Node reserved fields (frontmatter `meta`)

All optional, validated only WHEN PRESENT — no migration (they live in `meta`):

| field | type | meaning |
|---|---|---|
| `type` | open string (≤40) | node kind. Absent = a work/knowledge node. Two server-recognized values: `reference` (an external citation/source) and `decision` (a committed choice — see [Decision records](#decision-records-e17)). |
| `significance` | number 0.0–1.0 (one-decimal convention) | how much this node matters. UNIVERSAL (plans + research). |
| `confidence` | number 0.0–1.0 (one-decimal) | how sure we are (a finding) / source reliability (a `reference`). Research-tier. |
| `verified_at` | ISO-8601 datetime | when the claim was last DELIBERATELY re-checked AND HELD. Distinct from the automatic `updated_at`. Research-tier. **E18.2: this is now a CACHE of the latest held check — the event log is the record.** It stays the authoritative ANCHOR (how long since the claim was last confirmed); the log supplies the WINDOW (how long that confirmation is good for). |
| `refuted_at` | ISO-8601 datetime | **E18.2** — when a deliberate re-check FAILED. Set by `POST /tasks/:id/verify {outcome:"failed"}`, which also CLEARS `verified_at`, so a refuted claim goes straight back to the top of `/frontier`. Mirrors `decided_at`/`decision.reopened`: setting it emits `claim.refuted`, clearing it does not. |
| `decay` | boolean | **E18.2** — per-node opt-OUT from verification decay. Absent (the normal case) means the node's verification goes stale with time. `decay: false` pins retrievability at 1 and removes it from `/frontier`'s stale term — the way a fixed MEASUREMENT (an extracted constant, a quoted spec value, a definition, a contract clause) says it does not rot. It can still surface as low-confidence. |
| `decided_at` | ISO-8601 datetime | when the human COMMITTED a `type: decision` node. `/decisions/at-risk` compares each ground's `updated_at` against it (pivot detection); absent → the decision's `created_at` is the baseline. |

`significance`, `confidence`, `verified_at`, `refuted_at`, `decay`, `decided_at` survive a body-rewriting agent PATCH that omits them (merge-protected like `x`/`y`); send an explicit `null` to clear one (e.g. a re-verify run resetting a stale `verified_at`). `type` is NOT merge-protected — an omitting rewrite drops it, so always re-state `type` (e.g. `type: reference`, `type: decision`) when you rewrite a node's content.

### Role predicates (derived, never stored)
- **claim** = `confidence` set AND `type` ≠ `reference` — a node that ASSERTS something, with a sureness.
- **open question** = `status: todo` AND no `confidence` — an unanswered question.
- **reference** = `type: reference` — an external source.
- **decision** = `type: decision` — a committed choice; its staleness is computed from its grounds by `/decisions/at-risk`, never self-reported.

### Conventions (HARD — keep the vocabulary consistent or read-time filtering rots)
- **Never put `confidence` on an open question.** The moment a node has confidence it READS as an assertion; an open question with confidence is a category error. To remove a `confidence` value set by mistake you must send `confidence: null` — omitting it preserves the old value (merge protection), so the node stays hidden from `/ready`. Same for clearing a stale `verified_at`.
- **A finding is born at `review` (or `done`), never `todo`.** `todo` means "open question, not yet answered" — that's what `/ready` hands back as work to do. The instant you record a finding (you set `confidence`), give it a real status: `review` for a first-pass claim awaiting human confirmation, `done` only on explicit human say-so; a `type: reference` source lands at `review` like every other agent write — `done` stays the human's call. Leaving a confidence-bearing node at `todo` is the same category error as the bullet above — and `/ready` filters such nodes out, so a finding stuck at `todo` silently goes missing from BOTH the work queue and the answered-knowledge view.
- **`verified_at` = a deliberate re-check, not any edit.** A typo fix bumps `updated_at` automatically — it must NOT touch `verified_at`. Set `verified_at` only when you actually re-confirmed the claim against sources.
- **`confidence` and `verified_at` are research-tier — for findings/claims and `reference` sources ONLY.** Don't put them on plan / coding / decision / task nodes: a design preference or task estimate is not a research sureness, and a node with `confidence` reads as a *claim* (it'll surface in research queries). For how much a task/decision matters use `significance` (the one reserved field that's universal and belongs on a plain task); put trade-offs and option preferences in the body or model them as `contradicts`/`supports` between option nodes. A provisional *decision* does NOT get `confidence` as a workaround — it gets `type: decision` + `decided_at` + typed edges from its grounds, and `/decisions/at-risk` computes its staleness (see [Decision records](#decision-records-e17)).
- **Findings get NO `type`.** A finding/claim is identified by its `confidence` + `status`, **not** a type label — leave `type` ABSENT on findings. `type` is reserved for a genuine node KIND a reader acts on — `reference` (a source) or `decision` (a committed choice). Do NOT invent per-finding category/topic types (`commercialization`, `finding/market`, `timeline`, …): that proliferating, per-session vocabulary IS the cross-session encoding drift the reserved fields exist to kill (two sessions invent two schemes and filtering breaks). Categorize a finding by its searchable body + `significance`, never a `type` vocabulary. Use `type: reference` (one word, server-recognized) for sources — not "source", not a topic.
- **Findings are SEPARATE nodes**, never prose embedded in a question's body — so each finding carries its own `confidence`/`verified_at` and retrieval/filtering is per-finding and token-efficient.
- **Completeness of retrieval FIRST, scrutinize confidence LATER.** Build the full picture, then filter by confidence at READ time — don't drop low-confidence nodes while building.
- **Filters choose what to SHOW / SEED, never what to TRAVERSE.** Read-time filters (see [Read-side queries](#read-side-queries-e15-filters-frontier-inconsistency)) apply at the output; on `/context` a low-confidence node bridging two matching nodes is KEPT and marked `bridge:true` so connectivity stays honest.

### Decision records (E17)

Knowledge bases change, projects pivot, new tech ships — every committed decision is provisional, and the graph must notice MECHANICALLY when a decision's grounds shift, not via prose vows ("done must never suppress this") buried in node bodies that only help an agent who happens to read them. When the human commits a choice (a stack, an architecture, a vendor, a strategy):

- **The decision is a node**: `type: decision`, `decided_at: <when the human committed>`, `significance` for how much rides on it. Status reflects the work ("decide X" starts as an open question at `todo`; committed → `done` on human say-so, like any node). NO `confidence`/`verified_at` — a decision's staleness is computed from its grounds, never self-reported.
- **The body records what a future reader needs**: the chosen option, the alternatives considered *as node references* (so "why not X?" has an answer years later), the rationale, and any explicit revisit-if conditions.
- **Grounds are TYPED EDGES, not prose refs.** Every finding/requirement the decision rests on gets `supports` (or `required for`) → the decision. Writing "see node 3954" in the body wires NOTHING — `/frontier` importance and `/decisions/at-risk` both read edges, so a prose-only cluster is invisible to the exact machinery meant to guard it (this is an observed failure: a carefully-built decision cluster wired only with `related to` scored importance 0 and could never surface).
- **Dependents are gated**: work that builds on the decision gets decision `required for` → task. This is what makes the decision (and via inheritance its grounds) load-bearing to `/frontier`, and what makes `/blockers` honest about what a reopened decision blocks.
- **Reopening never rewrites history.** If the verdict flips, move the decision's `status` back (done → todo/in_progress) and APPEND the new context — the original rationale and alternatives stay in the body. The rewrite that erases why you decided is the memory-loss this machinery exists to prevent.
- **When you weaken a claim, check what rests on it.** Any time you drop a node's `confidence`, add a `contradicts` edge, or supersede a finding (E18.4: a real `supersedes` edge, successor → superseded, not a note in the title), traverse its outgoing `supports`/`required for` edges; if a `type: decision` node is among the dependents, SURFACE that to the human ("this weakens the ground under decision N") — never silently reopen or re-decide.
Items 1 & 2 are MANDATORY write-gates; item 3 is a deliberately softer ask-don't-act gate (surface, then stop) — don't conflate them.
1. **(mandatory) Stop at `review`, never set `done`** (§3) — `done` is the human's call.
2. **(mandatory) Run the inconsistency scan when you finish a body of graph work** — and per-task only when that task added or changed a `supports`/`contradicts` edge: `POST /inconsistencies`; if it returns tensions, SURFACE them (name the loop / its nodes) for the human and NEVER auto-resolve (don't delete or flip a `contradicts` edge). On a graph with no signed (`supports`/`contradicts`) edges the scan is always empty, so it's a no-op you can skip. Framing: like git merge conflicts — the tool surfaces the conflict; the analyst resolves it.
3. **(ask, don't act) If a report already EXISTS, ask after a body of work — never regenerate automatically.** At the same "finished a body of work" boundary as item 2 (NOT per-write), run the cheap body-less probe `GET /api/graphs/$GT_GID/report/meta`. If it returns `exists && stale` (the report's `generated_at` predates the graph's `updated_at`), surface ONE line — "the report is stale as of `<generated_at>` vs the graph's `<updated_at>`; want me to regenerate it?" — then STOP and wait for a yes. If `exists` is false (no report yet), do nothing. Optional magnitude threshold: only ask after ≥K nodes changed or a transition to `done`. Regenerating a report is always an explicit, human-approved action.
   **Clearing staleness on regenerate:** by default the PUT PRESERVES `generated_at` on update — a plain re-write (typo fix, narration scrub, metadata patch) is deliberately NOT a regeneration and must not reset the staleness clock ("a re-write is NOT a regeneration", pinned in `tests/report-baseline-integrity.test.js`). When the user says yes and you regenerate the report from the current graph, send **`regenerated: true`** in the PUT body — that resets `generated_at` to now, so the freshly regenerated report reads as current and the stale banner clears. Omit the flag (or send `false`) for a correction you don't want to reset the clock. (The flag's only effect is advancing the report's own `generated_at`; the graph's baseline — `graphs.updated_at`/`version` — is never touched by any report write.)

**Ship-fully / save-project interplay.** A report is Multitap DB state, not a repo file — it's never git-added, committed, or built — so report generation lives OUTSIDE `wafer-save-project` and must never auto-run inside it. "Ship fully" auto-ships CODE; it does NOT auto-generate or auto-update a report. The ask-to-update prompt above is the report-shaped counterweight to "ship fully", exactly as "never set `done`" is the review-shaped counterweight. The test-gated-done convention (mark `done` when tests pass) applies to BUILD/CODE work only and never licenses auto-generating or updating a report — a report always waits for an explicit yes.

## 2. Build the graph

**Materialize what you already know up front.** The graph is the artifact the user reviews — they want to see structure on the canvas, not get nodes one at a time. For plan-shaped graphs, lay down the **entire DAG** before starting the first task. For research / mapping / freeform graphs, lay down the **starting nodes and connections you already know about**, then grow the graph as you learn.

**One node = one user-meaningful concept or unit of work.** Don't create a node per file edit, per git commit, or per sentence of notes. Granularity should match what a human would read in a status update or scan as a single concept.

**No meta/navigation nodes — orientation is computed, not written.** Never create "RESUME HERE", "⭐ START HERE", "current status", table-of-contents, or session-handoff nodes. The graph already answers "where do I pick up?" with queries that are correct by construction and can't go stale: `/tasks/ready` (workable now), `/blockers` (why something isn't), `/frontier` (established knowledge to re-check). A hand-written status node is a parallel narrative that drifts from live state — the exact failure the sync HARD RULE exists to prevent — and if it sits at `todo` it pollutes the very `/ready` queue it tries to replace. Cold-start context (the "why", decisions, gotchas) belongs in the bodies of the real nodes it concerns; a human-readable whole-graph snapshot is the **report** (§8 — explicit ask only), never a node. This is an observed cross-session failure mode: agents inherit a RESUME node from a previous session and keep feeding it. Don't — if you find one, treat the live graph as truth, and offer the user to fold anything not already in real nodes into them and delete it.

For each node, write a real markdown body — title alone is never enough. The body is what the human sees when reviewing or exploring. See section 3 for what to put in the body at each status.

The example below is plan-shaped (`required for` edges for ordering). For a research / mapping shape, swap `"purpose":"required for"` for `"purpose":"related to"` (or `supports`/`contradicts` for evidence relations) and use whichever frontmatter status fits the depth ladder (e.g. `todo` = unexplored, `review` = drafted). The bulk-edge mechanics are identical regardless of shape. (See [The universal schema (E15)](#the-universal-schema-e15) for the full `purpose` vocabulary.)

**YAML caution:** quote any frontmatter title that contains a colon (`title: "Signal: ARR up"`) — an unquoted colon makes the frontmatter fail to parse and the POST 400s.

```bash
# Tasks. Body content tells the user what you intend to do, in plain markdown.
T1=$(curl -sS -X POST "$GT_BASE/api/graphs/$GT_GID/tasks" \
  "${WRITE_HEADERS[@]}" \
  -d '{"content":"---\ntitle: Audit current session-token usage\nstatus: todo\n---\n## Approach\nGrep src/auth/** for token reads. List call sites that need to switch to cookie-based reads.\n"}' \
  | jq -r .id)
T2=$(curl -sS -X POST "$GT_BASE/api/graphs/$GT_GID/tasks" \
  "${WRITE_HEADERS[@]}" \
  -d '{"content":"---\ntitle: Implement cookie-based session\nstatus: todo\n---\n## Approach\nWrap the existing session middleware so reads come from `Set-Cookie` (httpOnly + secure) instead of the auth header.\n"}' \
  | jq -r .id)
T3=$(curl -sS -X POST "$GT_BASE/api/graphs/$GT_GID/tasks" \
  "${WRITE_HEADERS[@]}" \
  -d '{"content":"---\ntitle: Update auth tests\nstatus: todo\n---\n## Approach\nSwitch test fixtures from header-based to cookie-jar style. Update assertions for Set-Cookie response headers.\n"}' \
  | jq -r .id)

# Bulk dependencies — transactional, all-or-nothing. `purpose: required for`
# derives the cycle-checked `dependency` type.
curl -sS -X POST "$GT_BASE/api/graphs/$GT_GID/edges/bulk" \
  "${WRITE_HEADERS[@]}" \
  -d "{\"edges\":[
    {\"source_id\":$T1,\"target_id\":$T2,\"purpose\":\"required for\"},
    {\"source_id\":$T2,\"target_id\":$T3,\"purpose\":\"required for\"}
  ]}"
```

`POST /edges/bulk` semantics: validates every edge, opens a transaction, inserts them all, then runs cycle detection across the resulting graph. **Any failure rolls everything back** and returns `400`/`409` with `{ error, failedAt: <index> }`. Fix the offending edge and retry the whole batch — never assume partial application.

### Write-side structure — author a graph that stays navigable

§6 below is the READ side (how to pull context out of a graph). These four rules are the WRITE side — how to author nodes and edges so the graph is a faithful, navigable map. They matter because **write-time structure determines read quality**: the connections you author are exactly what lets a reader (or the retriever's traversal) reach a related node two hops away. A/B-validated on fresh build agents — each rule helped or was neutral, none regressed, and together they lifted blind multi-hop answer quality and cut "I can't answer from this" responses ~5× while keeping the graph *leaner*, not denser.

1. **Author the connective tissue.** When two parts of the graph relate only *through* an intermediate concept, create that intermediate as its own **bridge node** and wire the cross-cluster `related` edges to it — rather than leaving the two ends unconnected, or faking a direct A–B edge. Bridge nodes carry the multi-hop payload: B is reached from A by stepping through the bridge. When you add or revise a node, ask *"what does this connect to that isn't already linked — and is there a missing middle concept between them?"* and model the real intermediate. A graph that only links the obvious near-neighbors loses exactly the cross-region connections that make it worth more than a flat list.

2. **Name a node's neighbors in its body.** In a node's markdown body, name the neighboring concepts it connects to — the entities/topics on the other end of its `related` edges. This is truthful (a faithful description of a concept mentions what it relates to) *and* it lifts retrieval: those neighbor names are what hybrid search matches to surface this node as a *seed*, from which traversal reaches the rest of the neighborhood. A node whose body never mentions its neighbors is an island to the retriever even when the edges exist.

3. **A `related` edge is a genuine semantic link.** It should encode a real, specific relationship — not a loose "these are both about the same broad topic" vibe. The edge's value is its *selectivity*: it tells the reader (and the traversal) that *these two nodes specifically* inform each other. Before adding one, be able to state the relationship in a few words ("X supplies Y", "X competes with Y", "X bridges Y and Z"). If you can't name it, it's probably noise — leave it out. A graph where everything relates to everything carries no information, and traversal from any seed drags in half the graph.

4. **Optimize for TRUTH, not the retriever (anti-hairball).** A faithful graph — real concepts, real intermediates, real relationships — is *already* the retrieval-optimal one, because retrieval rides on genuine structure. So do **not** add edges "to help search": a phantom edge that doesn't reflect a real relationship corrupts both the artifact and retrieval precision (an over-connected hairball has high coverage but near-zero precision — every pack drags in half the graph and the reader drowns). Connectivity is a *consequence* of modeling the domain honestly, never a target to maximize. Rules 1–2 are about modeling real structure faithfully — they are not licence to over-connect.

5. **A program of work is its prerequisite chain — never an umbrella node.** For a multi-phase body of work (what a tracker would call an epic), wire the REAL prerequisites among its steps, plus the one handoff edge where the program's last step feeds the next program. That is the whole structure. Do **not** create a container/umbrella node with membership edges to its children, and do not invent a node `type` for it (`type` has exactly two server-recognized values, `reference` and `decision`). Grouping is DERIVED — `POST /structure` (§ below) returns the independent bodies of work as connected components of the `required for` subgraph, so a membership edge would restate what the chain already proves, which rules 3–4 forbid. A prefix in the title (`E18.1`, `E18.2`, …) is a human LABEL for reading the canvas; it is convenient and additive, but it is never the mechanism, and no query reads it.

   Measured basis: on a 124-node plan graph, sibling steps carried 118 intra-program `required for` edges against 7 cross-program ones, and plain components recovered most programs exactly — while the umbrella nodes that did exist linked only 6–16% of their own children, because rules 3–4 correctly told agents not to write those edges. The container node was filling a gap that the chain already covered. If a node genuinely holds a program's design rationale, keep it as a document node with real content and let it sit in the chain — just don't wire membership to it.

## 3. Status discipline and node body content

Status enum: `todo` → `in_progress` → `review` → `done`. Each transition should bring **new body content** that justifies the status. Don't bump status without updating the body — the body is the artifact, regardless of graph shape.

The body content should always justify the current status. What "justify" means depends on what the node represents:

| Status | Who sets it | Body content (any graph shape) |
|---|---|---|
| `todo` | You (during graph creation) | The starting frame. Execution nodes: the approach, what needs to be done, known constraints. Research / mapping nodes: the question or claim, what we want to know, what's open. |
| `in_progress` | You (when you actually start) | Running notes: what you're investigating, what you've ruled out, files / sources you're touching. Update as you go. |
| `review` | You (when you think it's done) | Self-contained synthesis ready for the human. Execution nodes: what you did, files changed, how to verify. Research / mapping nodes: the synthesized finding with sources and reasoning. **This is what the human reads to confirm.** |
| `done` | **Only the human** | Their confirmation that they accept the node. **Never write this yourself unless the user explicitly asks you to** ("mark X as done", "finish X off"). That permission applies to *that node only* — don't infer permission for siblings, parents, or the rest of the graph. |

A **report** is the whole-graph analogue of a node's `review` body — that same review-tier synthesis for the ENTIRE graph, long-form markdown a human reads instead of clicking every node. It's a separate artifact (the report API — see the API reference) — **never** a graph node — so it inherits the same `review`/`done` discipline: you draft it, the human owns whether it's canonical, and you never produce or overwrite one on your own initiative (§8).

**Read before you write, and send OCC fields.** Always GET the task right before you PATCH it AND include `base_version` + `base_content` in the PATCH body. Without those, the server falls back to "blind replace" and your write silently overwrites any UI-managed frontmatter keys (positions `x`/`y`, `color`, `background-image`) that exist on the row but aren't in your new content. With OCC fields the server runs a three-way merge that preserves the fixed list of protected keys you didn't touch. **The merge only protects that fixed key list, though — `title`/`status`/`body` are writer-wins.** Because the OCC dance sends the content you just fetched as `base_content`, base == current, so the merge can't detect a concurrent human edit to those fields: whatever you PATCH overwrites them. So GET first, READ the returned title/body/status, fold any human changes into your new content, and only then PATCH — never rewrite from memory.

**Keep related task bodies in sync.** When work on one task surfaces information that affects another (e.g., you find that the schema migration also needs a new index, which is a different task), update *that* task's body to reflect the new finding. The graph is a living context document, not a one-shot plan. Each task body should be accurate to the current state of the work.

**Hard rule: before transitioning any task to `in_progress`, check its blockers.**

```bash
# On failure the response is {"error":...}, not an array — a bare `jq length`
# would return 1 and silently mask it, so type-check before trusting the count.
BLOCKERS=$(curl -sS "$GT_BASE/api/graphs/$GT_GID/tasks/$TID/blockers" "${READ_HEADERS[@]}" \
  | jq 'if type=="array" then length else "AUTH_ERROR" end')
```

If `BLOCKERS` isn't a number, the read itself failed (usually auth) — stop and ask; don't treat it as a blocker count. If `BLOCKERS > 0`, **do not start the task.** Pause and tell the user the task is blocked by [list with statuses], and ask whether to proceed anyway. `review` counts as blocking too — even though the agent finished its part, the human hasn't confirmed, so downstream work isn't safe to begin.

Only proceed if (a) blockers is zero, or (b) the user explicitly OKs starting while blocked. Don't rely on what you remember from when you first laid out the graph — the user may have deleted, retitled, or rearranged tasks since.

For readiness queries (section 5), `review` and `in_progress` count as not-yet-done — downstream tasks won't be classified as ready until every prerequisite is `done`.

PATCH replaces the entire `content` blob (frontmatter + body). The OCC pattern below is the **only safe way to update a task**: GET first, capture `version` + `content`, then PATCH with those as `base_version` + `base_content`. The server's three-way merge then preserves any UI-managed keys (`x`/`y` positions, `color`, `background-image`) that aren't in your new content — but it does NOT shield `title`/`status`/`body`, so base your new content on what you just GET-ed, not on memory.

**Required: announce your focus.** Before you start touching a task — and every time you switch which task you're working on — POST to `/api/graphs/:gid/selection` with `cursor_anchor` + `editing` set to that task. This is what tells humans watching the canvas which node you're on; without it, your edits show up as flickers on the canvas with no source attribution and no colored outline. The server keeps one selection per writer (so a new POST replaces the previous), and your Stop hook DELETEs presence at end of turn which cascades to clearing the selection. The helpers below combine selection-announce with `patch_task` so you can't accidentally forget.

```bash
announce_focus() {
  # Tell viewers "I'm working on this task right now". Replaces any previous
  # selection from this agent (one selection per writer_id on the server).
  local TID="$1"
  local ANCHOR
  ANCHOR=$(jq -nc --argjson id "$TID" '{kind: "node", id: $id}')
  curl -sS -X POST "$GT_BASE/api/graphs/$GT_GID/selection" \
    "${WRITE_HEADERS[@]}" \
    -d "{\"node_ids\":[$TID],\"edge_ids\":[],\"editing\":$ANCHOR,\"cursor_anchor\":$ANCHOR}" \
    >/dev/null
}

announce_focus_edge() {
  # Same as announce_focus but for an edge. Use before any edge PATCH so
  # the viewer can see which edge you're about to touch — they may want
  # to intercept ("wait, don't change THAT one") before you commit.
  local EID="$1"
  local ANCHOR
  ANCHOR=$(jq -nc --argjson id "$EID" '{kind: "edge", id: $id}')
  curl -sS -X POST "$GT_BASE/api/graphs/$GT_GID/selection" \
    "${WRITE_HEADERS[@]}" \
    -d "{\"node_ids\":[],\"edge_ids\":[$EID],\"editing\":$ANCHOR,\"cursor_anchor\":$ANCHOR}" \
    >/dev/null
}

clear_focus() {
  # Optional explicit clear when you're done with a task and won't touch
  # another. Usually not needed — Stop hook cleanup handles it at end of turn.
  curl -sS -X DELETE "$GT_BASE/api/graphs/$GT_GID/selection/$AGENT_ID" >/dev/null
}

patch_task() {
  # Usage: patch_task <TID> <new-content>
  # Fetches the current task, then PATCHes with OCC so the server can
  # protect UI-managed frontmatter keys (positions etc.) you didn't touch.
  # ALWAYS call announce_focus first (or use work_on_task which bundles them).
  # IMPORTANT: $NEW_CONTENT must already fold in the human's CURRENT
  # title/body/status. base_content is the row we just fetched, so the merge
  # only shields the fixed protected-key list — title/status/body are
  # writer-wins, and a blind rewrite WILL clobber a concurrent human edit. Read
  # CUR_JSON (below) before composing $NEW_CONTENT; don't rewrite from memory.
  local TID="$1"
  local NEW_CONTENT="$2"
  local CUR_JSON
  CUR_JSON=$(curl -sS "$GT_BASE/api/graphs/$GT_GID/tasks/$TID" "${READ_HEADERS[@]}")
  local CUR_VERSION
  CUR_VERSION=$(echo "$CUR_JSON" | jq -r .version)
  local CUR_CONTENT
  CUR_CONTENT=$(echo "$CUR_JSON" | jq -r .content)
  local RESP
  RESP=$(curl -sS -X PATCH "$GT_BASE/api/graphs/$GT_GID/tasks/$TID" \
    "${WRITE_HEADERS[@]}" \
    -d "$(jq -nc \
      --arg c "$NEW_CONTENT" \
      --argjson v "$CUR_VERSION" \
      --arg b "$CUR_CONTENT" \
      '{content: $c, base_version: $v, base_content: $b}')")
  # Confirm the write landed: the response must be the updated row, not an
  # error. On failure follow §7 — re-fetch on 410/404, retry once on 409 with
  # the body's `current` row as the new base, fix-and-retry on 400.
  if echo "$RESP" | jq -e '.error' >/dev/null 2>&1; then
    echo "patch_task: write FAILED for $TID — $(echo "$RESP" | jq -r '.error')" >&2
    return 1
  fi
  echo "$RESP"
}

work_on_task() {
  # Preferred wrapper: announces focus, then PATCHes. Use this for every
  # task edit so the canvas viewers always see who's on what.
  announce_focus "$1"
  patch_task "$1" "$2"
}

# Moving from todo → in_progress with running notes
work_on_task "$T1" "$(cat <<'EOF'
---
title: Audit current session-token usage
status: in_progress
---
## Approach
Grep src/auth/** for token reads.

## Findings so far
- 4 call sites in src/auth/middleware.js read req.headers.authorization
- 2 call sites in src/api/* call those middleware functions directly
EOF
)"

# Moving to review with a self-contained summary
work_on_task "$T1" "$(cat <<'EOF'
---
title: Audit current session-token usage
status: review
---
## Findings
6 call sites total — 4 in src/auth/middleware.js, 2 in src/api/users.js and src/api/projects.js.

## Suggested next step
Replace the middleware-internal reads with a cookie-aware helper, then keep the api/* call sites unchanged (they go through the middleware anyway).

## Verify
Run `rg -n "req.headers.authorization" src/` — should return zero results after T2 lands.
EOF
)"
```

Notice the PATCH body has no `x`/`y`, `color`, or `background-image` keys, but the user's drag positions, color tweaks, and chosen node image will survive. The server's mergeFields treats those keys as **protected from agent removal** — when the writer is an agent and the new content omits one of them, the merge preserves the current value rather than reading the omission as "remove this key". Task protections: `x`, `y`, `color`, `background-image`, plus the E15 research fields `significance`, `confidence`, `verified_at` (see 'Node reserved fields' above). Edge protections: `meta.color`, `meta.curve`.

This protection only covers that fixed list. Custom frontmatter keys you drop from a rewritten content blob are still treated as removals — if you want them to survive across PATCHes, include them yourself (read existing frontmatter from `base_content`, splice in your changes, send the merged blob).

**Escape hatch.** If you legitimately want to clear a protected key (e.g. user asks you to reset a node's position), send the key with an explicit `null` value. `null` is defined, so the protection short-circuit doesn't fire and the clear lands.

**Without OCC fields, the PATCH falls back to blind replace** and you'll silently wipe any UI keys the human is managing. Always send `base_version` + `base_content`.

**After everything is in `review`, stop.** Summarize in chat what you submitted and let the user review on the canvas. Don't poll the graph waiting for the human to mark things `done` — they'll use the UI. Your job ends at `review`.

## 4. Update edge purpose or endpoints

Change an edge's `purpose` (e.g. `related to` → `supports`, or into/out of `required for`), or repoint it to a different source/target. The server re-derives `type` from the new `purpose`; cycle detection re-runs whenever the result is `required for` (derived `dependency`). See [The universal schema (E15)](#the-universal-schema-e15) for the `purpose` vocabulary.

**Required: announce focus on the edge first** with `announce_focus_edge` (defined in section 3). This is the same "tell viewers what you're about to touch" rule as for tasks — without it, the human can't see which edge you're about to change in time to intercept.

Same OCC rule as tasks (see [§3](#3-status-discipline-and-node-body-content)): GET first, send `base_version` + `base_row` so the server's three-way merge protects UI-managed `meta` keys (`color`, `curve`) the user set on the edge. There is no single-edge GET route — fetch the edge by filtering the edge list (`GET /api/graphs/$GT_GID/edges`), which returns full edge rows (`source_id`, `target_id`, `purpose`, `meta`, `version`) suitable for `base_row`.

```bash
announce_focus_edge "$EID"
CUR=$(curl -sS "$GT_BASE/api/graphs/$GT_GID/edges" "${READ_HEADERS[@]}" | jq --argjson id "$EID" '.[] | select(.id==$id)')
curl -sS -X PATCH "$GT_BASE/api/graphs/$GT_GID/edges/$EID" \
  "${WRITE_HEADERS[@]}" \
  -d "$(jq -nc \
    --argjson v "$(echo "$CUR" | jq .version)" \
    --argjson r "$CUR" \
    '{purpose: "supports", base_version: $v, base_row: $r}')"
```

(Edges use `base_row` instead of `base_content` because they have structured fields, not a content blob.)

## 5. Status-aware traversal (find what to work on next, what's blocking, what gets unblocked)

These queries are most natural on plan-shaped graphs where ordering matters. The **structural** ones (`subtasks`, `ancestors`, `shortest-path`, `leaves`) also work on research / mapping graphs that use `dependency` edges — useful for "what concepts does this finding rest on?" or "what's the chain from entity A to entity B?". The **status-aware** ones (`ready`, `blockers`, `unblocks`) only make sense if the graph has an ordering and a notion of "done." **All of these follow `dependency` edges only — none traverse `related` links.** To navigate a knowledge-base graph wired with `related` edges (search → follow links), see [*Search + traversal: the graph as a knowledge base*](#search--traversal-the-graph-as-a-knowledge-base) in §6.

The server does the recursion — never compute readiness yourself. All three status-aware queries treat `review` and `in_progress` as "not yet done" so a downstream task only becomes ready when every prerequisite is `done`.

```bash
# What can I work on right now? Returns OPEN QUESTIONS — todo tasks with NO
# confidence (per the role predicate) and all recursive prereqs done. A
# confidence-bearing node is a claim/finding, not ready work, so it never
# appears here even if it still sits at todo; re-checking findings is /frontier's
# job. So in a mixed plan+knowledge graph, /ready stays a clean "what to do next".
curl -sS "$GT_BASE/api/graphs/$GT_GID/tasks/ready" "${READ_HEADERS[@]}"

# What's blocking task X from being completable? Returns recursive prereqs not yet done
# (mix of todo, in_progress, review tasks). Use this to triage a stuck goal.
curl -sS "$GT_BASE/api/graphs/$GT_GID/tasks/$T2/blockers" "${READ_HEADERS[@]}"

# If I finish task X, what becomes ready? Returns the direct parent tasks whose
# only remaining non-done prereq is X. Use this to find "critical review" tasks —
# review tasks whose completion would unlock further work.
curl -sS "$GT_BASE/api/graphs/$GT_GID/tasks/$T1/unblocks" "${READ_HEADERS[@]}"
```

`/ready` is also the **resume mechanism**: a fresh session or an agent hand-off orients by running `/ready` + `/blockers` (plus `/frontier` for stale knowledge and `/decisions/at-risk` for committed decisions whose grounds shifted — both are cheap and quiet when healthy) — never by hunting for, or creating, a narrative "RESUME / START HERE" node. See the no-meta-nodes rule in §2.

**Resume also checks the refresh clock.** When you start working a graph, `GET /api/graphs/<gid>/refresh` (404 = no schedule, fine, move on). If `due:true`, tell the user ONCE, plainly — "this graph's <interval_days>-day refresh is overdue (purpose: <purpose>); want me to run it, or dismiss until next cycle?" — then do what they say: run the pass in [Scheduled refresh](#scheduled-refresh--the-standing-loop-that-works-those-queues) and stamp `/complete`, or `POST /refresh/dismiss`. **Never auto-run and never auto-dismiss** — the refresh spends real effort and the dismissal spends real staleness; both are the user's to choose. Don't re-ask in the same session after they've answered.

### Claiming work when agents run in parallel (claim/lease)

When more than one agent works the same graph (fanout, a fleet, a teammate's session), `/ready` alone is a race: two agents can pull the same task. **Claim before you start**:

```bash
# Atomically take the task: flips todo → in_progress and records you as the
# holder with a lease (default 30 min, ttl_seconds 60–14400). Requires your
# X-Writer-Id (WRITE_HEADERS carries it). 200 = yours; 409 = someone else
# holds it — the body names the holder and expiry; pull the next /ready task.
curl -sS -X POST "$GT_BASE/api/graphs/$GT_GID/tasks/$T1/claim" "${WRITE_HEADERS[@]}" -d '{}'

# Long task? POST again before the lease runs out — same call renews it.
# If your lease EXPIRES, the task resurfaces in /ready (still in_progress,
# claimed_by set) and anyone may take it over — a crashed agent never wedges
# the queue. Finished? A normal PATCH to review ends the work; the stale lease
# fields are harmless. Abandoning instead? Release it:
curl -sS -X DELETE "$GT_BASE/api/graphs/$GT_GID/tasks/$T1/claim" "${WRITE_HEADERS[@]}"
# → back to todo, claim cleared, /ready re-surfaces it immediately.
```

Claiming is only for genuinely parallel contexts — a solo session editing its own graph can keep flipping status with normal PATCHes as before. Humans override any lease by just editing status (a card dragged back to `todo` is claimable regardless).

**Fleet strategy — don't all grab the first task.** Load-tested 2026-08-08 (scripts/load-test.mjs): with every worker claiming `ready[0]`, doubling a fleet from 8 to 16 agents made the same queue drain SLOWER (409 churn dominates). Pick randomly among the first ~K ready tasks (K ≈ fleet size) instead; a 409 is normal — just try another, never retry the same id in a loop.

For raw structural traversal (no status filtering):

```bash
curl -sS "$GT_BASE/api/graphs/$GT_GID/tasks/leaves" "${READ_HEADERS[@]}"          # DAG roots: no incoming deps
curl -sS "$GT_BASE/api/graphs/$GT_GID/tasks/$T2/subtasks" "${READ_HEADERS[@]}"    # all recursive prerequisites
curl -sS "$GT_BASE/api/graphs/$GT_GID/tasks/$T2/ancestors" "${READ_HEADERS[@]}"   # all recursive dependents
curl -sS "$GT_BASE/api/graphs/$GT_GID/graph/shortest-path?from=$T1&to=$T3" "${READ_HEADERS[@]}"
```

**Pattern: "find the review tasks I should chase down to unstick the critical path"**

```bash
# 1. Get all review tasks
REVIEW_IDS=$(curl -sS "$GT_BASE/api/graphs/$GT_GID/tasks" "${READ_HEADERS[@]}" | jq -r '.[] | select(.meta.status == "review") | .id')
# 2. For each, ask the server what completing it would unblock
for id in $REVIEW_IDS; do
  unblocks=$(curl -sS "$GT_BASE/api/graphs/$GT_GID/tasks/$id/unblocks" "${READ_HEADERS[@]}" | jq 'length')
  if [ "$unblocks" -gt 0 ]; then
    echo "task $id unblocks $unblocks parent(s)"
  fi
done
```

## 6. Search the graph (find / "what does the graph say about X")

When the user asks a **content** question about the graph — "find the node about X", "what does the graph say about Y", "which task covers Z" — don't grep node bodies or answer from memory. Call the search endpoint, then rerank and synthesize from the candidates yourself. `POST /api/graphs/:gid/search` runs the exact hybrid pipeline the browser search box uses (BM25 lexical + dense vectors → RRF, plus 1-hop graph expansion) and returns a ranked candidate list.

```bash
# Ask the retriever. Read-gated, so READ_HEADERS is only needed on a private
# graph; a JSON body means you still send Content-Type.
RESULTS=$(curl -sS -X POST "$GT_BASE/api/graphs/$GT_GID/search" \
  -H 'Content-Type: application/json' "${READ_HEADERS[@]}" \
  -d '{"query":"how does presence cleanup work"}')

# Ranked taskIds, best-first. results = [{taskId, score, source, snippet, meta}].
IDS=$(echo "$RESULTS" | jq -r '.results[].taskId')

# The results carry an optional lexical `snippet` but NOT the full body — pull
# the candidate pool so you can rerank it against the actual question.
for id in $IDS; do
  curl -sS "$GT_BASE/api/graphs/$GT_GID/tasks/$id" "${READ_HEADERS[@]}" \
    | jq '{id, title: .meta.title, content}'
done
```

**You are the reranker.** The retriever is tuned for **recall**, not for getting rank-1 right: on the eval graph the relevant node lands in the top ~50 about 77% of the time and in the top ~100 ~99% (recall@50 0.77, recall@100 0.99) — but it's often buried below less-relevant hits. Reordering that pool against the *real* question is the job, and you — already an LLM reading the bodies against the query — are a stronger reranker than any model the server could call, at no extra cost. So: take the candidate pool, read the bodies, pick the node(s) that actually answer the question, and synthesize from those. This is the whole reason to prefer search over grep — the investigation that motivated this section found that **only reading candidates and reranking against the real query fixes complex / indirect queries**; query rewrite and index-time expansion don't.

**Pool depth.** The endpoint returns the deployment's configured top-K — the **server default is 10**; hosted/tuned deployments set `SEARCH_TOPK=50`, and the recall figures assume that 50-deep pool: because retrieval is recall-tuned, the right node on a hard / indirect query is usually *somewhere* in the top ~50 but rarely at #1 (on the eval set recall@50 ≈ 0.77 vs recall@20 ≈ 0.48). So call with no `config`, then **check the size of the pool you actually got back** — a ~10-deep pool means `SEARCH_TOPK` is unset; raise it at the deployment. If you need to go deeper, `config:{"topK":100}` is now safe: since 2026-08-08 a per-request `config` is normalized over the **deployed** config, so a partial one keeps this deployment's dense leg and graph expansion and only changes the knob you named. (Before that fix it merged over the *lexical-only* library defaults and silently handed back keyword-only results — if you are talking to an older instance, prefer raising `SEARCH_TOPK` at the deployment.) Unknown config keys are now a 400 rather than a silent downgrade, and an embedding override naming a model other than the deployed one is still a 400 (one pooled in-process copy).

**Cross-graph.** `POST /api/search` (no `:gid`) runs the same pipeline over every graph the signed-in user owns or is a member of; each result adds `graphId` + `title`, and a `graphs` map (id → name) labels them. Requires a real user — anonymous callers get 401. Reach for it on "search all my graphs for X".

**Errors.** Empty / missing `query` → 400 `{error}`; an invalid `config` → 400 `{error, errors}`.

### Search + traversal: the graph as a knowledge base

Search and traversal are **two complementary ways to pull context out of a graph — reach for both.** Search jumps to the most relevant nodes *by content* (the RAG-style move above); traversal follows the *edges* out of a node to gather what's connected to it. When the graph is itself a knowledge base — nodes are concept / topic pages and `related` edges are the cross-references between them, the way a wiki links articles — the strongest pattern is the one Karpathy calls an **"LLM wiki"**: rather than re-running vector retrieval on every question, **load the index, jump to an entry page, and follow its links.** Here that's: **search to find the entry node(s), then traverse `related` links to read the connected neighborhood, and synthesize from both.**

The index you traverse is `GET /api/graphs/:gid/graph` → `{nodes, links}`: every node (`id`, `title`, `description`, `status`, plus the full `meta` frontmatter — **no body**) plus every edge (`source`, `target`, `purpose` ∈ `required for | supports | contradicts | related to | supersedes`, the derived `type` ∈ `dependency | related`, and `meta`/`version`). One cheap call gives you the whole structure; then pull only the bodies you need with `GET /tasks/:id`.

```bash
# 1. INDEX — the whole map once (structure only, no bodies).
MAP=$(curl -sS "$GT_BASE/api/graphs/$GT_GID/graph" "${READ_HEADERS[@]}")

# 2. ENTRY — search finds the most relevant node by content (this section, above).
SEED=$(curl -sS -X POST "$GT_BASE/api/graphs/$GT_GID/search" -H 'Content-Type: application/json' \
  "${READ_HEADERS[@]}" -d '{"query":"how does X relate to Y"}' | jq -r '.results[0].taskId')

# 3. TRAVERSE — follow SEED's related links to its neighbors, then read their bodies.
NEIGHBORS=$(echo "$MAP" | jq --argjson s "$SEED" \
  '[.links[] | select(.type=="related") | select(.source==$s or .target==$s)
    | if .source==$s then .target else .source end] | unique')
for id in $(echo "$NEIGHBORS" | jq -r '.[]'); do
  curl -sS "$GT_BASE/api/graphs/$GT_GID/tasks/$id" "${READ_HEADERS[@]}" | jq '{id, title:.meta.title, content}'
done
```

**Which mode for which question:**
- *"What does the graph say about X?"* → **search**, then rerank the pool (above).
- *"What's connected / related to node N?"* → **traverse** N's `related` links from the `/graph` map (above).
- *"How are A and B connected?"* → `GET /graph/shortest-path?from=A&to=B` for a **dependency** chain; for a `related`-link path, walk the `/graph` links yourself.
- *Deep / multi-hop knowledge-base answer* → search for entry points, traverse `related` links a hop or two out, read those bodies, then synthesize — index-then-links, not one-shot retrieval.
- *"Write me a report / brief / summary of the whole graph"* → the same index→entry→traverse→synthesize move applied graph-wide: `GET /graph` is the index, then walk it section by section (by subtree / status / `related` cluster), read the node bodies, and synthesize. Search-as-KB over the whole map, not new machinery — emit long-form markdown and `PUT` it to the report API (§8, API reference).

**Heads-up:** every section-5 endpoint (`subtasks`, `ancestors`, `blockers`, `unblocks`, `ready`, `leaves`) and `shortest-path` traverses **`dependency` edges only** — they're for plan-shaped graphs and won't see `related` links. A knowledge base wired with `related` edges is navigated through the `/graph` map, as above.

**`subtasks` vs `ancestors`** are the two directions of one recursive closure: `subtasks` walks upstream (everything this node rests on), `ancestors` walks downstream (everything resting on this node). Note the naming inverts the graph-theory convention — here "ancestors" returns *dependents* — because edge direction is prerequisite → dependent, so following edges forward reaches the tasks a node feeds. Neither is a membership query: `subtasks` from one terminal node recovers only that node's branch, so on a program that fans out it returns a fraction of the program. For "what's in this body of work" use `POST /structure`.

## 7. Error handling

The API uses HTTP status codes meaningfully — handle them, don't paper over them:

- **Preflight fails (`GET /api/config` unreachable)** — don't conclude the app is down from a single failed curl: a supervised instance that sleeps between sessions often revives seconds after your session starts, which is why the §1 preflight retries for ~25s. If it's still unreachable after the retries, **stop and ask the user** what URL Multitap is at; don't try to install or start it yourself.
- **400 `cycle`** on `POST /edges` or `/edges/bulk` — your dependency would close a loop. The bulk version returns `failedAt: <index>` so you can identify the offending edge. Drop it (or invert direction) and retry the whole batch.
- **400 on `POST /tasks`** with a frontmatter validation message — check `title` length (≤100), `description` length (≤200), `status` value, or an unquoted colon in `title` (YAML parse failure — quote it: `title: "Signal: ARR up"`).
- **400 on `PATCH /graphs/:id`** with `anon_role must be one of none, viewer, editor` — pass one of those three strings literally.
- **400 on `PATCH /graphs/:id`** with `unknown settings key` / `font must be one of …` / `… must be a 6-digit hex color` — see section 9 for valid `settings` shape.
- **403 on any graph route** — access denied for this caller. See the "Why am I getting 401 / 403?" table near the top to triage by route + verb.
- **404 on a task or edge** — it was likely deleted by the user. Re-fetch `GET /graph` and reconcile your local view; don't assume your cached ids are still valid.
- **409 on a task PATCH** — three-way merge fell through (rare; server handles most conflicts silently). The body carries the `current` row — retry once with it as your new base.
- **409 on an edge / bulk / batch write** — a duplicate ("already exists") conflict; the body has NO `current` row. The row is already there — treat as already-applied and move on, don't merge-retry.
- **410 on a `PATCH /tasks/:id`** — the task was deleted between your read and write. Refetch `GET /graph` and decide whether to recreate or skip. (Tasks only — a `PATCH /edges/:id` on a deleted edge returns 404, not 410.)

## 8. What you must not touch

- `meta.x` and `meta.y` on tasks — node positions on the canvas. These are persisted whenever the user drags a node; if you omit them from your PATCH body the server's three-way merge keeps them intact (assuming you sent `base_version` + `base_content` per section 3). Don't include `x`/`y` in your frontmatter.
- `meta.curve` and `meta.color` on edges, and `meta.color` on tasks — those are user UI concerns. Same rule: leave them out of your PATCH; the merge preserves them.
- `meta['background-image']` on tasks — the picture rendered on the node face. Don't set or replace one on your own initiative; only the user picks which image (if any) lives on the canvas. See [Images and agent discretion](#images-and-agent-discretion--hard-rules) for the full rule; same merge protection as the other UI keys, so leaving it out of a PATCH preserves what the user chose.
- The `done` status on tasks — never write it on your own initiative. Only set `done` when the user explicitly says so for a specific task ("mark T1 done", "go ahead and finish off the testing task"). Vague positive feedback ("looks great") is **not** permission. When in doubt, leave it in `review` and ask.
- **Reports** — never generate a report, and never overwrite an existing one, on your own initiative. Generate only when the user explicitly asks ("write me a report / brief / summary of this graph"). When a report already exists and you've just finished a body of work on the graph, you MAY *ask* whether to update it — but asking is the ceiling: regenerating without a yes is the same category error as writing `done` yourself. The report is a separate artifact (`PUT /api/graphs/:gid/report`), never a graph node, so it never touches the graph.
- **Meta/navigation nodes** — never create (or keep feeding) "RESUME HERE" / "START HERE" / status-banner nodes. Orientation is computed (`/tasks/ready`, `/blockers`, `/frontier`, `/decisions/at-risk` — §5); narrative snapshots are the report's job, on explicit ask. Full rule in §2.
- The graph's `settings` JSONB (font / colors) — also a UI concern. Don't touch unless the user explicitly asks (e.g. "make this graph's background dark green"). See section 9 if so.

## 9. Per-graph appearance settings (do not touch unless asked)

Each graph carries a `settings` JSONB object with optional keys:

| Key | Type | Validation |
|---|---|---|
| `font` | string | one of `inter`, `garamond`, `roboto` |
| `font_color` | string | `^#[0-9A-Fa-f]{6}$` |
| `bg_color` | string | `^#[0-9A-Fa-f]{6}$` |

Missing keys fall back to the viewer's app-level Defaults. PATCH merges; sending `null` for a key clears it.

```bash
# Override font + background for this graph
curl -sS -X PATCH "$GT_BASE/api/graphs/$GT_GID" \
  "${WRITE_HEADERS[@]}" \
  -d '{"settings":{"font":"garamond","bg_color":"#100F0F"}}'

# Clear the per-graph font override (revert to default)
curl -sS -X PATCH "$GT_BASE/api/graphs/$GT_GID" \
  "${WRITE_HEADERS[@]}" \
  -d '{"settings":{"font":null}}'
```

Invalid keys/values return 400. There's no `POST /api/graphs/:id/settings` endpoint — `PATCH /api/graphs/:id` with a `settings` field is the only path.

## Reference

Reference material below — consult at point of use, not start to finish. The step sections above link in here by anchor.

## Read-side queries (E15): filters, frontier, inconsistency

The query surface for the typed schema above. All are READ-only (a viewer can run them) and never mutate.

### Metadata filters on `/search` and `/context`

Both accept an optional `filter` — a Mongo/Pinecone-style object over node `meta`. Operators: `$eq $ne $gt $gte $lt $lte $in $nin` plus `$and` / `$or`; a flat object is an implicit AND; a bare value is implicit `$eq`. Comparators compare numbers numerically and ISO datetimes chronologically; an ABSENT field fails the comparators but PASSES `$ne` / `$nin` (Mongo semantics — "field ≠ x" is true when the field isn't there).

```bash
# High-confidence, non-reference search hits only. Ranking is untouched — the
# filter just drops non-matching candidates (you still rerank, §6).
curl -sS -X POST "$GT_BASE/api/graphs/$GT_GID/search" -H 'Content-Type: application/json' "${READ_HEADERS[@]}" \
  -d '{"query":"selenium supply","filter":{"confidence":{"$gte":0.7},"type":{"$ne":"reference"}}}'

# Context neighborhood, filtered at OUTPUT. A low-confidence node on the path
# between two matching nodes is RETAINED and marked bridge:true — the filter
# NEVER prunes traversal. `meta` is surfaced on each node when a filter is set.
curl -sS -X POST "$GT_BASE/api/graphs/$GT_GID/context" -H 'Content-Type: application/json' "${READ_HEADERS[@]}" \
  -d '{"query":"how does X relate to Y","filter":{"confidence":{"$gte":0.6}}}'
```

An absent filter → response byte-identical to the pre-filter contract. An invalid filter → 400. Structured fields aren't text-indexed, so filtering never affects relevance ranking.

### Re-verification frontier — "what established knowledge most needs re-checking"

`POST /frontier` returns LOAD-BEARING confidence-bearing nodes that are STALE or LOW-confidence — the maintenance queue a flat doc store can't express (complements `/tasks/ready`). Importance = OUT-degree over `required for` + `supports` edges, so a foundation many things REST ON ranks first.

```bash
curl -sS -X POST "$GT_BASE/api/graphs/$GT_GID/frontier" -H 'Content-Type: application/json' "${READ_HEADERS[@]}" \
  -d '{"minImportance":2,"staleDays":90,"lowConfidenceBelow":0.5,"maxResults":50}'
# → {frontier:[{id,title,status,type,importance,confidence,verified_at,stale,lowConfidence,
#               refuted_at,r,stability,due_at,decays,checks}], truncated, params, model}
```

All params optional (defaults shown). A node with no `verified_at` counts as stale (never verified). Plain tasks (no `confidence`, not a `reference`) are excluded. Over the cap → `truncated:true`. Importance is E17-aware: a claim whose `supports`/`required for` edge lands on a `type: decision` node also inherits that decision's own out-degree (one hop — a finding grounding a decision that gates ten build tasks is load-bearing even at direct out-degree 1), and equal importance breaks ties by `significance` so a significant orphan claim isn't buried below the cap.

**Rational decay (E18.2).** Staleness is no longer one global window for every fact. Each node gets its OWN window `S`, derived from its verification history in the event log, and the route reports retrievability `R(t) = (1 + t/(9S))^-1` beside it. A claim that keeps surviving WELL-SPACED re-checks earns a longer leash (S: 90 → 108 → 129.6 → 155.52 days); one that fails a check collapses to 9 days and comes back immediately. Re-checking the same claim five times in one session buys 0.001 days — **spacing is the reward, not repetition**.

Nothing about the existing parameters changed: `staleDays` is now `S_INIT`, and `R < 0.9` is algebraically "older than `staleDays`", so a node with no verification events behaves exactly as before. `staleDays: 0` stays legal and still means "everything already checked is stale": S is 0, `r` is the step function (1 only for a node checked this instant, else 0), and rows that tie on `r` keep v1's `verified_at` ascending order. Two new params: `rThreshold` (default `0.9`) moves the surfacing threshold, and `rank` (`tiered` — today's order, the default — or `urgency`, the continuous `importance × (1 − R)` trade). Per-row additions: `refuted_at`, `r` (0..1), `stability` (S, days), `due_at` (**when this claim comes back — the time-to-surface handle**), `decays` (false for `decay: false` nodes), and `checks: {held, failed, deliberate, last_at, last_outcome}`. Top-level `model: {mode: 'scalar'|'decay', head_seq, verified_nodes}` says which path ran, so "no decay data yet" is distinguishable from "decay says fresh".

### Recording a re-check (E18.2)

```bash
curl -sS -X POST "$GT_BASE/api/graphs/$GT_GID/tasks/$ID/verify" -H 'Content-Type: application/json' "${WRITE_HEADERS[@]}" \
  -d '{"outcome":"held"}'
# outcome: "held" | "failed"   (required)
# optional: confidence (0..1, null clears), happened_at (ISO — the world time of
#           the CHECK; backdate freely), cause_id, base_version (→ 409)
# → the task row. held: verified_at := happened_at, refuted_at cleared.
#   failed: refuted_at := happened_at, verified_at cleared, and the claim is
#   back at the top of /frontier immediately.
```

Prefer this over a PATCH when you actually re-checked something: it records ONE atomic event with one `happened_at` (a failure plus its confidence drop is a single event), it is the only way to record a FAILED check, and it stamps `payload.intent` so the log can tell a deliberate re-check from an agent that happened to rewrite the node. A PATCH that sets `verified_at` still works and still counts as a hold — it just carries no intent. Repeating `held` at the same `happened_at` writes no second event and still answers 200. **Edit-gated** (a viewer gets 403).

### Decisions at risk — "which committed decisions no longer rest on solid ground"

`POST /decisions/at-risk` (E17) returns every `type: decision` node with a shifted ground — **status-independent by design: `done` decisions surface.** "Done must never suppress the re-check" is a computed invariant here, not a prose vow. A ground (a node wired INTO the decision via `supports`/`required for`) puts the decision at risk when it is stale (frontier scope + rules), low-confidence, touched by a `contradicts` edge, **superseded** (E18.4 — `supersededGround`: the ground has been replaced by a newer version), or **edited after `decided_at`** (the pivot detector — falls back to the decision's `created_at`). A decision that has ITSELF been superseded drops out of the queue entirely — it is history, not a live commitment (`includeSuperseded: true` to see it). A decision that itself touches a `contradicts` edge surfaces as `selfContradicted` even with no wired grounds.

```bash
curl -sS -X POST "$GT_BASE/api/graphs/$GT_GID/decisions/at-risk" -H 'Content-Type: application/json' "${READ_HEADERS[@]}" \
  -d '{"staleDays":90,"lowConfidenceBelow":0.5,"maxResults":50}'
# → {atRisk:[{id,title,status,decided_at,importance,selfContradicted,
#             reasons:[{id,title,kinds:["stale"|"lowConfidence"|"contradicted"|"changedSinceDecision"]}]}],
#    truncated, params}
```

All params optional (defaults shown). Ranked by the decision's out-degree (blast radius). A healthy cluster returns nothing — the queue only speaks when something actually degraded, so run it at every resume without noise. When it fires: surface the decision + reasons to the human; reopening (status back from `done`, rationale APPENDED never rewritten) is the human's call — see [Decision records](#decision-records-e17).

### Scheduled refresh — the standing loop that works those queues

A graph can carry a per-graph **schedule + purpose prompt** (node-3834 primitive): "every N days, re-check this graph with this intent." The server stores the config and derives due-ness; **execution is yours** — any cron/scheduled session is the executor. The purpose prompt is the judgment half a query can't compute: *is the goal still the right goal, did the landscape move* — read it and take it seriously, don't just mechanically re-verify.

```bash
# Which of my graphs are due? (owned + member scope; the executor's poll)
curl -sS "$GT_BASE/api/refreshes/due" "${READ_HEADERS[@]}"

# The refresh pass, per due graph: work the computed queues + the purpose prompt.
#   1. POST /frontier            → re-verify stale/low-confidence load-bearing claims
#   2. POST /decisions/at-risk   → surface decisions whose grounds shifted
#   3. The purpose prompt        → the landscape / goal re-check (skill-judged)
# Land EVERY change at review (never done), then stamp the run:
curl -sS -X POST "$GT_BASE/api/graphs/<gid>/refresh/complete" "${WRITE_HEADERS[@]}" \
  -d '{"summary":"<one paragraph: what was re-verified, what flipped, what surfaced>","run_id":"<run id>"}'

# Set or change a graph's schedule (PUT is an upsert; DELETE removes it):
curl -sS -X PUT "$GT_BASE/api/graphs/<gid>/refresh" "${WRITE_HEADERS[@]}" \
  -d '{"interval_days":30,"purpose":"Re-verify fast-moving external claims; re-question whether the target still makes sense."}'
```

Only an explicit `/complete` moves `last_run_at` — a run that dies mid-checklist leaves the graph due, so the next poll retries it. Never stamp complete before the pass actually finished.

**There is no automatic executor (owner decision 2026-08-08).** Due-ness just accumulates until a human acts on it — the surfacing lives in the resume flow (§5): when a graph you're working reads `due:true`, offer the user *run now* or *dismiss this cycle*. Dismissal is its own endpoint so it never impersonates a run — `last_run_kind` says which one happened:

```bash
# User said "not this cycle" — silences due until the next interval, honestly labeled:
curl -sS -X POST "$GT_BASE/api/graphs/<gid>/refresh/dismiss" "${WRITE_HEADERS[@]}" -d '{}'
```

### Inconsistency scan — "where does the graph contradict itself"

`POST /inconsistencies` finds DIRECTED cycles in the supports/contradicts subgraph with an ODD number of `contradicts` edges (signed-graph balance). Even-contradicts (mutual disagreement) and pure-supports (circular reasoning) are NOT flagged.

```bash
# Graph-wide — list every tension.
curl -sS -X POST "$GT_BASE/api/graphs/$GT_GID/inconsistencies" -H 'Content-Type: application/json' "${READ_HEADERS[@]}" -d '{}'
# Per-claim — only tensions through node 42 ("is claim X contested?").
curl -sS -X POST "$GT_BASE/api/graphs/$GT_GID/inconsistencies" -H 'Content-Type: application/json' "${READ_HEADERS[@]}" -d '{"start": 42}'
# → {mode, start?, inconsistencies:[{nodes,edges,length,contradicts,balanced}], truncated, scanned, params}
```

Guardrailed (max cycle length / count → `truncated:true`). This IS completion gate (2): run it after writing, surface tensions by name, never auto-resolve.

### Derived plan structure — "what are the bodies of work in here, and where is each one up to"

`POST /structure` (E19) answers the question every other structural query can't. `subtasks`, `ancestors`, `blockers`, `unblocks`, `ready`, `leaves`, and `shortest-path` are all anchored on a node you already know; this one returns the SHAPE of the graph. Use it to orient at the start of a session on an unfamiliar graph, and to report progress by body of work instead of by node.

A **region** is a connected component of the purpose-filtered subgraph. That is the entire definition — deterministic, label-free, no heuristic and no resolution knob.

```bash
# Plan structure (default): the independent programs of work.
curl -sS -X POST "$GT_BASE/api/graphs/$GT_GID/structure" -H 'Content-Type: application/json' "${READ_HEADERS[@]}" -d '{}'
# Argument structure: how the evidence clusters instead.
curl -sS -X POST "$GT_BASE/api/graphs/$GT_GID/structure" -H 'Content-Type: application/json' "${READ_HEADERS[@]}" -d '{"purposes":["supports","contradicts"]}'
# → {regions:[{id,size,nodes:[{id,title,status}],counts,entry,exit,ready}], seams:[…], singletons:[…], params}
```

- `purposes` (default `["required for"]`) picks which subgraph to componentize: `required for` → plan/program structure; `supports`+`contradicts` → argument structure; `related to` → topical KB regions.

**To pull a whole FEATURE — its research, its design, and its build tasks as one cluster — use `{"purposes":["required for","supports"]}`.** These are the two load-bearing purposes, and together they span the arc a feature actually takes: sources `supports` the thesis, the thesis `supports` the design, and the build steps chain by `required for`. That is the recipe for "show me everything about X": search for one node in the feature, then read off the region containing it.

Do **not** add `related to` to that list hoping for more coverage. It is the promiscuous default, and on a mature graph it connects everything to everything — measured on a 124-node graph, including `related to` collapsed the entire graph into ONE region, while the load-bearing pair produced 15 clean ones. If a feature's research sits in a different region from its build tasks, the fix is not a broader traversal: it means the research was wired with `related to` when it is genuinely evidence, and those edges should be `supports`. That is the same inertness that once left a decision cluster at importance 0 — `related to` is invisible to every piece of machinery that matters.
- `minRegionSize` (default `2`) — smaller components are reported under `singletons`. Output is total: every node lands in exactly one region or in `singletons`.
- Per region: `counts` is the status rollup ("what's left in this chunk"), `entry` are the nodes with no in-region prerequisite (where it starts), `exit` are the nodes with no in-region dependent (what it delivers), and `ready` is the subset `/tasks/ready` would return.
- `seams` are the graph's **bridges — single points of failure, NOT region boundaries.** A bridge in a dependency graph means: if this one prerequisite never lands, everything on the far side is severed. Each carries `sideA`/`sideB` node counts, ranked widest-severance first. Read them as plan risk.

**Seams are never auto-cut, and there is deliberately no option to.** It's tempting to cut them to recover a finer sub-structure, but measurement showed no label-free criterion distinguishes a program handoff from an ordinary link in a chain (in-program seams severed 19 and 17 nodes while the true cross-program ones severed 18 and 14), and in a linear chain *every* edge is a bridge, so cutting shatters chains. Auto-cutting would manufacture a confidently wrong grouping. If two programs come back fused into one region, that usually means they genuinely are one program by dependency, and the separate names are the human's subdivision — see write-side rule 5.

### Agent-side `purpose` traversal

`GET /graph` already emits `purpose` (and derived `type`) on every link, so you can walk SIGNED relations yourself: `supports` / `contradicts` edges into/out of a node N are its evidence / counter-evidence; `required for` edges are its prerequisites (or use §5's status queries, which traverse `required for` server-side). Combine with the search-then-traverse "LLM wiki" move in §6.

### Which mode for which question
- *"high-confidence answers about X"* → `/search` with a `confidence` filter, then rerank (§6).
- *"the neighborhood of X, trustworthy nodes only, without losing connectivity"* → `/context` with a filter (bridges kept).
- *"what needs re-verifying / what's gone stale"* → `/frontier`.
- *"which committed decisions need revisiting / did anything shift under a done decision"* → `/decisions/at-risk`.
- *"does the graph contradict itself / is claim X contested"* → `/inconsistencies` (graph-wide / per-claim).
- *"what supports or contradicts N"* → `GET /graph`, then filter N's links by `purpose`.

## Report prose: the house style

Everything below governs the **body of a report** (`PUT /report`) and, where it
applies, long node bodies. It exists because the reader renders through a real
design system now — `design/DESIGN.md` § Report Prose specifies the visual side;
this is the authoring side. Follow it whatever harness you run in.

### The sanitizer contract (read first)

The reader passes every body through DOMPurify with
`FORBID_TAGS: [input, script, textarea, form, button, select, meta, style, link, title, object, base]`.
Consequences you must design around:

- **You cannot ship CSS.** No `<style>` blocks, and don't reach for `style="…"`
  attributes either — inline color would bypass the theme and break in one of
  the two themes. Use the `gt-` classes below; they are the whole palette.
- **You can ship structure.** `div`, `span`, `p`, `figure`, `figcaption`,
  `table`, `svg` and the `class` attribute all survive. That is what makes the
  vocabulary possible.
- **Inline SVG works and themes itself**, because it reads CSS custom
  properties. This is the ONLY way to put a chart in a report.

### Document form

A report is a **document**, not an essay: readers scan first, read second. The
same rules ride in `report.workflow.js`'s `FORM` block (workflow drafters never
read this file), and `eval/report-form.js` scores them deterministically as
part of the E16.16 gate — breaking them is a caught defect, not a style choice.

- **Lede first.** Open every section with its finding in 1–2 sentences, then
  the evidence, then the analysis. Never bury the verdict.
- **Paragraphs**: one idea each, median under 110 words; no more than 15% of
  paragraphs over 150 words; never two 100+-word paragraphs back to back —
  recast the second as a table, list, blockquote, stat row, or diagram.
- Any h3 subsection beyond ~400 words of prose must carry at least one
  non-prose block; keep h3s to roughly 150–350 words of prose plus their
  structure, and split or tighten past that.
- **Comparative content** (3+ items × 2+ properties) is a GFM table wrapped in
  `.gt-scroll`, at least **3 data rows** (fewer belongs in prose), cites in
  cells, `class="num"` on numeric cells, a caption stating the takeaway (never
  the column list — the columns are visible).
- **3–6 load-bearing numbers** go in a `.gt-stats` row, findable by scanning —
  never a stat row for one number, never numbers buried mid-sentence.
- A verbatim primary-source quote of 15+ words: a `>` blockquote immediately
  followed by its `[[cite:id]]`.
- **Sequential/causal content**: a numbered list or a compact `A → B → C` line.
  Numbered markers only when the content genuinely is a sequence.
- **Diagrams are fetched, never drawn.** `GET
  /api/graphs/:gid/diagram?kind=fan|chain|cluster&node=<id>[&to=<id>]`
  (read-gated) returns `{markdown}` — a finished `.gt-fig` figure derived from
  the live edge list (fan = evidence around a claim; chain = a required-for
  path; cluster = a decision's grounds). Paste it **verbatim** as its own
  block; only the `<figcaption>` sentence may be rewritten to state the
  section's takeaway. A 404 means no such diagram — skip it. Lists ≤40% of
  body words: argument stays prose.
- **Carry structure through**: if a cited node body holds a table, figure,
  image, or list, reproduce that structure — do not flatten it into prose.
- **Anti-decoration**: every structural device must encode something true — no
  table restating one sentence, no figure without a claim it illustrates, and
  a chain of reasoning stays prose. When in doubt, prose.
- The mechanical gates (median ≤110 words, >150-word paragraphs ≤15%, no
  400-word prose-only h3, tables ≥3 data rows, adjacent 100+-word pairs ≤10%,
  lists ≤40% of words) are scored by `eval/report-form.js`.

### Emphasis

| Device | Use for | Don't |
|---|---|---|
| **Bold** | A defined term at first use, or the one load-bearing number in a paragraph. At most a couple per paragraph — bold everything and nothing is bold. | Whole sentences. Bold is a pointer, not a highlighter. |
| *Italic* | A contrast or pivot the sentence turns on ("the beat was never the variable — *guidance* was"), and titles of works. | Emphasis you could get from better word order. |
| `Code` | Identifiers, endpoints, literal values, file paths. | Ordinary nouns. |
| UPPERCASE | **Never in body prose.** Caps is the eyebrow/pill language (`.gt-eyebrow`, `.gt-pill`); using it in a sentence collides with the component vocabulary and reads as shouting. | — |

### Structure is information

Every structural device must encode something true, or it's decoration:

- An eyebrow names what the section **is** ("Question 2 — is the premise
  right?"), not that a section exists.
- Numbered markers (01 / 02) only when the content genuinely **is** a sequence —
  a real process, an ordered timeline. Don't number a set of parallel findings.
- A callout variant is a claim about severity. `.warn` means *read this before
  acting on the section*. Don't reach for it to make a paragraph look important.
- A table `<caption>` states the **takeaway** ("Comps improved for eight
  straight quarters before the market re-rated"), never the column list — the
  columns are already visible.

### The `gt-` vocabulary

Only these classes exist. Anything else renders unstyled.

| Class | Use when |
|---|---|
| `.gt-eyebrow` (`+ .muted`) | Labelling a section with its question or role, above the `##` heading. |
| `.gt-note` (`+ .warn`, `+ .key`) | An aside that would break the paragraph's flow. `.warn` = caveat that changes how to read the section; `.key` = the finding itself. Inner `<p class="h">` is its uppercase label. |
| `.gt-stats` › `.gt-stat` › `.k`/`.v`/`.s` | Three-to-six headline numbers scanned together. `.v` takes `.up`/`.down` for direction. Not for one number — put that in the prose. |
| `.gt-pill` (`+ .good`/`.bad`/`.flag`) | An inline status chip beside a name or row. |
| `.gt-fig` › `<svg>` + `<figcaption>` | Any chart or diagram. Always with a caption. |
| `.gt-legend` › `<span><i></i>…` | Series key above a multi-series chart. |
| `.gt-scroll` | **Wraps every table.** The reading measure is 68ch; an unwrapped wide table scrolls the whole page. |
| `.gt-cols.two` › `.gt-card` › `.h` | Genuinely paired content — for/against, before/after. Not a generic card grid. |
| `.num` | On a `<td>`/`<th>` holding figures: right-aligns and stops wrapping. |

### Charts

Inline SVG only. **Never upload a raster (PNG/JPG) for data** — it can't follow
the theme, can't be read by a screen reader, and goes blurry on retina.

- Color comes **exclusively** from `--chart-1` … `--chart-6` (categorical, in
  order), with `--chart-grid` for gridlines and `--chart-label` for axis text.
  Never a literal hex — a hex works in one theme and fails in the other.
- Always `viewBox="0 0 W H"` plus `width="100%"`, so it scales.
- Always `role="img"` and an `aria-label` that states what the data *shows*
  ("Comparable sales by quarter, improving from −11% to +5%"), not what it is
  ("a line chart").
- Relationship diagrams (evidence fans, dependency chains, decision grounds)
  are never hand-drawn — `GET /api/graphs/:gid/diagram` returns a finished
  `.gt-fig` block derived from the live edge list; paste it verbatim (see
  *Document form* above).
- Keep it to what SVG does well: lines, areas, bars, simple scatter. If it needs
  a rendering engine, it doesn't belong in a report.

```markdown
## What the graph actually says

<p class="gt-eyebrow">Question 2 — where is the work concentrated?</p>

<div class="gt-stats">
  <div class="gt-stat"><div class="k">Ready now</div><div class="v up">12</div><div class="s">of 47 open</div></div>
  <div class="gt-stat"><div class="k">Blocked</div><div class="v down">9</div><div class="s">on 3 seams</div></div>
</div>

Most of the remaining work sits behind **three seam nodes** — sever any one and
the region downstream is cut off.

<figure class="gt-fig">
  <div class="gt-legend"><span><i style="background:var(--chart-1)"></i>Done</span></div>
  <svg viewBox="0 0 600 180" width="100%" role="img"
       aria-label="Completed nodes per week, rising from 2 to 11 over six weeks.">
    <line x1="0" y1="150" x2="600" y2="150" stroke="var(--chart-grid)"/>
    <polyline fill="none" stroke="var(--chart-1)" stroke-width="2"
              points="0,140 120,120 240,95 360,70 480,45 600,30"/>
  </svg>
  <figcaption>Throughput has roughly doubled since the E15 schema landed.</figcaption>
</figure>

<div class="gt-scroll">
<table>
  <caption>Every seam traces back to the same unresolved schema decision.</caption>
  <thead><tr><th>Region</th><th class="num">Open</th></tr></thead>
  <tbody><tr><td>Search</td><td class="num">7</td></tr></tbody>
</table>
</div>

<div class="gt-note warn">
  <p class="h">Before you act on this</p>
  <p>Two of the three seams are the same node counted twice.</p>
</div>
```

The `.gt-` list above is enforced: `tests/report-prose-vocabulary.test.js` fails
the build if this table and `public/style.css` disagree, so a class named here
always renders.

## Using Multitap with dynamic workflows

This section applies only when the harness running this skill ALSO exposes a dynamic-workflow / multi-agent orchestration tool (e.g. Claude Code's `Workflow`, plus `Agent` for a single subagent). With one, the graph stops being merely where you *record* work and becomes the durable home for work a workflow *does*: the workflow is the engine that executes one node's fan-out; the graph keeps the plan, the dependencies, and the result.

**Two planes — keep them separate.**

- **Graph = control plane** — durable, cross-session, human-in-the-loop: the plan, the dependency DAG, each node's acceptance criteria (its "tests"), status, findings. This is state + memory.
- **Workflow = data plane** — transient, in-session: the engine for ONE node's fan-out / pipeline / loop / adversarial-verify. This is compute.

**The pattern.** A graph node DEFINES a unit of work → a workflow EXECUTES its fan-out and RETURNS structured results → the main loop DISTILLS those back into the node (flip status, write the synthesis into the body) and freezes any heavy artifact to disk. The graph is the source of truth; a workflow's journals are transient scaffolding.

**When to reach for a workflow** (from inside a node): the node's work is many independent, agent-shaped sub-tasks that benefit from structure and verification — an eval/test suite (N runs × arms × answer→judge), a multi-source research sweep, a large audit or migration, multi-perspective analysis. Build the workflow once; parameterize it per run.

**Generating a report (E16) — inline vs workflow.** A human-readable report of the whole graph is search-as-KB (§6) run graph-wide, not new machinery. Start cheap: `GET /graph` for the structure (no bodies). For a **tiny** graph, one inline pass suffices — read the map, pull the node bodies you need, draft the whole report in one go, and `PUT /api/graphs/:gid/report` with the Bearer token (writes 403 / orphan without `Authorization: Bearer $MULTITAP_AGENT_TOKEN`). Send the body under the `body` field (not `markdown`), and — like the workflow path — include `regenerated: true` when this is a genuine (re)generation so the staleness clock resets (completion gate 3). For a **large** graph, escalate to the `report.workflow.js` generator (map → draft sections in parallel → stitch → completeness critic) that RETURNS the markdown for the main loop to `PUT`. NEVER generate on your own initiative (§8); one report per graph, and PUT replaces it. The inline path follows the SAME drafting conventions as the workflow (the CITE block in `report.workflow.js`): cite nodes with `[[cite:<id>]]` markers, and honor **edge fidelity** — edges are directed (source → target), so prose saying "A supports B" requires the live edge A→B (writing "A is supported by B" over an A→B edge is an inversion), and a plain `related to` edge never licenses an evidence/causal claim ("exists because of", "supports"), only loose-association language. Both are checked against the live edge list by the E16.16 faithfulness eval (`eval/report-faithfulness.js` + `eval/report-form.js` + `eval/report-faithfulness-judges.workflow.js`), the gate for report-generation work — and the **Document form** rules (§ Report prose) bind the inline path exactly as they bind the workflow's drafters, with `eval/report-form.js` scoring them deterministically.

**When NOT to.**

- Deterministic, measurable work → a plain script, no agents. Agents are the expensive part; never spend one on what a `curl`/`jq`/node script can compute exactly (coverage, counts, diffs, rendering).
- Single-step work → one inline agent, or just do it.
- **Never** automate the plan-walk, status transitions, keep/drop decisions, or review gates into a workflow. Those stay in the main loop, human-in-the-loop — and you NEVER set `done` (§3).

**The tool, briefly.** `agent(prompt, {schema?, label?, phase?, model?, effort?})` spawns a subagent; its final message IS the return value, and with a JSON-Schema `schema` it returns a validated object (parse-free). `parallel(thunks)` runs tasks concurrently and awaits all (a barrier). `pipeline(items, ...stages)` streams each item through every stage with no barrier between them — the default for multi-stage work. `phase(title)` / `log(msg)` drive the progress display. Useful shapes: **fan-out** (N independent finders), **pipeline answer→judge** (the verify shape), **loop-until-dry** (keep finding until K empty rounds), **adversarial verify** (N skeptics try to refute a finding; kill it if the majority do), **judge panel** (score N independent attempts, synthesize the winner).

**The clean contract (HARD RULE).** Workflows COMPUTE and RETURN; the **main loop** SYNCS the graph (announce-focus + OCC, §3). Do not have a workflow write to the plan graph concurrently — collect its results, then write them from the main loop with OCC so the canvas stays consistent and your avatar attribution is right. Spawning agents is **opt-in and costs tokens**: do it only when the user/harness has actually asked for multi-agent orchestration.

**Writing results back — the batch endpoint.** When a workflow returns a set of nodes + edges (a research round, a batch of distilled findings), commit them in ONE call: `POST /api/graphs/:gid/batch`. It upserts many nodes + edges in a single transaction, is idempotent per node via a client `external_id` (re-running a round updates instead of duplicating), and stamps every row with a `run_id` so a run's additions can be inspected or undone. This is the write-back path: it collapses N racing single-writes into one transaction — the real memory win on a small box — and lets a re-run be a safe no-op.

```bash
# Results from the workflow, already structured. external_id is YOUR stable key
# per node (so a re-run upserts, not duplicates); edges reference nodes by that
# external_id (string) or by an existing numeric task id.
curl -sS -X POST "$GT_BASE/api/graphs/$GT_GID/batch" "${WRITE_HEADERS[@]}" -d "$(jq -n \
  --arg run "research-2026-06-21-round1" \
  '{run_id:$run,
    nodes:[ {external_id:"claim:tsmc-capex",
             content:"---\ntitle: TSMC raises 2026 capex\nstatus: review\nconfidence: 0.8\nverified_at: 2026-06-21T00:00:00Z\n---\n## Finding\n…"},
            {external_id:"src:tsmc-q1-call",
             content:"---\ntitle: TSMC Q1 2026 earnings call\nstatus: review\ntype: reference\nconfidence: 0.9\n---\n## Source\n…"} ],
    edges:[ {source:"src:tsmc-q1-call", target:"claim:tsmc-capex", purpose:"supports"},
            {source:"claim:tsmc-capex", target:"entity:tsmc", purpose:"related to"} ]}')"
# Response: {run_id, nodes:[{…,_op:created|updated|unchanged}], edges:[…],
#            created:{…}, updated:{…}, unchanged:{…}}. Re-running the same batch
# reports everything `unchanged` — no version churn, no canvas flash.
```

**YAML caution:** quote any frontmatter title that contains a colon (`title: "Signal: ARR up"`) — an unquoted colon makes the YAML fail to parse and rejects the whole batch.

Agents write status `review`, never `done` (§3 — `done` is the human's call). The batch merge preserves UI-managed keys AND a human's `status` — but ONLY when your node content omits them: re-sending `status` (as the example payload above does) WILL revert a node a human advanced. On re-runs, omit `status` from node content (or send `base_content` from the prior run) so a human's advance survives. Keep the small, fixed node/edge vocabulary the graph already uses.

**Single dynamic node, no workflow involved — `upsert_task`.** Not every write is a structured workflow result; sometimes you just need to create-or-update ONE node from a computed variable (a finding, a rendered summary). `POST /tasks` has no identity key — it's `{content}` only, so it can only ever create, never tell you "this already exists." A client-side check-then-create-or-update would mean searching by title first, which isn't reliable (titles aren't unique). `POST /batch` already solves this server-side via `external_id`, even for a single node — route single-node upserts through it instead of `POST /tasks`:

```bash
upsert_task() {
  # Usage: upsert_task <external_id> <content>
  # Create-or-update ONE node keyed by a stable external_id you choose (e.g.
  # "claim:tsmc-capex"). Re-calling with the same external_id updates in place
  # instead of duplicating — the same idempotency /batch gives a whole
  # workflow result, applied to just one node.
  local EXT_ID="$1"
  local CONTENT="$2"
  curl -sS -X POST "$GT_BASE/api/graphs/$GT_GID/batch" \
    "${WRITE_HEADERS[@]}" \
    -d "$(jq -nc --arg ext "$EXT_ID" --arg c "$CONTENT" \
      '{nodes:[{external_id:$ext, content:$c}], edges:[]}')"
}
```

**Gotcha: `--arg`, not `--argjson`, for any `content`/body field.** `--argjson` tells jq "this argument is already valid JSON" — feed it a raw multi-line markdown string (real newlines, not `\n` literals) and it fails with `Invalid string: control characters ... must be escaped`, which surfaces downstream as a server-side `content is required` (the curl body never built, so the request goes out empty/broken). `--arg` takes a raw string and escapes it for you — that's what `upsert_task` above and `patch_task` (§3) both use for `content`. `--argjson` is only correct for values that are already JSON on their own, like the numeric `version` in `patch_task` or the `id` in `announce_focus`. If you're assembling many nodes at once with computed content (not the fixed two-node shape in the example above), jq's per-field `--arg` flags stop scaling — building the payload with `python3 -c 'import json; print(json.dumps({...}))'` is a simpler, equally-safe alternative for that case.

**Hard-won lessons (validated on a real run, E13.10).**

- **Shape = TWO fan-out workflows with deterministic GLUE between them, not one mega-workflow.** Use agents ONLY for the genuinely-LLM phases (build, judge); use plain node scripts for everything measurable (provision, measure, render, compare). The glue lives in the main loop between workflows. Minimize agents — they're the cost.
- **Concurrency is ~serial on a small box** (the cap is ≈ cores − 2; on 1 core, fan-out just queues). The value of fan-out here is ORGANIZATION + structured verification, **not speed** — set that expectation.
- **Structured output (JSON schema) is the contract** — build summaries and judge verdicts come back parse-free. `pipeline(answer→judge)` is the verification shape; lean on it.
- **Data handoff is the rough edge.** `Workflow` `args` must be inline in the call (you can't reference a file), and the result arrives in the completion notification. So pass SMALL args / file PATHS (not file contents), and persist a workflow's result to disk for the next script to read.
- **Memory is the binding constraint.** Many single writes each trigger a server-side embedding pass; the batch endpoint writes once. On a capable embedding backend, `EMBED_TASKS_PER_PASS` (a deploy env var, default 1 = unchanged) also groups embeddings per pass.
- **Subagents are faithful "fresh sessions."** They inherit env (the `gt_` token), can curl the live API, honor model/effort overrides + schemas, and are lightweight — a no-context `agent()` given only a skill + a task behaves like a brand-new session.

**A working example to ADAPT, not reinvent (committed):** `eval/skill-ab/ab-build.workflow.js` + `ab-aq.workflow.js` are the two fan-out workflows; `provision.js` / `measure.js` / `aggregate.js` / `compare.js` are the deterministic glue. Start from those.

### Example: a deep-research workflow (E15 schema)

A concrete, parameterized research workflow ships at **`.claude/skills/multitap/workflows/research.workflow.js`** (run it with `Workflow({ scriptPath: ".../research.workflow.js", args: { question, gid, base } })`). Its only required input is a research question. It implements the canonical shape against the universal schema:

**read KB (filtered) → [discover (fan-out) → fetch sources → adversarial 3-vote verify → dedup] looped until dry → completeness critic**, returning verified findings in the small fixed vocabulary:
- each finding → a **claim node** at `status: review` with `confidence` (the mean of the three adversarial judges' 0..1 sureness, one decimal — survival itself is a majority vote: killed when 2+ of 3 refute), `significance`, and `verified_at` — and **no `type`** (it's a claim, identified by confidence + status);
- each source → a **`type: reference`** node, with a **`supports`** edge source→finding;
- a finding that conflicts with another → a **`contradicts`** edge;
- the critic's gaps → **`todo` open-question** nodes (NO confidence).

Per the clean contract, the workflow COMPUTES and RETURNS `{ nodes, edges, openQuestions }`; the MAIN LOOP then does the side-effects:

```bash
# 1. stamp the workflow's PUT_ISO_TIMESTAMP_HERE sentinel (verified_at) with a
#    real timestamp FIRST — the server rejects non-ISO datetimes, so an
#    unstamped batch 400s wholesale — then write the round atomically at status
#    review (idempotent on external_id); sources land as reference nodes.
ROUND_JSON=$(echo "$ROUND_JSON" | sed "s/PUT_ISO_TIMESTAMP_HERE/$(date -u +%FT%TZ)/g")
curl -sS -X POST "$GT_BASE/api/graphs/$GT_GID/batch" "${WRITE_HEADERS[@]}" -d "$ROUND_JSON"
# 2. COMPLETION GATE 1 is already honored — everything is `review`, never `done`.
# 3. work the re-verification frontier (stale load-bearing knowledge to re-check):
curl -sS -X POST "$GT_BASE/api/graphs/$GT_GID/frontier" -H 'Content-Type: application/json' "${READ_HEADERS[@]}" -d '{}'
# 4. COMPLETION GATE 2 — run the inconsistency scan and SURFACE any tension by
#    name (never auto-resolve a contradicts edge):
curl -sS -X POST "$GT_BASE/api/graphs/$GT_GID/inconsistencies" -H 'Content-Type: application/json' "${READ_HEADERS[@]}" -d '{}'
```

Rule of thumb: read-only POSTs — `search` / `context` / `frontier` / `inconsistencies` — take `READ_HEADERS` + an explicit `Content-Type`; only mutating calls (e.g. the `batch` write in step 1) take `WRITE_HEADERS`.

Re-running the workflow on the SAME graph next session compounds: the read-KB stage skips what's already confident, the batch write upserts (no duplicates), and the frontier resurfaces what's gone stale. That loop — build → read → re-verify → compound — is the whole point of the typed schema.

**If the Workflow tool is absent**, degrade to a single-agent sequential loop with the same discipline (read the graph → do the work → write back via the batch endpoint → repeat), just without the fan-out.

### Example: a report-generation workflow (E15 schema)

A concrete, parameterized report generator ships at **`.claude/skills/multitap/workflows/report.workflow.js`** (run it with `Workflow({ scriptPath: ".../report.workflow.js", args: { gid, base, focus?, audience? } })`). It is the report-shaped sibling of the deep-research workflow, but with the OPPOSITE data-flow: research is **write-amplifying** (returns `{nodes,edges}` → the main loop POSTs `/batch`, writing INTO the graph); this one is **read-over-graph, write-once-beside-it** (returns `{title, description, markdown, source_graph_version, coverage}` → the main loop does ONE `PUT /api/graphs/:gid/report`, writing NOTHING into the graph — no report node, no tasks, no edges). It implements the report-as-KB shape (§6) run graph-wide:

**index/read (structure only) → outline (status-aware sections) → draft sections in parallel (blind drafters, each grounded STRICTLY in fetched bodies+sources) → deterministic stitch (frontmatter + concat, no agent) → completeness critic with a bounded re-draft** — then RETURNS the finished markdown. Per the clean contract, the workflow COMPUTES and RETURNS; the workflow itself never curls a write (its agents only hit read endpoints — `GET /graph`, `GET /tasks/:id`, the read-gated `POST /search|/context|/frontier|/inconsistencies`), and the MAIN LOOP does the single side-effect:

```bash
# The workflow returns {title, description, markdown, source_graph_version, coverage}.
# The PUT field is `body`, NOT `markdown` — the server silently coerces a
# missing/mis-keyed body to '' (a blank report, 200, no error) — so build the
# payload explicitly, stamping the PUT_ISO_TIMESTAMP_HERE sentinel on the way.
# `coverage` is workflow diagnostics only, not a PUT field. `regenerated: true`
# resets the staleness clock (generated_at) — send it because this IS a genuine
# regeneration from the current graph; a fresh generation should read as current.
REPORT_JSON=$(echo "$RESULT" | jq --arg now "$(date -u +%FT%TZ)" \
  '{title, description, body: (.markdown | gsub("PUT_ISO_TIMESTAMP_HERE"; $now)), source_graph_version, regenerated: true}')
# The ONE write — a write-gated upsert (needs Authorization: Bearer $MULTITAP_AGENT_TOKEN).
curl -sS -X PUT "$GT_BASE/api/graphs/$GT_GID/report" "${WRITE_HEADERS[@]}" -d "$REPORT_JSON"
```

**When to reach for this workflow vs stay inline — a SOFT skill gate, not a server limit.** Like `SEARCH_TOPK` (§6), this is a threshold the skill states, not a cap the server enforces — nothing rejects an inline report on a big graph or a workflow on a small one; the gate just spends agents where they earn their token cost. **Always do the cheap `GET /graph` first** for the node count N and theme/component count (structure only, no bodies — token-light), then decide:

- **INLINE** (one main-loop pass, NO fan-out): N ≲ 35 **AND** ≲ 6 themes **AND** the bodies you'd pull are ≲ ~40–50k tokens. Read the map → pull the node bodies you need → draft the whole report in one go → the main loop PUTs it. This is search-as-KB (§6), not new machinery.
- **WORKFLOW** (`report.workflow.js`, fan-out): N ≳ 40 **OR** bodies ≳ ~50k tokens **OR** ≳ 6 themes/components.
- **Structure overrides raw count.** 25 nodes in 8 disconnected clusters → workflow (the fan-out organizes the clusters); a tight 30-node single-topic graph → inline. Judge by how many independent regions a drafter would have to hold at once, not the headline number.

**Default to inline** — agents are the expensive part (the "agents cost tokens" rule from *When NOT to* above), so only fan out when the graph is genuinely large or multi-cluster. And as always (§8), NEVER generate a report on your own initiative — one report per graph, the PUT replaces it, and it waits for an explicit ask.

## API reference

All paths below are `:gid`-scoped (substitute `$GT_GID`). Base URL is `$GT_BASE` (`MULTITAP_BASE_URL` env var, default `http://127.0.0.1:3000`).

| Method | Path | Notes |
|---|---|---|
| GET | `/api/config` | `{auth_enabled, provider, publishable_key, viewer_user_id}` — probe first to learn the deployment mode (`publishable_key` = Clerk publishable key for the frontend, `null` when auth is off) |
| GET | `/api/graphs` | Lists graphs the viewer owns + is a member of; anonymous callers (which includes every caller in auth-off mode) get `[]` — legacy un-owned graphs stay reachable by URL only |
| POST | `/api/graphs` | `{name, description?, allow_anonymous?}` — `name` ≤80, `description` ≤500; duplicate names allowed; on an accounts-enabled instance a create with no token is refused (401) unless `allow_anonymous: true` (an owner-less, URL-only graph); new graphs default `anon_role='viewer'` and `settings={}` |
| GET | `/api/graphs/:id` | One graph; also returns `viewer_can_edit` / `viewer_can_manage` based on the caller's role |
| PATCH | `/api/graphs/:id` | `{name?, description?, anon_role?, settings?}` — `name` ≤80, `description` ≤500; `anon_role` ∈ `none | viewer | editor`; see section 9 for `settings` |
| DELETE | `/api/graphs/:id` | Cascades to tasks + edges |
| POST | `/api/graphs/:id/rotate-id` | Issues a new id; old URL stops resolving |
| GET | `/api/graphs/:gid/members` | `{members, pending}` — read-gated list (any viewer, anonymous included, sees members + pending invites, emails included); POST and the DELETEs are manage-gated |
| POST | `/api/graphs/:gid/members` | `{email, role}` — promotes to member if email matches a user, else stashes pending |
| DELETE | `/api/graphs/:gid/members/:userId` | Kick a real member; emits SSE so the kicked browser evicts in real time |
| DELETE | `/api/graphs/:gid/members/pending/:email` | Cancel a pending invite |
| GET/POST | `/api/me/agent_tokens` | Agent-token list/mint; user-facing, normally driven from the in-app modal. (There is NO `GET /api/me` — it 404s; viewer identity comes from `GET /api/config` → `viewer_user_id`.) |
| DELETE | `/api/me/agent_tokens/:id` | Revoke a token |
| GET/PUT | `/api/me/prefs` | Per-user app-level prefs (signed-in users only) |
| GET | `/api/graphs/:gid/tasks` | List tasks |
| POST | `/api/graphs/:gid/tasks` | `{content}` markdown |
| GET | `/api/graphs/:gid/tasks/:id` | One task |
| PATCH | `/api/graphs/:gid/tasks/:id` | `{content}` — full replace |
| DELETE | `/api/graphs/:gid/tasks/:id` | Cascades to its edges |
| POST | `/api/graphs/:gid/tasks/:id/verify` | **E18.2** record a deliberate re-check. `{outcome:"held"\|"failed", confidence?, happened_at?, cause_id?, base_version?}` → the task row. `held` sets `verified_at` and clears `refuted_at`; `failed` does the reverse, which puts the claim straight back on `/frontier`. One atomic event, stamped `intent`. **Edit-gated.** |
| GET | `/api/graphs/:gid/tasks/leaves` | DAG roots (no incoming dep edges) |
| GET | `/api/graphs/:gid/tasks/ready` | Tasks ready to start — open questions (`status:todo`, no `confidence`) with all recursive prereqs `done`; see [§5](#5-status-aware-traversal-find-what-to-work-on-next-whats-blocking-what-gets-unblocked) for the exact predicate. Superseded nodes are excluded (`?includeSuperseded=1` to keep them); a superseded PREREQUISITE still blocks |
| GET | `/api/graphs/:gid/tasks/:id/subtasks` | All recursive prerequisites — everything this node rests on |
| GET | `/api/graphs/:gid/tasks/:id/ancestors` | All recursive dependents — everything resting on this node |
| GET | `/api/graphs/:gid/tasks/:id/blockers` | Recursive prereqs not yet done |
| GET | `/api/graphs/:gid/tasks/:id/worldline[?axis=&asOf=&known=]` | **E18.4** — the fact's generations along its `supersedes` chain: `{node, as_of, generations:[{generation, id, title, valid_from, approximate_from, created_at, valid_to, open, interval_inverted, closed_by}], roots, branches, merges, truncated}`. Intervals are half-open `[valid_from, valid_to)` and DERIVED from the log, never stored; same `asOf`/`axis`/`known` knobs (and the same errors) as `GET /graph`. A worldline is **not always a line**: `roots` names every chain head (a MERGE — two facts, one replacement — has two, and both are reported at generation 0), `branches` the nodes that fan out and `merges` the nodes where lines join. `interval_inverted` marks a generation whose `valid_to` precedes its `valid_from` — a supersession backdated to before the fact it ends began. The timestamps are reported as recorded and never clamped: the two axes are allowed to disagree. `truncated` marks a walk that hit a cap; the window is centred on the queried node, which is never cut out of its own worldline. **Read-gated.** |
| POST | `/api/graphs/:gid/tasks/:id/excise` | **E18.6** — remove a node's bytes from the log; `{reason}` required. **Owner-only; refuses `X-Writer-Type: agent` — not for you.** Appends `node.excised` and blanks every earlier event of the node to a shape-preserving marker. Returns `{seq, node_present, excised_count, excised_seq_min, excised_seq_max, genesis}`. Not deletion, not a correction. |
| GET | `/api/graphs/:gid/tasks/:id/unblocks` | Direct parents that would become ready if this task were done |
| GET | `/api/graphs/:gid/edges` | List edges |
| GET | `/api/graphs/:gid/decisions/:id/branches` | **E18.5** — a decision's options, their branches, the DORMANT set, and the contingency closure (what is in play if the decision is reopened), each with its reasoning chain. Same `asOf`/`axis`/`known` knobs as `GET /graph`. Options are `related to` edges carrying `meta.branch.role` ∈ `chosen | alternative`. **Read-gated.** |
| POST | `/api/graphs/:gid/decisions/:id/confrontation` | **E18.5** — retrace a decision: the graph as it stood when it was committed (anchored on the commitment EVENT's seq, not the backdatable `decided_at`), the grounds then set against what the log recorded since, and a pointer to any re-runnable benchmark. **It never invents a counterfactual**: a branch nobody worked on returns `empty: true`, and the `limits` block states `counterfactual: false`, `benchmark_run: false`, `verdict: false`, `silence_is_not_vindication: true`. A ground with no outcomes means NOBODY CHECKED, not that the decision was vindicated; `truncation` says when a cap stopped the search. **Read-gated.** |
| POST | `/api/graphs/:gid/edges` | `{source_id, target_id, purpose, meta?}` — `purpose` ∈ `required for | supports | contradicts | related to | supersedes`, **required** (server derives + stores `type`; legacy `type` no longer accepted). See [The universal schema (E15)](#the-universal-schema-e15). |
| POST | `/api/graphs/:gid/edges/bulk` | `{edges: [...]}` — transactional, all-or-nothing; ≤500 edges per call; each edge takes `purpose` (required) |
| POST | `/api/graphs/:gid/batch` | `{run_id?, nodes:[{external_id, content, base_content?}], edges:[{source, target, purpose, meta?, external_id?}]}` — transactional UPSERT of nodes + edges in one call. Caps: ≤500 nodes / ≤1000 edges per call; `external_id`/`run_id` ≤200 chars. Idempotent per node via `external_id` (re-run → upsert, not duplicate); edges idempotent on their endpoints; every row stamped with `run_id`. Edge `source`/`target` is a numeric task id OR an in-batch/existing `external_id` string; `purpose` is required (one of `required for | supports | contradicts | related to | supersedes`) and the server derives + stores `type`. Returns `{run_id, nodes, edges, created, updated, unchanged}`. The dynamic-workflow write-back path — see [Using Multitap with dynamic workflows](#using-Multitap-with-dynamic-workflows). |
| PATCH | `/api/graphs/:gid/edges/:id` | Partial update |
| DELETE | `/api/graphs/:gid/edges/:id` | Delete |
| GET | `/api/graphs/:gid/graph[?asOf=&asOfSeq=&axis=&known=]` | `{nodes, links}` snapshot. **Bare, this is the hot path** and touches only `tasks`/`edges`. **E18.1 time travel** (opt-in, adds an `as_of` envelope): `?asOf=<iso>` or `?asOfSeq=<n>` reconstructs the same payload from the event log; `?axis=learned` (default) orders by when we were TOLD, `?axis=happened` by when it was TRUE and requires `asOf`; `?known=<iso>` adds the belief-time ceiling that makes the pair a bitemporal rectangle. Envelope: `{axis, requested, known, seq, head_seq, base, events_replayed, history_starts_at, pre_history_approximation, truncated, anomalies}` — READ `truncated` and `pre_history_approximation` before quoting a reconstruction. The two axes may legitimately disagree and the fold does not reconcile them. `no-store`, except a pinned `?asOfSeq=` which is immutable. See [The two clocks](#the-two-clocks--happened_at-and-learned_at-e181). |
| GET | `/api/graphs/:gid/graph/shortest-path?from=&to=` | BFS over dependency edges (undirected); returns `{path, cost, tasks}` or empty if disconnected |
| GET | `/api/graphs/:gid/diagram?kind=&node=[&to=][&maxNodes=]` | Server-derived relationship diagram for report bodies: `kind` ∈ `fan\|chain\|cluster` → `{markdown, stats}` — a finished `.gt-fig` figure (theme-token inline SVG, aria-labelled, clickable node titles) built deterministically from the live edge list; paste it VERBATIM into a report (see § Document form). `fan` = supports/contradicts around `node`; `chain` = required-for path through `node` (or `node`→`to`); `cluster` = a decision's incoming grounds. 404 = no such diagram (missing seed or no qualifying edges) — skip, don't retry. **Read-gated.** |
| POST | `/api/graphs/:gid/search` | Hybrid (BM25 + dense → RRF, +1-hop expand) search over the graph's nodes; **read-gated** (viewers can run it; never mutates). Body `{query, config?, filter?}` → `{query, results, timings}`; `results` is the ranked list `[{taskId, score, source, snippet, meta}]`. Optional `filter` (E15) post-filters by node `meta` without changing ranking — see [Read-side queries (E15)](#read-side-queries-e15-filters-frontier-inconsistency). For content questions, prefer this over grep — see [§6](#6-search-the-graph-find--what-does-the-graph-say-about-x). |
| POST | `/api/graphs/:gid/context` | Query- or node-seeded k-hop neighborhood WITH bodies (one cohesive KB call); **read-gated**. Body `{query?|seeds?, hops?, maxNodes?, edgeTypes?, alpha?, filter?}`. Optional `filter` (E15) applies at OUTPUT with the bridge rule (a node bridging two matching nodes is kept + marked `bridge:true`) — see [Read-side queries (E15)](#read-side-queries-e15-filters-frontier-inconsistency). |
| POST | `/api/graphs/:gid/frontier` | **E15** re-verification frontier: load-bearing (out-degree of `required for`+`supports`, plus E17 decision-inherited importance) ∧ (stale ∨ low-confidence) confidence-bearing OR `type: reference` nodes. Body `{minImportance?, staleDays?, lowConfidenceBelow?, maxResults?, rThreshold?, rank?}` → `{frontier, truncated, params, model}`. **E18.2** adds per-node rational decay: `stability` (S), `r`, `due_at`, `decays`, `checks`, `refuted_at`. **Read-gated.** |
| POST | `/api/graphs/:gid/decisions/at-risk` | **E17** decision re-check queue: `type: decision` nodes whose grounds (incoming `supports`/`required for`) are stale ∨ low-confidence ∨ contradicted ∨ edited after `decided_at`. Status-independent (`done` surfaces). Body `{staleDays?, lowConfidenceBelow?, maxResults?}` → `{atRisk, truncated, params}`. **Read-gated.** |
| POST | `/api/graphs/:gid/inconsistencies` | **E15** signed-cycle scan: directed cycles in the supports/contradicts subgraph with odd `contradicts`. Body `{start?, maxCycleLen?, maxCycles?}` (graph-wide, or per-claim when `start` is a node id) → `{mode, inconsistencies, truncated, scanned}`. **Read-gated.** |
| POST | `/api/graphs/:gid/structure` | **E19** derived plan structure: the independent bodies of work as connected components of a purpose-filtered subgraph, each with a status rollup + entry/exit/ready, plus `seams` (bridges = single points of failure, never auto-cut). Body `{purposes?, minRegionSize?}` → `{regions, seams, singletons, params}`. **Read-gated.** See [Derived plan structure](#derived-plan-structure--what-are-the-bodies-of-work-in-here-and-where-is-each-one-up-to). |
| POST | `/api/search` | Cross-graph search over every graph the signed-in caller owns or is a member of (same set as `GET /api/graphs`). Body `{query}` only — `config`/`filter` are silently ignored here (filter per-graph instead). Response same shape, plus each result carries `graphId` + `title` and a `graphs` map (id → name). **401 if anonymous.** |
| GET | `/api/graphs/:gid/events` | SSE stream — used by the browser; you generally don't need to consume this |
| GET/POST | `/api/graphs/:gid/presence` | Live avatar-bar presence. `POST {id, name, type}` announces/refreshes (204; 400 without `id`); `GET` returns the snapshot. The browser owns this; agents normally let the install-time Stop/SessionStart hooks manage it — see [Presence lifecycle](#presence-lifecycle). **Read-gated.** |
| DELETE | `/api/graphs/:gid/presence/:writerId` | Idempotent depart (204 even if absent). What the Stop hook calls for each touched gid at end of turn. |
| GET/POST | `/api/graphs/:gid/selection` | Per-writer focus broadcast (the colored outline + cursor peers see on the canvas). `POST {node_ids, edge_ids, editing, cursor_anchor}` (204; 400 without `X-Writer-Id`) is what `announce_focus`/`announce_focus_edge` (§3) call — one selection per writer, a new POST replaces the prior; `GET` returns the snapshot. **Read-gated** (a viewer may publish their own). |
| DELETE | `/api/graphs/:gid/selection/:writerId` | Clears that writer's selection; idempotent 204. What `clear_focus` (§3) and end-of-turn cleanup call (`:writerId` = your `AGENT_ID`). |
| GET/PUT | `/api/graphs/:gid/prefs/me` | Per-(user, graph) camera-follow toggle. `GET` → `{agent_follow}` (null = unset → client default); `PUT {agent_follow: <bool>}` sets it AND your account-wide default. **Signed-in users only — 401 anonymous**; a UI preference, not an agent write. |
| POST | `/api/graphs/:gid/uploads` | Raw image bytes (`Content-Type: image/png|jpeg|gif|webp|svg+xml`, 5 MB cap). Returns `{id, url, content_type, byte_size}`; reference the URL from a task's `background-image` frontmatter to make it render on the canvas. |
| GET | `/api/graphs/:gid/uploads/:id` | Image bytes; served with the stored content-type, immutable cache headers, and `X-Content-Type-Options: nosniff`. |
| GET | `/api/graphs/:gid/report` | The graph's ONE human-readable report (E16). `200` with `{title, description, body, meta, generated_at, updated_at, source_graph_version, run_id}`, or `404 {error:'no report yet'}`. **Read-gated** — a viewer/anon may read it. |
| GET | `/api/graphs/:gid/report/meta` | Body-less existence + staleness probe (what completion gate 3 runs). `{exists:false}` or `{exists:true, title, generated_at, updated_at, source_graph_version, graph_updated_at, stale}`. **Read-gated**; served with `Cache-Control: no-store`. |
| PUT | `/api/graphs/:gid/report` | Upsert the report (one per graph; PUT idempotently REPLACES). Body `{title (req, ≤200), description? (≤500), body (markdown), source_graph_version?, run_id?, meta?, regenerated?}`. **Edit-gated** — needs edit access + Bearer token. `run_id` preserved when omitted. `generated_at` (the staleness clock) is preserved across updates by default — a re-write is NOT a regeneration; send `regenerated: true` to reset it to NOW() (clears the stale banner after a genuine regeneration). Writing a report has ZERO impact on the graph (its own table + notify — never bumps `updated_at`/`version`). |
| GET | `/api/graphs/:gid/export` | **OKF v0.2 export**: the whole graph as an Open Knowledge Format bundle for consumption OUTSIDE Multitap (hand a snapshot to another agent/tool with no API access). Default JSON envelope `{graph, okf_version, files: {path → content}}`; `?format=tar` → plain ustar attachment (`<gid>.okf.tar`) that untars into a git-ready directory. Task docs keep every frontmatter key and add `type` (absent → `task`), OKF `status` (`done`→`stable`, else `draft`) beside the lossless `task_status`, `generated: {by, at}`, and outgoing `edges: [{to, purpose}]`; edges also render as a prose-typed `## Links` body trailer, and the report ships as `report.md`. Read-only, never mutates. **Read-gated.** |

### Markdown frontmatter shape

```yaml
---
title: string (required, ≤100 chars)
description: optional string (≤200 chars)
status: todo | in_progress | review | done   # defaults to todo
type: optional open string (≤40)             # E15; `reference` = an external source
significance: optional number 0.0–1.0        # E15; how much this node matters (universal)
confidence: optional number 0.0–1.0          # E15; how sure (a finding) / source reliability (research-tier)
verified_at: optional ISO-8601 datetime      # E15; last DELIBERATE re-check that HELD (≠ auto updated_at)
refuted_at: optional ISO-8601 datetime       # E18.2; last deliberate re-check that FAILED
decay: optional boolean                      # E18.2; `false` = a fixed measurement, never goes stale
background-image: optional URL string (≤500 chars)   # UI-managed; see below
---
free-form markdown body
```

Three of the four E15 fields — `significance`, `confidence`, `verified_at` — plus E17's `decided_at` and E18.2's `refuted_at` / `decay`, are validated only when present and merge-protected (a body-rewriting PATCH that omits them keeps them; explicit `null` clears). `type` is validated when present but is NOT merge-protected: a body-rewriting PATCH that omits `type` drops it, so always re-state `type` (e.g. `type: reference`) when you rewrite a node's content. See [The universal schema (E15)](#the-universal-schema-e15) for the predicates and conventions.

`background-image` holds a URL into the graph's uploads (e.g.
`/api/graphs/:gid/uploads/:id`). The canvas renders it inside the node frame
(title above, image below) when present. **UI-managed key** — like
`x`/`y`/`color`, it's on the `protectedFromAgentRemoval` list in the PATCH
merge. Agents that rewrite content shouldn't include it; the server preserves
the existing value when an agent's PATCH omits it. To intentionally clear it,
send an explicit `null`. To upload bytes from a script: `POST
/api/graphs/:gid/uploads` with `Content-Type: image/*` and the raw bytes as
the body (5 MB cap by default; the self-hoster's `MULTITAP_UPLOAD_MAX_BYTES`
can change it); response is `{id, url, content_type, byte_size}`.

### Images and agent discretion — HARD RULES

Images cost the user real disk space (bytes live in their Postgres `uploads`
table), so be deliberate about when you add one. Two distinct cases:

**Setting a node's `background-image`** — the picture rendered on the canvas
itself. **Don't set this on your own initiative.** Only set it when the
user explicitly asks for that node to have a background image ("find a
chart for the revenue node and put it as the background", "use this
screenshot as the image for task T3"). A graph full of agent-chosen
background images is noise the user has to clear out; a graph where the
user picked each one is signal.

*Replacing an image that's already there* is more guarded still. When a
node already has a `background-image`, treat the existing one as the user's
deliberate choice and **never overwrite it on your own initiative** — only
replace it when the user explicitly asks you to swap that node's image
("replace the chart on T3 with this newer one"). This mirrors the UI, which
asks the user to confirm "Replace image?" before clobbering an existing
background; the agent's equivalent of that confirmation is to act only on an
explicit replace instruction. If you think a node's current image should
change but the user hasn't asked, surface it as a question rather than
overwriting — e.g. *"T3 already has a background image; want me to replace it
with the updated chart?"*

**Including images in a node's markdown body** — `![alt](url)` inside the
body, surfaced in the side panel when the user opens the node. This is
fair game when the image *materially adds* to the node's content. Use your
judgement:

- *Stock research* — a chart of revenue trends, an earnings-call slide
  with the relevant number circled, an org-chart of subsidiaries → useful,
  include. The company's logo or a generic stock-ticker icon → decorative,
  skip.
- *Concept / research map* — a diagram of the architecture being studied,
  a figure from a referenced paper → useful, include. A photo of the
  author or a generic "code on a screen" stock photo → decorative, skip.
- *Execution plan* — a screenshot of the failing test output you're about
  to fix, a Figma frame of the design being built → useful, include. A
  decorative emoji or a clip-art icon for the task type → decorative,
  skip.

The rule: would a human reviewing this graph next month thank you for the
image, or wish you hadn't bloated their database with it? If you can't
articulate why this specific image helps understanding, leave it out.

**If the user says "no images" / "don't add images" / "skip images"** —
honor that absolutely, for both `background-image` AND body images. Don't
search for them, don't upload them, don't include them via `![]()`. This
is usually a signal that the user is self-hosting or running locally and
doesn't want their Postgres footprint to grow. Even useful images stay out
when the user has said no.

When in doubt, ask: *"This node would be clearer with [the X chart from the
Q3 earnings slide] — should I include it, or are you keeping images out of
the graph?"* One line of confirmation is cheaper than an unwanted upload.

### Edge shape

```json
{
  "source_id": 1,
  "target_id": 2,
  "purpose": "required for",
  "meta": {}
}
```

`purpose` ∈ `required for | supports | contradicts | related to | supersedes` (E15, fifth value E18.4 — the field you set; required on writes). The server derives the structural `type` (`required for`→`dependency`, the rest→`related`) and emits both; a legacy `type` is no longer accepted as input. `required for` edges form a DAG; the server enforces this with a transactional cycle check on every insert/update (single + bulk). See [The universal schema (E15)](#the-universal-schema-e15).

## Setup (only if the user asks)

If the user says something like "set up Multitap" / "install the skill" / "I followed your steps but the canvas isn't updating":

1. **Skill + hooks** — run the project's installer, which copies this `SKILL.md` to `~/.claude/skills/multitap/` and merges presence-cleanup hooks (Stop + SessionStart) into `~/.claude/settings.json` with a timestamped backup:
   ```bash
   bash <(curl -fsSL https://raw.githubusercontent.com/kevinj507/multitap/main/install.sh)
   ```
   Override `CLAUDE_HOME` if their config lives somewhere other than `~/.claude`. After the script runs, tell them to **restart Claude Code** so the new hooks load.
2. **`jq`** — recipes parse JSON with it. Install via `brew install jq` (macOS), `apt install jq` (Debian/Ubuntu), or `apk add jq` (Alpine).
3. **`MULTITAP_BASE_URL`** — point at the instance they're using. Hosted users: `export MULTITAP_BASE_URL=https://context.multitap.sh`. Self-hosted: `export MULTITAP_BASE_URL=https://multitap.example.com`. Local users: leave unset; the recipes default to `http://127.0.0.1:3000`. Persist it the same way as the token in step 4 (shell rc / session env) — if it only lives in one terminal, future agent sessions silently fall back to the localhost default and probe the wrong instance. The agent uses this for both API calls AND the URL it prints to the user — so it must be reachable from the user's browser, not just the agent.
4. **`MULTITAP_AGENT_TOKEN`** (auth-enabled instances — **recommended** so the user's work is saved to their account) — tell them to sign in, click their name at the bottom of the sidebar, choose **Agents**, click Generate, copy the `gt_…` string from the panel (shown exactly once), and persist it in whichever env mechanism their setup uses (`export` in `~/.zshrc`, a project `.env`, a wafer `session.env`, etc.). The skill's token resolver reads these repo-local secrets files directly (§ identity block), so the token is picked up even in a fresh shell that never sourced them — the user doesn't have to re-`export` it every session. Without a token anywhere the agent still works anonymously, but creates orphan graphs not tied to their account — so the section 1 check surfaces the tradeoff and lets them choose; it does not hard-block.

If the user reports they can't reach Multitap at all (preflight fails even after §1's retries), don't try to start the server yourself — ask whether they're running it locally and which port, or whether they meant to point at the hosted URL. The most common false alarm is a supervised instance still booting when the session's first probe runs; the §1 retry loop absorbs that, so a failure that survives the retries is a real reachability or URL problem.

