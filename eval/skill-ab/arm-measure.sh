#!/usr/bin/env bash
# Per-arm MEASURE (main loop, deterministic): save the build-workflow result, reset
# the server (build re-indexing grows its RSS), score coverage + render AQ packs,
# emit the ab-aq workflow args. Usage: arm-measure.sh <arm> <qids-comma> [buildResultFile]
set -euo pipefail
cd /data/workspace/multitap
source .multitap/env.sh
export MULTITAP_WRITER_ID="$AGENT_ID" MULTITAP_WRITER_NAME="$AGENT_NAME" SKILLAB_THROTTLE_MS="${SKILLAB_THROTTLE_MS:-120}"
D=eval/skill-ab
ARM="$1"; QIDS="${2:-}"
bash "$D/ensure-up.sh" fresh >&2
node "$D/measure.js" --manifest "/tmp/ab/$ARM.manifest.json" --maxNodes 10 --qids "$QIDS"
echo "AQARGS=/tmp/ab/$ARM.aqargs.json"
