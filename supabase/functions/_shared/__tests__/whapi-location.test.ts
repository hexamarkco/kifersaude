import assert from 'node:assert/strict';
import { test } from 'vitest';
import { extractWhapiLocationMeta } from '../comm-whatsapp';
import { getMessageLocationInfo } from '../../../../src/features/communication/whatsapp/domain/messageLocation';
import type { CommWhatsAppMessage } from '../../../../src/features/communication/whatsapp/domain/types';

const message = (type: string, location: unknown): CommWhatsAppMessage => ({
  id: 'message', chat_id: 'chat', channel_id: 'channel', direction: 'inbound',
  message_type: type, delivery_status: 'received', text_content: '[Localizacao]',
  message_at: '2026-10-14T12:00:00Z', created_at: '2026-10-14T12:00:00Z',
  metadata: { location },
});

for (const type of ['location', 'live_location']) {
  test(`preserves ${type} provider coordinates and address for rendering`, () => {
    const location = extractWhapiLocationMeta({
      type, [type]: { latitude: -22.9, longitude: -43.2, name: ' Clínica ', address: 'Rua A, 12', comment: 'Entrada lateral' },
    });
    assert.deepEqual(location, { latitude: -22.9, longitude: -43.2, name: 'Clínica', address: 'Rua A, 12', comment: 'Entrada lateral' });
    const info = getMessageLocationInfo(message(type, location));
    assert.equal(info?.live, type === 'live_location');
    assert.equal(info?.address, 'Rua A, 12');
    assert.equal(info?.mapUrl, 'https://www.google.com/maps/search/?api=1&query=-22.9%2C-43.2');
  });
}

test('accepts zero and numeric strings without inventing missing coordinates', () => {
  assert.ok(getMessageLocationInfo(message('location', { latitude: 0, longitude: '0' }))?.mapUrl);
  for (const invalid of [null, undefined, '', ' ', false, {}, NaN, Infinity, 'invalid', 181]) {
    const location = { latitude: invalid, longitude: invalid };
    const persisted = extractWhapiLocationMeta({ type: 'location', location });
    assert.equal(persisted?.latitude, null);
    assert.equal(persisted?.longitude, null);
    assert.equal(getMessageLocationInfo(message('location', location))?.mapUrl, null);
  }
  assert.equal(getMessageLocationInfo(message('location', { latitude: 91, longitude: 0 }))?.mapUrl, null);
  assert.equal(getMessageLocationInfo(message('location', { latitude: 0 }))?.mapUrl, null);
});

test('handles missing payloads and live locations using the location field', () => {
  assert.equal(extractWhapiLocationMeta({ type: 'location' }), null);
  assert.equal(extractWhapiLocationMeta(null), null);
  assert.equal(extractWhapiLocationMeta({ type: 'text', location: { latitude: 0, longitude: 0 } }), null);
  assert.equal(getMessageLocationInfo(message('text', {})), null);
  assert.equal(getMessageLocationInfo(message('location', undefined))?.mapUrl, null);
  assert.equal(extractWhapiLocationMeta({ type: 'live_location', location: { latitude: 0, longitude: 0 } })?.latitude, 0);
});
