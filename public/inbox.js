// The inbox and the triggers (Multitap er289bkv2zkcs5w6 #12450). The server
// holds "when to look again" — a trigger on a graph or a node — and fires it:
// a notice lands in the graph's inbox, or a JOB is proposed (re-verify a
// node, run the graph's refresh pass, check a tripwire). Nothing that costs a
// model run starts on its own: a proposed job waits here for an editor's
// okay, then runs in the background on the lab daemon and reports back. This
// module is the canvas's side of it — the words for a trigger or a job, the
// badge count, the forms' validation (pure, tested in tests/inbox.test.js)
// and the rendering of the inbox modal and the node panel's "Look again"
// section (DOM; takes a ctx so it never reaches for app.js globals).
//
// Browser: index.html hangs this on window.Inbox.

export const INBOX_NOTE =
  'Triggers the server fired. A job waits here for your okay — nothing runs a model until you approve it; ' +
  'an approved job runs in the background on the lab machine and reports back. Notices need no action.';

const KIND_WORDS = {
  time: 'on a schedule',
  event: "when the decision's grounds change",
  condition: 'a tripwire, checked on a schedule',
};

const ACTION_WORDS = {
  notify: 'tell me',
  recheck: 're-verify the node',
  refresh: 'run the refresh pass',
  check: 'check the condition',
};

export function kindWords(kind) {
  return KIND_WORDS[kind] || String(kind || '');
}

export function actionWords(action) {
  return ACTION_WORDS[action] || String(action || '');
}

// badgeCount is what the sidebar pill shows: what needs a person.
export function badgeCount(counts) {
  if (!counts || typeof counts !== 'object') return 0;
  const n = (k) => (typeof counts[k] === 'number' && Number.isFinite(counts[k]) ? counts[k] : 0);
  return n('proposed_jobs') + n('unseen_notices');
}

// scheduleWords: "every 30 days", "once, on 2026-12-01", or "" for an event trigger.
export function scheduleWords(t) {
  if (!t) return '';
  if (t.kind === 'event') return '';
  if (t.every_days) return `every ${t.every_days} day${t.every_days === 1 ? '' : 's'}`;
  if (t.at) return `once, on ${dayOf(t.at)}`;
  return '';
}

function dayOf(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toISOString().slice(0, 10);
}

function stamp(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, 'Z');
}

// describeTrigger: one line a person can read — "Re-verify "A claim" — re-verify
// the node, every 30 days; next 2026-12-18; last fired 2026-11-18 (proposed)".
export function describeTrigger(t) {
  if (!t) return '';
  const parts = [`${actionWords(t.action)}, ${t.kind === 'event' ? kindWords('event') : scheduleWords(t) || kindWords(t.kind)}`];
  if (t.enabled === false) parts.push('paused');
  else if (t.due) parts.push('due now');
  else if (t.next_due_at) parts.push(`next ${dayOf(t.next_due_at)}`);
  if (t.last_fired_at) parts.push(`last fired ${dayOf(t.last_fired_at)}${t.last_outcome ? ` (${t.last_outcome})` : ''}`);
  return parts.join('; ');
}

// describeJob: the job's state in words.
export function describeJob(j) {
  if (!j) return '';
  switch (j.status) {
    case 'proposed':
      return `waiting for your okay since ${stamp(j.proposed_at)}`;
    case 'approved':
      return `approved${j.decided_by ? ` by ${j.decided_by}` : ''}, waiting for the lab machine`;
    case 'running':
      return `running since ${stamp(j.started_at)}`;
    case 'done':
      return `done${j.outcome ? ` — ${j.outcome}` : ''}${j.finished_at ? `, ${stamp(j.finished_at)}` : ''}`;
    case 'failed':
      return `failed${j.finished_at ? ` at ${stamp(j.finished_at)}` : ''}`;
    case 'dismissed':
      return `dismissed${j.decided_by ? ` by ${j.decided_by}` : ''}`;
    default:
      return String(j.status || '');
  }
}

// validateTriggerBody mirrors the server's rules so the form can say what
// is wrong before the request; the server stays the authority.
export function validateTriggerBody(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'nothing to add' };
  const { kind, action, every_days, at, prompt, node_id } = body;
  if (!['time', 'event', 'condition'].includes(kind)) return { ok: false, error: 'pick when it fires' };
  if (!['notify', 'recheck', 'refresh', 'check'].includes(action)) return { ok: false, error: 'pick what it does' };
  if (every_days != null && !(Number.isInteger(every_days) && every_days >= 1 && every_days <= 3650)) return { ok: false, error: 'days must be a whole number from 1 to 3650' };
  if (kind === 'condition' && !(typeof prompt === 'string' && prompt.trim())) return { ok: false, error: 'say the condition, in words' };
  if (kind === 'condition' && !(every_days >= 1)) return { ok: false, error: 'say how often to check' };
  if (action === 'refresh' && !(typeof prompt === 'string' && prompt.trim())) return { ok: false, error: 'say what the refresh should check' };
  if ((kind === 'event' || action === 'recheck') && node_id == null) return { ok: false, error: 'this kind of trigger belongs on a node' };
  if (kind === 'time' && !(every_days >= 1) && !at) return { ok: false, error: 'say every how many days, or a date' };
  return { ok: true };
}

// presetToBody turns the panel's preset into a request body.
//   recheck:   { preset: 'recheck', days }
//   remind:    { preset: 'remind', date }           (notify, once)
//   grounds:   { preset: 'grounds' }                (event, notify; decisions only)
//   tripwire:  { preset: 'tripwire', days, condition }
export function presetToBody(nodeId, p) {
  if (!p) return null;
  const days = p.days != null && p.days !== '' ? Number(p.days) : undefined;
  switch (p.preset) {
    case 'recheck':
      return { node_id: nodeId, kind: 'time', action: 'recheck', every_days: days };
    case 'remind':
      return { node_id: nodeId, kind: 'time', action: 'notify', at: p.date ? `${p.date}T09:00:00Z` : undefined, title: p.title || undefined };
    case 'grounds':
      return { node_id: nodeId, kind: 'event', action: 'notify' };
    case 'tripwire':
      return { node_id: nodeId, kind: 'condition', action: 'check', every_days: days, prompt: p.condition };
    default:
      return null;
  }
}

// ---- DOM ------------------------------------------------------------------------

function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of Array.isArray(children) ? children : [children]) {
    if (c == null) continue;
    n.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return n;
}

async function call(ctx, method, path, body) {
  const init = { method, headers: ctx.writeHeaders() };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await ctx.authedFetch(`${ctx.apiBase()}${path}`, init);
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || `status ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

async function read(ctx, path) {
  const res = await ctx.authedFetch(`${ctx.apiBase()}${path}`, { headers: ctx.writeHeaders() });
  if (!res.ok) throw new Error(`status ${res.status}`);
  return res.json();
}

// fetchInbox: the badge's counts.
export async function fetchInbox(ctx) {
  return read(ctx, '/inbox');
}

function section(title, hint, rows) {
  const s = el('section', { class: 'inbox-section' }, [
    el('h4', { text: title }),
    hint ? el('p', { class: 'inbox-hint', text: hint }) : null,
  ]);
  if (!rows.length) s.append(el('p', { class: 'inbox-empty', text: 'Nothing here.' }));
  for (const r of rows) s.append(r);
  return s;
}

function jobRow(ctx, j, onChanged) {
  const actions = el('div', { class: 'inbox-row-actions' });
  const busy = (b) => { for (const btn of actions.querySelectorAll('button')) btn.disabled = b; };
  const act = (verb, label) => el('button', {
    type: 'button', class: `coord-action inbox-${verb}`, text: label,
    onclick: async () => {
      busy(true);
      try {
        await call(ctx, 'POST', `/jobs/${j.id}/${verb}`, verb === 'dismiss' ? { note: 'dismissed from the inbox' } : undefined);
        ctx.showHint(verb === 'approve' ? 'Approved — it runs on the lab machine and reports back here.' : 'Dismissed.');
        onChanged();
      } catch (err) {
        ctx.showHint(`Could not ${verb}: ${err.message}`);
        busy(false);
      }
    },
  });
  if (ctx.canEdit()) {
    if (j.status === 'proposed') { actions.append(act('approve', 'Approve'), act('dismiss', 'Dismiss')); }
    if (j.status === 'approved') { actions.append(act('dismiss', 'Dismiss')); }
  }
  const details = el('details', { class: 'inbox-details' }, [
    el('summary', { text: 'What the agent will be asked to do' }),
    el('pre', { text: j.prompt || '' }),
  ]);
  const body = [];
  if (j.summary) body.push(el('p', { class: 'inbox-body', text: j.summary }));
  if (j.error) body.push(el('p', { class: 'inbox-body inbox-error', text: j.error }));
  if (j.report_node_id) {
    // The one node-link shape: the standalone node page, in a new tab, so
    // the inbox stays where it is.
    body.push(el('p', { class: 'inbox-body' }, [
      'Report: ',
      el('a', { href: ctx.nodeLink(j.report_node_id), target: '_blank', rel: 'noopener noreferrer', text: `node #${j.report_node_id}` }),
    ]));
  }
  if (j.evidence) body.push(el('p', { class: 'inbox-meta', text: `Evidence on the lab machine: ${j.evidence}` }));
  return el('div', { class: `inbox-row inbox-job inbox-job-${j.status}` }, [
    el('div', { class: 'inbox-row-head' }, [
      el('span', { class: 'inbox-title', text: j.title || `Job #${j.id}` }),
      el('span', { class: 'inbox-meta', text: `#${j.id} · ${actionWords(j.action)} · ${j.model || ''}` }),
    ]),
    el('p', { class: 'inbox-state', text: describeJob(j) }),
    ...body,
    details,
    actions,
  ]);
}

function noticeRow(n) {
  return el('div', { class: 'inbox-row inbox-notice' }, [
    el('div', { class: 'inbox-row-head' }, [
      el('span', { class: 'inbox-title', text: n.title || n.kind }),
      el('span', { class: 'inbox-meta', text: stamp(n.fired_at) }),
    ]),
    n.body ? el('p', { class: 'inbox-body', text: n.body }) : null,
    n.node_id ? el('p', { class: 'inbox-meta', text: `Node #${n.node_id}` }) : null,
  ]);
}

function triggerRow(ctx, t, onChanged) {
  const actions = el('div', { class: 'inbox-row-actions' });
  const busy = (b) => { for (const btn of actions.querySelectorAll('button')) btn.disabled = b; };
  const doCall = async (method, path, body, said) => {
    busy(true);
    try {
      await call(ctx, method, path, body);
      if (said) ctx.showHint(said);
      onChanged();
    } catch (err) {
      ctx.showHint(`Could not change the trigger: ${err.message}`);
      busy(false);
    }
  };
  if (ctx.canEdit()) {
    actions.append(
      el('button', { type: 'button', class: 'coord-action', text: t.enabled === false ? 'Resume' : 'Pause',
        onclick: () => doCall('PATCH', `/triggers/${t.id}`, { enabled: t.enabled === false }) }),
      el('button', { type: 'button', class: 'coord-action', text: 'Look now', title: 'Fire it now; a job still waits for your okay',
        onclick: () => doCall('POST', `/triggers/${t.id}/fire`, undefined, 'Fired.') }),
    );
    if (t.source !== 'graph_refreshes') {
      actions.append(el('button', { type: 'button', class: 'coord-action inbox-danger', text: 'Remove',
        onclick: () => doCall('DELETE', `/triggers/${t.id}`, undefined, 'Removed.') }));
    }
  }
  return el('div', { class: `inbox-row inbox-trigger${t.enabled === false ? ' inbox-paused' : ''}` }, [
    el('div', { class: 'inbox-row-head' }, [
      el('span', { class: 'inbox-title', text: t.title }),
      el('span', { class: 'inbox-meta', text: `#${t.id}${t.node_id ? ` · node #${t.node_id}` : ' · whole graph'}` }),
    ]),
    el('p', { class: 'inbox-state', text: describeTrigger(t) }),
    t.prompt ? el('p', { class: 'inbox-body', text: t.prompt }) : null,
    actions,
  ]);
}

// graphTriggerForm: add a graph-level trigger (a refresh schedule or a
// tripwire on the whole graph, or a reminder).
function graphTriggerForm(ctx, onChanged) {
  const kindSel = el('select', { class: 'inbox-input' }, [
    el('option', { value: 'refresh', text: 'Run the refresh pass every N days' }),
    el('option', { value: 'tripwire', text: 'Tripwire: check a condition every N days' }),
    el('option', { value: 'remind', text: 'Remind me once, on a date' }),
  ]);
  const days = el('input', { class: 'inbox-input inbox-days', type: 'number', min: '1', max: '3650', value: '30', 'aria-label': 'Every how many days' });
  const date = el('input', { class: 'inbox-input hidden', type: 'date', 'aria-label': 'On which date' });
  const prompt = el('textarea', { class: 'inbox-input inbox-prompt', rows: '3', placeholder: 'What should the refresh check? (in your words)' });
  const title = el('input', { class: 'inbox-input hidden', type: 'text', maxlength: '300', placeholder: 'What to remind you of' });
  const err = el('p', { class: 'modal-error hidden' });
  const paint = () => {
    const k = kindSel.value;
    days.classList.toggle('hidden', k === 'remind');
    date.classList.toggle('hidden', k !== 'remind');
    prompt.classList.toggle('hidden', k === 'remind');
    title.classList.toggle('hidden', k !== 'remind');
    prompt.placeholder = k === 'tripwire' ? 'The condition, in your words — e.g. "a cheaper source for X appears"' : 'What should the refresh check? (in your words)';
  };
  kindSel.addEventListener('change', paint);
  paint();
  const add = el('button', { type: 'button', class: 'coord-action', text: 'Add trigger', onclick: async () => {
    err.classList.add('hidden');
    const k = kindSel.value;
    const d = days.value ? Number(days.value) : undefined;
    let body;
    if (k === 'refresh') body = { kind: 'time', action: 'refresh', every_days: d, prompt: prompt.value.trim() || undefined };
    else if (k === 'tripwire') body = { kind: 'condition', action: 'check', every_days: d, prompt: prompt.value.trim() || undefined };
    else body = { kind: 'time', action: 'notify', at: date.value ? `${date.value}T09:00:00Z` : undefined, title: title.value.trim() || undefined };
    const v = validateTriggerBody(body);
    if (!v.ok) { err.textContent = v.error; err.classList.remove('hidden'); return; }
    add.disabled = true;
    try {
      await call(ctx, 'POST', '/triggers', body);
      ctx.showHint('Trigger added.');
      onChanged();
    } catch (e) {
      err.textContent = e.message; err.classList.remove('hidden'); add.disabled = false;
    }
  } });
  return el('div', { class: 'inbox-form' }, [kindSel, days, date, title, prompt, err, add]);
}

// renderInbox fills the modal's body for the active graph.
export async function renderInbox(ctx, host) {
  host.replaceChildren(el('p', { class: 'inbox-hint', text: 'Loading…' }));
  let jobs, notices, triggers;
  try {
    [jobs, notices, triggers] = await Promise.all([read(ctx, '/jobs'), read(ctx, '/notices?limit=50'), read(ctx, '/triggers')]);
  } catch (err) {
    host.replaceChildren(el('p', { class: 'modal-error', text: `Could not load the inbox: ${err.message}` }));
    return;
  }
  const again = () => renderInbox(ctx, host).then(() => ctx.onChanged && ctx.onChanged());
  const proposed = jobs.filter((j) => j.status === 'proposed');
  const active = jobs.filter((j) => j.status === 'approved' || j.status === 'running');
  const recent = jobs.filter((j) => ['done', 'failed', 'dismissed'].includes(j.status)).slice(0, 10);
  const unseen = notices.filter((n) => !n.seen_at);
  const seenBtn = unseen.length && ctx.canEdit()
    ? el('button', { type: 'button', class: 'coord-action', text: 'Mark all seen', onclick: async () => {
      try { await call(ctx, 'POST', '/notices/seen', {}); again(); } catch (err) { ctx.showHint(`Could not mark seen: ${err.message}`); }
    } })
    : null;
  host.replaceChildren(
    el('p', { class: 'inbox-note', text: INBOX_NOTE }),
    section('Waiting for your okay', proposed.length ? 'Each is a model run on your plan. Approve to run it in the background; dismiss to say not this time.' : '', proposed.map((j) => jobRow(ctx, j, again))),
    section('Under way', '', active.map((j) => jobRow(ctx, j, again))),
    section('Notices', '', [seenBtn, ...unseen.map(noticeRow), ...(unseen.length ? [] : notices.slice(0, 5).map(noticeRow))].filter(Boolean)),
    section('Recent jobs', '', recent.map((j) => jobRow(ctx, j, again))),
    section('Triggers on this graph', 'When to look again. Node triggers are added from the node itself.', [
      ...triggers.map((t) => triggerRow(ctx, t, again)),
      ctx.canEdit() ? graphTriggerForm(ctx, again) : null,
    ].filter(Boolean)),
  );
}

// renderNodeTriggers fills the panel's "Look again" section for one node.
export async function renderNodeTriggers(ctx, host, node) {
  if (!node || node.id == null) { host.classList.add('hidden'); return; }
  const list = host.querySelector('.triggers-list');
  const form = host.querySelector('.triggers-form');
  if (!list || !form) return;
  host.classList.remove('hidden');
  let triggers = [];
  try { triggers = await read(ctx, `/triggers?node=${node.id}`); } catch { triggers = []; }
  const again = () => renderNodeTriggers(ctx, host, node).then(() => ctx.onChanged && ctx.onChanged());
  list.replaceChildren(...(triggers.length ? triggers.map((t) => triggerRow(ctx, t, again)) : [el('p', { class: 'inbox-empty', text: 'No triggers on this node.' })]));
  form.replaceChildren();
  if (!ctx.canEdit()) return;
  const isDecision = node.type === 'decision';
  const preset = el('select', { class: 'inbox-input' }, [
    el('option', { value: 'recheck', text: 'Re-verify this node every N days' }),
    el('option', { value: 'remind', text: 'Remind me about it once, on a date' }),
    isDecision ? el('option', { value: 'grounds', text: 'Tell me when its grounds change' }) : null,
    el('option', { value: 'tripwire', text: 'Tripwire: check a condition every N days' }),
  ].filter(Boolean));
  const days = el('input', { class: 'inbox-input inbox-days', type: 'number', min: '1', max: '3650', value: '30', 'aria-label': 'Every how many days' });
  const date = el('input', { class: 'inbox-input hidden', type: 'date', 'aria-label': 'On which date' });
  const condition = el('textarea', { class: 'inbox-input inbox-prompt hidden', rows: '2', placeholder: 'The condition, in your words' });
  const err = el('p', { class: 'modal-error hidden' });
  const paint = () => {
    const p = preset.value;
    days.classList.toggle('hidden', p === 'remind' || p === 'grounds');
    date.classList.toggle('hidden', p !== 'remind');
    condition.classList.toggle('hidden', p !== 'tripwire');
  };
  preset.addEventListener('change', paint);
  paint();
  const add = el('button', { type: 'button', class: 'coord-action', text: 'Add', onclick: async () => {
    err.classList.add('hidden');
    const body = presetToBody(node.id, { preset: preset.value, days: days.value, date: date.value, condition: condition.value.trim() });
    const v = validateTriggerBody(body || {});
    if (!v.ok) { err.textContent = v.error; err.classList.remove('hidden'); return; }
    add.disabled = true;
    try {
      await call(ctx, 'POST', '/triggers', body);
      ctx.showHint('Trigger added.');
      again();
    } catch (e) {
      err.textContent = e.message; err.classList.remove('hidden'); add.disabled = false;
    }
  } });
  form.append(preset, days, date, condition, err, add);
}
