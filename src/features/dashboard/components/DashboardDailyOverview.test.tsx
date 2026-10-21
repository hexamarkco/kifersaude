import assert from 'node:assert/strict';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { test } from 'vitest';

import type { DashboardCommercialAnalysis } from '../shared/dashboardTypes';
import { DashboardDailyOverview } from './DashboardCommercialSections';

const analysis = {
  agenda: { pending: 3, overdue: 1, completed: 2, items: [] },
  followUp: { withoutNextStep: 2 },
  opportunities: [{
    leadId: 'lead-1',
    name: 'Ana Silva',
    status: 'Proposta enviada',
    statusColor: null,
    monthlyValue: null,
    lastContact: null,
    idleDays: 3,
    nextStep: null,
    responsavel: 'Bruno',
    signal: 'Sem próximo passo',
    tone: 'warning' as const,
  }],
  salesCount: 4,
  conversion: 25,
  monthlyRevenue: 1200,
  dataCoverage: { monthlyRevenue: true },
  leadsReceived: 16,
} as unknown as DashboardCommercialAnalysis;

test('prioriza oportunidades e encaminha para lead, agenda e carteira', async () => {
  const navigatedLeads: string[] = [];
  const navigatedTabs: string[] = [];
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);

  try {
    await act(async () => {
      root.render(
        <DashboardDailyOverview
          analysis={analysis}
          showFinancialMetrics={false}
          onNavigateToLead={(leadId) => navigatedLeads.push(leadId)}
          onNavigateToTab={(tab) => navigatedTabs.push(tab)}
        />,
      );
    });

    assert.equal(container.textContent?.includes('Ana Silva'), true);
    assert.equal(container.textContent?.includes('Leads recebidos'), true);
    assert.equal(container.textContent?.includes('Valor mensal vendido'), false);

    const opportunity = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Ana Silva'));
    const agenda = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Abrir agenda'));
    const leads = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Abrir leads'));
    assert.ok(opportunity);
    assert.ok(agenda);
    assert.ok(leads);

    await act(async () => {
      opportunity.click();
      agenda.click();
      leads.click();
    });

    assert.deepEqual(navigatedLeads, ['lead-1']);
    assert.deepEqual(navigatedTabs, ['agenda', 'leads']);
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});
