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
vi.mock('../../features/leads', () => ({ getLeadTimeline: async () => mocks.timeline, addLeadInteraction: async () => undefined, LeadRelationshipsPanel: () => <div>Negociações em conjunto</div> }));
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
    assert.ok(drawer.textContent?.includes('Sobre a negociação'));
    const tabs = [...drawer.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    assert.deepEqual(tabs.map(tab => tab.textContent), ['Resumo', 'Histórico', 'Vínculos', 'Anotações']);
    const history = tabs.find(tab => tab.textContent === 'Histórico'); assert.ok(history);
    await act(async () => history.click());
    assert.ok(drawer.textContent?.includes('Histórico de interações'));
    const links = tabs.find(tab => tab.textContent === 'Vínculos'); assert.ok(links);
    await act(async () => links.click());
    assert.ok(drawer.textContent?.includes('Negociações em conjunto'));
    const notes = tabs.find(tab => tab.textContent === 'Anotações'); assert.ok(notes);
    await act(async () => notes.click());
    assert.ok(drawer.textContent?.includes('Contexto de demonstração'));
    await act(async () => tabs[0].click());
    const interactionButton = [...drawer.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.trim() === 'Interação');
    assert.ok(interactionButton);
    await act(async () => interactionButton.click());
    const interactionDialog = document.querySelector<HTMLElement>('.kds-lead-interaction-dialog');
    assert.ok(interactionDialog?.querySelector('form#lead-interaction-form'));
    assert.equal(interactionDialog.querySelector('button[type="submit"]')?.getAttribute('form'), 'lead-interaction-form');
    const cancelInteraction = [...interactionDialog.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.trim() === 'Cancelar');
    assert.ok(cancelInteraction);
    await act(async () => cancelInteraction.click());
    assert.equal(document.querySelector('.kds-lead-interaction-dialog'), null);
    await act(async () => tabs[0].click());
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
