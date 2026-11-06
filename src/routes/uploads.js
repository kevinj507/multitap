import { Router } from 'express';
import express from 'express';
import pool from '../db.js';

const router = Router({ mergeParams: true });

// Per-upload byte cap. Default 5 MB — generous for typical UI screenshots and
// diagrams, small enough that someone dragging a 4K phone wallpaper hits a
// clear 413. Self-hosters can override via MULTITAP_UPLOAD_MAX_BYTES (raw
// bytes); set higher if your users routinely paste large diagrams, or lower
// if you want to keep the `uploads` table small. Enforced by the body parser
// so oversize requests fail before allocating the buffer in our handler.
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const MAX_BYTES = (() => {
  const raw = process.env.MULTITAP_UPLOAD_MAX_BYTES ?? process.env.GRAPHTASK_UPLOAD_MAX_BYTES; // former name still read
  if (!raw) return DEFAULT_MAX_BYTES;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MAX_BYTES;
  return parsed;
})();

const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]);

// POST raw image bytes. Client sets Content-Type to the image MIME type.
// We trust it for routing (it never executes as code) and persist it so GET
// returns the right header. SVG is in the allowed list but served with
// X-Content-Type-Options: nosniff so a hostile SVG can't execute script
// against the app's origin.
router.post(
  '/',
  // `type: () => true` accepts any Content-Type so the route handler can do
  // the allowlist check itself with a precise 415. If we set `type: 'image/*'`
  // the parser would silently no-op for other types and the handler would
  // see an empty body — harder to debug.
  express.raw({ type: () => true, limit: MAX_BYTES }),
  async (req, res) => {
    const { gid } = req.params;
    const rawCT = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (!ALLOWED_TYPES.has(rawCT)) {
      return res.status(415).json({ error: 'unsupported image type' });
    }
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: 'empty body' });
    }
    const userId = req.user?.id ?? null;
    const result = await pool.query(
      `INSERT INTO uploads (graph_id, bytes, content_type, byte_size, created_by_user)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, content_type, byte_size, created_at`,
      [gid, req.body, rawCT, req.body.length, userId],
    );
    const row = result.rows[0];
    res.status(201).json({
      id: row.id,
      url: `/api/graphs/${gid}/uploads/${row.id}`,
      content_type: row.content_type,
      byte_size: row.byte_size,
    });
  },
);

router.get('/:id', async (req, res) => {
  const { gid, id } = req.params;
  const result = await pool.query(
    'SELECT bytes, content_type FROM uploads WHERE id = $1 AND graph_id = $2',
    [id, gid],
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
  const row = result.rows[0];
  // Opaque ID → immutable bytes. Cache forever; if the user replaces an
  // image we mint a new id (and the old row becomes a reap candidate).
  res.set('Content-Type', row.content_type);
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.set('X-Content-Type-Options', 'nosniff');
  res.send(row.bytes);
});

// Handle express.raw's "413 Payload Too Large" error so the client sees a
// JSON message instead of Express's default HTML body.
router.use((err, req, res, next) => {
  if (err && err.type === 'entity.too.large') {
    const mb = Math.round((MAX_BYTES / 1024 / 1024) * 10) / 10;
    return res.status(413).json({ error: `image must be ${mb} MB or smaller` });
  }
  return next(err);
});

export default router;
