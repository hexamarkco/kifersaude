import assert from 'node:assert/strict';
import { test } from 'vitest';

import { KeyedActionLock } from '../keyedActionLock';

test('blocks only duplicate actions for the same key', () => {
  const lock = new KeyedActionLock();

  assert.equal(lock.tryAcquire('message-1'), true);
  assert.equal(lock.tryAcquire('message-1'), false);
  assert.equal(lock.tryAcquire('message-2'), true);

  lock.release('message-1');
  assert.equal(lock.tryAcquire('message-1'), true);
  assert.equal(lock.tryAcquire('message-2'), false);
});

test('releasing an unknown key does not affect other locks', () => {
  const lock = new KeyedActionLock();

  assert.equal(lock.tryAcquire('message-1'), true);
  lock.release('message-unknown');

  assert.equal(lock.tryAcquire('message-1'), false);
});
