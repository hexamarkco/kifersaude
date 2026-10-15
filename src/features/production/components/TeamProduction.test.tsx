import assert from 'node:assert/strict';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { test, vi } from 'vitest';
import type { ProductionReport } from '../domain/types';

const state = vi.hoisted(() => ({ report: null as ProductionReport | null, error: null as string | null }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ isAdmin: true }) }));
vi.mock('../hooks/useProduction', () => ({ useProduction: () => ({
  report: state.report, error: state.error, range: { start:'2026-10-14',end:'2026-10-14' },
  operator:'',offset:0,loading:false,setRange:vi.fn(),setOperator:vi.fn(),setOffset:vi.fn(),reload:vi.fn(),activate:vi.fn(),
}) }));
import { TeamProduction } from './TeamProduction';

async function withView(check: (container: HTMLDivElement) => void) {
  const container=document.createElement('div'); document.body.append(container);
  const root=createRoot(container);
  await act(async () => { root.render(<TeamProduction onNavigateToLead={() => undefined} />); });
  try { check(container); }
  finally { act(() => root.unmount()); container.remove(); state.report=null; state.error=null; }
}

test('source failure is shown as unavailable rather than zero production', async () => {
  state.error='Cobertura indisponível';
  await withView((container) => {
    assert.ok(container.textContent?.includes('Cobertura indisponível'));
    assert.equal(container.querySelector('table'),null);
  });
});

test('activation explains exclusion of the shared-login history', async () => {
  state.report={started_at:null,operators:[],summary:[],events:[],total_events:0,unattributed:{automation:0,external:0,unknown:0}};
  await withView((container) => {
    assert.ok(container.textContent?.includes('histórico do login compartilhado'));
    assert.ok(container.textContent?.includes('Iniciar medição a partir de agora'));
  });
});

test('report separates immediate and scheduled sends and exposes explaining records', async () => {
  state.report={started_at:'2026-10-14T12:00:00Z',operators:[{user_id:'nick',display_name:'Nick',active:true}],summary:[{
    user_id:'nick',display_name:'Nick',clients:2,messages:3,scheduled_messages:4,schedules:5,reminders:1,advances:1,regressions:0,losses:0,sales:1,cancellations:0,
  }],events:[],total_events:0,unattributed:{automation:10,external:2,unknown:1}};
  await withView((container) => {
    assert.ok(container.textContent?.includes('Envios imediatos'));
    assert.ok(container.textContent?.includes('Envios agendados'));
    assert.ok(container.textContent?.includes('Registros que compõem os indicadores'));
    assert.ok(container.textContent?.includes('WhatsApp externo — autoria não identificada 2'));
  });
});
