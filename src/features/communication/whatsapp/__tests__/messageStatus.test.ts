import assert from 'node:assert/strict';
import { test } from 'vitest';

import type { CommWhatsAppMessage } from '../../../../lib/supabase';
import { mergeCommWhatsAppMessages, resolveDeliveryStatus } from '../messageStatus';

const baseMessage = (overrides: Partial<CommWhatsAppMessage>): CommWhatsAppMessage => ({
  id: overrides.id ?? 'message-1',
  chat_id: overrides.chat_id ?? 'chat-1',
  channel_id: overrides.channel_id ?? 'channel-1',
  external_message_id: overrides.external_message_id ?? 'external-1',
  direction: overrides.direction ?? 'outbound',
  message_type: overrides.message_type ?? 'text',
  delivery_status: overrides.delivery_status ?? 'pending',
  text_content: overrides.text_content ?? 'Oi',
  message_at: overrides.message_at ?? '2026-05-27T10:00:00.000Z',
  created_by: overrides.created_by ?? null,
  source: overrides.source ?? null,
  sender_name: overrides.sender_name ?? null,
  sender_phone: overrides.sender_phone ?? null,
  status_updated_at: overrides.status_updated_at ?? '2026-05-27T10:00:00.000Z',
  error_message: overrides.error_message ?? null,
  media_id: overrides.media_id ?? null,
  media_url: overrides.media_url ?? null,
  media_mime_type: overrides.media_mime_type ?? null,
  media_file_name: overrides.media_file_name ?? null,
  media_size_bytes: overrides.media_size_bytes ?? null,
  media_duration_seconds: overrides.media_duration_seconds ?? null,
  media_caption: overrides.media_caption ?? null,
  transcription_text: overrides.transcription_text ?? null,
  transcription_status: overrides.transcription_status ?? null,
  transcription_provider: overrides.transcription_provider ?? null,
  transcription_model: overrides.transcription_model ?? null,
  transcription_error: overrides.transcription_error ?? null,
  transcription_updated_at: overrides.transcription_updated_at ?? null,
  metadata: overrides.metadata ?? {},
  created_at: overrides.created_at ?? '2026-05-27T10:00:00.000Z',
});

test('advances statuses monotonically', () => {
  assert.equal(resolveDeliveryStatus('pending', 'sent'), 'sent');
  assert.equal(resolveDeliveryStatus('sent', 'delivered'), 'delivered');
  assert.equal(resolveDeliveryStatus('delivered', 'read'), 'read');
});

test('does not regress statuses', () => {
  assert.equal(resolveDeliveryStatus('read', 'delivered'), 'read');
  assert.equal(resolveDeliveryStatus('sent', 'pending'), 'sent');
});

test('only applies failed to non-terminal sends', () => {
  assert.equal(resolveDeliveryStatus('pending', 'failed'), 'failed');
  assert.equal(resolveDeliveryStatus('queued', 'failed'), 'failed');
  assert.equal(resolveDeliveryStatus('delivered', 'failed'), 'delivered');
});

test('merges local and server messages by client request id', () => {
  const local = baseMessage({
    id: 'local-1',
    external_message_id: null,
    delivery_status: 'pending',
    source: 'local',
    metadata: { local_outgoing: true, client_request_id: 'request-1', client_order_at: '2026-05-27T10:00:00.000Z' },
  });
  const server = baseMessage({
    id: 'server-1',
    external_message_id: 'external-1',
    delivery_status: 'sent',
    metadata: { client_request_id: 'request-1' },
  });

  const merged = mergeCommWhatsAppMessages([server], [local]);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 'server-1');
  assert.equal(merged[0].delivery_status, 'sent');
  assert.deepEqual(merged[0].metadata, {
    local_outgoing: true,
    client_request_id: 'request-1',
    client_order_at: '2026-05-27T10:00:00.000Z',
  });
});

test('keeps the most advanced status when merging duplicates', () => {
  const delivered = baseMessage({ id: 'server-1', external_message_id: 'external-1', delivery_status: 'delivered' });
  const stale = baseMessage({ id: 'server-1', external_message_id: 'external-1', delivery_status: 'sent' });

  const merged = mergeCommWhatsAppMessages([delivered], [stale]);

  assert.equal(merged[0].delivery_status, 'delivered');
});

test('merges by id when identity keys diverge (webhook-first race)', () => {
  const webhookFirst = baseMessage({
    id: 'server-1',
    external_message_id: 'external-1',
    delivery_status: 'sent',
    metadata: { from_me: true, provider: 'whapi' },
  });
  const sendUpdate = baseMessage({
    id: 'server-1',
    external_message_id: 'external-1',
    delivery_status: 'sent',
    metadata: { from_me: true, provider: 'whapi', client_request_id: 'req-1' },
  });

  const merged = mergeCommWhatsAppMessages([webhookFirst], [sendUpdate]);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 'server-1');
  assert.ok(merged[0].metadata.client_request_id, 'client_request_id should survive');
  assert.equal(merged[0].metadata.client_request_id, 'req-1');
});
