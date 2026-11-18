// The inbox and the triggers (Multitap #12450) — the pure half of
// public/inbox.js: the words for a trigger or a job, the badge count, the
// forms' validation and the panel presets.
import { describe, it, expect } from 'vitest';
import {
  badgeCount, describeTrigger, describeJob, validateTriggerBody, presetToBody, scheduleWords, actionWords, kindWords, INBOX_NOTE,
} from '../public/inbox.js';

describe('badgeCount', () => {
  it('counts what needs a person: proposed jobs and unseen notices', () => {
    expect(badgeCount({ proposed_jobs: 2, unseen_notices: 3, running_jobs: 5, due_triggers: 7 })).toBe(5);
    expect(badgeCount({})).toBe(0);
    expect(badgeCount(null)).toBe(0);
    expect(badgeCount({ proposed_jobs: 'x', unseen_notices: 1 })).toBe(1);
  });
});

describe('describeTrigger', () => {
  it('a repeating recheck, due now', () => {
    expect(describeTrigger({ kind: 'time', action: 'recheck', every_days: 30, enabled: true, due: true }))
      .toBe('re-verify the node, every 30 days; due now');
  });
  it('a one-shot reminder with a next date and a last firing', () => {
    expect(describeTrigger({ kind: 'time', action: 'notify', at: '2026-12-01T09:00:00Z', next_due_at: '2026-12-01T09:00:00Z', last_fired_at: '2026-11-01T09:00:00Z', last_outcome: 'noticed', enabled: true }))
      .toBe('tell me, once, on 2026-12-01; next 2026-12-01; last fired 2026-11-01 (noticed)');
  });
  it('an event trigger has no schedule; a paused one says so', () => {
    expect(describeTrigger({ kind: 'event', action: 'notify', enabled: true })).toBe("tell me, when the decision's grounds change");
    expect(describeTrigger({ kind: 'condition', action: 'check', every_days: 1, enabled: false })).toBe('check the condition, every 1 day; paused');
  });
  it('words', () => {
    expect(scheduleWords({ kind: 'time', every_days: 7 })).toBe('every 7 days');
    expect(actionWords('refresh')).toBe('run the refresh pass');
    expect(kindWords('condition')).toBe('a tripwire, checked on a schedule');
    expect(INBOX_NOTE).toMatch(/nothing runs a model until you approve it/);
  });
});

describe('describeJob', () => {
  it('each state in words', () => {
    expect(describeJob({ status: 'proposed', proposed_at: '2026-11-18T22:00:00.123Z' })).toBe('waiting for your okay since 2026-11-18 22:00:00Z');
    expect(describeJob({ status: 'approved', decided_by: 'Kevin' })).toBe('approved by Kevin, waiting for the lab machine');
    expect(describeJob({ status: 'running', started_at: '2026-11-18T22:05:00Z' })).toBe('running since 2026-11-18 22:05:00Z');
    expect(describeJob({ status: 'done', outcome: 'held', finished_at: '2026-11-18T22:09:00Z' })).toBe('done — held, 2026-11-18 22:09:00Z');
    expect(describeJob({ status: 'failed', finished_at: '2026-11-18T22:09:00Z' })).toBe('failed at 2026-11-18 22:09:00Z');
    expect(describeJob({ status: 'dismissed', decided_by: 'Kevin' })).toBe('dismissed by Kevin');
  });
});

describe('validateTriggerBody', () => {
  it('mirrors the server: what each kind needs', () => {
    expect(validateTriggerBody({ kind: 'time', action: 'recheck', every_days: 30, node_id: 5 })).toEqual({ ok: true });
    expect(validateTriggerBody({ kind: 'time', action: 'notify' }).error).toMatch(/every how many days, or a date/);
    expect(validateTriggerBody({ kind: 'time', action: 'recheck', every_days: 30 }).error).toMatch(/belongs on a node/);
    expect(validateTriggerBody({ kind: 'event', action: 'notify' }).error).toMatch(/belongs on a node/);
    expect(validateTriggerBody({ kind: 'condition', action: 'check', every_days: 7 }).error).toMatch(/say the condition/);
    expect(validateTriggerBody({ kind: 'condition', action: 'check', prompt: 'x' }).error).toMatch(/how often/);
    expect(validateTriggerBody({ kind: 'time', action: 'refresh', every_days: 30 }).error).toMatch(/what the refresh should check/);
    expect(validateTriggerBody({ kind: 'time', action: 'notify', every_days: 0.5 }).error).toMatch(/whole number/);
    expect(validateTriggerBody({ kind: 'sometimes', action: 'notify' }).error).toMatch(/when it fires/);
    expect(validateTriggerBody({ kind: 'time', action: 'explode' }).error).toMatch(/what it does/);
  });
});

describe('presetToBody', () => {
  it('turns the panel presets into request bodies', () => {
    expect(presetToBody(9, { preset: 'recheck', days: '14' })).toEqual({ node_id: 9, kind: 'time', action: 'recheck', every_days: 14 });
    expect(presetToBody(9, { preset: 'remind', date: '2026-12-24' })).toEqual({ node_id: 9, kind: 'time', action: 'notify', at: '2026-12-24T09:00:00Z', title: undefined });
    expect(presetToBody(9, { preset: 'grounds' })).toEqual({ node_id: 9, kind: 'event', action: 'notify' });
    expect(presetToBody(9, { preset: 'tripwire', days: '7', condition: 'the source changes' })).toEqual({ node_id: 9, kind: 'condition', action: 'check', every_days: 7, prompt: 'the source changes' });
    expect(presetToBody(9, { preset: 'nope' })).toBeNull();
  });
});
