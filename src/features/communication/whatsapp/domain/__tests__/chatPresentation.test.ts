import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  getSafeChatDisplayName,
  mergeUniqueChats,
  preserveUsefulChatPreview,
  rankChatsBySearch,
  sortChatsByInboxOrder,
  stabilizeChatIdentityForLocalMerge,
} from '../chatPresentation';
import type { CommWhatsAppChat } from '../types';

const createChat = (overrides: Partial<CommWhatsAppChat> = {}): CommWhatsAppChat => ({
  id: 'chat-1',
  channel_id: 'channel-1',
  external_chat_id: '5511999999999@s.whatsapp.net',
  phone_number: '5511999999999',
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
  last_message_text: 'Mensagem atual',
  last_message_direction: 'inbound',
  last_message_at: '2026-09-08T12:00:00.000Z',
  last_message_delivery_status: 'delivered',
  unread_count: 0,
  status: 'open',
  autonomous_attendance_status: 'inactive',
  created_at: '2026-09-08T12:00:00.000Z',
  updated_at: '2026-09-08T12:00:00.000Z',
  ...overrides,
});

test('sorts pinned chats first and keeps the newest pin first', () => {
  const regular = createChat({ id: 'regular', last_message_at: '2026-09-08T15:00:00.000Z' });
  const olderPin = createChat({ id: 'older-pin', is_pinned: true, pinned_at: '2026-09-08T10:00:00.000Z' });
  const newerPin = createChat({ id: 'newer-pin', is_pinned: true, pinned_at: '2026-09-08T11:00:00.000Z' });

  assert.deepEqual(
    sortChatsByInboxOrder([regular, olderPin, newerPin]).map((chat) => chat.id),
    ['newer-pin', 'older-pin', 'regular'],
  );
});

test('preserves a useful newer preview when a stale chat update arrives', () => {
  const previous = createChat({
    last_message_text: 'Mensagem mais recente',
    last_message_at: '2026-09-08T12:05:00.000Z',
    last_message_delivery_status: 'read',
  });
  const incoming = createChat({
    last_message_text: '[Mensagem]',
    last_message_at: '2026-09-08T12:00:00.000Z',
    last_message_delivery_status: 'sent',
  });

  const result = preserveUsefulChatPreview(incoming, previous);
  assert.equal(result.last_message_text, 'Mensagem mais recente');
  assert.equal(result.last_message_at, previous.last_message_at);
  assert.equal(result.last_message_delivery_status, 'read');
});

test('chooses stable contact names and hides a leaked connected-user name', () => {
  const namedChat = createChat({
    saved_contact_name: 'Contato salvo',
    lead_name: 'Nome do lead',
    push_name: 'Nome do WhatsApp',
  });
  const leakedOwnName = createChat({ display_name: 'Atendente', saved_contact_name: null, lead_id: null });

  assert.equal(getSafeChatDisplayName(namedChat), 'Contato salvo');
  assert.equal(getSafeChatDisplayName(leakedOwnName, 'Atendente'), '+55 (11) 99999-9999');
});

test('keeps known identity fields while merging a partial update for the same lead', () => {
  const previous = createChat({
    saved_contact_name: 'Maria',
    lead_id: 'lead-1',
    lead_name: 'Maria da Silva',
    lead_link_source: 'manual',
    lead_linked_at: '2026-09-08T11:00:00.000Z',
    lead_linked_by: 'user-1',
  });
  const incoming = createChat({
    display_name: '5511999999999',
    saved_contact_name: null,
    lead_id: 'lead-1',
    lead_name: null,
  });

  const result = stabilizeChatIdentityForLocalMerge(incoming, previous);
  assert.equal(result.display_name, 'Maria');
  assert.equal(result.lead_name, 'Maria da Silva');
  assert.equal(result.lead_link_source, 'manual');
  assert.equal(result.lead_linked_by, 'user-1');
});

test('ranks accent-insensitive names before phone-only matches', () => {
  const nameMatch = createChat({
    id: 'name',
    display_name: 'João Ferreira',
    phone_number: '5511988888888',
    phone_digits: '5511988888888',
  });
  const phoneMatch = createChat({ id: 'phone', display_name: 'Maria', phone_number: '5511999999999' });

  assert.deepEqual(rankChatsBySearch([phoneMatch, nameMatch], 'joao').map((chat) => chat.id), ['name']);
  assert.deepEqual(rankChatsBySearch([nameMatch, phoneMatch], '99999').map((chat) => chat.id), ['phone']);
});

test('keeps the first copy when chat collections overlap', () => {
  const first = createChat({ id: 'same', display_name: 'Primeiro' });
  const duplicate = createChat({ id: 'same', display_name: 'Segundo' });

  assert.equal(mergeUniqueChats([first], [duplicate])[0].display_name, 'Primeiro');
});
