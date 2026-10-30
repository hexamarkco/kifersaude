import assert from 'node:assert/strict';
import { test } from 'vitest';

import { describeMediaResolutionFailure } from '../mediaResolution';

test('informa quando a mídia expirou e orienta pedir novo envio', () => {
  assert.deepEqual(
    describeMediaResolutionFailure(new Error('Specified media not found')),
    {
      message: 'Arquivo expirado. Peça ao contato para enviá-lo novamente.',
      retryable: false,
    },
  );
});

test('mantém uma tentativa de recuperação para falhas temporárias', () => {
  assert.deepEqual(
    describeMediaResolutionFailure(new Error('Gateway timeout')),
    { message: 'Gateway timeout', retryable: true },
  );
});
