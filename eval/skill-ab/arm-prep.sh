#!/usr/bin/env bash
# Per-arm PREP (main loop, deterministic): compose the skill version, provision the
# throwaway graphs (+degrade on screen), emit the ab-build workflow args, and leave
# the server fresh. Usage: arm-prep.sh <track> <arm> <changes> <runs> <seedBase>
#   track ∈ screen|confirm ; changes e.g. "" (baseline) or "1" or "1,2,3"
set -euo pipefail
cd /data/workspace/multitap
source .multitap/env.sh
export MULTITAP_WRITER_ID="$AGENT_ID" MULTITAP_WRITER_NAME="$AGENT_NAME" SKILLAB_THROTTLE_MS="${SKILLAB_THROTTLE_MS:-100}"
D=eval/skill-ab
TRACK="$1"; ARM="$2"; CHANGES="${3:-}"; RUNS="${4:-2}"; SEEDBASE="${5:-42}"
mkdir -p /tmp/ab/skills
node "$D/compose.js" --changes "$CHANGES" > "/tmp/ab/skills/$ARM.md"
TASK="$D/task-$TRACK.txt"
echo "arm=$ARM track=$TRACK changes=[$CHANGES] runs=$RUNS skill=$(wc -l < /tmp/ab/skills/$ARM.md)L" >&2
bash "$D/ensure-up.sh" check >&2  # db-copy is memory-free; just ensure the endpoint is up
node "$D/provision.js" --track "$TRACK" --arm "$ARM" --runs "$RUNS" --seedBase "$SEEDBASE" \
  --skillPath "/tmp/ab/skills/$ARM.md" --taskFile "$TASK" --out "/tmp/ab/$ARM.manifest.json"
bash "$D/ensure-up.sh" fresh >&2
echo "BUILDARGS=/tmp/ab/$ARM.buildargs.json"
