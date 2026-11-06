import { Router } from 'express';
import * as presence from '../presence.js';

const router = Router({ mergeParams: true });

// Announce or refresh the requester's presence on this graph. The body's
// {id, name, type} are the source of truth (the browser owns its identity);
// X-Writer-* headers are an alternative path used by the implicit-touch flow
// elsewhere and are ignored here.
router.post('/', (req, res) => {
  const { gid } = req.params;
  const { id, name, type } = req.body ?? {};
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'id is required' });
  }
  const writer = presence.announce(gid, {
    id,
    name,
    type,
    owner_user_id: req.user?.id ?? null,
  });
  if (!writer) return res.status(400).json({ error: 'invalid writer' });
  res.status(204).end();
});

// Idempotent depart. Returns 204 even if the writer wasn't present so callers
// (sendBeacon on unload, SessionEnd hook) don't have to handle race conditions.
router.delete('/:writerId', (req, res) => {
  const { gid, writerId } = req.params;
  presence.depart(gid, writerId);
  res.status(204).end();
});

router.get('/', (req, res) => {
  const { gid } = req.params;
  res.json(presence.getSnapshot(gid));
});

export default router;
