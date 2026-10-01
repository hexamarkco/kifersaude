import assert from 'node:assert/strict';
import type { ReactElement } from 'react';
import { test } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { CommWhatsAppMessageSearchResult } from '../../data';
import type { CommWhatsAppChat, CommWhatsAppPhoneContact } from '../../domain/types';
import { useInboxChatListModel } from '../useInboxChatListModel';

type ModelParams = Parameters<typeof useInboxChatListModel>[0];
type ModelSnapshot = {
  sidebar: Array<{ id: string; displayName: string; savedName: string | null }>;
  selected: { id: string; displayName: string; savedName: string | null } | null;
  transcriptLabel: string;
  filteredMessageChatIds: string[];
  forwardTargetIds: string[];
  contacts: Array<{ id: string; name: string }>;
  matches: boolean[];
};

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

const createContact = (overrides: Partial<CommWhatsAppPhoneContact> = {}): CommWhatsAppPhoneContact => ({
  id: 'contact-1',
  channel_id: 'channel-1',
  contact_id: 'provider-1',
  phone_number: '5511999999999',
  phone_digits: '5511999999999',
  display_name: 'Nome do provedor',
  saved: true,
  last_synced_at: '2026-09-28T12:00:00.000Z',
  created_at: '2026-09-28T12:00:00.000Z',
  updated_at: '2026-09-28T12:00:00.000Z',
  ...overrides,
});

const createSearchResult = (chat: CommWhatsAppChat, id = `message-${chat.id}`): CommWhatsAppMessageSearchResult => ({
  chat,
  message: {
    id,
    chat_id: chat.id,
    channel_id: chat.channel_id,
    direction: 'inbound',
    message_type: 'text',
    delivery_status: 'delivered',
    message_at: '2026-09-28T12:00:00.000Z',
    metadata: {},
    created_at: '2026-09-28T12:00:00.000Z',
  },
});

const createParams = (overrides: Partial<ModelParams> = {}): ModelParams => ({
  chats: [],
  selectedChatId: null,
  selectedChat: null,
  archivedSectionOpen: false,
  activityFilter: 'all',
  leadStatusFilters: [],
  leadResponsavelFilters: [],
  search: '',
  chatSearchResults: [],
  messageSearchResults: [],
  connectedUserName: null,
  savedContacts: [],
  savedContactNameRevision: 0,
  savedContactNameOverrides: new Map(),
  synchronizedContactNames: new Map(),
  forwardSearch: '',
  ...overrides,
});

const Harness = ({ params }: { params: ModelParams }) => {
  const model = useInboxChatListModel(params);
  const snapshot: ModelSnapshot = {
    sidebar: model.sidebarChats.map((chat) => ({
      id: chat.id,
      displayName: chat.display_name,
      savedName: chat.saved_contact_name ?? null,
    })),
    selected: model.selectedChatForPresentation
      ? {
          id: model.selectedChatForPresentation.id,
          displayName: model.selectedChatForPresentation.display_name,
          savedName: model.selectedChatForPresentation.saved_contact_name ?? null,
        }
      : null,
    transcriptLabel: model.selectedChatTranscriptLabel,
    filteredMessageChatIds: model.filteredMessageSearchResults.map((result) => result.chat.id),
    forwardTargetIds: model.forwardTargetChats.map((chat) => chat.id),
    contacts: model.savedContactsForPresentation.map((contact) => ({ id: contact.id, name: contact.display_name })),
    matches: params.chats.map((chat) => model.chatMatchesActiveFilters(chat)),
  };

  return <output data-testid="model">{JSON.stringify(snapshot)}</output>;
};

const readSnapshot = (params: ModelParams): ModelSnapshot => {
  const view = render(<Harness params={params} /> as ReactElement);
  const output = view.container.querySelector('[data-testid="model"]')?.textContent;
  view.unmount();
  assert.ok(output);
  return JSON.parse(output) as ModelSnapshot;
};

test('encontra imediatamente o contato pelo nome salvo mesmo sem resultados remotos', () => {
  for (const lookup of ['savedContactNameOverrides', 'synchronizedContactNames'] as const) {
    const snapshot = readSnapshot(createParams({
      chats: [createChat({ display_name: 'Nome antigo' })],
      search: 'vida',
      [lookup]: new Map([['5511999999999', 'Vida Saúde']]),
    }));
    assert.deepEqual(snapshot.sidebar.map((chat) => chat.id), ['chat-1']);
    assert.equal(snapshot.sidebar[0]?.displayName, 'Vida Saúde');
  }
});

test('preserva a conversa selecionada, aplica filtros às buscas e projeta nomes manuais', () => {
  const selected = createChat({
    id: 'selected',
    display_name: 'Nome antigo',
    last_message_at: '2026-09-28T12:00:00.000Z',
    lead_status: 'Em andamento',
  });
  const matching = createChat({
    id: 'matching',
    display_name: 'Outro contato',
    phone_number: '5511888888888',
    phone_digits: '5511888888888',
    unread_count: 1,
    lead_status: 'Qualificado',
    last_message_at: '2026-09-28T11:00:00.000Z',
  });
  const archived = createChat({
    id: 'archived',
    is_archived: true,
    unread_count: 1,
    lead_status: 'Qualificado',
  });
  const params = createParams({
    chats: [selected, matching, archived],
    selectedChatId: selected.id,
    selectedChat: selected,
    activityFilter: 'unread',
    leadStatusFilters: ['Qualificado'],
    messageSearchResults: [createSearchResult(matching), createSearchResult(selected)],
    savedContacts: [createContact()],
    savedContactNameRevision: 1,
    savedContactNameOverrides: new Map([['5511999999999', 'Nome manual']]),
  });

  const snapshot = readSnapshot(params);

  assert.deepEqual(snapshot.sidebar.map((chat) => chat.id), ['selected', 'matching']);
  assert.deepEqual(snapshot.matches, [false, true, true]);
  assert.deepEqual(snapshot.filteredMessageChatIds, ['matching']);
  assert.deepEqual(snapshot.selected, {
    id: 'selected',
    displayName: 'Nome manual',
    savedName: 'Nome manual',
  });
  assert.equal(snapshot.transcriptLabel, 'Nome manual');
  assert.deepEqual(snapshot.contacts, [{ id: 'contact-1', name: 'Nome manual' }]);
});

test('combina resultados local/remoto sem duplicar conversas e limita destinos de encaminhamento', () => {
  const local = createChat({ id: 'same', display_name: 'Ana local' });
  const remoteDuplicate = createChat({ id: 'same', display_name: 'Ana remota' });
  const remoteOnly = createChat({ id: 'remote', display_name: 'Ana distante' });
  const forwardChats = Array.from({ length: 31 }, (_, index) => createChat({
    id: `forward-${String(index).padStart(2, '0')}`,
    display_name: `Comercial ${index + 1}`,
    phone_number: `55118888${String(index).padStart(4, '0')}`,
    phone_digits: `55118888${String(index).padStart(4, '0')}`,
  }));
  const withoutExternalId = createChat({ id: 'no-external', display_name: 'Comercial sem WhatsApp', external_chat_id: undefined });
  const params = createParams({
    chats: [local, ...forwardChats, withoutExternalId],
    search: 'Ana',
    chatSearchResults: [remoteDuplicate, remoteOnly],
    forwardSearch: 'comercial',
  });

  const snapshot = readSnapshot(params);

  assert.deepEqual(snapshot.sidebar.map((chat) => chat.id), ['same', 'remote']);
  assert.equal(snapshot.sidebar[0]?.displayName, 'Ana remota');
  assert.equal(snapshot.forwardTargetIds.length, 30);
  assert.ok(!snapshot.forwardTargetIds.includes('no-external'));
});
