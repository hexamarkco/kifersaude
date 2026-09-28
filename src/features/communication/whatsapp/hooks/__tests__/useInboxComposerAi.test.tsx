import assert from 'node:assert/strict';
import { act, useRef, useState } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import { useInboxComposerAi } from '../useInboxComposerAi';

type MockFunction = ((...args: unknown[]) => unknown) & {
  mockReset: () => MockFunction;
  mockResolvedValue: (value: unknown) => MockFunction;
  mockImplementation: (implementation: (...args: unknown[]) => unknown) => MockFunction;
  mock: { calls: unknown[][] };
};

const mocks = vi.hoisted(() => ({
  rewrite: vi.fn() as unknown as MockFunction,
  suggestReply: vi.fn() as unknown as MockFunction,
  toastError: vi.fn() as unknown as MockFunction,
  toastSuccess: vi.fn() as unknown as MockFunction,
}));

vi.mock('../../data', () => ({
  whatsappFollowUpService: {
    rewrite: mocks.rewrite,
    suggestReply: mocks.suggestReply,
  },
}));

vi.mock('../../../../../lib/toast', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

type ComposerAi = ReturnType<typeof useInboxComposerAi>;
type HarnessControls = {
  ai: ComposerAi;
  selectedChatId: string;
  messageDraft: string;
  composerSelection: { start: number; end: number };
  changeChat: () => void;
  changeDraft: (value: string) => void;
  changeSuggestionKey: () => void;
};

let controls: HarnessControls;

const Harness = () => {
  const [selectedChatId, setSelectedChatId] = useState<string | null>('chat-1');
  const selectedChatIdRef = useRef(selectedChatId);
  selectedChatIdRef.current = selectedChatId;
  const [messageDraft, setMessageDraft] = useState('Rascunho original');
  const messageDraftRef = useRef(messageDraft);
  messageDraftRef.current = messageDraft;
  const [composerSelection, setComposerSelection] = useState({ start: 0, end: 0 });
  const [replySuggestionKey, setReplySuggestionKey] = useState('chat-1:message-1');
  const ai = useInboxComposerAi({
    selectedChatId,
    selectedChatIdRef,
    replySuggestionKey,
    replySuggestionDisabledReason: null,
    composerRewriteDisabledReason: null,
    messageDraft,
    messageDraftRef,
    setMessageDraft,
    setComposerSelection,
    setComposerFocused: () => undefined,
    composerTextareaRef: { current: null },
  });

  controls = {
    ai,
    selectedChatId: selectedChatId ?? '',
    messageDraft,
    composerSelection,
    changeChat: () => setSelectedChatId('chat-2'),
    changeDraft: setMessageDraft,
    changeSuggestionKey: () => setReplySuggestionKey('chat-1:message-2'),
  };
  return null;
};

const resetMocks = () => {
  mocks.rewrite.mockReset();
  mocks.suggestReply.mockReset();
  mocks.toastError.mockReset();
  mocks.toastSuccess.mockReset();
};

test('gera sugestão no contexto atual e aplica texto normalizado ao composer', async () => {
  resetMocks();
  mocks.suggestReply.mockResolvedValue({ text: '  Olá, tudo bem?  ' });
  const view = render(<Harness />);

  await act(async () => {
    await controls.ai.handleGenerateReplySuggestion(true);
  });

  assert.deepEqual(mocks.suggestReply.mock.calls, [[{
    chatId: 'chat-1',
    composerDraft: 'Rascunho original',
    mode: 'complete_draft',
  }]]);
  assert.equal(controls.ai.replySuggestionText, 'Olá, tudo bem?');
  assert.equal(controls.ai.replySuggestionLoading, false);

  act(() => controls.ai.handleApplyReplySuggestion());
  assert.equal(controls.messageDraft, 'Olá, tudo bem?');
  assert.deepEqual(controls.composerSelection, { start: 14, end: 14 });
  assert.equal(controls.ai.replySuggestionText, '');
  view.unmount();
});

test('descarta sugestão que termina depois de mudar a chave do contexto', async () => {
  resetMocks();
  let resolveSuggestion: (value: { text: string }) => void = () => undefined;
  mocks.suggestReply.mockImplementation(() => new Promise((resolve) => {
    resolveSuggestion = resolve;
  }));
  const view = render(<Harness />);
  let pending: Promise<void> = Promise.resolve();

  act(() => {
    pending = controls.ai.handleGenerateReplySuggestion();
  });
  act(() => controls.changeSuggestionKey());
  await act(async () => {
    resolveSuggestion({ text: 'Resposta antiga' });
    await pending;
  });

  assert.equal(controls.ai.replySuggestionText, '');
  assert.equal(controls.ai.replySuggestionLoading, false);
  view.unmount();
});

test('reescreve no modal e ignora resultado após fechar a sessão de edição', async () => {
  resetMocks();
  let resolveRewrite: (value: { text: string }) => void = () => undefined;
  mocks.rewrite.mockImplementation(() => new Promise((resolve) => {
    resolveRewrite = resolve;
  }));
  const view = render(<Harness />);

  act(() => controls.ai.handleOpenComposerRewriteModal());
  assert.equal(controls.ai.composerRewriteModalOpen, true);
  act(() => controls.ai.handleRegenerateComposerRewrite());
  act(() => controls.ai.handleCloseComposerRewriteModal());
  await act(async () => {
    resolveRewrite({ text: 'Texto reescrito' });
    await Promise.resolve();
  });

  assert.equal(controls.ai.composerRewriteModalOpen, false);
  assert.equal(controls.ai.composerRewriteDraft, '');
  assert.equal(controls.ai.rewritingComposer, false);
  view.unmount();
});

test('reescrita rápida só aplica se o rascunho original permanecer igual', async () => {
  resetMocks();
  let resolveRewrite: (value: { text: string }) => void = () => undefined;
  mocks.rewrite.mockImplementation(() => new Promise((resolve) => {
    resolveRewrite = resolve;
  }));
  const view = render(<Harness />);

  act(() => controls.ai.handleQuickRewriteComposerText('grammar'));
  act(() => controls.changeDraft('Novo texto do operador'));
  await act(async () => {
    resolveRewrite({ text: 'Texto corrigido' });
    await Promise.resolve();
  });

  assert.equal(controls.messageDraft, 'Novo texto do operador');
  assert.equal(mocks.toastSuccess.mock.calls.length, 0);
  view.unmount();
});
