import assert from 'node:assert/strict';
import { act, useState } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { useInboxChannelSubscriptions } from '../useInboxChannelSubscriptions';
import { useInboxRealtimeController } from '../useInboxRealtimeController';

const mocks = vi.hoisted(() => ({
  applyRealtimeChatChange: vi.fn(),
  applyRealtimePresenceChange: vi.fn(),
  applyRealtimeMessageChange: vi.fn(),
  isRealtimeHealthy: false,
  selectedChatIds: [] as Array<string | null>,
  subscriptionOptions: [] as unknown[],
  updateOptions: [] as unknown[],
}));

vi.mock('../useInboxRealtimeUpdates', () => ({
  useInboxRealtimeUpdates: (options: unknown) => {
    mocks.updateOptions.push(options);
    return {
      applyRealtimeChatChange: mocks.applyRealtimeChatChange,
      applyRealtimePresenceChange: mocks.applyRealtimePresenceChange,
      applyRealtimeMessageChange: mocks.applyRealtimeMessageChange,
    };
  },
}));

vi.mock('../useInboxChannelSubscriptions', () => ({
  useInboxChannelSubscriptions: (options: unknown) => {
    mocks.subscriptionOptions.push(options);
  },
}));

vi.mock('../useCommWhatsAppMessageRealtime', () => ({
  useCommWhatsAppMessageRealtime: (selectedChatId: string | null) => {
    mocks.selectedChatIds.push(selectedChatId);
    return { readyChatId: selectedChatId, isRealtimeHealthy: mocks.isRealtimeHealthy };
  },
}));

type ControllerOptions = Parameters<typeof useInboxRealtimeController>[0];
type ControllerState = ReturnType<typeof useInboxRealtimeController>;
type ControllerHarnessControl = { rerender: (() => void) | null };

const Harness = ({ options, capture, control }: {
  options: ControllerOptions;
  capture: (state: ControllerState) => void;
  control: ControllerHarnessControl;
}) => {
  const [, setRenderVersion] = useState(0);
  control.rerender = () => setRenderVersion((current) => current + 1);
  capture(useInboxRealtimeController(options));
  return null;
};

const createOptions = (): ControllerOptions => ({
  channelId: 'channel-1',
  selectedChatId: 'chat-1',
  channelConnected: true,
  updates: {
    refs: {
      chatPollBackoffRef: { current: 0 },
      chatPollIdleCyclesRef: { current: 0 },
      selectedChatIdRef: { current: 'chat-1' },
      archivedSectionOpenRef: { current: false },
      latestChatsRef: { current: [] },
      chatIdFromUrlRef: { current: null },
      savedContactNameOverrideByPhoneRef: { current: new Map() },
      savedContactNameByPhoneRef: { current: new Map() },
      pendingChatInboxStateRef: { current: new Map() },
      chatsSignatureRef: { current: '' },
      messagesSignatureRef: { current: '' },
      isNearBottomRef: { current: true },
      pendingScrollModeRef: { current: null },
      pendingScrollTopRef: { current: null },
      pendingScrollHeightRef: { current: null },
      messagesContainerRef: { current: null },
      loadChatsRef: { current: () => undefined },
    },
    setSelectedChatId: () => undefined,
    setChats: () => undefined,
    setMessages: () => undefined,
    buildChatsSignature: () => '',
    buildMessagesSignature: () => '',
    chatMatchesActiveFilters: () => true,
    applyFrontendSavedContactNames: (chats) => chats,
    applyPrefetchedLeadNames: (chats) => chats,
    applyOutgoingOrderToServerMessage: (message) => message,
    reconcileLocalOutgoingMessages: () => undefined,
  },
});

const resetMocks = () => {
  mocks.isRealtimeHealthy = false;
  mocks.selectedChatIds.length = 0;
  mocks.subscriptionOptions.length = 0;
  mocks.updateOptions.length = 0;
};

test('coordena os três canais Realtime e mantém as refs de saúde atualizadas', () => {
  resetMocks();
  const options = createOptions();
  const control: ControllerHarnessControl = { rerender: null };
  let state!: ControllerState;
  const view = render(
    <Harness options={options} control={control} capture={(nextState) => { state = nextState; }} />,
  );

  try {
    assert.deepEqual(mocks.updateOptions, [options.updates]);
    assert.deepEqual(mocks.selectedChatIds, ['chat-1']);
    assert.equal(mocks.subscriptionOptions.length, 1);
    const subscription = mocks.subscriptionOptions[0] as Parameters<typeof useInboxChannelSubscriptions>[0] | undefined;
    assert.equal(subscription?.channelId, 'channel-1');
    assert.equal(subscription?.onChatChange, mocks.applyRealtimeChatChange);
    assert.equal(subscription?.onPresenceChange, mocks.applyRealtimePresenceChange);
    assert.equal(state.isChannelConnectedRef.current, true);
    assert.equal(state.isMessageRealtimeHealthyRef.current, false);

    options.channelConnected = false;
    mocks.isRealtimeHealthy = true;
    act(() => control.rerender?.());

    assert.equal(state.isChannelConnectedRef.current, false);
    assert.equal(state.isMessageRealtimeHealthyRef.current, true);
  } finally {
    view.unmount();
  }
});
