#!/usr/bin/env bash
# Per-arm FINISH (main loop): fold to a summary (coverage + AQ + build) and TEAR DOWN
# the throwaway copies. Usage: arm-finish.sh <arm>
#   expects /tmp/ab/<arm>.verdicts.json and (optional) /tmp/ab/<arm>.build.json present.
set -euo pipefail
cd /data/workspace/multitap
source .multitap/env.sh
export MULTITAP_WRITER_ID="$AGENT_ID" MULTITAP_WRITER_NAME="$AGENT_NAME"
D=eval/skill-ab
ARM="$1"
BUILD_ARG=""
[ -f "/tmp/ab/$ARM.build.json" ] && BUILD_ARG="--build /tmp/ab/$ARM.build.json"
node "$D/aggregate.js" --manifest "/tmp/ab/$ARM.manifest.json" --verdicts "/tmp/ab/$ARM.verdicts.json" $BUILD_ARG --out "/tmp/ab/$ARM.summary.json" >/dev/null
echo "=== summary $ARM ==="
jq '{arm, track, nRuns, coverage:(.coverage|if .==null then null else {covN10:.covN10, covN30:.covN30, precN10:.precN10, bridgeReach:.bridgeReach, relEdges:.relEdges, edgeDensity:.edgeDensity} end), aq:{strict:.aq.strict, lenient:.aq.lenient, perRunStrict:.aq.perRunStrict, breakdown:.aq.breakdown, n:.aq.n}, build:(.build|if .==null then null else {nodesAdded:.nodesAdded.mean, edgesAdded:.edgesAdded.mean, bridgeNodesAdded:.bridgeNodesAdded.mean} end)}' "/tmp/ab/$ARM.summary.json"
# teardown copies (keep summaries/manifests as the frozen record)
for g in $(jq -r '.runs[].gid' "/tmp/ab/$ARM.manifest.json"); do
  curl -sS -X DELETE "$GT_BASE/api/graphs/$g" "${WRITE_HEADERS[@]}" >/dev/null && echo "torn down $g" >&2
done
echo "DONE $ARM -> /tmp/ab/$ARM.summary.json"
