import assert from 'node:assert/strict';
import { act } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import { useInboxStartChatSources } from '../useInboxStartChatSources';

const repositoryState = vi.hoisted(() => ({
  savedCalls: [] as unknown[],
  leadCalls: [] as unknown[],
  savedPages: [] as unknown[],
  leadResults: [] as unknown[],
}));

vi.mock('../../data', () => ({
  whatsappContactsRepository: {
    listSaved: async (params: unknown) => {
      repositoryState.savedCalls.push(params);
      return repositoryState.savedPages.shift() ?? { contacts: [], total: 0, hasMore: false };
    },
    searchLeads: async (params: unknown) => {
      repositoryState.leadCalls.push(params);
      return repositoryState.leadResults.shift() ?? [];
    },
  },
}));

type InboxStartChatSources = ReturnType<typeof useInboxStartChatSources>;

const Harness = ({ capture }: { capture: (value: InboxStartChatSources) => void }) => {
  const sources = useInboxStartChatSources({ isOpen: false, query: '' });
  capture(sources);
  return (
    <>
      <output data-testid="contacts">{sources.savedContacts.map((contact) => contact.id).join(',')}</output>
      <output data-testid="leads">{sources.crmStartResults.map((lead) => lead.id).join(',')}</output>
    </>
  );
};

test('normaliza a busca e pagina contatos sem repetir a busca de leads', async () => {
  repositoryState.savedCalls.length = 0;
  repositoryState.leadCalls.length = 0;
  repositoryState.savedPages.push(
    { contacts: [createContact('contact-1', '5511999999991')], total: 2, hasMore: true },
    { contacts: [createContact('contact-2', '5511999999992')], total: 2, hasMore: false },
  );
  repositoryState.leadResults.push([{ id: 'lead-1', nome_completo: 'Ana', telefone: '5511999999991' }]);

  const currentSourcesRef: { current: InboxStartChatSources | null } = { current: null };
  const view = render(<Harness capture={(sources) => { currentSourcesRef.current = sources; }} />);

  try {
    const sources = currentSourcesRef.current;
    assert.ok(sources);

    await act(async () => {
      await sources.refreshStartChatSources('  Ana  ', 1, false, true);
    });
    assert.equal(view.container.querySelector('[data-testid="contacts"]')?.textContent, 'contact-1');
    assert.equal(view.container.querySelector('[data-testid="leads"]')?.textContent, 'lead-1');

    await act(async () => {
      await sources.refreshStartChatSources(' Ana ', 2, true);
    });
    assert.equal(view.container.querySelector('[data-testid="contacts"]')?.textContent, 'contact-1,contact-2');
    assert.equal(view.container.querySelector('[data-testid="leads"]')?.textContent, 'lead-1');
    assert.deepEqual(repositoryState.savedCalls, [
      { query: 'Ana', page: 1, pageSize: 50, forceSync: true },
      { query: 'Ana', page: 2, pageSize: 50, forceSync: false },
    ]);
    assert.deepEqual(repositoryState.leadCalls, [{ query: 'Ana', limit: 20 }]);
  } finally {
    view.unmount();
  }
});

const createContact = (id: string, phone: string) => ({
  id,
  channel_id: 'channel-1',
  contact_id: phone,
  phone_number: phone,
  phone_digits: phone,
  display_name: 'Contato',
  saved: true,
  last_synced_at: '2026-09-26T00:00:00.000Z',
  created_at: '2026-09-26T00:00:00.000Z',
  updated_at: '2026-09-26T00:00:00.000Z',
});
