import assert from 'node:assert/strict';
import { act, useRef, useState } from 'react';
import { test, vi } from 'vitest';
import { createSearchParams, type SetURLSearchParams } from 'react-router-dom';

import { render } from '../../../../../testing-library/react';
import { useWhatsAppInboxDeepLink } from '../useWhatsAppInboxDeepLink';
import type { CommWhatsAppChat } from '../../domain/types';

const DeepLinkHarness = () => {
  const [selectedChatId, setSelectedChatId] = useState<string | null>('chat-old');
  const [searchParams, setSearchParamsState] = useState(() => new URLSearchParams('chatId=chat-old'));
  const chatIdFromUrlRef = useRef<string | null>(null);
  const latestChatsRef = useRef<CommWhatsAppChat[]>([]);
  const loadChats = useRef(vi.fn(async () => undefined)).current;

  const setSearchParams: SetURLSearchParams = (nextInit) => {
    setSearchParamsState((current) => {
      const next = typeof nextInit === 'function' ? nextInit(current) : nextInit;
      return createSearchParams(next);
    });
  };

  useWhatsAppInboxDeepLink({
    searchParams,
    setSearchParams,
    selectedChatId,
    chatIdFromUrlRef,
    latestChatsRef,
    setArchivedSectionOpen: () => undefined,
    setSelectedChatId,
    loadChats,
  });

  return (
    <div>
      <button
        type="button"
        data-testid="open-new-chat"
        onClick={() => setSearchParamsState(new URLSearchParams('chatId=chat-new'))}
      >
        abrir novo chat
      </button>
      <button type="button" data-testid="select-new-chat" onClick={() => setSelectedChatId('chat-new')}>
        selecionar novo chat
      </button>
      <output data-testid="selected-chat">{selectedChatId}</output>
      <output data-testid="url-chat">{searchParams.get('chatId') ?? ''}</output>
    </div>
  );
};

test('não restaura o chat anterior enquanto processa o deep link do toast', () => {
  const view = render(<DeepLinkHarness />);
  const openNewChatButton = view.container.querySelector('[data-testid="open-new-chat"]');

  assert.ok(openNewChatButton instanceof HTMLButtonElement);

  act(() => {
    openNewChatButton.click();
  });

  assert.equal(view.container.querySelector('[data-testid="selected-chat"]')?.textContent, 'chat-new');
  assert.equal(view.container.querySelector('[data-testid="url-chat"]')?.textContent, 'chat-new');

  view.unmount();
});

test('continua sincronizando a URL quando a seleção é manual', () => {
  const view = render(<DeepLinkHarness />);
  const selectNewChatButton = view.container.querySelector('[data-testid="select-new-chat"]');

  assert.ok(selectNewChatButton instanceof HTMLButtonElement);

  act(() => {
    selectNewChatButton.click();
  });

  assert.equal(view.container.querySelector('[data-testid="selected-chat"]')?.textContent, 'chat-new');
  assert.equal(view.container.querySelector('[data-testid="url-chat"]')?.textContent, 'chat-new');

  view.unmount();
});
