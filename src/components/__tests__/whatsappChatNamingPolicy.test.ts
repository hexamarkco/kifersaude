import { describe, expect, it } from 'vitest';
import {
  formatPhoneToE164,
  resolveNameWithPriority,
  shouldBlockChatName,
  type ChatNameState,
} from '../whatsappChatNamingPolicy';

describe('whatsappChatNamingPolicy', () => {
  it('prioritizes contact name when available', () => {
    const decision = resolveNameWithPriority({
      normalizedPhone: '5511987654321',
      contactName: 'Maria Silva',
      leadNames: ['Lead Example'],
      fallbackDisplay: '11987654321',
    });

    expect(decision.state.value).toBe('Maria Silva');
    expect(decision.state.source).toBe('contact');
    expect(decision.promoted).toBe(true);
  });

  it('falls back to lead name when no contact is provided', () => {
    const decision = resolveNameWithPriority({
      normalizedPhone: '5511987654321',
      leadNames: ['João Souza'],
      fallbackDisplay: '11987654321',
    });

    expect(decision.state.value).toBe('João Souza');
    expect(decision.state.source).toBe('lead');
  });

  it('uses E.164 formatted phone when no contact or lead is available', () => {
    const decision = resolveNameWithPriority({
      normalizedPhone: '5511987654321',
      fallbackDisplay: '11987654321',
    });

    expect(decision.state.value).toBe('+5511987654321');
    expect(decision.state.source).toBe('phone');
  });

  it('preserves higher priority name when new candidate is weaker', () => {
    const previous: ChatNameState = { value: 'Contato Salvo', source: 'contact' };
    const decision = resolveNameWithPriority({
      normalizedPhone: '5511987654321',
      fallbackDisplay: '11987654321',
      previous,
    });

    expect(decision.state).toEqual(previous);
    expect(decision.changed).toBe(false);
  });

  it('reports lead conflicts by keeping the phone with a conflict label', () => {
    const decision = resolveNameWithPriority({
      normalizedPhone: '5511987654321',
      leadNames: ['Lead A', 'Lead B'],
      hasLeadConflict: true,
      fallbackDisplay: '11987654321',
    });

    expect(decision.state.source).toBe('lead-conflict');
    expect(decision.state.value).toContain('vários leads disponíveis');
    expect(decision.state.value).toContain('+5511987654321');
  });

  it('allows updating to lead conflict from a previous lead name', () => {
    const previous: ChatNameState = { value: 'Lead Único', source: 'lead' };
    const decision = resolveNameWithPriority({
      normalizedPhone: '5511987654321',
      leadNames: ['Lead Único', 'Lead Secundário'],
      hasLeadConflict: true,
      fallbackDisplay: '11987654321',
      previous,
    });

    expect(decision.state.source).toBe('lead-conflict');
    expect(decision.changed).toBe(true);
    expect(decision.promoted).toBe(false);
  });

  it('formats arbitrary phone fallback values as E.164 when possible', () => {
    expect(formatPhoneToE164('5511987654321')).toBe('+5511987654321');
    expect(formatPhoneToE164(undefined, '(11) 98765-4321')).toBe('+11987654321');
  });

  it('detects blocked names regardless of casing and accents', () => {
    const blocked = ['Kifer Saúde'];
    expect(shouldBlockChatName('kifer saude', blocked)).toBe(true);
    expect(shouldBlockChatName('Outro Nome', blocked)).toBe(false);
  });
});
