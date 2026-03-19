import assert from 'node:assert/strict';
import { test } from 'vitest';
import { isWhatsAppPayloadForwarded, markWhatsAppPayloadAsForwarded } from '../messageForwarding';

test('detects top-level forwarded flags', () => {
  assert.equal(isWhatsAppPayloadForwarded({ is_forwarded: true }), true);
  assert.equal(isWhatsAppPayloadForwarded({ forwarded: 'true' }), true);
});

test('detects nested forwarding markers from provider payloads', () => {
  assert.equal(
    isWhatsAppPayloadForwarded({
      message: {
        contextInfo: {
          forwardingScore: 2,
        },
      },
    }),
    true,
  );
});

test('ignores false or empty forwarding markers', () => {
  assert.equal(isWhatsAppPayloadForwarded({ is_forwarded: false }), false);
  assert.equal(isWhatsAppPayloadForwarded({ context: { forwarding_score: 0 } }), false);
  assert.equal(isWhatsAppPayloadForwarded(null), false);
});

test('marks local payloads as forwarded while preserving existing data', () => {
  assert.deepEqual(markWhatsAppPayloadAsForwarded({ id: 'msg-1' }), {
    id: 'msg-1',
    is_forwarded: true,
    forwarding_score: 1,
  });

  assert.deepEqual(markWhatsAppPayloadAsForwarded({ forwarding_score: 3, foo: 'bar' }), {
    forwarding_score: 3,
    foo: 'bar',
    is_forwarded: true,
  });
});
