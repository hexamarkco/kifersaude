import assert from 'node:assert/strict';
import { act } from 'react';
import { test } from 'vitest';

import { render } from '../../../../../testing-library/react';
import { useInboxSendQueue } from '../useInboxSendQueue';

type Queue = ReturnType<typeof useInboxSendQueue>;
type QueueOptions = Parameters<typeof useInboxSendQueue>[0];

const Harness = ({ options, capture }: { options: QueueOptions; capture: (queue: Queue) => void }) => {
  capture(useInboxSendQueue(options));
  return null;
};

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => { resolve = complete; });
  return { promise, resolve };
};

test('serializa envios do mesmo chat, permite paralelismo entre chats e mantém os indicadores corretos', async () => {
  const events: string[] = [];
  const sendingByChatId: Record<string, boolean> = {};
  const states: Array<Record<string, boolean>> = [];
  const firstSend = deferred();
  const options: QueueOptions = {
    setSendingByChatId: (updater) => {
      const next = typeof updater === 'function' ? updater(sendingByChatId) : updater;
      Object.keys(sendingByChatId).forEach((key) => { delete sendingByChatId[key]; });
      Object.assign(sendingByChatId, next);
      states.push({ ...sendingByChatId });
    },
  };
  const queueRef: { current: Queue | null } = { current: null };
  const getQueue = () => {
    const current = queueRef.current;
    if (!current) {
      throw new Error('A fila de envio não foi montada.');
    }
    return current;
  };
  const view = render(<Harness options={options} capture={(value) => { queueRef.current = value; }} />);

  try {
    assert.ok(queueRef.current);
    assert.equal(getQueue().isChatSendActive('chat-1'), false);
    let sameChatSecond: Promise<void> | null = null;
    let otherChatSend: Promise<void> | null = null;
    act(() => {
      void getQueue().enqueueChatSend('chat-1', async () => {
        events.push('chat-1:first:start');
        await firstSend.promise;
        events.push('chat-1:first:end');
      });
      sameChatSecond = getQueue().enqueueChatSend('chat-1', async () => {
        events.push('chat-1:second');
      });
      otherChatSend = getQueue().enqueueChatSend('chat-2', async () => {
        events.push('chat-2:first');
      });
    });

    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    assert.deepEqual(events, ['chat-1:first:start', 'chat-2:first']);
    assert.deepEqual(sendingByChatId, { 'chat-1': true });
    assert.equal(getQueue().isChatSendActive('chat-1'), true);
    assert.equal(getQueue().isChatSendActive('chat-2'), false);

    await act(async () => {
      firstSend.resolve();
      await Promise.all([sameChatSecond, otherChatSend]);
    });

    assert.deepEqual(events, ['chat-1:first:start', 'chat-2:first', 'chat-1:first:end', 'chat-1:second']);
    assert.deepEqual(sendingByChatId, {});
    assert.equal(getQueue().isChatSendActive('chat-1'), false);
    assert.ok(states.some((state) => state['chat-1'] === true));
  } finally {
    view.unmount();
  }
});
