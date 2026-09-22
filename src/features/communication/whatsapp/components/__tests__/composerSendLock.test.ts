import assert from 'node:assert/strict';
import { test } from 'vitest';

import { ComposerSendLock } from '../composerSendLock';

test('keeps an equivalent composer payload locked until its queued send settles', async () => {
  const lock = new ComposerSendLock();
  const snapshotKey = 'chat-1:Amiga, boa noite! Tudo bem?:';
  let settleSend: (() => void) | undefined;
  const queuedSend = new Promise<void>((resolve) => {
    settleSend = resolve;
  });

  assert.equal(lock.tryAcquire(snapshotKey), true);
  void queuedSend.then(
    () => lock.release(snapshotKey),
    () => lock.release(snapshotKey),
  );

  assert.equal(lock.tryAcquire(snapshotKey), false);

  settleSend?.();
  await queuedSend;
  await Promise.resolve();

  assert.equal(lock.tryAcquire(snapshotKey), true);
});
