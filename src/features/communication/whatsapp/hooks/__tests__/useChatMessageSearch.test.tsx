import assert from 'node:assert/strict';
import { act } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import { useChatMessageSearch } from '../useChatMessageSearch';

type AsyncMock = {
  (...args: unknown[]): Promise<unknown>;
  mock: { calls: unknown[][] };
  mockReset: () => AsyncMock;
  mockRejectedValueOnce: (error: unknown) => AsyncMock;
  mockResolvedValue: (value: unknown) => AsyncMock;
  mockResolvedValueOnce: (value: unknown) => AsyncMock;
};

const mocks = vi.hoisted(() => ({
  searchMessages: vi.fn() as unknown as AsyncMock,
}));

vi.mock('../../data', () => ({
  whatsappMessagesRepository: { search: mocks.searchMessages },
}));

const SearchHarness = () => {
  const searchState = useChatMessageSearch({
    chatId: 'chat-1',
    enabled: true,
    query: 'fabiola',
  });

  return (
    <div>
      <button type="button" data-testid="retry" onClick={searchState.retry}>
        tentar novamente
      </button>
      <output data-testid="error">{searchState.error ?? ''}</output>
      <output data-testid="result-count">{searchState.results.length}</output>
    </div>
  );
};

test('diferencia falha na busca dentro do chat de uma busca sem resultados', async () => {
  mocks.searchMessages.mockReset();
  mocks.searchMessages.mockRejectedValueOnce(new Error('falha de conexão'));

  const view = render(<SearchHarness />);

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await Promise.resolve();
    await Promise.resolve();
  });

  assert.equal(
    view.container.querySelector('[data-testid="error"]')?.textContent,
    'Não foi possível buscar as mensagens agora. Tente novamente.',
  );
  assert.equal(view.container.querySelector('[data-testid="result-count"]')?.textContent, '0');

  view.unmount();
});

test('permite repetir a busca dentro do chat', async () => {
  mocks.searchMessages.mockReset();
  mocks.searchMessages.mockRejectedValueOnce(new Error('falha de conexão')).mockResolvedValueOnce([]);

  const view = render(<SearchHarness />);
  const retryButton = view.container.querySelector('[data-testid="retry"]');
  assert.ok(retryButton instanceof HTMLButtonElement);

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await Promise.resolve();
    await Promise.resolve();
  });
  assert.notEqual(view.container.querySelector('[data-testid="error"]')?.textContent, '');

  await act(async () => {
    retryButton.click();
    await Promise.resolve();
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await Promise.resolve();
    await Promise.resolve();
  });

  assert.equal(view.container.querySelector('[data-testid="error"]')?.textContent, '');
  assert.equal(mocks.searchMessages.mock.calls.length, 2);

  view.unmount();
});
