import assert from 'node:assert/strict';
import { test } from 'vitest';

import { shouldShowBlockingMessageLoader } from '../messageLoadState';

test('não bloqueia a conversa quando já existe cache de mensagens', () => {
  assert.equal(shouldShowBlockingMessageLoader(true), false);
});

test('mostra carregamento bloqueante quando não existe cache', () => {
  assert.equal(shouldShowBlockingMessageLoader(false), true);
});
