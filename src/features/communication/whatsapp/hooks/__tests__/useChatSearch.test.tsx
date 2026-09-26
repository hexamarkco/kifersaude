import assert from 'node:assert/strict';
import { act, useRef, useState } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import { useChatSearch } from '../useChatSearch';

type AsyncMock = {
  (...args: unknown[]): Promise<unknown>;
  mock: { calls: unknown[][] };
  mockReset: () => AsyncMock;
  mockRejectedValueOnce: (error: unknown) => AsyncMock;
  mockResolvedValue: (value: unknown) => AsyncMock;
  mockResolvedValueOnce: (value: unknown) => AsyncMock;
};

const mocks = vi.hoisted(() => ({
  listChats: vi.fn() as unknown as AsyncMock,
  searchMessages: vi.fn() as unknown as AsyncMock,
}));

vi.mock('../../data', () => ({
  whatsappConversationsRepository: { list: mocks.listChats },
  whatsappMessagesRepository: { search: mocks.searchMessages },
}));

const identitySortChats = <T,>(chats: T[]) => chats;
const emptyFilters: string[] = [];

const SearchHarness = () => {
  const [query, setQuery] = useState('');
  const pendingChatInboxStateRef = useRef(new Map());
  const searchState = useChatSearch({
    activityFilter: 'all',
    leadStatusFilters: emptyFilters,
    leadResponsavelFilters: emptyFilters,
    pendingChatInboxStateRef,
    sortChats: identitySortChats,
  });

  return (
    <div>
      <button type="button" data-testid="search" onClick={() => {
        setQuery('fabiola');
        searchState.setSearch('fabiola');
      }}>
        buscar
      </button>
      <button type="button" data-testid="retry" onClick={searchState.retrySearch}>
        tentar novamente
      </button>
      <output data-testid="query">{query}</output>
      <output data-testid="chat-error">{searchState.chatSearchError ?? ''}</output>
      <output data-testid="message-error">{searchState.messageSearchError ?? ''}</output>
    </div>
  );
};

test('diferencia falha na busca de uma busca sem resultados', async () => {
  mocks.listChats.mockReset();
  mocks.searchMessages.mockReset();
  mocks.listChats.mockRejectedValueOnce(new Error('falha de conexão'));
  mocks.searchMessages.mockResolvedValueOnce([]);

  const view = render(<SearchHarness />);
  const searchButton = view.container.querySelector('[data-testid="search"]');
  assert.ok(searchButton instanceof HTMLButtonElement);

  await act(async () => {
    searchButton.click();
    await Promise.resolve();
  });

  assert.equal(
    view.container.querySelector('[data-testid="chat-error"]')?.textContent,
    'Não foi possível buscar as conversas agora. Tente novamente.',
  );
  assert.equal(view.container.querySelector('[data-testid="message-error"]')?.textContent, '');

  view.unmount();
});

test('permite repetir a busca sem reaproveitar o erro anterior', async () => {
  mocks.listChats.mockReset();
  mocks.searchMessages.mockReset();
  mocks.listChats.mockRejectedValueOnce(new Error('falha de conexão')).mockResolvedValueOnce([]);
  mocks.searchMessages.mockResolvedValue([]);

  const view = render(<SearchHarness />);
  const searchButton = view.container.querySelector('[data-testid="search"]');
  const retryButton = view.container.querySelector('[data-testid="retry"]');
  assert.ok(searchButton instanceof HTMLButtonElement);
  assert.ok(retryButton instanceof HTMLButtonElement);

  await act(async () => {
    searchButton.click();
    await Promise.resolve();
  });
  assert.notEqual(view.container.querySelector('[data-testid="chat-error"]')?.textContent, '');

  await act(async () => {
    retryButton.click();
    await Promise.resolve();
  });

  assert.equal(view.container.querySelector('[data-testid="chat-error"]')?.textContent, '');
  assert.equal(mocks.listChats.mock.calls.length, 2);

  view.unmount();
});
