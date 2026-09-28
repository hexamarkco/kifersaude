import assert from 'node:assert/strict';
import { test } from 'vitest';

import { loadInboxChatSection } from '../inboxChatLoader';
import type { CommWhatsAppChat } from '../../domain/types';

const baseOptions = (overrides: Partial<Parameters<typeof loadInboxChatSection>[0]> = {}) => ({
  section: 'active' as const,
  listPage: async () => [],
  activityFilter: 'all' as const,
  leadStatusFilters: [],
  leadResponsavelFilters: [],
  hasLoadFilters: false,
  partialArchived: false,
  archivedPage: 1,
  pageSize: 2,
  isRequestCurrent: () => true,
  waitBeforeRetry: async () => undefined,
  ...overrides,
});

test('tenta novamente uma lista ativa vazia antes de aceitar o estado vazio', async () => {
  const calls: number[] = [];
  const waits: number[] = [];

  const result = await loadInboxChatSection(baseOptions({
    retryDelaysMs: [10, 20],
    listPage: async (params) => {
      calls.push(params.offset);
      return [];
    },
    waitBeforeRetry: async (delayMs) => { waits.push(delayMs); },
  }));

  assert.deepEqual(calls, [0, 0, 0]);
  assert.deepEqual(waits, [10, 20]);
  assert.deepEqual(result, { chats: [], pagesFetched: 1, hasMore: false });
});

test('não repete uma resposta vazia quando filtros estão ativos', async () => {
  let calls = 0;

  const result = await loadInboxChatSection(baseOptions({
    hasLoadFilters: true,
    listPage: async () => {
      calls += 1;
      return [];
    },
    waitBeforeRetry: async () => {
      assert.fail('não deve aguardar retry com filtros ativos');
    },
  }));

  assert.equal(calls, 1);
  assert.equal(result.pagesFetched, 1);
});

test('limita páginas arquivadas à página solicitada e reporta paginação incremental', async () => {
  const calls: number[] = [];
  const result = await loadInboxChatSection(baseOptions({
    section: 'archived',
    partialArchived: true,
    archivedPage: 2,
    pageSize: 1,
    listPage: async ({ offset }) => {
      calls.push(offset);
      return [createChat(`archived-${offset}`, true)];
    },
  }));

  assert.deepEqual(calls, [0, 1]);
  assert.deepEqual(result.chats.map((chat) => chat.id), ['archived-0', 'archived-1']);
  assert.deepEqual({ pagesFetched: result.pagesFetched, hasMore: result.hasMore }, { pagesFetched: 2, hasMore: true });
});

test('abandona a carga obsoleta sem retries nem consumir respostas adicionais', async () => {
  let current = true;
  let calls = 0;
  const waits: number[] = [];

  const result = await loadInboxChatSection(baseOptions({
    retryDelaysMs: [10, 20],
    listPage: async () => {
      calls += 1;
      current = false;
      return [];
    },
    isRequestCurrent: () => current,
    waitBeforeRetry: async (delayMs) => { waits.push(delayMs); },
  }));

  assert.equal(calls, 1);
  assert.deepEqual(waits, []);
  assert.deepEqual(result, { chats: [], pagesFetched: 0, hasMore: false });
});

const createChat = (id: string, isArchived: boolean): CommWhatsAppChat => ({
  id,
  channel_id: 'channel-1',
  external_chat_id: id,
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
  is_archived: isArchived,
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
});
