import assert from 'node:assert/strict';
import { test } from 'vitest';

import { computeMessagePollIntervalMs, computeOperationalStatePollIntervalMs } from '../pollingIntervals';

test('polling de mensagens usa o intervalo rápido quando o Realtime não está saudável', () => {
  assert.equal(computeMessagePollIntervalMs(false, 5000, 20000), 5000);
});

test('polling de mensagens usa o intervalo de rede de segurança quando o Realtime está saudável', () => {
  assert.equal(computeMessagePollIntervalMs(true, 5000, 20000), 20000);
});

test('polling de estado operacional usa o intervalo espaçado quando o canal está conectado', () => {
  assert.equal(computeOperationalStatePollIntervalMs(true, 30000, 10000), 30000);
});

test('polling de estado operacional usa o intervalo rápido quando o canal não está conectado', () => {
  assert.equal(computeOperationalStatePollIntervalMs(false, 30000, 10000), 10000);
});
