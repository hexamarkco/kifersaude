import { describe, expect, it } from 'vitest';
import { auditOpportunityFollowUps, normalizeOpportunityRecords } from '../opportunity-followup-audit';

const primary = '11111111-1111-4111-8111-111111111111';
const familyMember = '22222222-2222-4222-8222-222222222222';
const opportunityId = '33333333-3333-4333-8333-333333333333';

describe('opportunity follow-up audit', () => {
  it('normalizes RPC result and reports capped data', () => {
    const normalized = normalizeOpportunityRecords({
      opportunities_truncated: true,
      opportunities: [{
        id: opportunityId,
        status: 'open',
        member_count: 2,
        member_lead_ids: [primary],
        primary_contact_lead_id: primary,
      }],
    });

    expect(normalized.truncated).toBe(true);
    expect(normalized.opportunities[0]?.members_truncated).toBe(true);
  });

  it('does not treat the display members cap as truncated member lead IDs when all IDs are present', () => {
    const normalized = normalizeOpportunityRecords({
      opportunities: [{
        id: opportunityId,
        status: 'open',
        member_count: 2,
        member_lead_ids: [primary, familyMember],
        members_truncated: true,
      }],
    });

    expect(normalized.opportunities[0]?.members_truncated).toBe(false);
  });

  it('detects equivalent follow-ups, non-primary scheduling, and conflicting next returns', () => {
    const normalized = normalizeOpportunityRecords({
      opportunities: [{
        id: opportunityId,
        status: 'open',
        archived: false,
        primary_contact_lead_id: primary,
        member_lead_ids: [primary, familyMember],
        member_count: 2,
      }],
    });
    const issues = auditOpportunityFollowUps({
      opportunities: normalized.opportunities,
      reminders: [
        { id: 'r1', lead_id: primary, tipo: 'Retorno', titulo: 'Ligar sobre proposta', data_lembrete: '2026-09-20T10:00:00-03:00' },
        { id: 'r2', lead_id: familyMember, tipo: 'retorno', titulo: '  LIGAR sobre proposta ', data_lembrete: '2026-09-20T15:00:00Z' },
      ],
      schedules: [
        { id: 's1', lead_id: familyMember, text_content: 'Olá, vamos falar sobre a proposta?', scheduled_at: '2026-09-20T15:00:00Z' },
      ],
    });

    expect(issues.map((issue) => issue.code)).toEqual([
      'DUPLICATE_OPPORTUNITY_FOLLOW_UP',
      'CONFLICTING_OPPORTUNITY_NEXT_RETURNS',
      'NON_PRIMARY_CONTACT_FOLLOW_UP_WITHOUT_RECORDED_JUSTIFICATION',
    ]);
    expect(issues[2]).toMatchObject({ lead_id: familyMember, primary_contact_lead_id: primary, justification_recorded: false });
  });

  it('does not audit archived or completed opportunities', () => {
    const issues = auditOpportunityFollowUps({
      opportunities: [{ id: opportunityId, archived: true, status: 'open', primary_contact_lead_id: primary, member_lead_ids: [primary, familyMember], member_count: 2, members_truncated: false }],
      reminders: [{ id: 'r1', lead_id: primary, tipo: 'Retorno', titulo: 'Follow up', data_lembrete: '2026-09-20' }],
      schedules: [],
    });
    expect(issues).toEqual([]);
  });

  it('groups dates in the CRM timezone, including late-night BRT follow-ups', () => {
    const normalized = normalizeOpportunityRecords({
      opportunities: [{ id: opportunityId, status: 'open', primary_contact_lead_id: primary, member_lead_ids: [primary, familyMember], member_count: 2 }],
    });
    const issues = auditOpportunityFollowUps({
      opportunities: normalized.opportunities,
      reminders: [
        { id: 'r1', lead_id: primary, tipo: 'Retorno', titulo: 'Proposta', data_lembrete: '2026-09-20T23:30:00-03:00' },
        { id: 'r2', lead_id: familyMember, tipo: 'Retorno', titulo: 'Proposta', data_lembrete: '2026-09-20T20:00:00-03:00' },
      ],
      schedules: [],
    });

    expect(issues.map((issue) => issue.code)).toContain('DUPLICATE_OPPORTUNITY_FOLLOW_UP');
    expect(issues.find((issue) => issue.code === 'CONFLICTING_OPPORTUNITY_NEXT_RETURNS')?.date).toBe('2026-09-20');
  });
});
