#!/usr/bin/env bash
# Multitap install.sh — one-shot install for the Claude Code skill + presence hooks.
#
# What this does:
#   1. Copies SKILL.md to ~/.claude/skills/multitap/SKILL.md
#      (falls back to fetching from GitHub if not run from a cloned repo)
#   2. Copies the bundled workflows/ (e.g. research.workflow.js, which SKILL.md
#      references) to ~/.claude/skills/multitap/workflows/ — same local-then-
#      remote fallback as the skill file.
#   3. Merges two hooks into ~/.claude/settings.json:
#        - SessionStart: clears stale agent-session state on session start
#        - Stop:         departs agent presence at the end of every response
#      The skill ships with these expectations; without them, the agent's
#      avatar lingers on the canvas until the 30-minute server-side reaper
#      catches it.
#
# Safe to re-run: skill/workflow copies are overwriting (newer version wins) and
# the hook merge is idempotent (checks for the exact command string before
# adding). A timestamped backup of settings.json is written before any change.
#
# Override defaults via env:
#   CLAUDE_HOME=<path>            default: ~/.claude
#   MULTITAP_SKILL_URL=<url>     default: GitHub raw URL for SKILL.md
#   MULTITAP_WORKFLOW_URL=<url>  default: GitHub raw URL for research.workflow.js

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
LOCAL_SKILL="$SCRIPT_DIR/.claude/skills/multitap/SKILL.md"
REMOTE_SKILL="${MULTITAP_SKILL_URL:-${GRAPHTASK_SKILL_URL:-https://raw.githubusercontent.com/kevinj507/multitap/main/.claude/skills/multitap/SKILL.md}}"
LOCAL_WORKFLOWS_DIR="$SCRIPT_DIR/.claude/skills/multitap/workflows"
REMOTE_WORKFLOW="${MULTITAP_WORKFLOW_URL:-${GRAPHTASK_WORKFLOW_URL:-https://raw.githubusercontent.com/kevinj507/multitap/main/.claude/skills/multitap/workflows/research.workflow.js}}"

CLAUDE_HOME="${CLAUDE_HOME:-$HOME/.claude}"
SKILL_DIR="$CLAUDE_HOME/skills/multitap"
WORKFLOWS_DIR="$SKILL_DIR/workflows"
SETTINGS="$CLAUDE_HOME/settings.json"

# --- preflight ---
if ! command -v jq >/dev/null 2>&1; then
  cat >&2 <<EOF
error: jq is required to merge Claude Code hooks safely.
install with:
  macOS:  brew install jq
  linux:  sudo apt install jq   (or: dnf / pacman / apk)
EOF
  exit 1
fi

# --- 1. install skill file ---
mkdir -p "$SKILL_DIR"
if [ -f "$LOCAL_SKILL" ]; then
  cp "$LOCAL_SKILL" "$SKILL_DIR/SKILL.md"
  echo "✓ skill copied from $LOCAL_SKILL"
elif command -v curl >/dev/null 2>&1; then
  curl -fsSL "$REMOTE_SKILL" -o "$SKILL_DIR/SKILL.md"
  echo "✓ skill downloaded from $REMOTE_SKILL"
elif command -v wget >/dev/null 2>&1; then
  wget -q "$REMOTE_SKILL" -O "$SKILL_DIR/SKILL.md"
  echo "✓ skill downloaded from $REMOTE_SKILL"
else
  echo "error: no local SKILL.md and neither curl nor wget available" >&2
  exit 1
fi

# --- 1b. install bundled workflows ---
# SKILL.md references .claude/skills/multitap/workflows/research.workflow.js;
# ship it alongside the skill. Same local-then-remote fallback as above.
mkdir -p "$WORKFLOWS_DIR"
if [ -d "$LOCAL_WORKFLOWS_DIR" ]; then
  cp "$LOCAL_WORKFLOWS_DIR"/*.js "$WORKFLOWS_DIR"/ 2>/dev/null \
    && echo "✓ workflows copied from $LOCAL_WORKFLOWS_DIR" \
    || echo "… no workflow files found in $LOCAL_WORKFLOWS_DIR"
elif command -v curl >/dev/null 2>&1; then
  curl -fsSL "$REMOTE_WORKFLOW" -o "$WORKFLOWS_DIR/research.workflow.js"
  echo "✓ workflow downloaded from $REMOTE_WORKFLOW"
elif command -v wget >/dev/null 2>&1; then
  wget -q "$REMOTE_WORKFLOW" -O "$WORKFLOWS_DIR/research.workflow.js"
  echo "✓ workflow downloaded from $REMOTE_WORKFLOW"
else
  echo "… skipped workflows: no local dir and neither curl nor wget available" >&2
fi

# --- 2. install hooks ---
mkdir -p "$CLAUDE_HOME"
if [ ! -f "$SETTINGS" ]; then
  echo '{}' > "$SETTINGS"
  echo "✓ created $SETTINGS"
fi

BACKUP="$SETTINGS.bak.$(date +%s)"
cp "$SETTINGS" "$BACKUP"

# Hook command strings (kept verbatim so the idempotency check matches exactly)
STOP_CMD='GT_BASE="${MULTITAP_BASE_URL:-${GRAPHTASK_BASE_URL:-http://127.0.0.1:3000}}"; for d in .multitap .graphtask; do if [ -f $d/agent-session.json ] && [ -f $d/agent-session-graphs ]; then AID=$(jq -r .id $d/agent-session.json); while IFS= read -r g; do [ -n "$g" ] && curl -sS -X DELETE "$GT_BASE/api/graphs/$g/presence/$AID" -o /dev/null || true; done < $d/agent-session-graphs; : > $d/agent-session-graphs; fi; done'
START_CMD='rm -f .multitap/agent-session.json .multitap/agent-session-graphs .graphtask/agent-session.json .graphtask/agent-session-graphs'

TMP="$(mktemp)"
jq --arg stop_cmd "$STOP_CMD" --arg start_cmd "$START_CMD" '
  .hooks //= {}
  | .hooks.SessionStart //= []
  | .hooks.Stop //= []
  | (([.hooks.SessionStart[]?.hooks[]?.command] | index($start_cmd)) != null) as $has_start
  | (([.hooks.Stop[]?.hooks[]?.command]         | index($stop_cmd))  != null) as $has_stop
  | (if $has_start then . else .hooks.SessionStart += [{"matcher":"*","hooks":[{"type":"command","command":$start_cmd}]}] end)
  | (if $has_stop  then . else .hooks.Stop         += [{"matcher":"*","hooks":[{"type":"command","command":$stop_cmd }]}] end)
' "$SETTINGS" > "$TMP"

if ! diff -q "$SETTINGS" "$TMP" >/dev/null 2>&1; then
  mv "$TMP" "$SETTINGS"
  echo "✓ hooks merged into $SETTINGS"
  echo "  (backup: $BACKUP)"
else
  rm -f "$TMP" "$BACKUP"
  echo "✓ hooks already present in $SETTINGS — nothing to merge"
fi

cat <<EOF

Multitap skill installed.
  skill:     $SKILL_DIR/SKILL.md
  workflows: $WORKFLOWS_DIR/
  settings:  $SETTINGS

Next steps:
  1. Restart Claude Code so the new hooks load.
  2. Set the base URL if you're not using a local instance — and persist it
     (shell rc / settings.json env block), or future sessions fall back to
     http://127.0.0.1:3000:
       export MULTITAP_BASE_URL=https://your-multitap.example.com
  3. (If the instance has AUTH_PROVIDER=clerk) Sign in, open
     Settings → Agent tokens, mint a token, then export it:
       export MULTITAP_AGENT_TOKEN=gt_...
     The skill auto-sends it as a Bearer header so writes attribute to
     your account. No-auth deployments can skip this.
  4. In a project, prompt your agent: "Track this in Multitap" or
     "Turn this plan into a graph".

The agent's 🤖 avatar will appear on the canvas while it works and
depart automatically at the end of each turn.
EOF
