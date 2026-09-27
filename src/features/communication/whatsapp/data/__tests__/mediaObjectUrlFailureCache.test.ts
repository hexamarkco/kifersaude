import assert from 'node:assert/strict';
import { test } from 'vitest';

import { createMediaObjectUrlFailureCache } from '../mediaObjectUrlFailureCache';

test('reutiliza uma falha temporária sem repetir a requisição durante o TTL', () => {
  let now = 1_000;
  const cache = createMediaObjectUrlFailureCache({ now: () => now, ttlMs: 60_000 });
  const error = new Error('specified media not found');

  cache.remember('media-1', error);

  assert.equal(cache.get('media-1'), error);
  now += 59_999;
  assert.equal(cache.get('media-1'), error);
});

test('expira a falha e permite uma nova tentativa depois do TTL', () => {
  let now = 1_000;
  const cache = createMediaObjectUrlFailureCache({ now: () => now, ttlMs: 60_000 });
  cache.remember('media-1', new Error('specified media not found'));

  now += 60_000;

  assert.equal(cache.get('media-1'), null);
});

test('limpa a falha quando o usuário solicita um retry explícito', () => {
  const cache = createMediaObjectUrlFailureCache();
  cache.remember('media-1', new Error('specified media not found'));

  cache.clear('media-1');

  assert.equal(cache.get('media-1'), null);
});
