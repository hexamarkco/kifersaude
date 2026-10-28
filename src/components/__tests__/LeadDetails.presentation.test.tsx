import assert from 'node:assert/strict';
import { act } from 'react';
import { test, vi } from 'vitest';
import { render } from '../../testing-library/react';
import type { Lead } from '../../features/leads';

const mocks = vi.hoisted(() => ({
  timeline: { interactions: [], statusHistory: [], reminders: [{ id: 'demo-reminder', titulo: 'Retorno de demonstração', descricao: 'Contato agendado', data_lembrete: '2026-10-28T12:00:00Z', lido: false }] },
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ role: 'admin' }) }));
vi.mock('../../contexts/ConfigContext', () => ({ useConfig: () => ({ getRoleModulePermission: () => ({ can_edit: true }) }) }));
vi.mock('../../features/leads', () => ({ getLeadTimeline: async () => mocks.timeline, addLeadInteraction: async () => undefined }));
vi.mock('../LeadFavoriteStar', () => ({ LeadFavoriteToggle: () => <span>Favorito</span> }));
vi.mock('../NextStepSuggestion', () => ({ default: () => null }));
import LeadDetails from '../LeadDetails';

const lead: Lead = { id: 'demo', nome_completo: 'Contato Demonstração', telefone: '', email: 'contato@exemplo.invalid', origem: 'Site', cidade: 'Rio de Janeiro', observacoes: 'Contexto de demonstração', data_criacao: '2026-10-27', created_at: '2026-10-27', updated_at: '2026-10-27', arquivado: false };

test('lead workspace tabs preserve contact data, reminders and existing action callbacks', async () => {
  const calls: string[] = [];
  const view = render(<LeadDetails presentation="page" lead={lead} onClose={() => calls.push('close')} onUpdate={() => undefined} onEdit={() => calls.push('edit')} onDelete={() => calls.push('delete')} onScheduleReminder={() => calls.push('reminder')} onConvert={() => calls.push('convert')} />);
  const click = async (text: string) => {
    const button = [...document.body.querySelectorAll('button')].find(el => el.textContent === text || el.getAttribute('aria-label') === text);
    assert.ok(button, text); await act(async () => button.click());
  };
  try {
    await act(async () => { await Promise.resolve(); });
    assert.equal(view.container.querySelector('[role="dialog"]'), null);
    await click('Agendar follow-up'); await click('Converter em contrato'); await click('Editar lead'); await click('Mais ações do lead'); await click('Excluir lead');
    assert.deepEqual(calls, ['reminder', 'convert', 'edit', 'delete']);
    await click('Dados do lead');
    assert.ok(view.container.textContent?.includes('Contexto de demonstração'));
    assert.ok(view.container.textContent?.includes('Rio de Janeiro'));
    await click('Follow-ups'); assert.ok(view.container.textContent?.includes('Retorno de demonstração'));
    await click('Histórico'); assert.ok(view.container.textContent?.includes('Linha do tempo'));
    await click('Gestão de leads'); assert.equal(calls[calls.length - 1], 'close');
  } finally { view.unmount(); }
});

test('lead details drawer preserves close, edit and full-page callbacks', async () => {
  const calls: string[] = [];
  const view = render(<LeadDetails presentation="drawer" lead={lead} onClose={() => calls.push('close')} onUpdate={() => undefined} onEdit={() => calls.push('edit')} onOpenFullPage={() => calls.push('full-page')} onDelete={() => calls.push('delete')} />);
  try {
    await act(async () => { await Promise.resolve(); });
    const drawer = document.body.querySelector<HTMLElement>('[role="dialog"]');
    assert.ok(drawer);
    assert.match(drawer.className, /kds-drawer-right/);
    assert.equal(drawer.getAttribute('aria-label'), 'Detalhes do lead');
    assert.ok(document.body.textContent?.includes('Histórico de interações'));
    assert.ok(document.body.textContent?.includes('Contato Demonstração'));
    const more = document.body.querySelector<HTMLButtonElement>('[aria-label="Mais ações do lead"]');
    assert.ok(more);
    await act(async () => more.click());
    const fullPage = [...document.body.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find((button) => button.textContent === 'Abrir ficha completa');
    assert.ok(fullPage);
    await act(async () => fullPage.click());
    assert.deepEqual(calls, ['full-page']);
    const edit = [...document.body.querySelectorAll('button')].find((button) => button.textContent === 'Editar lead');
    assert.ok(edit);
    await act(async () => edit.click());
    assert.deepEqual(calls, ['full-page', 'edit']);
    const close = document.body.querySelector<HTMLButtonElement>('[aria-label="Fechar"]');
    assert.ok(close);
    await act(async () => close.click());
    assert.deepEqual(calls, ['full-page', 'edit', 'close']);
  } finally { view.unmount(); }
});
