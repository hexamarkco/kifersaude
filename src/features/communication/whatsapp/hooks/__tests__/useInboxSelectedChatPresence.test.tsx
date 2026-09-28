import assert from 'node:assert/strict';
import { act, useState, type Dispatch, type SetStateAction } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { CommWhatsAppChat } from '../../domain/types';
import { useInboxSelectedChatPresence } from '../useInboxSelectedChatPresence';

type MockFunction = ((...args: unknown[]) => unknown) & {
  mockReset: () => MockFunction;
  mockImplementationOnce: (implementation: (...args: unknown[]) => unknown) => MockFunction;
  mockResolvedValue: (value: unknown) => MockFunction;
  mock: { calls: unknown[][] };
};

const mocks = vi.hoisted(() => ({
  ensureChatPresence: vi.fn() as unknown as MockFunction,
}));

vi.mock('../../data', () => ({
  commWhatsAppService: { ensureChatPresence: mocks.ensureChatPresence },
}));

const createChat = (id: string): CommWhatsAppChat => ({
  id,
  channel_id: 'channel-1',
  external_chat_id: `${id}@s.whatsapp.net`,
  is_group: false,
  phone_number: '+55 11 99999-9999',
  phone_digits: '5511999999999',
  display_name: `Contato ${id}`,
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
});

type PresenceControl = { selectChat: (chatId: string | null) => void };

const Harness = ({
  initialSelectedChatId,
  setChats,
  control,
}: {
  initialSelectedChatId: string | null;
  setChats: Dispatch<SetStateAction<CommWhatsAppChat[]>>;
  control: PresenceControl;
}) => {
  const [selectedChatId, setSelectedChatId] = useState(initialSelectedChatId);
  control.selectChat = setSelectedChatId;
  useInboxSelectedChatPresence({ selectedChatId, setChats });
  return null;
};

const resetMocks = () => mocks.ensureChatPresence.mockReset();

const flushEffects = async () => {
  await act(async () => { await Promise.resolve(); });
};

test('sincroniza a presença da conversa selecionada no estado local', async () => {
  resetMocks();
  mocks.ensureChatPresence.mockResolvedValue({
    presence: { status: 'typing', last_seen_at: '2026-09-28T11:59:00.000Z', observed_at: '2026-09-28T12:00:00.000Z' },
    subscriptionStatus: 'subscribed',
    subscriptionError: null,
  });
  const updates: Array<SetStateAction<CommWhatsAppChat[]>> = [];
  const view = render(<Harness
    initialSelectedChatId="chat-1"
    setChats={(update) => { updates.push(update); }}
    control={{ selectChat: () => undefined }}
  />);

  try {
    await flushEffects();

    assert.deepEqual(mocks.ensureChatPresence.mock.calls[0], ['chat-1']);
    const update = updates[0];
    assert.ok(update);
    const next = typeof update === 'function' ? update([createChat('chat-1')]) : update;
    assert.equal(next[0]?.presence_status, 'typing');
    assert.equal(next[0]?.presence_last_seen_at, '2026-09-28T11:59:00.000Z');
    assert.equal(next[0]?.presence_updated_at, '2026-09-28T12:00:00.000Z');
  } finally {
    view.unmount();
  }
});

test('descarta presença atrasada da conversa anterior após a troca de seleção', async () => {
  resetMocks();
  let resolveOldPresence!: (presence: unknown) => void;
  mocks.ensureChatPresence
    .mockImplementationOnce(() => new Promise((resolve) => { resolveOldPresence = resolve; }))
    .mockResolvedValue({
      presence: { status: 'recording', last_seen_at: null, observed_at: '2026-09-28T12:01:00.000Z' },
      subscriptionStatus: 'subscribed',
      subscriptionError: null,
    });
  const updates: Array<SetStateAction<CommWhatsAppChat[]>> = [];
  const control: PresenceControl = { selectChat: () => undefined };
  const view = render(<Harness
    initialSelectedChatId="chat-1"
    setChats={(update) => { updates.push(update); }}
    control={control}
  />);

  try {
    await flushEffects();
    act(() => control.selectChat('chat-2'));
    await flushEffects();
    resolveOldPresence({
      presence: { status: 'typing', last_seen_at: '2026-09-28T11:58:00.000Z', observed_at: '2026-09-28T12:00:00.000Z' },
      subscriptionStatus: 'subscribed',
      subscriptionError: null,
    });
    await flushEffects();

    assert.equal(mocks.ensureChatPresence.mock.calls.length, 2);
    assert.equal(updates.length, 1);
    const update = updates[0];
    assert.ok(update);
    const next = typeof update === 'function' ? update([createChat('chat-2')]) : update;
    assert.equal(next[0]?.presence_status, 'recording');
    assert.equal(next[0]?.presence_updated_at, '2026-09-28T12:01:00.000Z');
  } finally {
    view.unmount();
  }
});
