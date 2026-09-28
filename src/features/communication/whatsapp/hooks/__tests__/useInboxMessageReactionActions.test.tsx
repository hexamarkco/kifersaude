import assert from 'node:assert/strict';
import { act } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { CommWhatsAppMessage } from '../../domain/types';
import { useInboxMessageReactionActions } from '../useInboxMessageReactionActions';

type MockFunction = ((...args: unknown[]) => unknown) & {
  mockReset: () => MockFunction;
  mockResolvedValue: (value: unknown) => MockFunction;
  mockRejectedValue: (value: unknown) => MockFunction;
  mockReturnValueOnce: (value: unknown) => MockFunction;
  mock: { calls: unknown[][] };
};

const mocks = vi.hoisted(() => ({
  react: vi.fn() as unknown as MockFunction,
  star: vi.fn() as unknown as MockFunction,
  toastError: vi.fn() as unknown as MockFunction,
}));

vi.mock('../../data', () => ({
  whatsappMessagesRepository: { react: mocks.react, star: mocks.star },
}));

vi.mock('../../../../../lib/toast', () => ({
  toast: { error: mocks.toastError },
}));

type MessageReactionActions = ReturnType<typeof useInboxMessageReactionActions>;
type MessageReactionActionsOptions = Parameters<typeof useInboxMessageReactionActions>[0];

const Harness = ({ options, capture }: {
  options: MessageReactionActionsOptions;
  capture: (actions: MessageReactionActions) => void;
}) => {
  capture(useInboxMessageReactionActions(options));
  return null;
};

const createMessage = (metadata: Record<string, unknown> = {}): CommWhatsAppMessage => ({
  id: 'message-1',
  chat_id: 'chat-1',
  channel_id: 'channel-1',
  external_message_id: 'external-1',
  direction: 'outbound',
  message_type: 'text',
  delivery_status: 'sent',
  message_at: '2026-09-28T12:00:00.000Z',
  metadata,
  created_at: '2026-09-28T12:00:00.000Z',
});

const applyStateUpdate = <Value,>(update: Value | ((current: Value) => Value), previous: Value) => (
  typeof update === 'function' ? (update as (current: Value) => Value)(previous) : update
);

const createOptions = (message = createMessage()) => {
  const state = {
    message,
    openReactionPickerMessageId: 'message-1' as string | null,
    openMessageActionMenuMessageId: 'message-1' as string | null,
  };
  const options: MessageReactionActionsOptions = {
    selectedChatExternalId: 'contact-1@s.whatsapp.net',
    patchMessageLocally: (messageId, patch) => {
      if (messageId !== state.message.id) return;
      state.message = {
        ...state.message,
        ...patch,
        metadata: { ...state.message.metadata, ...(patch.metadata ?? {}) },
      };
    },
    setOpenReactionPickerMessageId: (update) => {
      state.openReactionPickerMessageId = applyStateUpdate(update, state.openReactionPickerMessageId);
    },
    setOpenMessageActionMenuMessageId: (update) => {
      state.openMessageActionMenuMessageId = applyStateUpdate(update, state.openMessageActionMenuMessageId);
    },
  };

  return { options, state };
};

const resetMocks = () => {
  mocks.react.mockReset();
  mocks.star.mockReset();
  mocks.toastError.mockReset();
};

const mountActions = (options: MessageReactionActionsOptions) => {
  let actions!: MessageReactionActions;
  const view = render(<Harness options={options} capture={(next) => { actions = next; }} />);
  return { view, get actions() { return actions; } };
};

test('alternar a própria reação preserva reações alheias e fecha o seletor', async () => {
  resetMocks();
  mocks.react.mockResolvedValue(undefined);
  const context = createOptions(createMessage({
    chat_id: 'contact-1@s.whatsapp.net',
    reactions: [
      { actor_key: 'other', emoji: '👏', from_me: false },
      { actor_key: 'self', emoji: '🔥', from_me: true },
    ],
  }));
  const mounted = mountActions(context.options);

  try {
    await act(async () => {
      await mounted.actions.handleReactToMessage(context.state.message, '🔥');
    });

    assert.deepEqual(mocks.react.mock.calls[0], [{
      chatId: 'contact-1@s.whatsapp.net',
      messageId: 'external-1',
      emoji: null,
    }]);
    assert.deepEqual(context.state.message.metadata.reactions, [
      { actor_key: 'other', emoji: '👏', from_me: false },
    ]);
    assert.ok(String(context.state.message.metadata.last_reaction_at).length > 0);
    assert.equal(context.state.openReactionPickerMessageId, null);
    assert.equal(mounted.actions.reactingMessageIds.has('message-1'), false);
  } finally {
    mounted.view.unmount();
  }
});

test('falha ao reagir restaura a reação anterior e libera o estado de operação', async () => {
  resetMocks();
  let rejectRequest!: (error: Error) => void;
  const request = new Promise<void>((_resolve, reject) => { rejectRequest = reject; });
  mocks.react.mockReturnValueOnce(request);
  const context = createOptions(createMessage({
    chat_id: 'contact-1@s.whatsapp.net',
    reactions: [
      { actor_key: 'other', emoji: '👏', from_me: false },
      { actor_key: 'self', emoji: '🔥', from_me: true },
    ],
  }));
  const mounted = mountActions(context.options);
  const originalError = console.error;
  console.error = () => undefined;

  try {
    let reactionRequest!: Promise<void>;
    act(() => {
      reactionRequest = mounted.actions.handleReactToMessage(context.state.message, '✅');
    });
    assert.ok(Array.isArray(context.state.message.metadata.reactions));
    assert.equal(context.state.message.metadata.reactions[1]?.emoji, '✅');
    assert.equal(mounted.actions.reactingMessageIds.has('message-1'), true);

    await act(async () => {
      rejectRequest(new Error('offline'));
      await reactionRequest;
    });

    assert.ok(Array.isArray(context.state.message.metadata.reactions));
    assert.equal(context.state.message.metadata.reactions.length, 2);
    assert.equal(context.state.message.metadata.reactions[0]?.emoji, '👏');
    assert.equal(context.state.message.metadata.reactions[1]?.emoji, '🔥');
    assert.equal(mocks.toastError.mock.calls[0]?.[0], 'offline');
    assert.equal(mounted.actions.reactingMessageIds.has('message-1'), false);
  } finally {
    mounted.view.unmount();
    console.error = originalError;
  }
});

test('ignora uma segunda reação concorrente na mesma mensagem', async () => {
  resetMocks();
  let resolveRequest!: () => void;
  const request = new Promise<void>((resolve) => { resolveRequest = resolve; });
  mocks.react.mockReturnValueOnce(request);
  const context = createOptions(createMessage({ chat_id: 'contact-1@s.whatsapp.net' }));
  const mounted = mountActions(context.options);

  try {
    let firstRequest!: Promise<void>;
    act(() => {
      firstRequest = mounted.actions.handleReactToMessage(context.state.message, '✅');
    });
    assert.equal(mounted.actions.reactingMessageIds.has('message-1'), true);

    await act(async () => {
      await mounted.actions.handleReactToMessage(context.state.message, '⚡');
      assert.equal(mocks.react.mock.calls.length, 1);
      resolveRequest();
      await firstRequest;
    });

    assert.equal(mounted.actions.reactingMessageIds.has('message-1'), false);
  } finally {
    mounted.view.unmount();
  }
});

test('estrelar atualiza otimisticamente e restaura os metadados se a persistência falhar', async () => {
  resetMocks();
  let rejectRequest!: (error: Error) => void;
  const request = new Promise<{ starred: boolean; starredAt: string | null }>((_resolve, reject) => { rejectRequest = reject; });
  mocks.star.mockReturnValueOnce(request);
  const context = createOptions(createMessage({ starred: false, starred_at: 'antes' }));
  const mounted = mountActions(context.options);
  const originalError = console.error;
  console.error = () => undefined;

  try {
    let starRequest!: Promise<void>;
    act(() => {
      starRequest = mounted.actions.handleToggleStarMessage(context.state.message);
    });
    assert.equal(context.state.message.metadata.starred, true);
    assert.equal(mounted.actions.starringMessageIds.has('message-1'), true);

    await act(async () => {
      rejectRequest(new Error('falha ao salvar estrela'));
      await starRequest;
    });

    assert.deepEqual(mocks.star.mock.calls[0], ['message-1', true]);
    assert.equal(context.state.message.metadata.starred, false);
    assert.equal(context.state.message.metadata.starred_at, 'antes');
    assert.equal(mocks.toastError.mock.calls[0]?.[0], 'falha ao salvar estrela');
    assert.equal(mounted.actions.starringMessageIds.has('message-1'), false);
  } finally {
    mounted.view.unmount();
    console.error = originalError;
  }
});

test('reação sem ID da conversa é rejeitada sem chamar o repository', async () => {
  resetMocks();
  const context = createOptions(createMessage());
  context.options.selectedChatExternalId = null;
  const mounted = mountActions(context.options);

  try {
    await act(async () => {
      await mounted.actions.handleReactToMessage(context.state.message, '✅');
    });

    assert.equal(mocks.react.mock.calls.length, 0);
    assert.equal(mocks.toastError.mock.calls[0]?.[0], 'Não foi possível identificar a conversa desta mensagem.');
    assert.equal(mounted.actions.reactingMessageIds.has('message-1'), false);
  } finally {
    mounted.view.unmount();
  }
});
