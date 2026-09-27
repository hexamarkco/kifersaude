import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  preserveChatsFromPartialLoad,
  selectInitialChatId,
  shouldPreserveSelectedChatAfterLoad,
} from '../chatLoadState';
import type { CommWhatsAppChat } from '../types';

const createChat = (overrides: Partial<CommWhatsAppChat> = {}): CommWhatsAppChat => ({
  id: 'chat-1',
  channel_id: 'channel-1',
  external_chat_id: '5511999999999',
  is_group: false,
  phone_number: '5511999999999',
  phone_digits: '5511999999999',
  display_name: 'Contato',
  saved_contact_name: null,
  push_name: null,
  lead_id: null,
  lead_name: null,
  lead_status: null,
  lead_responsavel_id: null,
  lead_responsavel: null,
  merged_into_chat_id: null,
  lead_link_source: null,
  lead_linked_at: null,
  lead_linked_by: null,
  auto_link_blocked: false,
  identity_conflict: false,
  is_archived: false,
  archived_at: null,
  is_muted: false,
  muted_at: null,
  is_pinned: false,
  pinned_at: null,
  manual_unread: false,
  manual_unread_at: null,
  last_message_text: null,
  last_message_direction: 'inbound',
  last_message_at: null,
  last_message_delivery_status: null,
  unread_count: 0,
  status: 'open',
  autonomous_attendance_status: 'inactive',
  last_read_at: null,
  created_at: '2026-09-26T00:00:00.000Z',
  updated_at: '2026-09-26T00:00:00.000Z',
  ...overrides,
});

test('não preserva chat selecionado omitido por uma seção carregada', () => {
  assert.equal(
    shouldPreserveSelectedChatAfterLoad({
      selectedChat: createChat(),
      refreshedChatIds: new Set(),
      loadedSections: ['active'],
      unexpectedlyEmptySections: new Set(),
    }),
    false,
  );
});

test('preserva chat quando a seção dele ainda não foi carregada', () => {
  assert.equal(
    shouldPreserveSelectedChatAfterLoad({
      selectedChat: createChat({ is_archived: true }),
      refreshedChatIds: new Set(),
      loadedSections: ['active'],
      unexpectedlyEmptySections: new Set(),
    }),
    true,
  );
});

test('preserva chat quando a resposta da seção foi vazia de forma transitória', () => {
  assert.equal(
    shouldPreserveSelectedChatAfterLoad({
      selectedChat: createChat(),
      refreshedChatIds: new Set(),
      loadedSections: ['active'],
      unexpectedlyEmptySections: new Set(['active']),
    }),
    true,
  );
});

test('não preserva chat que já voltou na resposta atual', () => {
  assert.equal(
    shouldPreserveSelectedChatAfterLoad({
      selectedChat: createChat(),
      refreshedChatIds: new Set(['chat-1']),
      loadedSections: ['active'],
      unexpectedlyEmptySections: new Set(),
    }),
    false,
  );
});

test('seleciona primeiro um chat da seção que o operador acabou de abrir', () => {
  const activeChat = createChat({ id: 'active-chat', is_archived: false });
  const archivedChat = createChat({ id: 'archived-chat', is_archived: true });

  assert.equal(selectInitialChatId([activeChat, archivedChat], 'archived'), 'archived-chat');
  assert.equal(selectInitialChatId([archivedChat, activeChat], 'active'), 'active-chat');
});

test('preserva chats da seção cuja consulta falhou', () => {
  const activeChat = createChat({ id: 'active-chat', is_archived: false });
  const archivedChat = createChat({ id: 'archived-chat', is_archived: true });

  const preserved = preserveChatsFromPartialLoad({
    previousChats: [activeChat, archivedChat],
    refreshedChatIds: new Set(['active-chat']),
    loadedSections: new Set(['active']),
    unexpectedlyEmptySections: new Set(),
  });

  assert.deepEqual(preserved, [archivedChat]);
});

test('preserva chats quando a resposta vazia da seção carregada é transitória', () => {
  const activeChat = createChat({ id: 'active-chat', is_archived: false });
  const archivedChat = createChat({ id: 'archived-chat', is_archived: true });

  const preserved = preserveChatsFromPartialLoad({
    previousChats: [activeChat, archivedChat],
    refreshedChatIds: new Set(),
    loadedSections: new Set(['active']),
    unexpectedlyEmptySections: new Set(['active']),
  });

  assert.deepEqual(preserved, [activeChat, archivedChat]);
});
