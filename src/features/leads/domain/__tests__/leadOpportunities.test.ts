import assert from 'node:assert/strict';
import { test } from 'vitest';
import { parseLeadOpportunities } from '../leadOpportunities';

const opportunity = {
  id: 'group-1', name: 'Plano da Lorrayne', status: 'won', archived: false,
  updated_at: '2026-11-12T15:00:00Z', primary_contact_lead_id: 'lead-2',
  members: [{ lead_id: 'lead-1', name: 'Claudio', status: 'Atendimento', is_primary_contact: false }, { lead_id: 'lead-2', name: 'Lorrayne', status: 'Convertido', is_primary_contact: true }],
  member_lead_ids: ['lead-1', 'lead-2'], member_count: 2, members_truncated: false,
};

test('mantém os contatos, principal e status individual ao interpretar a negociação compartilhada', () => {
  const snapshot = parseLeadOpportunities({ success: true, opportunities: [opportunity], opportunities_truncated: false });
  assert.deepEqual(snapshot.opportunities[0], opportunity);
});

test('distingue ausência confirmada de vínculos de uma resposta ausente ou inválida', () => {
  assert.deepEqual(parseLeadOpportunities({ success: true, opportunities: [], opportunities_truncated: false }), { opportunities: [], truncated: false });
  for (const value of [null, {}, { success: true }, { success: false }, { success: true, opportunities: [{}], opportunities_truncated: false }]) {
    assert.throws(() => parseLeadOpportunities(value));
  }
});

test('preserva truncamento e rejeita dados incompletos dos participantes', () => {
  assert.equal(parseLeadOpportunities({ success: true, opportunities: [opportunity], opportunities_truncated: true }).truncated, true);
  assert.throws(() => parseLeadOpportunities({ success: true, opportunities: [{ ...opportunity, members: [{ lead_id: 'lead-1' }] }], opportunities_truncated: false }));
});
