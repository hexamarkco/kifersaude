import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  CONTACT_CACHE_STALE_MS,
  isContactCacheStale,
} from './contactSync';

test('considera cache sem sincronização como desatualizado', () => {
  assert.equal(isContactCacheStale(null, 1_000), true);
  assert.equal(isContactCacheStale(undefined, 1_000), true);
});

test('mantém cache recente sem exigir nova sincronização', () => {
  const now = 1_000_000;
  const recent = new Date(now - CONTACT_CACHE_STALE_MS + 1).toISOString();

  assert.equal(isContactCacheStale(recent, now), false);
});

test('considera cache antigo ou inválido como desatualizado', () => {
  const now = 1_000_000;
  const old = new Date(now - CONTACT_CACHE_STALE_MS - 1).toISOString();

  assert.equal(isContactCacheStale(old, now), true);
  assert.equal(isContactCacheStale('data-invalida', now), true);
});
