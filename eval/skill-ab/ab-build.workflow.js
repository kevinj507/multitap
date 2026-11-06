export const meta = {
  name: 'ab-build',
  description: 'E13.10 A/B fan-out: fresh-session build/enrich agents, one per run, under a fixed skill version',
  phases: [{ title: 'Build' }],
}
// args = {
//   arm: 'baseline'|'c1'|..., track:'screen'|'confirm',
//   task: <build/enrich instructions>, skillPath: <file with the composed SKILL.md (the variable under test)>,
//   runs: [{ gid, runIdx, corpusPath? }], base, writerName, builderModel
// }
const { arm, track, task, skillPath, runs, base, writerName, builderModel } = args

const BUILD_SCHEMA = {
  type: 'object',
  required: ['nodesAdded', 'edgesAdded', 'summary'],
  properties: {
    nodesAdded: { type: 'integer', description: 'how many NEW nodes you created' },
    edgesAdded: { type: 'integer', description: 'how many NEW related edges you created' },
    bridgeNodesAdded: { type: 'integer', description: 'of the new nodes, how many are intermediate "bridge" connectors between otherwise-separate topics' },
    summary: { type: 'string', description: 'one paragraph: what you changed and why' },
  },
  additionalProperties: true,
}

function buildPrompt(run) {
  const corpusLine = run.corpusPath
    ? `- The source dossier to build from is the file: ${run.corpusPath} — read it with the Read tool first.`
    : ''
  return `# Operational context (IDENTICAL across all arms — this is NOT part of the skill being tested)

You are a fresh Multitap agent session. No prior context. Your ONLY job is the task below, writing to ONE pre-existing graph.

## Where to write
- Base URL: ${base}
- The active graph ALREADY EXISTS. Its id is: ${run.gid}
- DO NOT create a new graph. DO NOT run the skill's "resolve active graph" / identity-bootstrap steps. Write ONLY to ${run.gid}.
- Your agent token is already in the environment as $MULTITAP_AGENT_TOKEN. Put these headers on EVERY write:
\`\`\`bash
WID="$(cat /proc/sys/kernel/random/uuid)"
WH=(-H 'Content-Type: application/json' -H 'X-Writer-Type: agent' -H "X-Writer-Id: $WID" -H 'X-Writer-Name: ${writerName}' -H "Authorization: Bearer $MULTITAP_AGENT_TOKEN")
# read the whole graph (structure, no bodies):  curl -s "${base}/api/graphs/${run.gid}/graph"
# read one node's body:                          curl -s "${base}/api/graphs/${run.gid}/tasks/<id>"
# add ONE related edge:                          curl -s -X POST "${base}/api/graphs/${run.gid}/edges" "\${WH[@]}" -d '{"source_id":A,"target_id":B,"type":"related"}'
# add MANY edges at once (transactional):        curl -s -X POST "${base}/api/graphs/${run.gid}/edges/bulk" "\${WH[@]}" -d '{"edges":[{"source_id":A,"target_id":B,"type":"related"}, ...]}'
# add a NEW node:                                curl -s -X POST "${base}/api/graphs/${run.gid}/tasks" "\${WH[@]}" -d '{"content":"---\\ntitle: ...\\nstatus: review\\n---\\nbody markdown"}'
# update an existing node body (OCC):            GET /tasks/<id> for .version and .content, then PATCH /tasks/<id> with {content, base_version, base_content}
\`\`\`
- Edges are undirected for traversal; \`related\` is the only edge type used here. A bulk edge insert is rejected wholesale if any edge is a duplicate or invalid — if a bulk call fails, drop the offending edge and retry.
- Work efficiently and then STOP: make your changes in a focused pass, then report. Do not poll, sleep, or wait for anything. Budget roughly 30–60 write calls.
${corpusLine}

## Your task
${task}

## Your Multitap skill (THIS is the variable under test)
Read the file ${skillPath} with the Read tool — that is your Multitap skill for this session. Follow it as written. (Ignore its bootstrap/"resolve active graph"/identity steps; the operational context above overrides those.)

When finished, return the schema: nodesAdded, edgesAdded, bridgeNodesAdded, and a one-paragraph summary of what you changed and why.`
}

phase('Build')
const results = await parallel(
  runs.map((run) => () =>
    agent(buildPrompt(run), {
      schema: BUILD_SCHEMA,
      model: builderModel || 'sonnet',
      label: `build:${arm}:r${run.runIdx}`,
      phase: 'Build',
    }).then((r) => (r ? { ...r, gid: run.gid, runIdx: run.runIdx } : null))
  )
)
return results.filter(Boolean)
