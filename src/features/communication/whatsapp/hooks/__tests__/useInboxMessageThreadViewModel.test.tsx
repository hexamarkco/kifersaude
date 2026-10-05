import assert from 'node:assert/strict';
import { useState } from 'react';
import { test } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { CommWhatsAppMessage } from '../../domain/types';
import { useInboxMessageThreadViewModel } from '../useInboxMessageThreadViewModel';

type Options = Omit<Parameters<typeof useInboxMessageThreadViewModel>[0], 'setLightboxMessageId'>;
type ViewModel = ReturnType<typeof useInboxMessageThreadViewModel>;
type Snapshot = { viewModel: ViewModel; lightboxMessageId: string | null };

const createMessage = (
  id: string,
  overrides: Partial<CommWhatsAppMessage> = {},
): CommWhatsAppMessage => ({
  id,
  chat_id: 'chat-1',
  channel_id: 'channel-1',
  direction: 'inbound',
  message_type: 'text',
  delivery_status: 'received',
  text_content: `Mensagem de teste ${id}`,
  message_at: '2026-09-28T12:00:00.000Z',
  metadata: {},
  created_at: '2026-09-28T12:00:00.000Z',
  ...overrides,
});

const createOptions = (overrides: Partial<Options> = {}): Options => ({
  messages: [],
  localOutgoingMessages: [],
  selectedChatId: null,
  applyOutgoingOrderToServerMessage: (message) => message,
  lightboxMessageId: null,
  openReactionPickerMessageId: null,
  openMessageActionMenuMessageId: null,
  messageDetailsMessageId: null,
  ...overrides,
});

const Harness = ({ options, capture }: {
  options: Options;
  capture: (snapshot: Snapshot) => void;
}) => {
  const [lightboxMessageId, setLightboxMessageId] = useState(options.lightboxMessageId);
  const viewModel = useInboxMessageThreadViewModel({ ...options, lightboxMessageId, setLightboxMessageId });
  capture({ viewModel, lightboxMessageId });
  return null;
};

test('mantém mensagens não selecionadas sem dedupe, oculta ações técnicas e limita mídia ao viewer', () => {
  const firstDuplicate = createMessage('duplicate-1', { text_content: 'Mensagem longa repetida no mesmo instante' });
  const secondDuplicate = createMessage('duplicate-2', { text_content: 'Mensagem longa repetida no mesmo instante' });
  const hiddenAction = createMessage('action', {
    direction: 'system',
    message_type: 'action',
    text_content: '[reacao]',
  });
  const deletedImage = createMessage('deleted-image', { message_type: 'image', delivery_status: 'deleted' });
  const image = createMessage('image', { message_type: 'image' });
  const systemNote = createMessage('system-note', { direction: 'system' });
  const appliedOrderIds: string[] = [];
  let snapshot!: Snapshot;
  const view = render(
    <Harness
      options={createOptions({
        messages: [firstDuplicate, hiddenAction, secondDuplicate, deletedImage, image, systemNote],
        applyOutgoingOrderToServerMessage: (message) => {
          appliedOrderIds.push(message.id);
          return message;
        },
      })}
      capture={(next) => { snapshot = next; }}
    />,
  );

  try {
    const model = snapshot.viewModel;
    assert.deepEqual(model.visibleMessages.map((message) => message.id), [
      'duplicate-1', 'duplicate-2', 'deleted-image', 'image', 'system-note',
    ]);
    assert.deepEqual(model.mediaViewerMessages.map((message) => message.id), ['image']);
    assert.equal(model.lastUsefulVisibleMessage?.id, 'image');
    assert.deepEqual(
      model.messageTimelineItems.filter((item) => item.type === 'message').map((item) => item.type === 'message' ? item.message.id : ''),
      model.visibleMessages.map((message) => message.id),
    );
    assert.deepEqual(appliedOrderIds, ['duplicate-1', 'duplicate-2', 'deleted-image', 'image', 'system-note']);
  } finally {
    view.unmount();
  }
});

test('oculta o evento Album e mantém as fotos agrupadas na conversa', () => {
  const first = createMessage('photo-1', { message_type: 'image', text_content: '[Imagem]', media_url: 'https://example.com/1.jpg' });
  const album = createMessage('album', { message_type: 'album', text_content: '[Album]' });
  const second = createMessage('photo-2', { message_type: 'image', text_content: '[Imagem]', media_url: 'https://example.com/2.jpg' });
  let snapshot!: Snapshot;
  const view = render(<Harness
    options={createOptions({ messages: [first, album, second] })}
    capture={(next) => { snapshot = next; }}
  />);
  try {
    assert.deepEqual(snapshot.viewModel.visibleMessages.map((message) => message.id), ['photo-1', 'photo-2']);
    const groups = snapshot.viewModel.messageTimelineItems.filter((item) => item.type === 'media-group');
    assert.equal(groups.length, 1);
    assert.deepEqual(groups[0].type === 'media-group' ? groups[0].messages.map((message) => message.id) : [], ['photo-1', 'photo-2']);
  } finally {
    view.unmount();
  }
});

test('mescla apenas mensagens otimistas da conversa ativa e resolve seleções obsoletas', () => {
  const early = createMessage('early', { message_at: '2026-09-28T12:00:00.000Z' });
  const late = createMessage('late', { message_at: '2026-09-28T12:02:00.000Z' });
  const local = createMessage('local', {
    direction: 'outbound',
    source: 'local',
    message_at: '2026-09-28T12:03:00.000Z',
  });
  const otherChatLocal = createMessage('other-chat-local', {
    chat_id: 'chat-2',
    direction: 'outbound',
    source: 'local',
    message_at: '2026-09-28T12:04:00.000Z',
  });
  let snapshot!: Snapshot;
  const view = render(
    <Harness
      options={createOptions({
        messages: [late, early],
        localOutgoingMessages: [local, otherChatLocal],
        selectedChatId: 'chat-1',
        openReactionPickerMessageId: 'early',
        openMessageActionMenuMessageId: 'local',
        messageDetailsMessageId: 'missing',
      })}
      capture={(next) => { snapshot = next; }}
    />,
  );

  try {
    assert.deepEqual(snapshot.viewModel.visibleMessages.map((message) => message.id), ['early', 'late', 'local']);
    assert.equal(snapshot.viewModel.openReactionPickerMessage?.id, 'early');
    assert.equal(snapshot.viewModel.openMessageActionMenuMessage?.id, 'local');
    assert.equal(snapshot.viewModel.messageDetailsMessage, null);
    assert.equal(snapshot.viewModel.visibleMessages.some((message) => message.chat_id === 'chat-2'), false);
  } finally {
    view.unmount();
  }
});

test('fecha a lightbox quando a mensagem deixa de ser mídia visualizável', () => {
  const deletedImage = createMessage('deleted-image', { message_type: 'image', delivery_status: 'deleted' });
  let snapshot!: Snapshot;
  const view = render(
    <Harness
      options={createOptions({ messages: [deletedImage], lightboxMessageId: 'deleted-image' })}
      capture={(next) => { snapshot = next; }}
    />,
  );

  try {
    assert.equal(snapshot.lightboxMessageId, null);
  } finally {
    view.unmount();
  }
});
