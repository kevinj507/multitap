import YAML from 'yaml';

const FENCE = '---';

export function parseMarkdown(text) {
  if (!text || !text.startsWith(FENCE + '\n')) {
    return { meta: {}, body: text || '', frontmatterError: null };
  }

  const end = text.indexOf('\n' + FENCE, FENCE.length);
  if (end === -1) {
    return { meta: {}, body: text, frontmatterError: null };
  }

  const yamlStr = text.slice(FENCE.length + 1, end);
  const body = text.slice(end + FENCE.length + 2); // skip \n---\n

  // `frontmatterError` distinguishes "the YAML failed to parse" (e.g. an
  // unquoted colon in a title) from "valid YAML that simply has no title".
  // Without it both collapse to the misleading "title is required" — callers
  // can surface the real cause instead.
  let meta;
  let frontmatterError = null;
  try {
    meta = YAML.parse(yamlStr) || {};
  } catch (e) {
    meta = {};
    frontmatterError = e.message;
  }

  return { meta, body, frontmatterError };
}

export function serializeMarkdown(meta, body) {
  const yamlStr = YAML.stringify(meta).trimEnd();
  const parts = [FENCE, yamlStr, FENCE];
  if (body) {
    parts.push(body);
  } else {
    parts.push('');
  }
  return parts.join('\n');
}

const VALID_STATUSES = ['todo', 'in_progress', 'review', 'done'];

// E15.A2 — node `type` (open string) classification cap. Empty/absent means a
// plain work/knowledge node; the server-recognized special values are
// `reference` (an external citation) and `decision` (E17 — a committed choice
// whose staleness /decisions/at-risk computes from its grounds), but the field
// is intentionally open.
const NODE_TYPE_MAX = 40;

// Accept ISO-8601 date or date-time — the form the skill documents for
// `verified_at`: a YYYY-MM-DD prefix, optional time and zone. The trailing
// Date.parse guard rejects impossible calendar dates (e.g. 2026-13-45) that
// still match the shape, while the regex rejects free text ("tomorrow",
// "not-a-date") and bare numbers that Date.parse would otherwise coerce.
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;
export function isIsoDatetime(v) {
  if (v instanceof Date) return !Number.isNaN(v.getTime());
  if (typeof v !== 'string') return false;
  if (!ISO_DATETIME_RE.test(v)) return false;
  return !Number.isNaN(new Date(v).getTime());
}

export function validateMeta(meta) {
  if (!meta.title || typeof meta.title !== 'string' || meta.title.trim() === '') {
    return 'title is required';
  }
  if (typeof meta.title === 'string' && meta.title.length > 100) {
    return 'title must be 100 characters or less';
  }
  if (meta.description !== undefined && typeof meta.description === 'string' && meta.description.length > 200) {
    return 'description must be 200 characters or less';
  }
  if (meta.status && !VALID_STATUSES.includes(meta.status)) {
    return 'status must be todo, in_progress, review, or done';
  }
  // background-image is an optional URL string. Capped at 500 chars so the
  // frontmatter stays scannable — the bytes themselves live in the uploads
  // table, not in this string.
  const bg = meta['background-image'];
  if (bg !== undefined && bg !== null && bg !== '') {
    if (typeof bg !== 'string') {
      return 'background-image must be a string';
    }
    if (bg.length > 500) {
      return 'background-image must be 500 characters or less';
    }
  }
  // E15.A2 — reserved typed node fields. All optional; validated only WHEN
  // PRESENT (none is required). An explicit `null` is allowed through as the
  // clear / escape-hatch signal: mergeFields treats a defined null as "clear
  // this protected key", so validation must not reject it.
  for (const key of ['significance', 'confidence']) {
    const v = meta[key];
    if (v !== undefined && v !== null) {
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1) {
        return `${key} must be a number between 0.0 and 1.0`;
      }
    }
  }
  if (meta.verified_at !== undefined && meta.verified_at !== null) {
    if (!isIsoDatetime(meta.verified_at)) {
      return 'verified_at must be an ISO-8601 datetime';
    }
  }
  // E18.2 — `refuted_at`: when a deliberate re-check FAILED. Same shape rules
  // as verified_at, same explicit-null clear. It exists because a failure is
  // not expressible as a verified_at assignment: clearing verified_at on a
  // never-verified claim moves nothing, so the trigger would produce ch = '{}'
  // and the log would record the failure nowhere.
  if (meta.refuted_at !== undefined && meta.refuted_at !== null) {
    if (!isIsoDatetime(meta.refuted_at)) {
      return 'refuted_at must be an ISO-8601 datetime';
    }
  }
  // E18.2 — `decay`: the per-node opt-OUT from verification decay. Absent or
  // true means "this node's verification goes stale" (the default for every
  // node in the corpus); `false` pins retrievability at 1, which is how a
  // fixed MEASUREMENT — an extracted constant, a quoted spec value, a
  // definition, a contract clause — says it does not rot. Boolean only, and
  // only validated when present.
  if (meta.decay !== undefined && meta.decay !== null) {
    if (typeof meta.decay !== 'boolean') {
      return 'decay must be true or false';
    }
  }
  // E17 — `decided_at`: when a human committed a `type: decision` node. Same
  // shape rules as verified_at; /decisions/at-risk compares each ground's
  // updated_at against it (falling back to the decision's created_at).
  if (meta.decided_at !== undefined && meta.decided_at !== null) {
    if (!isIsoDatetime(meta.decided_at)) {
      return 'decided_at must be an ISO-8601 datetime';
    }
  }
  if (meta.type !== undefined && meta.type !== null) {
    if (typeof meta.type !== 'string') {
      return 'type must be a string';
    }
    if (meta.type.length > NODE_TYPE_MAX) {
      return `type must be ${NODE_TYPE_MAX} characters or less`;
    }
  }
  return null;
}

export function applyDefaults(meta) {
  const result = { ...meta };
  // YAML parses unquoted scalars by type (e.g. "1" → number, "2026-04-26" →
  // Date). User-facing text fields must be strings for validation and storage.
  if (result.title !== undefined && result.title !== null) {
    result.title = String(result.title);
  }
  if (result.description !== undefined && result.description !== null) {
    result.description = String(result.description);
  }
  if (result['background-image'] !== undefined && result['background-image'] !== null) {
    result['background-image'] = String(result['background-image']);
  }
  // E15.A2 reserved fields. `type` is coerced to a string for consistency with
  // the text fields above. `verified_at` is normalized to a canonical ISO
  // string IF the YAML layer handed back a Date object (this build's yaml
  // config returns strings, but normalize defensively so storage stays
  // canonical). significance/confidence stay numbers — left untouched. `null`
  // is preserved on all of them (the explicit clear/escape-hatch must survive
  // to mergeFields).
  if (result.type !== undefined && result.type !== null) {
    result.type = String(result.type);
  }
  if (result.verified_at instanceof Date) {
    result.verified_at = result.verified_at.toISOString();
  }
  if (result.decided_at instanceof Date) {
    result.decided_at = result.decided_at.toISOString();
  }
  if (result.refuted_at instanceof Date) {
    result.refuted_at = result.refuted_at.toISOString();
  }
  result.status = result.status || 'todo';
  return result;
}
