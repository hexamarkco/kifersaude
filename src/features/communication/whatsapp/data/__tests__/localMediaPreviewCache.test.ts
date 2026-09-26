import assert from 'node:assert/strict';
import { test } from 'vitest';

import { createLocalMediaPreviewCache } from '../localMediaPreviewCache';

const createTestCache = () => {
  const timers = new Map<number, () => void>();
  const revoked: string[] = [];
  let nextTimerId = 1;

  const cache = createLocalMediaPreviewCache({
    setTimeout: (callback) => {
      const timerId = nextTimerId++;
      timers.set(timerId, callback);
      return timerId;
    },
    clearTimeout: (timerId) => {
      timers.delete(timerId);
    },
    revokeObjectUrl: (objectUrl) => {
      if (objectUrl.startsWith('blob:')) {
        revoked.push(objectUrl);
      }
    },
  });

  return {
    cache,
    revoked,
    flushTimers: () => {
      for (const [timerId, callback] of [...timers.entries()]) {
        timers.delete(timerId);
        callback();
      }
    },
  };
};

test('mantém a prévia enquanto há componentes usando-a e libera blob URLs depois', () => {
  const { cache, revoked, flushTimers } = createTestCache();

  cache.remember('message-1', 'blob:preview-1');
  assert.equal(cache.get('message-1'), 'blob:preview-1');
  assert.equal(cache.retain('message-1'), 'blob:preview-1');

  cache.release('message-1');
  flushTimers();

  assert.deepEqual(revoked, ['blob:preview-1']);
  assert.equal(cache.get('message-1'), null);
});

test('uma nova retenção cancela a limpeza pendente e URLs remotas não são revogadas', () => {
  const { cache, revoked, flushTimers } = createTestCache();

  cache.remember('message-1', 'blob:preview-1');
  cache.retain('message-1');
  cache.release('message-1');
  assert.equal(cache.retain('message-1'), 'blob:preview-1');
  flushTimers();
  assert.deepEqual(revoked, []);

  cache.release('message-1');
  flushTimers();
  assert.deepEqual(revoked, ['blob:preview-1']);

  cache.remember('message-2', 'https://example.test/preview.jpg');
  flushTimers();
  assert.deepEqual(revoked, ['blob:preview-1']);
});
