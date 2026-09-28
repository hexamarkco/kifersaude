import assert from 'node:assert/strict';
import { act, useRef, useState } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import { useInboxChatMessageSearch } from '../useInboxChatMessageSearch';

const mocks = vi.hoisted(() => ({
  retrySearch: vi.fn(),
  searchOptions: [] as unknown[],
}));

vi.mock('../useChatMessageSearch', () => ({
  useChatMessageSearch: (options: unknown) => {
    mocks.searchOptions.push(options);
    return { results: [], searching: false, error: null, retry: mocks.retrySearch };
  },
}));

type SearchState = ReturnType<typeof useInboxChatMessageSearch>;
type SearchHarnessControl = {
  selectChat: ((selectedChatId: string | null, chatId: string | null) => void) | null;
};

const Harness = ({
  initialSelectedChatId,
  initialChatId,
  capture,
  control,
}: {
  initialSelectedChatId: string | null;
  initialChatId: string | null;
  capture: (state: SearchState) => void;
  control: SearchHarnessControl;
}) => {
  const [selection, setSelection] = useState({
    selectedChatId: initialSelectedChatId,
    chatId: initialChatId,
  });
  const selectedChatIdRef = useRef(selection.selectedChatId);
  selectedChatIdRef.current = selection.selectedChatId;
  control.selectChat = (selectedChatId, chatId) => setSelection({ selectedChatId, chatId });

  const state = useInboxChatMessageSearch({
    chatId: selection.chatId,
    selectedChatId: selection.selectedChatId,
    selectedChatIdRef,
  });
  capture(state);

  return (
    <div>
      <input
        data-testid="message-search"
        ref={state.inputRef}
        value={state.draft}
        onChange={(event) => state.setDraft(event.target.value)}
      />
      <input data-testid="other-input" />
      <button type="button" data-testid="toggle" onClick={state.toggle}>Alternar busca</button>
      <button type="button" data-testid="close" onClick={state.close}>Fechar busca</button>
      <output data-testid="open">{String(state.open)}</output>
      <output data-testid="query">{state.query}</output>
    </div>
  );
};

const resetMocks = () => {
  mocks.searchOptions.length = 0;
};

test('Ctrl+F abre a busca sem capturar outros campos editáveis e o botão fecha limpando o rascunho', async () => {
  resetMocks();
  const control: SearchHarnessControl = { selectChat: null };
  let state!: SearchState;
  const view = render(
    <Harness
      initialSelectedChatId="chat-1"
      initialChatId="chat-1"
      control={control}
      capture={(nextState) => { state = nextState; }}
    />,
  );
  const searchInput = view.container.querySelector('[data-testid="message-search"]');
  const otherInput = view.container.querySelector('[data-testid="other-input"]');
  assert.ok(searchInput instanceof HTMLInputElement);
  assert.ok(otherInput instanceof HTMLInputElement);

  try {
    act(() => state.setDraft('cotação'));
    assert.equal(state.query, 'cotação');

    const ignoredShortcut = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      key: 'f',
    });
    act(() => otherInput.dispatchEvent(ignoredShortcut));
    assert.equal(ignoredShortcut.defaultPrevented, false);
    assert.equal(state.open, false);

    const searchShortcut = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      metaKey: true,
      key: 'f',
    });
    act(() => searchInput.dispatchEvent(searchShortcut));
    assert.equal(searchShortcut.defaultPrevented, true);
    assert.equal(state.open, true);
    await act(async () => { await new Promise((resolve) => window.setTimeout(resolve, 0)); });
    assert.equal(document.activeElement, searchInput);

    act(() => view.container.querySelector<HTMLButtonElement>('[data-testid="close"]')?.click());
    assert.equal(state.open, false);
    assert.equal(state.draft, '');
  } finally {
    view.unmount();
  }
});

test('limpa busca ao trocar de chat e consulta somente o chat resolvido com query normalizada', () => {
  resetMocks();
  const control: SearchHarnessControl = { selectChat: null };
  let state!: SearchState;
  const view = render(
    <Harness
      initialSelectedChatId="chat-1"
      initialChatId="chat-1"
      control={control}
      capture={(nextState) => { state = nextState; }}
    />,
  );

  try {
    act(() => {
      state.setDraft('  cotação  ');
      state.toggle();
    });

    const activeSearch = mocks.searchOptions[mocks.searchOptions.length - 1] as { chatId: string | null; enabled: boolean; query: string } | undefined;
    assert.deepEqual(activeSearch, { chatId: 'chat-1', enabled: true, query: 'cotação' });

    act(() => control.selectChat?.('chat-2', null));
    assert.equal(state.open, false);
    assert.equal(state.draft, '');
    assert.equal(state.query, '');

    const unresolvedChatSearch = mocks.searchOptions[mocks.searchOptions.length - 1] as { chatId: string | null; enabled: boolean; query: string } | undefined;
    assert.deepEqual(unresolvedChatSearch, { chatId: null, enabled: false, query: '' });
  } finally {
    view.unmount();
  }
});
