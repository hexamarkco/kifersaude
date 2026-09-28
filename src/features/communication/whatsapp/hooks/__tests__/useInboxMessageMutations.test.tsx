import assert from 'node:assert/strict';
import { act, useState } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { CommWhatsAppChat, CommWhatsAppMessage } from '../../domain/types';
import { useInboxMessageMutations } from '../useInboxMessageMutations';

type MockFunction = ((...args: unknown[]) => unknown) & {
  mockReset: () => MockFunction;
  mockResolvedValue: (value: unknown) => MockFunction;
  mockResolvedValueOnce: (value: unknown) => MockFunction;
  mockRejectedValueOnce: (value: unknown) => MockFunction;
  mockReturnValueOnce: (value: unknown) => MockFunction;
  mock: { calls: unknown[][] };
};

const mocks = vi.hoisted(() => ({
  edit: vi.fn() as unknown as MockFunction,
  delete: vi.fn() as unknown as MockFunction,
  transcribe: vi.fn() as unknown as MockFunction,
  toastError: vi.fn() as unknown as MockFunction,
  toastSuccess: vi.fn() as unknown as MockFunction,
}));

vi.mock('../../data', () => ({
  whatsappMessagesRepository: {
    edit: mocks.edit,
    delete: mocks.delete,
    transcribe: mocks.transcribe,
  },
}));

vi.mock('../../../../../lib/toast', () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}));

type MessageMutations = ReturnType<typeof useInboxMessageMutations>;
type MessageMutationsOptions = Parameters<typeof useInboxMessageMutations>[0];

const Harness = ({ options, capture }: {
  options: MessageMutationsOptions;
  capture: (mutations: MessageMutations) => void;
}) => {
  capture(useInboxMessageMutations(options));
  return null;
};

const ChatChangeHarness = ({ options, capture }: {
  options: MessageMutationsOptions;
  capture: (controls: { mutations: MessageMutations; switchChat: () => void }) => void;
}) => {
  const [selectedChatId, setSelectedChatId] = useState(options.selectedChatId);
  const mutations = useInboxMessageMutations({ ...options, selectedChatId });
  capture({ mutations, switchChat: () => setSelectedChatId('chat-2') });
  return null;
};

const createChat = (id = 'chat-1', lastMessageAt = '2026-09-28T12:00:00.000Z'): CommWhatsAppChat => ({
  id,
  channel_id: 'channel-1',
  external_chat_id: `${id}@s.whatsapp.net`,
  is_group: false,
  phone_number: '+55 11 99999-9999',
  phone_digits: '5511999999999',
  display_name: id,
  merged_into_chat_id: null,
  lead_link_source: null,
  lead_linked_at: null,
  lead_linked_by: null,
  auto_link_blocked: false,
  identity_conflict: false,
  is_archived: false,
  is_muted: false,
  is_pinned: false,
  manual_unread: false,
  last_message_at: lastMessageAt,
  last_message_text: 'Mensagem anterior',
  last_message_direction: 'outbound',
  unread_count: 0,
  status: 'open',
  autonomous_attendance_status: 'inactive',
  created_at: '2026-09-28T12:00:00.000Z',
  updated_at: '2026-09-28T12:00:00.000Z',
});

const createMessage = (overrides: Partial<CommWhatsAppMessage> = {}): CommWhatsAppMessage => ({
  id: 'message-1',
  chat_id: 'chat-1',
  channel_id: 'channel-1',
  external_message_id: 'external-1',
  direction: 'outbound',
  message_type: 'text',
  delivery_status: 'sent',
  text_content: 'Texto anterior',
  message_at: '2026-09-28T12:00:00.000Z',
  metadata: {},
  created_at: '2026-09-28T12:00:00.000Z',
  ...overrides,
});

const applyStateUpdate = <Value,>(update: Value | ((current: Value) => Value), previous: Value) => (
  typeof update === 'function' ? (update as (current: Value) => Value)(previous) : update
);

const createOptions = (message = createMessage()) => {
  const state = {
    messages: [message],
    chats: [createChat()],
    menuCloseCount: 0,
  };
  const options: MessageMutationsOptions = {
    selectedChatId: 'chat-1',
    patchMessageLocally: (messageId, patch) => {
      state.messages = state.messages.map((current) => current.id === messageId
        ? {
            ...current,
            ...patch,
            metadata: patch.metadata ? { ...current.metadata, ...patch.metadata } : current.metadata,
          }
        : current);
    },
    setChats: (update) => {
      state.chats = applyStateUpdate(update, state.chats);
    },
    closeMessageActionMenu: () => { state.menuCloseCount += 1; },
  };

  return { options, state };
};

const mountMutations = (options: MessageMutationsOptions) => {
  let mutations!: MessageMutations;
  const view = render(<Harness options={options} capture={(next) => { mutations = next; }} />);
  return { view, get mutations() { return mutations; } };
};

const resetMocks = () => {
  mocks.edit.mockReset();
  mocks.delete.mockReset();
  mocks.transcribe.mockReset();
  mocks.toastError.mockReset();
  mocks.toastSuccess.mockReset();
};

test('só abre edição para mensagem própria editável e fecha o menu de ações', () => {
  resetMocks();
  const context = createOptions();
  const mounted = mountMutations(context.options);

  try {
    act(() => mounted.mutations.handleOpenEditMessageModal(createMessage({ direction: 'inbound' })));
    assert.equal(Boolean(mounted.mutations.editingMessage), false);
    assert.equal(mocks.toastError.mock.calls[0]?.[0], 'Esta mensagem não pode ser editada no momento.');

    act(() => mounted.mutations.handleOpenEditMessageModal(context.state.messages[0]!));
    assert.equal(mounted.mutations.editingMessage?.id ?? null, 'message-1');
    assert.equal(mounted.mutations.editingMessageDraft, 'Texto anterior');
    assert.equal(context.state.menuCloseCount, 1);
  } finally {
    mounted.view.unmount();
  }
});

test('rascunho vazio é rejeitado; texto sem alteração fecha o modal sem chamada remota', async () => {
  resetMocks();
  const context = createOptions();
  const mounted = mountMutations(context.options);

  try {
    act(() => mounted.mutations.handleOpenEditMessageModal(context.state.messages[0]!));
    act(() => mounted.mutations.setEditingMessageDraft('   '));
    await act(async () => { await mounted.mutations.handleSaveEditedMessage(); });

    assert.equal(mocks.edit.mock.calls.length, 0);
    assert.equal(mocks.toastError.mock.calls[0]?.[0], 'Digite o novo texto da mensagem.');
    assert.equal(mounted.mutations.editingMessage?.id, 'message-1');

    act(() => mounted.mutations.setEditingMessageDraft(' Texto anterior '));
    await act(async () => { await mounted.mutations.handleSaveEditedMessage(); });

    assert.equal(mocks.edit.mock.calls.length, 0);
    assert.equal(mounted.mutations.editingMessage, null);
  } finally {
    mounted.view.unmount();
  }
});

test('edição persiste o texto normalizado, limita histórico e sincroniza apenas o preview correspondente', async () => {
  resetMocks();
  mocks.edit.mockResolvedValue({ editedText: 'Texto confirmado', editedAt: '2026-09-28T12:30:00.000Z' });
  const history = Array.from({ length: 11 }, (_, index) => ({ at: `antes-${index}` }));
  const context = createOptions(createMessage({ metadata: { edit_history: history, custom: 'preservado' } }));
  context.state.chats.push(createChat('chat-2'));
  const mounted = mountMutations(context.options);

  try {
    act(() => mounted.mutations.handleOpenEditMessageModal(context.state.messages[0]!));
    act(() => mounted.mutations.setEditingMessageDraft('  novo texto  '));
    await act(async () => { await mounted.mutations.handleSaveEditedMessage(); });

    assert.deepEqual(mocks.edit.mock.calls[0], ['message-1', 'novo texto']);
    const edited = context.state.messages[0]!;
    assert.equal(edited.text_content, 'Texto confirmado');
    assert.equal(edited.status_updated_at, '2026-09-28T12:30:00.000Z');
    assert.equal(edited.metadata.custom, 'preservado');
    assert.equal(edited.metadata.edited, true);
    assert.equal(edited.metadata.original_text_content, 'Texto anterior');
    assert.equal((edited.metadata.edit_history as unknown[]).length, 10);
    assert.equal(context.state.chats[0]?.last_message_text, 'Texto confirmado');
    assert.equal(context.state.chats[0]?.updated_at, '2026-09-28T12:30:00.000Z');
    assert.equal(context.state.chats[1]?.last_message_text, 'Mensagem anterior');
    assert.equal(mounted.mutations.savingMessageEdit, false);
    assert.equal(mounted.mutations.editingMessage, null);
    assert.equal(mocks.toastSuccess.mock.calls[0]?.[0], 'Mensagem editada no WhatsApp.');
  } finally {
    mounted.view.unmount();
  }
});

test('edição de mídia atualiza a legenda sem trocar a referência do arquivo', async () => {
  resetMocks();
  mocks.edit.mockResolvedValue({ editedText: 'Legenda nova', editedAt: null });
  const image = createMessage({
    message_type: 'image',
    text_content: null,
    media_caption: 'Legenda antiga',
    media_id: 'media-1',
    media_url: 'https://media.example/image.jpg',
  });
  const context = createOptions(image);
  const mounted = mountMutations(context.options);

  try {
    act(() => mounted.mutations.handleOpenEditMessageModal(context.state.messages[0]!));
    assert.equal(mounted.mutations.editingMessageDraft, 'Legenda antiga');
    act(() => mounted.mutations.setEditingMessageDraft('Legenda nova'));
    await act(async () => { await mounted.mutations.handleSaveEditedMessage(); });

    const edited = context.state.messages[0]!;
    assert.equal(edited.text_content, 'Legenda nova');
    assert.equal(edited.media_caption, 'Legenda nova');
    assert.equal(edited.media_id, 'media-1');
    assert.equal(edited.media_url, 'https://media.example/image.jpg');
  } finally {
    mounted.view.unmount();
  }
});

test('falha na edição não aplica patch e libera nova tentativa', async () => {
  resetMocks();
  mocks.edit.mockRejectedValueOnce(new Error('provedor indisponível'));
  mocks.edit.mockResolvedValue({ editedText: 'Nova tentativa', editedAt: null });
  const context = createOptions();
  const mounted = mountMutations(context.options);
  const originalError = console.error;
  console.error = () => undefined;

  try {
    act(() => mounted.mutations.handleOpenEditMessageModal(context.state.messages[0]!));
    act(() => mounted.mutations.setEditingMessageDraft('Nova tentativa'));
    await act(async () => { await mounted.mutations.handleSaveEditedMessage(); });

    assert.equal(context.state.messages[0]?.text_content, 'Texto anterior');
    assert.equal(mounted.mutations.savingMessageEdit, false);
    assert.equal(mocks.toastError.mock.calls[0]?.[0], 'provedor indisponível');

    await act(async () => { await mounted.mutations.handleSaveEditedMessage(); });
    assert.equal(mocks.edit.mock.calls.length, 2);
    assert.equal(context.state.messages[0]?.text_content, 'Nova tentativa');
  } finally {
    mounted.view.unmount();
    console.error = originalError;
  }
});

test('editor é descartado quando o usuário muda de conversa', () => {
  resetMocks();
  const context = createOptions();
  let controls!: { mutations: MessageMutations; switchChat: () => void };
  const view = render(<ChatChangeHarness options={context.options} capture={(next) => { controls = next; }} />);

  try {
    act(() => controls.mutations.handleOpenEditMessageModal(context.state.messages[0]!));
    act(() => controls.switchChat());

    assert.equal(controls.mutations.editingMessage?.id ?? null, null);
    assert.equal(controls.mutations.editingMessageDraft, '');
  } finally {
    view.unmount();
  }
});

test('exclusão preserva o texto e atualiza o preview somente quando a mensagem é a última do chat', async () => {
  resetMocks();
  let finishDelete!: (value: { deletedAt: string | null }) => void;
  mocks.delete.mockReturnValueOnce(new Promise((resolve) => { finishDelete = resolve; }));
  const context = createOptions(createMessage({ metadata: { custom: 'preservado' } }));
  context.state.chats.push(createChat('chat-2'));
  const mounted = mountMutations(context.options);

  try {
    let deletion!: Promise<void>;
    act(() => { deletion = mounted.mutations.handleDeleteMessage(context.state.messages[0]!); });
    assert.equal(mounted.mutations.deletingMessageId, 'message-1');
    assert.deepEqual(mocks.delete.mock.calls[0], ['message-1']);

    await act(async () => {
      finishDelete({ deletedAt: '2026-09-28T12:45:00.000Z' });
      await deletion;
    });

    const deleted = context.state.messages[0]!;
    assert.equal(deleted.delivery_status, 'deleted');
    assert.equal(deleted.status_updated_at, '2026-09-28T12:45:00.000Z');
    assert.equal(deleted.metadata.custom, 'preservado');
    assert.equal(deleted.metadata.deleted_original_text_content, 'Texto anterior');
    assert.equal(context.state.chats[0]?.last_message_text, '[Apagada] Texto anterior');
    assert.equal(context.state.chats[0]?.updated_at, '2026-09-28T12:45:00.000Z');
    assert.equal(context.state.chats[1]?.last_message_text, 'Mensagem anterior');
    assert.equal(mounted.mutations.deletingMessageId, null);
  } finally {
    mounted.view.unmount();
  }
});

test('exclusões concorrentes da mesma mensagem são deduplicadas e mensagens recebidas são rejeitadas', async () => {
  resetMocks();
  let finishDelete!: (value: { deletedAt: string | null }) => void;
  mocks.delete.mockReturnValueOnce(new Promise((resolve) => { finishDelete = resolve; }));
  const context = createOptions();
  const mounted = mountMutations(context.options);

  try {
    act(() => { void mounted.mutations.handleDeleteMessage(context.state.messages[0]!); });
    await act(async () => { await mounted.mutations.handleDeleteMessage(context.state.messages[0]!); });
    assert.equal(mocks.delete.mock.calls.length, 1);

    await act(async () => {
      finishDelete({ deletedAt: null });
      await Promise.resolve();
    });
    await act(async () => { await mounted.mutations.handleDeleteMessage(createMessage({ direction: 'inbound' })); });

    assert.equal(mocks.delete.mock.calls.length, 1);
    assert.equal(mocks.toastError.mock.calls[0]?.[0], 'Esta mensagem não pode ser apagada no momento.');
  } finally {
    mounted.view.unmount();
  }
});

test('transcrição publica estado pendente, força retry quando há falha e aplica o resultado do serviço', async () => {
  resetMocks();
  let finishTranscription!: (value: {
    transcription_text: string;
    transcription_status: 'completed';
    transcription_provider?: string;
    transcription_model?: string;
  }) => void;
  mocks.transcribe.mockReturnValueOnce(new Promise((resolve) => { finishTranscription = resolve; }));
  const message = createMessage({ transcription_status: 'failed', transcription_error: 'erro antigo' });
  const context = createOptions(message);
  const mounted = mountMutations(context.options);

  try {
    let transcription!: Promise<void>;
    act(() => { transcription = mounted.mutations.handleTranscribeMessage(message); });
    assert.deepEqual(mocks.transcribe.mock.calls[0], ['message-1', { force: true }]);
    assert.equal(mounted.mutations.transcribingMessageId, 'message-1');
    assert.equal(context.state.messages[0]?.transcription_status, 'processing');
    assert.equal(context.state.messages[0]?.transcription_error, null);

    await act(async () => {
      finishTranscription({
        transcription_text: 'áudio convertido',
        transcription_status: 'completed',
        transcription_provider: 'provider',
        transcription_model: 'model',
      });
      await transcription;
    });

    assert.equal(context.state.messages[0]?.transcription_text, 'áudio convertido');
    assert.equal(context.state.messages[0]?.transcription_status, 'completed');
    assert.equal(context.state.messages[0]?.transcription_provider, 'provider');
    assert.equal(context.state.messages[0]?.transcription_model, 'model');
    assert.equal(context.state.messages[0]?.transcription_error, null);
    assert.equal(mounted.mutations.transcribingMessageId, null);
    assert.equal(mocks.toastSuccess.mock.calls[0]?.[0], 'Transcrição concluída.');
  } finally {
    mounted.view.unmount();
  }
});

test('transcrições concorrentes da mesma mensagem não chamam o serviço duas vezes', async () => {
  resetMocks();
  let finishTranscription!: (value: {
    transcription_text: string;
    transcription_status: 'completed';
  }) => void;
  mocks.transcribe.mockReturnValueOnce(new Promise((resolve) => { finishTranscription = resolve; }));
  const context = createOptions();
  const mounted = mountMutations(context.options);

  try {
    let transcription!: Promise<void>;
    act(() => { transcription = mounted.mutations.handleTranscribeMessage(context.state.messages[0]!); });
    await act(async () => {
      await mounted.mutations.handleTranscribeMessage(context.state.messages[0]!);
      assert.equal(mocks.transcribe.mock.calls.length, 1);
      finishTranscription({ transcription_text: 'texto', transcription_status: 'completed' });
      await transcription;
    });

    assert.equal(mounted.mutations.transcribingMessageId, null);
    assert.equal(context.state.messages[0]?.transcription_text, 'texto');
  } finally {
    mounted.view.unmount();
  }
});

test('falha de transcrição fica visível na mensagem e libera o estado de operação', async () => {
  resetMocks();
  mocks.transcribe.mockRejectedValueOnce(new Error('áudio ilegível'));
  const context = createOptions();
  const mounted = mountMutations(context.options);

  try {
    await act(async () => { await mounted.mutations.handleTranscribeMessage(context.state.messages[0]!); });

    assert.deepEqual(mocks.transcribe.mock.calls[0], ['message-1', { force: false }]);
    assert.equal(context.state.messages[0]?.transcription_status, 'failed');
    assert.equal(context.state.messages[0]?.transcription_error, 'áudio ilegível');
    assert.equal(mounted.mutations.transcribingMessageId, null);
    assert.equal(mocks.toastError.mock.calls[0]?.[0], 'áudio ilegível');
  } finally {
    mounted.view.unmount();
  }
});
