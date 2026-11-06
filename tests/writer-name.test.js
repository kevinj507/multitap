import { describe, it, expect } from 'vitest';
import {
  nameFromEmail, operatorName, agentLabelFromClientName, resolveAgentName,
} from '../src/writerName.js';

describe('nameFromEmail', () => {
  it('takes the first segment before @ and separators, capitalized', () => {
    expect(nameFromEmail('ada@example.com')).toBe('Ada');
    expect(nameFromEmail('ada.lovelace@example.com')).toBe('Ada');
    expect(nameFromEmail('grace+test@example.com')).toBe('Grace');
    expect(nameFromEmail('grace42@example.com')).toBe('Grace42');
  });
  it('returns null for non-emails / empty', () => {
    expect(nameFromEmail(null)).toBe(null);
    expect(nameFromEmail('')).toBe(null);
    expect(nameFromEmail('@nope.com')).toBe(null);
  });
});

describe('operatorName', () => {
  it('prefers display_name, falls back to email local part', () => {
    expect(operatorName({ display_name: 'Ada Lovelace', email: 'ada@x.com' })).toBe('Ada Lovelace');
    expect(operatorName({ display_name: '  ', email: 'ada@x.com' })).toBe('Ada');
    expect(operatorName({ email: 'ada@x.com' })).toBe('Ada');
  });
  it('is null without a user or any identifier', () => {
    expect(operatorName(null)).toBe(null);
    expect(operatorName({})).toBe(null);
  });
});

describe('agentLabelFromClientName', () => {
  it('extracts the product label after "’s", default Claude', () => {
    expect(agentLabelFromClientName("Kevin's Claude")).toBe('Claude');
    expect(agentLabelFromClientName('Quiet Otter’s Codex')).toBe('Codex');
    expect(agentLabelFromClientName('no apostrophe here')).toBe('Claude');
    expect(agentLabelFromClientName(null)).toBe('Claude');
  });
});

describe('resolveAgentName', () => {
  it('composes "<operator>’s <label>" from the token owner', () => {
    expect(resolveAgentName({ user: { email: 'ada@example.com' }, clientName: "Whoever's Claude" }))
      .toBe("Ada's Claude");
    // operator from server, label from client → harness-agnostic
    expect(resolveAgentName({ user: { email: 'kevin@x.com' }, clientName: "X's Codex" }))
      .toBe("Kevin's Codex");
    // display_name wins over email
    expect(resolveAgentName({ user: { display_name: 'Grace H', email: 'g@x.com' }, clientName: "X's Claude" }))
      .toBe("Grace H's Claude");
  });
  it('falls back to the client name when there is no authed user (anon/no-auth)', () => {
    expect(resolveAgentName({ user: null, clientName: "Quiet Otter's Claude" }))
      .toBe("Quiet Otter's Claude");
    expect(resolveAgentName({ user: null, clientName: null })).toBe('Agent');
  });
});
