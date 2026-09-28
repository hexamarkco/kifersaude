import assert from 'node:assert/strict';
import { act, useCallback, useRef, useState } from 'react';
import { test } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { CommWhatsAppChat } from '../../domain/types';
import { useInboxChatCollection } from '../useInboxChatCollection';

type CollectionController = ReturnType<typeof useInboxChatCollection> & {
  chats: CommWhatsAppChat[];
  signature: { current: string };
};

const createChat = (id: string, overrides: Partial<CommWhatsAppChat> = {}): CommWhatsAppChat => ({
  id,
  channel_id: 'channel-1',
  external_chat_id: `${id}@s.whatsapp.net`,
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
  last_message_direction: 'inbound',
  unread_count: 0,
  status: 'open',
  autonomous_attendance_status: 'inactive',
  created_at: '2026-09-28T12:00:00.000Z',
  updated_at: '2026-09-28T12:00:00.000Z',
  ...overrides,
});

const signatureFor = (chats: CommWhatsAppChat[]) => chats.map((chat) => `${chat.id}:${chat.updated_at}`).join('|');

const Harness = ({ initialChats, capture }: {
  initialChats: CommWhatsAppChat[];
  capture: (controller: CollectionController) => void;
}) => {
  const [chats, setChats] = useState(initialChats);
  const signature = useRef(signatureFor(initialChats));
  const savedContactNameOverrideByPhoneRef = useRef(new Map<string, string>());
  const savedContactNameByPhoneRef = useRef(new Map<string, string>());
  const buildChatsSignature = useCallback(signatureFor, []);
  const controller = useInboxChatCollection({
    setChats,
    chatsSignatureRef: signature,
    savedContactNameOverrideByPhoneRef,
    savedContactNameByPhoneRef,
    buildChatsSignature,
  });
  capture({ ...controller, chats, signature });
  return null;
};

test('atualiza a coleção e a assinatura dentro da mesma transição funcional de estado', () => {
  let controller!: CollectionController;
  const original = createChat('chat-1');
  const view = render(<Harness initialChats={[original]} capture={(value) => { controller = value; }} />);

  act(() => controller.upsertChatLocally(createChat('chat-2', { last_message_at: '2026-09-28T13:00:00.000Z' })));

  assert.deepEqual(controller.chats.map((chat) => chat.id), ['chat-2', 'chat-1']);
  assert.equal(controller.signature.current, signatureFor(controller.chats));

  act(() => controller.upsertChatLocally(createChat('chat-2', { deleted_at: '2026-09-28T14:00:00.000Z' })));
  assert.deepEqual(controller.chats.map((chat) => chat.id), ['chat-1']);
  assert.equal(controller.signature.current, signatureFor(controller.chats));
  view.unmount();
});
