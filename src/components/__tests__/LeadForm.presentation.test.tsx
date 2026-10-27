import assert from 'node:assert/strict';
import { act } from 'react';
import { test, vi } from 'vitest';
import { render } from '../../testing-library/react';

const mocks = vi.hoisted(() => ({
  save: vi.fn(async (_request: { payload: Record<string, unknown> }) => ({ id: 'demo-lead' })),
  warning: vi.fn(),
  config: {
    loading: false,
    leadStatuses: [{ id: 'status-demo', nome: 'Contato inicial', ativo: true, padrao: true }],
    leadOrigins: [{ id: 'origem-demo', nome: 'Site', ativo: true, visivel_para_observadores: true }],
    options: { lead_responsavel: [{ id: 'responsavel-demo', label: 'Equipe Demonstração', value: 'Equipe Demonstração', ativo: true }] },
  },
}));
vi.mock('../../contexts/ConfigContext', () => ({ useConfig: () => mocks.config }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ isObserver: false }) }));
vi.mock('../../features/leads', () => ({ saveLeadRecord: mocks.save, upsertLeadFollowUpReminder: vi.fn() }));
vi.mock('../../features/reminders', () => ({ getLeadPendingReminderDate: vi.fn(async () => null) }));
vi.mock('../../lib/toast', () => ({ toast: { warning: mocks.warning, success: vi.fn(), error: vi.fn() } }));
import LeadForm from '../LeadForm';

test('page presentation keeps the production fields and automation opt-out in its save payload', async () => {
  mocks.save.mockClear();
  const onSave = vi.fn();
  const view = render(<LeadForm presentation="page" lead={null} initialValues={{ nome_completo: 'Contato Demonstração', telefone: '5521000000000' }} onClose={() => undefined} onSave={onSave} />);
  try {
    assert.equal(view.container.querySelectorAll('fieldset').length, 4);
    for (const label of ['Dados de contato', 'Localização', 'Qualificação e origem', 'Responsável e acompanhamento', 'Limite diário de envios', 'Observações']) assert.ok(view.container.textContent?.includes(label));
    const optOut = view.container.querySelector<HTMLInputElement>('input[type="checkbox"]');
    assert.ok(optOut);
    await act(async () => optOut.click());
    const form = view.container.querySelector('form');
    assert.ok(form);
    const submit = view.container.querySelector<HTMLButtonElement>('button[type="submit"]');
    assert.equal(submit?.getAttribute('form'), form.id);
    await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    assert.equal(mocks.save.mock.calls.length, 1);
    assert.equal(mocks.save.mock.calls[0][0].payload.skip_automation, true);
    assert.equal(mocks.save.mock.calls[0][0].payload.origem_id, 'origem-demo');
    assert.equal(mocks.save.mock.calls[0][0].payload.responsavel_id, 'responsavel-demo');
    assert.equal(onSave.mock.calls.length, 1);
  } finally { view.unmount(); }
});

test('page presentation rejects incomplete data and keeps cancel available', async () => {
  mocks.save.mockClear(); mocks.warning.mockClear();
  const onClose = vi.fn();
  const view = render(<LeadForm presentation="page" lead={null} onClose={onClose} onSave={() => undefined} />);
  try {
    const form = view.container.querySelector('form'); assert.ok(form);
    await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    assert.equal(mocks.save.mock.calls.length, 0);
    assert.ok(mocks.warning.mock.calls.some(([text]) => String(text).includes('nome completo')));
    const cancel = [...view.container.querySelectorAll('button')].find(button => button.textContent === 'Cancelar'); assert.ok(cancel);
    act(() => cancel.click()); assert.equal(onClose.mock.calls.length, 1);
  } finally { view.unmount(); }
});
