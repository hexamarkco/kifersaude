import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  computeChatPollIntervalMs,
  computeMessagePollIntervalMs,
  computeOperationalStatePollIntervalMs,
} from '../pollingIntervals';

test('polling de mensagens usa o intervalo rápido quando o Realtime não está saudável', () => {
  assert.equal(computeMessagePollIntervalMs(false, 5000, 20000), 5000);
});

test('polling de mensagens usa o intervalo de rede de segurança quando o Realtime está saudável', () => {
  assert.equal(computeMessagePollIntervalMs(true, 5000, 20000), 20000);
});

test('polling de chats aumenta gradualmente quando a lista permanece sem mudanças', () => {
  assert.equal(computeChatPollIntervalMs(0, 8000, 30000), 8000);
  assert.equal(computeChatPollIntervalMs(1, 8000, 30000), 16000);
  assert.equal(computeChatPollIntervalMs(2, 8000, 30000), 30000);
  assert.equal(computeChatPollIntervalMs(8, 8000, 30000), 30000);
});

test('polling de chats trata ciclos inválidos sem produzir intervalo negativo', () => {
  assert.equal(computeChatPollIntervalMs(-2, 8000, 30000), 8000);
  assert.equal(computeChatPollIntervalMs(1.9, 8000, 30000), 16000);
  assert.equal(computeChatPollIntervalMs(2, 0, 30000), 0);
});

test('polling de estado operacional usa o intervalo espaçado quando o canal está conectado', () => {
  assert.equal(computeOperationalStatePollIntervalMs(true, 30000, 10000), 30000);
});

test('polling de estado operacional usa o intervalo rápido quando o canal não está conectado', () => {
  assert.equal(computeOperationalStatePollIntervalMs(false, 30000, 10000), 10000);
});
