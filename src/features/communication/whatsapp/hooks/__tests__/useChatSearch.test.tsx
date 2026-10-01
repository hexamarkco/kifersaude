import assert from 'node:assert/strict';
import { act, useRef, useState } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import { useChatSearch } from '../useChatSearch';

type AsyncMock = {
  (...args: unknown[]): Promise<unknown>;
  mock: { calls: unknown[][] };
  mockImplementation(implementation: (...args: unknown[]) => Promise<unknown>): AsyncMock;
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

const SearchHarness = ({ term = 'fabiola' }: { term?: string }) => {
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
        setQuery(term);
        searchState.setSearchDraft(term);
        searchState.setSearch(term);
      }}>
        buscar
      </button>
      <button type="button" data-testid="retry" onClick={searchState.retrySearch}>
        tentar novamente
      </button>
      <button type="button" data-testid="clear" onClick={() => {
        searchState.setSearchDraft('');
        searchState.setSearch('');
      }}>limpar</button>
      <button type="button" data-testid="next-search" onClick={() => {
        searchState.setSearchDraft('vida');
        searchState.setSearch('vida');
      }}>trocar busca</button>
      <output data-testid="query">{query}</output>
      <output data-testid="chat-error">{searchState.chatSearchError ?? ''}</output>
      <output data-testid="message-error">{searchState.messageSearchError ?? ''}</output>
      <output data-testid="searching-chats">{String(searchState.searchingChats)}</output>
      <output data-testid="searching-messages">{String(searchState.searchingMessages)}</output>
      <output data-testid="chat-count">{searchState.chatSearchResults.length}</output>
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

test('busca contatos com uma letra sem consultar mensagens', async () => {
  mocks.listChats.mockReset().mockResolvedValue([]);
  mocks.searchMessages.mockReset().mockResolvedValue([]);
  const view = render(<SearchHarness term="v" />);
  await act(async () => {
    (view.container.querySelector('[data-testid="search"]') as HTMLButtonElement).click();
  });
  assert.equal(mocks.listChats.mock.calls.length, 1);
  assert.equal(mocks.searchMessages.mock.calls.length, 0);
  assert.equal(view.container.querySelector('[data-testid="searching-chats"]')?.textContent, 'false');
  view.unmount();
});

test('encerra buscas travadas e ignora resultados que chegam após o prazo', async () => {
  vi.useFakeTimers();
  let resolveChats: (value: unknown) => void = () => undefined;
  mocks.listChats.mockReset().mockImplementation(() => new Promise((resolve) => {
    resolveChats = resolve;
  }));
  mocks.searchMessages.mockReset().mockImplementation(() => new Promise(() => undefined));
  const view = render(<SearchHarness />);
  try {
    await act(async () => {
      (view.container.querySelector('[data-testid="search"]') as HTMLButtonElement).click();
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    assert.equal(view.container.querySelector('[data-testid="searching-chats"]')?.textContent, 'false');
    assert.equal(view.container.querySelector('[data-testid="searching-messages"]')?.textContent, 'false');
    assert.match(view.container.querySelector('[data-testid="chat-error"]')?.textContent ?? '', /demorou demais/);
    assert.match(view.container.querySelector('[data-testid="message-error"]')?.textContent ?? '', /demorou demais/);
    const chatParams = mocks.listChats.mock.calls[0]?.[0] as { signal: AbortSignal };
    const messageParams = mocks.searchMessages.mock.calls[0]?.[0] as { signal: AbortSignal };
    assert.equal(chatParams.signal.aborted, true);
    assert.equal(messageParams.signal.aborted, true);
    await act(async () => { resolveChats([{ id: 'late-chat' }]); });
    assert.equal(view.container.querySelector('[data-testid="chat-count"]')?.textContent, '0');
  } finally {
    view.unmount();
    vi.useRealTimers();
  }
});

test('cancela a busca anterior ao trocar o termo e ao limpar o campo', async () => {
  mocks.listChats.mockReset().mockImplementation(() => new Promise(() => undefined));
  mocks.searchMessages.mockReset().mockImplementation(() => new Promise(() => undefined));
  const view = render(<SearchHarness />);
  try {
    await act(async () => {
      (view.container.querySelector('[data-testid="search"]') as HTMLButtonElement).click();
    });
    const firstParams = mocks.listChats.mock.calls[0]?.[0] as { signal: AbortSignal };
    await act(async () => {
      (view.container.querySelector('[data-testid="next-search"]') as HTMLButtonElement).click();
    });
    assert.equal(firstParams.signal.aborted, true);
    const nextParams = mocks.listChats.mock.calls[1]?.[0] as { signal: AbortSignal };
    await act(async () => {
      (view.container.querySelector('[data-testid="clear"]') as HTMLButtonElement).click();
    });
    assert.equal(nextParams.signal.aborted, true);
    assert.equal(view.container.querySelector('[data-testid="searching-chats"]')?.textContent, 'false');
    assert.equal(view.container.querySelector('[data-testid="chat-error"]')?.textContent, '');
  } finally {
    view.unmount();
  }
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

test('ignora erro de busca que chega depois que o Inbox é desmontado', async () => {
  mocks.listChats.mockReset();
  mocks.searchMessages.mockReset();
  let rejectSearch: (error: unknown) => void = () => undefined;
  mocks.listChats.mockImplementation(() => new Promise((_, reject) => {
    rejectSearch = reject;
  }));
  mocks.searchMessages.mockResolvedValue([]);

  const originalError = console.error;
  const errors: unknown[][] = [];
  console.error = (...args: unknown[]) => {
    errors.push(args);
  };

  const view = render(<SearchHarness />);
  const searchButton = view.container.querySelector('[data-testid="search"]');
  assert.ok(searchButton instanceof HTMLButtonElement);

  await act(async () => {
    searchButton.click();
    await Promise.resolve();
  });

  view.unmount();
  await act(async () => {
    rejectSearch(new Error('resposta tardia'));
    await Promise.resolve();
    await Promise.resolve();
  });

  assert.equal(errors.length, 0);
  console.error = originalError;
});
