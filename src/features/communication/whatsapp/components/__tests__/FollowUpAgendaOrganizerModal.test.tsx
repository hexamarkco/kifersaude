import assert from 'node:assert/strict';
import { act } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  previewAgendaOrganization: vi.fn(),
  applyAgendaOrganization: vi.fn(),
}));
vi.mock('../../data', () => ({ whatsappFollowUpService: mocks }));
vi.mock('../../../../../lib/leadFavoriteService', () => ({ useFavoritedLeadIds: () => new Set<string>() }));
vi.mock('../../../../../hooks/useConfirmationModal', () => ({
  useConfirmationModal: () => ({ requestConfirmation: async () => true, ConfirmationDialog: null }),
}));
vi.mock('../../../../../lib/toast', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }));

import FollowUpAgendaOrganizerModal from '../FollowUpAgendaOrganizerModal';

test('Inbox shows real pending returns and only applies selected preview changes', async () => {
  const base = { leadId: null, leadName: 'Lead de teste', currentDateTime: '2026-11-26T12:00:00Z', newDateTime: '2026-11-27T12:00:00Z', priority: 'normal', score: 10, reasons: [], changed: true };
  const first = { ...base, reminderId: 'first', title: 'Retorno A' };
  const second = { ...base, reminderId: 'second', title: 'Retorno B' };
  mocks.previewAgendaOrganization.mockResolvedValue({ changes: [first, second], totalCandidates: 2, totalChanges: 2, groupedDays: { '2026-11-27': 2 } });
  mocks.applyAgendaOrganization.mockResolvedValue({ applied: 1, skipped: 0 });
  const close = vi.fn();
  const daily = vi.fn();
  const view = render(<FollowUpAgendaOrganizerModal isOpen onClose={close} onViewDailyAgenda={daily}
    pendingReturns={[{ id: 'first', title: 'Retorno A', leadName: 'Lead de teste', currentDateTime: base.currentDateTime, priority: 'normal' }]} />);
  try {
    assert.ok(screen.getByRole('heading', { name: 'Agenda das conversas' }));
    assert.ok(screen.getByRole('table', { name: 'Retornos pendentes' }));
    assert.ok((screen.getByRole('button', { name: 'Aplicar organização' }) as HTMLButtonElement).disabled);
    fireEvent.click(screen.getByRole('button', { name: 'Ver retornos do dia' }));
    assert.equal(daily.mock.calls.length, 1);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sugerir organização' })); });
    await waitFor(() => assert.ok(screen.getByRole('checkbox', { name: 'Selecionar Retorno B' })));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar Retorno B' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Aplicar organização' })); });
    await waitFor(() => assert.deepEqual(mocks.applyAgendaOrganization.mock.calls, [[[first]]]));
    assert.equal(close.mock.calls.length, 1);
  } finally { view.unmount(); }
});
