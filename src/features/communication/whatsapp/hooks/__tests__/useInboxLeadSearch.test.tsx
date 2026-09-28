import assert from 'node:assert/strict';
import { act } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import { useInboxLeadSearch } from '../useInboxLeadSearch';

const searchState = vi.hoisted(() => ({ calls: [] as unknown[] }));

vi.mock('../../data', () => ({
  whatsappContactsRepository: {
    searchLeads: async (params: unknown) => {
      searchState.calls.push(params);
      return [{ id: 'lead-1', nome_completo: 'Ana', telefone: '5511999999999' }];
    },
  },
}));

const Harness = ({ isOpen, query, leadId }: { isOpen: boolean; query: string; leadId: string | null }) => {
  const state = useInboxLeadSearch({
    isOpen,
    query,
    selectedChat: { lead_id: leadId, phone_number: ' 5511999999999 ' },
  });

  return (
    <>
      <output data-testid="results">{state.results.map((lead) => lead.id).join(',')}</output>
      <output data-testid="loading">{String(state.loading)}</output>
      <output data-testid="error">{state.error ?? ''}</output>
    </>
  );
};

test('busca o lead sugerido após debounce e normaliza a consulta e o telefone do chat', async () => {
  searchState.calls.length = 0;
  const view = render(<Harness isOpen query="  Ana  " leadId={null} />);

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
  });

  assert.equal(view.container.querySelector('[data-testid="results"]')?.textContent, 'lead-1');
  assert.equal(view.container.querySelector('[data-testid="loading"]')?.textContent, 'false');
  assert.deepEqual(searchState.calls, [{ query: 'Ana', phoneNumbers: ['5511999999999'], limit: 20 }]);
  view.unmount();
});
