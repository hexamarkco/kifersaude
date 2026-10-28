import assert from 'node:assert/strict';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { test } from 'vitest';

import type { DashboardCommercialAnalysis } from '../shared/dashboardTypes';
import { DashboardDailyOverview, DashboardResultOverview } from './DashboardCommercialSections';

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

test('modo compacto apresenta prioridades sem repetir o cabeçalho da seção', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);

  try {
    await act(async () => {
      root.render(
        <DashboardDailyOverview
          analysis={analysis}
          showFinancialMetrics={false}
          onNavigateToLead={() => undefined}
          compact
        />,
      );
    });

    assert.equal(container.textContent?.includes('Prioridades de hoje'), true);
    assert.equal(container.textContent?.includes('O que pede atenção'), false);
    assert.equal(container.textContent?.includes('Ana Silva'), true);
    assert.equal(container.textContent?.includes('Atrasados'), true);
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});

test('mantém quatro indicadores principais e revela os complementares ao solicitar', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const resultAnalysis = {
    ...analysis,
    commissionExpected: 2400,
    commissionReceived: null,
    averageTicket: 300,
    currentRange: { label: 'Últimos 30 dias' },
    dataCoverage: { monthlyRevenue: true, commissionExpected: true },
  } as unknown as DashboardCommercialAnalysis;

  try {
    await act(async () => {
      root.render(<DashboardResultOverview analysis={resultAnalysis} showFinancialMetrics />);
    });

    const primaryMetrics = container.querySelector('.kds-dashboard-primary-kpis');
    const additionalMetrics = container.querySelector('.kds-dashboard-secondary-kpis');
    assert.ok(primaryMetrics);
    assert.ok(additionalMetrics);
    assert.equal(primaryMetrics.querySelectorAll('.kds-card-kpi').length, 4);
    assert.equal(additionalMetrics.querySelectorAll('.kds-card-kpi').length, 2);

    const details = container.querySelector('details');
    const trigger = details?.querySelector('summary');
    assert.ok(details);
    assert.ok(trigger);
    assert.equal(details.open, false);

    await act(async () => {
      trigger.click();
    });

    assert.equal(details.open, true);
    assert.equal(additionalMetrics.textContent?.includes('Comissão recebida'), true);
    assert.equal(additionalMetrics.textContent?.includes('Ticket médio'), true);
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});
