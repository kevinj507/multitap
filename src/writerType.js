// Reads writer identification headers and attaches them to the request.
// `req.writerType` stays for backward compatibility — defaults to 'human' so
// an unidentified request never silently wins as an agent (matters for
// human-wins-on-same-field conflict resolution in src/merge.js).
//
// `req.writer = {id, name, type}` is the richer shape used by presence:
//   - id: from X-Writer-Id (max 128 chars), or null if absent
//   - name: from X-Writer-Name (max 64 chars, trimmed), or null if absent
//   - type: 'agent' if X-Writer-Type === 'agent', else 'human'
//
// Missing id leaves presence opaque (no announce-on-write); writes still
// succeed and stamp last_modified_by from writerType.
const MAX_ID = 128;
const MAX_NAME = 64;

function clamp(value, max) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

export function writerType(req, _res, next) {
  const raw = req.headers['x-writer-type'];
  const type = raw === 'agent' ? 'agent' : 'human';
  req.writerType = type;
  req.writer = {
    id: clamp(req.headers['x-writer-id'], MAX_ID),
    name: clamp(req.headers['x-writer-name'], MAX_NAME),
    type,
  };
  next();
}
