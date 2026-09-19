import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  COMM_WHATSAPP_TRANSIENT_PRESENCE_TTL_MS,
  getCommWhatsAppPresencePresentation,
} from '../presence';

test('shows typing and recording states', () => {
  assert.equal(
    getCommWhatsAppPresencePresentation({
      presence_status: 'typing',
      presence_updated_at: new Date().toISOString(),
      presence_last_seen_at: null,
    })?.label,
    'digitando…',
  );
  assert.equal(
    getCommWhatsAppPresencePresentation({
      presence_status: 'recording',
      presence_updated_at: new Date().toISOString(),
      presence_last_seen_at: null,
    })?.label,
    'gravando áudio…',
  );
});

test('expires transient states without inventing online or offline status', () => {
  const updatedAt = new Date(Date.now() - COMM_WHATSAPP_TRANSIENT_PRESENCE_TTL_MS - 1_000).toISOString();
  const result = getCommWhatsAppPresencePresentation({
    presence_status: 'typing',
    presence_updated_at: updatedAt,
    presence_last_seen_at: '2026-09-18T12:00:00.000Z',
  });

  assert.equal(result, null);
});

test('does not invent a last seen value without a timestamp', () => {
  assert.equal(
    getCommWhatsAppPresencePresentation({
      presence_status: 'unknown',
      presence_updated_at: null,
      presence_last_seen_at: null,
    }),
    null,
  );
});
