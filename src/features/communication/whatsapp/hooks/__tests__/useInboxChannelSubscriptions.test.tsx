import assert from 'node:assert/strict';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import { useInboxChannelSubscriptions } from '../useInboxChannelSubscriptions';

const subscriptions = vi.hoisted(() => ({
  chatHandlers: [] as Array<(payload: unknown) => void>,
  presenceHandlers: [] as Array<(payload: unknown) => void>,
  chatUnsubscribes: 0,
  presenceUnsubscribes: 0,
}));

vi.mock('../../data', () => ({
  subscribeToInboxChats: (_channelId: string, onChange: (payload: unknown) => void) => {
    subscriptions.chatHandlers.push(onChange);
    return () => { subscriptions.chatUnsubscribes += 1; };
  },
  subscribeToInboxPresences: (_channelId: string, onChange: (payload: unknown) => void) => {
    subscriptions.presenceHandlers.push(onChange);
    return () => { subscriptions.presenceUnsubscribes += 1; };
  },
}));

const Harness = ({ onChatChange, onPresenceChange }: {
  onChatChange: () => void;
  onPresenceChange: () => void;
}) => {
  useInboxChannelSubscriptions({
    channelId: 'channel-1',
    onChatChange,
    onPresenceChange,
  });
  return null;
};

test('conecta as inscrições de chats e presença e as encerra no unmount', () => {
  subscriptions.chatHandlers.length = 0;
  subscriptions.presenceHandlers.length = 0;
  subscriptions.chatUnsubscribes = 0;
  subscriptions.presenceUnsubscribes = 0;
  let chatChanges = 0;
  let presenceChanges = 0;

  const view = render(
    <Harness
      onChatChange={() => { chatChanges += 1; }}
      onPresenceChange={() => { presenceChanges += 1; }}
    />,
  );

  assert.equal(subscriptions.chatHandlers.length, 1);
  assert.equal(subscriptions.presenceHandlers.length, 1);
  subscriptions.chatHandlers[0]?.({});
  subscriptions.presenceHandlers[0]?.({});
  assert.equal(chatChanges, 1);
  assert.equal(presenceChanges, 1);

  view.unmount();
  assert.equal(subscriptions.chatUnsubscribes, 1);
  assert.equal(subscriptions.presenceUnsubscribes, 1);
});
