import assert from 'node:assert/strict';
import { act, useState } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { CommWhatsAppChat, CommWhatsAppPhoneContact } from '../../domain/types';
import { useInboxContactIdentity } from '../useInboxContactIdentity';

const identityState = vi.hoisted(() => ({
  calls: [] as Array<{ phoneNumbers: string[]; forceSync: boolean }>,
  responses: [] as unknown[][],
  shouldReject: false,
}));

vi.mock('../../data', () => ({
  whatsappContactsRepository: {
    lookupSavedByPhones: async (params: { phoneNumbers: string[]; forceSync: boolean }) => {
      identityState.calls.push(params);
      if (identityState.shouldReject) {
        throw new Error('lookup indisponível');
      }
      return identityState.responses.shift() ?? [];
    },
  },
}));

const createChat = (index: number): CommWhatsAppChat => {
  const phone = `5511999${String(index).padStart(6, '0')}`;
  return {
    id: `chat-${index}`,
    channel_id: 'channel-1',
    external_chat_id: `${phone}@s.whatsapp.net`,
    is_group: false,
    phone_number: phone,
    phone_digits: phone,
    display_name: `Contato ${index}`,
    last_message_direction: 'inbound',
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
    unread_count: 0,
    status: 'open',
    autonomous_attendance_status: 'inactive',
    created_at: '2026-09-28T12:00:00.000Z',
    updated_at: '2026-09-28T12:00:00.000Z',
  };
};

const createContact = (phone: string): CommWhatsAppPhoneContact => ({
  id: `contact-${phone}`,
  channel_id: 'channel-1',
  contact_id: `provider-${phone}`,
  phone_number: phone,
  phone_digits: phone,
  display_name: 'Nome sincronizado',
  saved: true,
  last_synced_at: '2026-09-28T12:00:00.000Z',
  created_at: '2026-09-28T12:00:00.000Z',
  updated_at: '2026-09-28T12:00:00.000Z',
});

const Harness = ({ initialChats, selectedChatId }: { initialChats: CommWhatsAppChat[]; selectedChatId: string | null }) => {
  const [chats, setChats] = useState(initialChats);
  const selectedChat = chats.find((chat) => chat.id === selectedChatId) ?? null;
  const identity = useInboxContactIdentity({ chats, selectedChat, setChats });

  return (
    <>
      <output data-testid="snapshot">{JSON.stringify({
        revision: identity.savedContactNameRevision,
        chats: chats.map((chat) => ({ id: chat.id, name: chat.display_name, savedName: chat.saved_contact_name ?? null })),
      })}</output>
      <button data-testid="rerender" onClick={() => setChats((current) => [...current])}>Rerender</button>
      <button
        data-testid="remember-manual"
        onClick={() => identity.rememberManualSavedContactName(selectedChat?.phone_number, 'Nome manual')}
      >
        Remember manual
      </button>
    </>
  );
};

type Snapshot = {
  revision: number;
  chats: Array<{ id: string; name: string; savedName: string | null }>;
};

const readSnapshot = (container: HTMLElement): Snapshot => {
  const content = container.querySelector('[data-testid="snapshot"]')?.textContent;
  assert.ok(content);
  return JSON.parse(content) as Snapshot;
};

const click = (container: HTMLElement, testId: string) => {
  const button = container.querySelector(`[data-testid="${testId}"]`);
  assert.ok(button);
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

const flushLookups = async () => act(async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
});

const resetIdentityState = () => {
  identityState.calls.length = 0;
  identityState.responses.length = 0;
  identityState.shouldReject = false;
};

test('limita cada ciclo a 30 conversas e aplica o nome sincronizado sem perder a conversa selecionada', async () => {
  resetIdentityState();
  const chats = Array.from({ length: 32 }, (_, index) => createChat(index));
  identityState.responses.push([createContact(chats[0]!.phone_number!)], []);

  const view = render(<Harness initialChats={chats} selectedChatId="chat-0" />);
  await flushLookups();

  assert.deepEqual(identityState.calls.map((call) => call.phoneNumbers.length), [30, 2]);
  assert.deepEqual(identityState.calls.map((call) => call.forceSync), [true, false]);
  const snapshot = readSnapshot(view.container);
  assert.equal(snapshot.chats[0]?.name, 'Nome sincronizado');
  assert.equal(snapshot.chats[0]?.savedName, 'Nome sincronizado');
  assert.equal(snapshot.revision, 1);
  view.unmount();
});

test('uma edição manual vence o nome sincronizado e impede nova busca para a mesma identidade', async () => {
  resetIdentityState();
  identityState.responses.push([]);
  const view = render(<Harness initialChats={[createChat(0)]} selectedChatId="chat-0" />);
  await flushLookups();

  click(view.container, 'remember-manual');
  await flushLookups();

  const snapshot = readSnapshot(view.container);
  assert.equal(snapshot.chats[0]?.name, 'Nome manual');
  assert.equal(snapshot.chats[0]?.savedName, 'Nome manual');
  assert.equal(identityState.calls.length, 1);
  view.unmount();
});

test('erro respeita cooldown e volta a tentar após cinco minutos', async () => {
  resetIdentityState();
  identityState.shouldReject = true;
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  let now = 1_000_000;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  const view = render(<Harness initialChats={[createChat(0)]} selectedChatId="chat-0" />);
  await flushLookups();

  click(view.container, 'rerender');
  await flushLookups();
  assert.equal(identityState.calls.length, 1);

  now += 5 * 60 * 1000 + 1;
  click(view.container, 'rerender');
  await flushLookups();
  assert.equal(identityState.calls.length, 2);

  view.unmount();
  vi.restoreAllMocks();
});
