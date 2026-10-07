import assert from 'node:assert/strict';
import { test } from 'vitest';
import { extractWhapiForwardedMeta } from '../comm-whatsapp';

test('preserves forwarded context for received and sent WhatsApp messages', () => {
  for (const fromMe of [false, true]) {
    assert.deepEqual(extractWhapiForwardedMeta({ from_me: fromMe, context: { forwarded: true, forwarding_score: 0 } }), {
      forwarded: true, forwarding_score: 0,
    });
  }
  assert.deepEqual(extractWhapiForwardedMeta({ context: { forwarding_score: 3 } }), { forwarded: true, forwarding_score: 3 });
});

test('does not infer forwarding from quotes or absent and invalid context', () => {
  for (const message of [{}, { context: null }, { context: { quoted_id: 'original' } }, { context: { forwarded: false, forwarding_score: 0 } }, { context: { forwarded: 'false', forwarding_score: '3' } }]) {
    assert.deepEqual(extractWhapiForwardedMeta(message), {});
  }
  assert.deepEqual(extractWhapiForwardedMeta({ context: { forwarded: true } }), { forwarded: true });
});
