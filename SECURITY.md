# Security — supply-chain practices

This repo runs a layered defense against dependency supply-chain attacks
(malicious packages, typosquats, install-time payloads, compromised
releases). Most of it is automatic; two things every collaborator must do
once are called out below.

## What every collaborator must do

1. **Enable the pre-push gate once per clone:**

   ```bash
   git config core.hooksPath .githooks
   ```

   This wires up `.githooks/pre-push`, which audits every pinned
   dependency before a push leaves your machine (see "Pre-push gate"
   below). Git does not enable versioned hooks automatically — this is a
   git safety feature, so the one-liner is mandatory after cloning.

2. **Install with the lockfile, never ad-hoc:**

   ```bash
   npm ci            # NOT `npm install <name>` for routine installs
   ```

   `npm ci` installs exactly the audited set in `package-lock.json`. A
   bare `npm install <name>` floats a new, unaudited package into the
   tree. When you *do* need to add or bump a dependency, do it
   deliberately and re-audit (below).

## Rules

- **Lockfile-only installs.** `npm ci` (JS) / `uv sync --locked` (the
  Modal Python app, if you touch it). Bare `pip install` / `npm install
  <name>` bypasses the audited set.
- **Never hand-install lookalike "convenience" packages.** Supply-chain
  campaigns seed plausible-sounding fakes (e.g. the 2026 *Hades* wave
  seeded `openai-mcp`, `tiktoken-mcp`, `langchain-core-mcp`, which
  exfiltrate Claude/MCP config). Install only what the lockfile already
  resolves, from the canonical package name.
- **Treat unexpected agent files inside dependencies as hostile.** The
  *TrapDoor* campaign ships packages that plant malicious `CLAUDE.md` /
  `.cursorrules` / `AGENTS.md` with hidden prompt injection. If you see
  such a file appear under `node_modules`, stop and investigate.
- **Re-audit on every dependency bump.** The pre-push gate automates the
  deterministic OSV check; for any *new or unfamiliar* package, also do a
  quick web check (recent compromise? maintainer continuity? version in
  the project's real release history?).
- **No custom registries or mirrors** in npm/bun/pip config — typosquat
  campaigns love fake mirrors. Keep the default public registries.

## What's set up (automatic layers)

- **Socket for GitHub App** scans every dependency-changing pull request
  (malware, typosquats, install scripts, 70+ risk types) and reports on
  the PR. Its enforcement moment is the PR; it does not gate direct
  pushes to `main` — the pre-push gate and the CI gate cover those.
- **CI gate** (`.github/workflows/supply-chain.yml`) runs the *same*
  `.githooks/supply_chain_gate.py` on every push to `main` and every PR.
  This exists because the pre-push hook is opt-in per clone (see step 1
  above) and silently does nothing in a clone that skipped it — so the
  check that matters most is the one easiest to miss. Note the division
  of labour: the **local hook prevents** (it blocks before the push
  leaves your machine); **CI detects** (a workflow runs after the push
  has landed and can only mark it red). To make CI preventive too,
  require PRs into `main` with this check marked required.
- **Pre-push gate** (`.githooks/`, stdlib Python 3, ecosystem-aware).
  Before any push:
  - every pin in `package-lock.json` (and `requirements*.txt` / `uv.lock`
    / `bun.lock` if present) is checked against OSV.dev — a malicious
    (`MAL-*`) advisory **blocks** the push; ordinary CVEs **warn**;
  - pins *changed* relative to `origin/main` must be at least **10 days**
    old on their registry (a cooling-off window; most compromises are
    caught within days of publication).
  - Network failure fails **open** with a loud warning. Emergency skip:
    `SUPPLY_GATE_SKIP=1 git push` (use sparingly, and re-audit after).
- **Socket Firewall (`sfw`)** on developer machines wraps package
  managers so installs are filtered at download time, plus a 10-day
  cooling-off in `~/.npmrc` / `~/.bunfig.toml`. Per-machine setup — see
  the internal supply-chain setup guide.

## Reporting

Found something suspicious in a dependency, or a gate that behaves wrong?
Open an issue or contact the maintainer directly before pushing.
