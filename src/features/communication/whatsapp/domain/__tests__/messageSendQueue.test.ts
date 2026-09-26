import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  QUEUED_TEXT_SEND_INTERRUPTED_MESSAGE,
  shouldContinueQueuedTextSendAfterFailure,
} from '../messageSendQueue';

test('continua a fila quando o envio é ambíguo', () => {
  assert.equal(shouldContinueQueuedTextSendAfterFailure(true), true);
});

test('interrompe a fila quando o envio falha definitivamente', () => {
  assert.equal(shouldContinueQueuedTextSendAfterFailure(false), false);
  assert.match(QUEUED_TEXT_SEND_INTERRUPTED_MESSAGE, /reenviar/);
});
