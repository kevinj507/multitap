export const meta = {
  name: 'ab-aq',
  description: 'E13.10 blind answer-quality: mid-tier answerer over each run pack, fixed Opus judge vs entity gold',
  phases: [{ title: 'Answer' }, { title: 'Judge' }],
}
// args = {
//   arm, runs:[{runIdx, packDir}], questions:[{id, question, gold:{canonical, must_mention[]}}],
//   passes, answerModel, judgeModel
// }
const { arm, runs, questions, passes, answerModel, judgeModel } = args
const qById = new Map(questions.map((q) => [q.id, q]))

const VERDICT_SCHEMA = {
  type: 'object',
  required: ['verdict', 'insufficient', 'reason'],
  properties: {
    verdict: { type: 'string', enum: ['correct', 'partial', 'incorrect'], description: 'correct = names all the required entities and the multi-hop chain; partial = some but not all; incorrect = wrong or missing the core' },
    insufficient: { type: 'boolean', description: 'true iff the answer itself said the pack lacked the info' },
    reason: { type: 'string', description: 'one sentence' },
  },
  additionalProperties: false,
}

// one work item per (run, question, pass)
const items = []
for (const run of runs) for (const q of questions) for (let p = 1; p <= (passes || 1); p++) items.push({ run, qid: q.id, pass: p })

function answerPrompt(run, q) {
  return `Answer the question using ONLY the context pack in the file ${run.packDir}/${q.id}.txt. Read that file with the Read tool. Do NOT use any network/curl; do NOT consult anything outside that file.

Question: ${q.question}

Answer in 2–5 sentences, naming the specific entities/companies and the chain that connects them. If the pack genuinely does not contain enough to answer, reply exactly: INSUFFICIENT — <what is missing>.`
}
function judgePrompt(q, answer) {
  const g = qById.get(q.qid).gold
  return `You are a strict grader. Judge whether the ANSWER correctly resolves the question.

Question: ${qById.get(q.qid).question}

Gold (reference — the answer must capture this; the grader sees it, the answerer did NOT):
- Canonical: ${g.canonical}
- Must mention these entities/topics (by meaning, not exact string): ${g.must_mention.join('; ')}

ANSWER UNDER TEST:
${answer}

Grade:
- "correct" = the answer names (essentially all of) the must-mention entities AND gets the connecting chain right.
- "partial" = it gets the gist / some entities but misses part of the chain or some required entities.
- "incorrect" = wrong, or misses the core of the chain.
Set insufficient=true only if the answer itself said the pack lacked the info. Give a one-sentence reason.`
}

const verdicts = await pipeline(
  items,
  // stage 1: blind answer
  (it) => agent(answerPrompt(it.run, qById.get(it.qid)), {
    model: answerModel || 'sonnet', label: `ans:${arm}:r${it.run.runIdx}:${it.qid}:p${it.pass}`, phase: 'Answer',
  }),
  // stage 2: judge vs gold
  (answer, it) => agent(judgePrompt(it, answer), {
    schema: VERDICT_SCHEMA, model: judgeModel || 'opus', label: `judge:${arm}:r${it.run.runIdx}:${it.qid}:p${it.pass}`, phase: 'Judge',
  }).then((v) => (v ? { arm, runIdx: it.run.runIdx, qid: it.qid, pass: it.pass, ...v } : null))
)
return verdicts.filter(Boolean)
