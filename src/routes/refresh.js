// Per-graph scheduled refresh (node 3834) — /api/graphs/:gid/refresh.
//
// The primitive is a SCHEDULE plus a PURPOSE PROMPT: "every N days, re-check
// this graph with this intent" — covering both stale-knowledge re-verification
// and re-questioning whether the graph's targets still make sense. The server
// stores config and derives due-ness; EXECUTION stays harness-side (a cron
// session polls GET /api/refreshes/due, works /frontier + /decisions/at-risk
// + the purpose prompt, lands everything at review, then POSTs /complete).
//
// Mounted with requireGraphForMethod: GET = read, PUT/POST/DELETE = edit.
// Writes here touch ONLY graph_refreshes — never the graph itself (no version
// bump, no SSE) — mirroring the reports isolation rule.
import { Router } from 'express';
import pool from '../db.js';

const router = Router({ mergeParams: true });

const MAX_PURPOSE = 2000;
const MAX_SUMMARY = 4000;
const MAX_RUN_ID = 200;

// due-ness is derived in SQL so every reader agrees on the clock.
const DUE_EXPR = `(enabled AND (last_run_at IS NULL
  OR last_run_at < NOW() - make_interval(days => interval_days)))`;

router.get('/', async (req, res) => {
  const { gid } = req.params;
  res.set('Cache-Control', 'no-store');
  const r = await pool.query(
    `SELECT *, ${DUE_EXPR} AS due FROM graph_refreshes WHERE graph_id = $1`,
    [gid],
  );
  if (r.rows.length === 0) return res.status(404).json({ error: 'no refresh schedule' });
  res.json(r.rows[0]);
});

router.put('/', async (req, res) => {
  const { gid } = req.params;
  const body = req.body || {};
  const interval = Number(body.interval_days);
  if (!Number.isInteger(interval) || interval < 1 || interval > 365) {
    return res.status(400).json({ error: 'interval_days must be an integer between 1 and 365' });
  }
  const purpose = typeof body.purpose === 'string' ? body.purpose.trim() : '';
  if (!purpose) return res.status(400).json({ error: 'purpose is required — what should the refresh run check?' });
  if (purpose.length > MAX_PURPOSE) {
    return res.status(400).json({ error: `purpose must be ${MAX_PURPOSE} characters or fewer` });
  }
  const enabled = body.enabled === undefined ? true : body.enabled === true;
  try {
    const r = await pool.query(
      `INSERT INTO graph_refreshes (graph_id, interval_days, purpose, enabled)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (graph_id) DO UPDATE
         SET interval_days = EXCLUDED.interval_days,
             purpose = EXCLUDED.purpose,
             enabled = EXCLUDED.enabled,
             updated_at = NOW()
       RETURNING *, ${DUE_EXPR} AS due`,
      [gid, interval, purpose, enabled],
    );
    res.json(r.rows[0]);
  } catch (e) {
    if (e.code === '23503') return res.status(404).json({ error: 'graph not found' });
    throw e;
  }
});

router.delete('/', async (req, res) => {
  const { gid } = req.params;
  const r = await pool.query('DELETE FROM graph_refreshes WHERE graph_id = $1 RETURNING graph_id', [gid]);
  if (r.rows.length === 0) return res.status(404).json({ error: 'no refresh schedule' });
  res.json({ deleted: true });
});

// The executor's "I ran it" stamp. Deliberately NOT auto-fired by any write —
// only an explicit complete moves last_run_at, so a half-finished run that
// died mid-checklist stays due and the next poll picks it up again.
router.post('/complete', async (req, res) => {
  const { gid } = req.params;
  const body = req.body || {};
  const summary = typeof body.summary === 'string' ? body.summary.trim().slice(0, MAX_SUMMARY) : null;
  const runId = typeof body.run_id === 'string' ? body.run_id.trim().slice(0, MAX_RUN_ID) : null;
  const r = await pool.query(
    `UPDATE graph_refreshes
        SET last_run_at = NOW(),
            last_run_summary = $2,
            last_run_id = $3,
            last_run_kind = 'run',
            updated_at = NOW()
      WHERE graph_id = $1
      RETURNING *, ${DUE_EXPR} AS due`,
    [gid, summary || null, runId || null],
  );
  if (r.rows.length === 0) return res.status(404).json({ error: 'no refresh schedule' });
  res.json(r.rows[0]);
});

// "Not this cycle" (owner decision 2026-08-08): silences the due flag until
// the next interval WITHOUT claiming a refresh ran — last_run_kind records
// the difference, so "when did this graph last actually get checked?" stays
// answerable. Same clock, honest label.
router.post('/dismiss', async (req, res) => {
  const { gid } = req.params;
  const body = req.body || {};
  const note = typeof body.note === 'string' && body.note.trim()
    ? body.note.trim().slice(0, MAX_SUMMARY)
    : '(dismissed — no refresh ran this cycle)';
  const r = await pool.query(
    `UPDATE graph_refreshes
        SET last_run_at = NOW(),
            last_run_summary = $2,
            last_run_id = NULL,
            last_run_kind = 'dismissed',
            updated_at = NOW()
      WHERE graph_id = $1
      RETURNING *, ${DUE_EXPR} AS due`,
    [gid, note],
  );
  if (r.rows.length === 0) return res.status(404).json({ error: 'no refresh schedule' });
  res.json(r.rows[0]);
});

export default router;
