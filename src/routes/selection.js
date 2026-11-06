// /api/graphs/:gid/selection — broadcast a writer's current cytoscape
// selection / open-editor state so other viewers can render colored
// outlines + a labeled cursor for that writer.
//
// State is ephemeral (in-memory in selectionState.js, mirrors presence.js).
// Mounted under requireGraph('read') so even viewers can publish their own
// selection — this is purely visual and harmless if a viewer broadcasts.
// Writer id comes from X-Writer-Id (set by writerType middleware); without
// it we 400 the same way the presence route does.
import { Router } from 'express';
import * as selectionState from '../selectionState.js';

const router = Router({ mergeParams: true });

router.post('/', (req, res) => {
  const writerId = req.writer?.id;
  if (!writerId) return res.status(400).json({ error: 'X-Writer-Id is required' });
  const { gid } = req.params;
  // selectionState.setSelection re-sanitizes the payload (id arrays,
  // anchor shapes) and applies a per-writer rate-limit, so we don't need to
  // pre-validate beyond requiring an object body.
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  selectionState.setSelection(gid, writerId, body);
  res.status(204).end();
});

// Idempotent: 204 even if there's nothing to clear, so the browser unload
// path (sendBeacon) doesn't have to handle race conditions.
router.delete('/:writerId', (req, res) => {
  const { gid, writerId } = req.params;
  selectionState.clearSelection(gid, writerId);
  res.status(204).end();
});

router.get('/', (req, res) => {
  const { gid } = req.params;
  res.json(selectionState.getSnapshot(gid));
});

export default router;
