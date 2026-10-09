import assert from 'node:assert/strict';
import { test } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { CommWhatsAppChat } from '../../domain/types';
import { useInboxChatSelectionController } from '../useInboxChatSelectionController';

type ControllerOptions = Parameters<typeof useInboxChatSelectionController>[0];
type Controller = ReturnType<typeof useInboxChatSelectionController>;

const createChat = (id: string): CommWhatsAppChat => ({
  id,
  channel_id: 'channel-1',
  external_chat_id: `${id}@s.whatsapp.net`,
  is_group: false,
  phone_number: '5511999999999',
  phone_digits: '5511999999999',
  display_name: id,
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
  created_at: '2026-09-28T12:00:00.000Z',
  updated_at: '2026-09-28T12:00:00.000Z',
});

const Harness = ({ options, capture }: {
  options: ControllerOptions;
  capture: (controller: Controller) => void;
}) => {
  capture(useInboxChatSelectionController(options));
  return null;
};

const createContext = (search: string): {
  options: ControllerOptions;
  refs: ControllerOptions['refs'];
  calls: string[];
  capture: (controller: Controller) => void;
  getController: () => Controller | null;
} => {
  const calls: string[] = [];
  const refs: ControllerOptions['refs'] = {
    latestChatsRef: { current: [] },
    selectedChatIdRef: { current: 'previous-chat' },
    chatIdFromUrlRef: { current: 'previous-chat' },
    suppressAutoChatSelectionRef: { current: false },
  };
  let controller: Controller | null = null;
  return {
    refs,
    calls,
    options: {
      search,
      refs,
      setChatMenuPointerAnchor: (value) => calls.push(`pointer:${String(value)}`),
      setOpenChatMenuChatId: (value) => calls.push(`menu:${String(value)}`),
      setSelectedChatId: (value) => calls.push(`selected:${String(value)}`),
      upsertChatLocally: (chat) => calls.push(`upsert:${chat.id}`),
    },
    capture: (value) => { controller = value; },
    getController: () => controller,
  };
};

test('selecionar resultado da busca fecha menu, hidrata o cache e abre a conversa', () => {
  const context = createContext('marina');
  const view = render(<Harness options={context.options} capture={context.capture} />);

  context.getController()?.handleSelectSidebarChat(createChat('search-result'));

  assert.deepEqual(context.calls, [
    'pointer:null',
    'menu:null',
    'upsert:search-result',
    'selected:search-result',
  ]);
  assert.equal(context.refs.selectedChatIdRef.current, 'search-result');
  assert.equal(context.refs.chatIdFromUrlRef.current, 'search-result');
  assert.equal(context.refs.latestChatsRef.current[0]?.id, 'search-result');
  view.unmount();
});

test('abrir resultado depois de voltar à lista libera a seleção automática antes do render', () => {
  const context = createContext('claudia');
  const view = render(<Harness options={context.options} capture={context.capture} />);
  context.getController()?.handleBackToChatList();
  context.getController()?.handleSelectSidebarChat(createChat('search-result'));
  assert.equal(context.refs.suppressAutoChatSelectionRef.current, false);
  assert.equal(context.refs.selectedChatIdRef.current, 'search-result');
  assert.equal(context.refs.chatIdFromUrlRef.current, 'search-result');
  view.unmount();
});

test('selecionar conversa fora da busca não altera desnecessariamente o cache', () => {
  const context = createContext('');
  const view = render(<Harness options={context.options} capture={context.capture} />);

  context.getController()?.handleSelectSidebarChat(createChat('visible-chat'));

  assert.deepEqual(context.calls, ['pointer:null', 'menu:null', 'selected:visible-chat']);
  view.unmount();
});

test('voltar para a lista sincroniza refs antes de limpar a seleção', () => {
  const context = createContext('');
  const view = render(<Harness options={context.options} capture={context.capture} />);

  context.getController()?.handleBackToChatList();

  assert.equal(context.refs.suppressAutoChatSelectionRef.current, true);
  assert.equal(context.refs.selectedChatIdRef.current, null);
  assert.equal(context.refs.chatIdFromUrlRef.current, null);
  assert.deepEqual(context.calls, ['selected:null']);
  view.unmount();
});
