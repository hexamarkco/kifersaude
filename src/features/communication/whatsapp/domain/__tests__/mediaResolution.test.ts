import assert from 'node:assert/strict';
import { test } from 'vitest';

import { describeMediaResolutionFailure } from '../mediaResolution';

test('permite tentar novamente quando a mídia ainda não está disponível', () => {
  assert.deepEqual(
    describeMediaResolutionFailure(new Error('Specified media not found')),
    {
      message: 'Não foi possível carregar agora.',
      retryable: true,
    },
  );
});

test('mantém uma tentativa de recuperação para falhas temporárias', () => {
  assert.deepEqual(
    describeMediaResolutionFailure(new Error('Gateway timeout')),
    { message: 'Gateway timeout', retryable: true },
  );
});
