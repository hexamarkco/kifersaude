import assert from 'node:assert/strict';
import { test } from 'vitest';

import type { CommWhatsAppChat } from '../../../../lib/supabase';
import {
  applyPendingChatInboxState,
  buildPendingChatInboxStatePatch,
  mergePendingChatInboxState,
  type PendingChatInboxStatePatch,
} from '../pendingChatInboxState';

const baseChat = (overrides: Partial<CommWhatsAppChat> = {}): CommWhatsAppChat => ({
  id: overrides.id ?? 'chat-1',
  channel_id: overrides.channel_id ?? 'channel-1',
  external_chat_id: overrides.external_chat_id ?? '5511999999999@s.whatsapp.net',
  phone_number: overrides.phone_number ?? '5511999999999',
  phone_digits: overrides.phone_digits ?? '5511999999999',
  display_name: overrides.display_name ?? 'Cliente Teste',
  saved_contact_name: overrides.saved_contact_name ?? null,
  push_name: overrides.push_name ?? null,
  lead_id: overrides.lead_id ?? null,
  lead_name: overrides.lead_name ?? null,
  lead_status: overrides.lead_status ?? null,
  is_archived: overrides.is_archived ?? false,
  archived_at: overrides.archived_at ?? null,
  is_muted: overrides.is_muted ?? false,
  muted_at: overrides.muted_at ?? null,
  is_pinned: overrides.is_pinned ?? false,
  pinned_at: overrides.pinned_at ?? null,
  manual_unread: overrides.manual_unread ?? false,
  manual_unread_at: overrides.manual_unread_at ?? null,
  last_message_text: overrides.last_message_text ?? 'Oi',
  last_message_direction: overrides.last_message_direction ?? 'inbound',
  last_message_at: overrides.last_message_at ?? '2026-05-27T10:00:00.000Z',
  last_message_delivery_status: overrides.last_message_delivery_status ?? 'received',
  unread_count: overrides.unread_count ?? 0,
  status: overrides.status ?? 'open',
  last_read_at: overrides.last_read_at ?? null,
  deleted_at: overrides.deleted_at ?? null,
  created_at: overrides.created_at ?? '2026-05-27T09:00:00.000Z',
  updated_at: overrides.updated_at ?? '2026-05-27T10:00:00.000Z',
});

test('keeps explicit archive patch alive through stale refetches until TTL', () => {
  const state = new Map<string, PendingChatInboxStatePatch>();
  const activeChat = baseChat({ is_archived: false, archived_at: null });
  const archivedAt = '2026-05-27T10:00:00.000Z';
  const archivedChat = baseChat({ is_archived: true, archived_at: archivedAt });

  mergePendingChatInboxState(state, activeChat.id, buildPendingChatInboxStatePatch(activeChat, { isArchived: true }));

  const confirmed = applyPendingChatInboxState([archivedChat], state)[0];
  assert.equal(confirmed.is_archived, true);
  assert.equal(state.has(activeChat.id), true);

  const staleRefetch = applyPendingChatInboxState([activeChat], state)[0];
  assert.equal(staleRefetch.is_archived, true);
  assert.equal(state.has(activeChat.id), true);

  const pendingState = state.get(activeChat.id);
  assert.ok(pendingState);
  pendingState.__issuedAt = Date.now() - 30_001;

  const afterTtl = applyPendingChatInboxState([activeChat], state)[0];
  assert.equal(afterTtl.is_archived, false);
  assert.equal(state.has(activeChat.id), false);
});
