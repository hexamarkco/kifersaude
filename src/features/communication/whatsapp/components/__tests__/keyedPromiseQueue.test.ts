import assert from 'node:assert/strict';
import { test } from 'vitest';

import { KeyedPromiseQueue } from '../keyedPromiseQueue';

test('serializes tasks for the same key and preserves enqueue order', async () => {
  const queue = new KeyedPromiseQueue();
  const events: string[] = [];
  let releaseFirst: (() => void) | undefined;
  const first = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });

  const firstTask = queue.enqueue('chat-1', async () => {
    events.push('first:start');
    await first;
    events.push('first:end');
  });
  const secondTask = queue.enqueue('chat-1', async () => {
    events.push('second');
  });

  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(events, ['first:start']);

  releaseFirst?.();
  await Promise.all([firstTask, secondTask]);
  assert.deepEqual(events, ['first:start', 'first:end', 'second']);
});

test('allows different keys to run concurrently and recovers after rejection', async () => {
  const queue = new KeyedPromiseQueue();
  const events: string[] = [];
  let releaseChatOne: (() => void) | undefined;
  const chatOneGate = new Promise<void>((resolve) => {
    releaseChatOne = resolve;
  });

  const firstTask = queue.enqueue('chat-1', async () => {
    events.push('chat-1');
    await chatOneGate;
  });
  const otherKeyTask = queue.enqueue('chat-2', async () => {
    events.push('chat-2');
  });

  await otherKeyTask;
  assert.deepEqual(events, ['chat-1', 'chat-2']);
  releaseChatOne?.();
  await firstTask;

  await assert.rejects(() => queue.enqueue('chat-3', async () => {
    throw new Error('expected failure');
  }));
  await queue.enqueue('chat-3', async () => {
    events.push('chat-3:recovered');
  });
  assert.equal(events[events.length - 1], 'chat-3:recovered');
});
