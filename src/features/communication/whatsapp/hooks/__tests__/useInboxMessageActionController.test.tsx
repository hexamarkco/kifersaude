import assert from 'node:assert/strict';
import { act, useState } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { InboxPointerAnchor } from '../../domain/inboxOverlayPosition';
import type { CommWhatsAppChat, CommWhatsAppMessage } from '../../domain/types';
import { useInboxMessageActionController } from '../useInboxMessageActionController';

const mocks = vi.hoisted(() => ({
  react: vi.fn(),
  star: vi.fn(),
  edit: vi.fn(),
  delete: vi.fn(),
  transcribe: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('../../data', () => ({
  whatsappMessagesRepository: {
    react: mocks.react,
    star: mocks.star,
    edit: mocks.edit,
    delete: mocks.delete,
    transcribe: mocks.transcribe,
  },
}));

vi.mock('../../../../../lib/toast', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

type Controller = ReturnType<typeof useInboxMessageActionController>;
type Snapshot = {
  controller: Controller;
  messages: CommWhatsAppMessage[];
  openReactionPickerMessageId: string | null;
  openMessageActionMenuMessageId: string | null;
  messageActionMenuPointerAnchor: InboxPointerAnchor | null;
  messageDetailsMessageId: string | null;
};

const createMessage = (overrides: Partial<CommWhatsAppMessage> = {}): CommWhatsAppMessage => ({
  id: 'message-1',
  chat_id: 'chat-1',
  channel_id: 'channel-1',
  external_message_id: 'external-1',
  direction: 'outbound',
  message_type: 'text',
  delivery_status: 'read',
  text_content: 'Mensagem enviada',
  message_at: '2026-09-28T12:00:00.000Z',
  metadata: { preserved: 'sim' },
  created_at: '2026-09-28T12:00:00.000Z',
  ...overrides,
});

const createChat = (): CommWhatsAppChat => ({
  id: 'chat-1',
  channel_id: 'channel-1',
  external_chat_id: 'contact-1@s.whatsapp.net',
  is_group: false,
  phone_number: '+55 11 99999-9999',
  phone_digits: '5511999999999',
  display_name: 'Contato',
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
  last_message_direction: 'outbound',
  unread_count: 0,
  status: 'open',
  autonomous_attendance_status: 'inactive',
  created_at: '2026-09-28T11:00:00.000Z',
  updated_at: '2026-09-28T12:00:00.000Z',
});

const Harness = ({ capture, initialMessage = createMessage() }: {
  capture: (snapshot: Snapshot) => void;
  initialMessage?: CommWhatsAppMessage;
}) => {
  const [messages, setMessages] = useState([initialMessage]);
  const [, setChats] = useState([createChat()]);
  const [openReactionPickerMessageId, setOpenReactionPickerMessageId] = useState<string | null>(null);
  const [openMessageActionMenuMessageId, setOpenMessageActionMenuMessageId] = useState<string | null>(null);
  const [messageActionMenuPointerAnchor, setMessageActionMenuPointerAnchor] = useState<InboxPointerAnchor | null>(null);
  const [messageDetailsMessageId, setMessageDetailsMessageId] = useState<string | null>(null);
  const controller = useInboxMessageActionController({
    selectedChatId: 'chat-1',
    selectedChatExternalId: 'contact-1@s.whatsapp.net',
    setMessages,
    setChats,
    uiState: {
      setOpenReactionPickerMessageId,
      setOpenMessageActionMenuMessageId,
      setMessageActionMenuPointerAnchor,
      setMessageDetailsMessageId,
    },
  });

  capture({
    controller,
    messages,
    openReactionPickerMessageId,
    openMessageActionMenuMessageId,
    messageActionMenuPointerAnchor,
    messageDetailsMessageId,
  });
  return null;
};

test('coordena reação, menu contextual, edição e detalhes sem deixar âncora obsoleta', () => {
  let snapshot!: Snapshot;
  const message = createMessage();
  const view = render(<Harness initialMessage={message} capture={(next) => { snapshot = next; }} />);

  try {
    act(() => snapshot.controller.handleToggleReactionPicker(message.id));
    assert.equal(snapshot.openReactionPickerMessageId, message.id);

    const anchor = { x: 80, y: 120 };
    act(() => snapshot.controller.handleOpenMessageActionMenuFromContext(message.id, anchor));
    assert.equal(snapshot.openReactionPickerMessageId, null);
    assert.equal(snapshot.openMessageActionMenuMessageId, message.id);
    assert.deepEqual(snapshot.messageActionMenuPointerAnchor, anchor);

    act(() => snapshot.controller.handleOpenEditMessageModal(message));
    assert.equal(snapshot.openMessageActionMenuMessageId, null);
    assert.equal(snapshot.messageActionMenuPointerAnchor, null);
    assert.equal(snapshot.controller.editingMessage?.id, message.id);

    act(() => snapshot.controller.handleCloseEditMessageModal());
    act(() => snapshot.controller.handleOpenMessageActionMenuFromContext(message.id, anchor));
    act(() => snapshot.controller.handleOpenMessageDetails(message));
    assert.equal(snapshot.openMessageActionMenuMessageId, null);
    assert.equal(snapshot.messageActionMenuPointerAnchor, null);
    assert.equal(snapshot.messageDetailsMessageId, message.id);

    act(() => snapshot.controller.closeMessageDetails());
    assert.equal(snapshot.messageDetailsMessageId, null);
  } finally {
    view.unmount();
  }
});

test('patch otimista preserva metadados locais e não regride status de entrega', () => {
  let snapshot!: Snapshot;
  const view = render(<Harness capture={(next) => { snapshot = next; }} />);

  try {
    act(() => snapshot.controller.patchMessageLocally('message-1', {
      delivery_status: 'delivered',
      metadata: { starred: true },
    }));

    assert.equal(snapshot.messages[0]?.delivery_status, 'read');
    assert.equal(snapshot.messages[0]?.metadata.preserved, 'sim');
    assert.equal(snapshot.messages[0]?.metadata.starred, true);
  } finally {
    view.unmount();
  }
});
