import assert from 'node:assert/strict';
import { test } from 'vitest';

import { upsertInboxChatCollection } from '../inboxChatCollection';
import type { CommWhatsAppChat } from '../types';

const createChat = (overrides: Partial<CommWhatsAppChat> = {}): CommWhatsAppChat => ({
  id: 'chat-1',
  channel_id: 'channel-1',
  external_chat_id: '5511999999999@s.whatsapp.net',
  is_group: false,
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
  last_message_at: '2026-09-28T12:00:00.000Z',
  last_message_delivery_status: 'delivered',
  unread_count: 0,
  status: 'open',
  autonomous_attendance_status: 'inactive',
  created_at: '2026-09-28T12:00:00.000Z',
  updated_at: '2026-09-28T12:00:00.000Z',
  ...overrides,
});

const options = (overrides: Partial<Parameters<typeof upsertInboxChatCollection>[2]> = {}) => ({
  savedContactNameOverrideByPhone: new Map<string, string>(),
  savedContactNameByPhone: new Map<string, string>(),
  previousSignature: '',
  buildSignature: (chats: CommWhatsAppChat[]) => chats.map((chat) => `${chat.id}:${chat.updated_at}`).join('|'),
  ...overrides,
});

test('remove chats apagados ou mesclados e recalcula a assinatura da coleção', () => {
  const current = [createChat({ id: 'kept' }), createChat({ id: 'removed' })];
  const result = upsertInboxChatCollection(current, createChat({ id: 'removed', deleted_at: '2026-09-28T13:00:00.000Z' }), options());

  assert.deepEqual(result.chats.map((chat) => chat.id), ['kept']);
  assert.equal(result.signature, 'kept:2026-09-28T12:00:00.000Z');

  const merged = upsertInboxChatCollection(result.chats, createChat({ id: 'kept', merged_into_chat_id: 'canonical' }), options({
    previousSignature: result.signature,
  }));
  assert.deepEqual(merged.chats, []);
  assert.equal(merged.signature, '');
});

test('mescla identidade e prévia estáveis antes de ordenar a coleção', () => {
  const previous = createChat({
    id: 'existing',
    display_name: 'Maria',
    saved_contact_name: 'Maria',
    lead_id: 'lead-1',
    lead_name: 'Maria da Silva',
    lead_link_source: 'manual',
    lead_linked_at: '2026-09-28T11:00:00.000Z',
    last_message_text: 'Prévia mais nova',
    last_message_at: '2026-09-28T12:05:00.000Z',
  });
  const older = createChat({ id: 'older', last_message_at: '2026-09-28T11:00:00.000Z' });
  const staleUpdate = createChat({
    id: 'existing',
    display_name: '5511999999999',
    saved_contact_name: null,
    lead_id: 'lead-1',
    lead_name: null,
    lead_link_source: null,
    last_message_text: '[Mensagem]',
    last_message_at: '2026-09-28T12:00:00.000Z',
    updated_at: '2026-09-28T12:06:00.000Z',
  });

  const result = upsertInboxChatCollection([older, previous], staleUpdate, options());
  const merged = result.chats[0];

  assert.deepEqual(result.chats.map((chat) => chat.id), ['existing', 'older']);
  assert.equal(merged?.display_name, 'Maria');
  assert.equal(merged?.saved_contact_name, 'Maria');
  assert.equal(merged?.lead_name, 'Maria da Silva');
  assert.equal(merged?.lead_link_source, 'manual');
  assert.equal(merged?.last_message_text, 'Prévia mais nova');
  assert.equal(merged?.last_message_at, '2026-09-28T12:05:00.000Z');
});

test('aplica o nome salvo em cache ao inserir uma projeção antiga sem identidade canônica', () => {
  const result = upsertInboxChatCollection([], createChat({
    id: 'new-contact',
    display_name: 'Nome antigo do provedor',
    saved_contact_name: null,
  }), options({
    savedContactNameByPhone: new Map([['5511999999999', 'Nome salvo']]),
  }));

  assert.equal(result.chats[0]?.display_name, 'Nome salvo');
  assert.equal(result.chats[0]?.saved_contact_name, 'Nome salvo');
});

test('retém a mesma referência quando a assinatura de conteúdo não mudou', () => {
  const current = [createChat()];
  const signature = options().buildSignature(current);
  const result = upsertInboxChatCollection(current, createChat(), options({ previousSignature: signature }));

  assert.equal(result.chats, current);
  assert.equal(result.signature, signature);
});
