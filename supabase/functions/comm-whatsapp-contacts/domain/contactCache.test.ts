import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  buildManualContactCacheRow,
  isManualContactId,
  isManualContactRow,
  MANUAL_CONTACT_ID_PREFIX,
} from './contactCache';

test('cria uma identidade manual estável para o telefone normalizado', () => {
  const row = buildManualContactCacheRow({
    channelId: 'channel-1',
    phoneNumber: '+55 (21) 98296-5495',
    displayName: 'Mariangela',
    nowIso: '2026-09-26T22:00:00.000Z',
  });

  assert.equal(row.contact_id, `${MANUAL_CONTACT_ID_PREFIX}5521982965495`);
  assert.equal(row.phone_digits, '5521982965495');
  assert.equal(row.display_name, 'Mariangela');
  assert.equal(row.short_name, 'Mariangela');
  assert.equal(row.saved, true);
  assert.equal(row.manual_override, true);
  assert.equal(row.manual_override_name, 'Mariangela');
  assert.equal(isManualContactId(row.contact_id), true);
});

test('não classifica a identidade do provedor como sobrescrita manual', () => {
  assert.equal(isManualContactId('5521982965495'), false);
  assert.equal(isManualContactId('chat:5521982965495'), false);
  assert.equal(isManualContactId(' manual:5521982965495 '), true);
});

test('reconhece contato antigo protegido mesmo com identificador do provedor', () => {
  assert.equal(isManualContactRow({
    contact_id: '5521982965495',
    manual_override: true,
  }), true);
  assert.equal(isManualContactRow({
    contact_id: '5521982965495',
    manual_override: false,
  }), false);
});

test('rejeita telefone ou nome inválido antes de gravar o cache', () => {
  assert.throws(
    () => buildManualContactCacheRow({
      channelId: 'channel-1',
      phoneNumber: 'abc',
      displayName: 'Mariangela',
      nowIso: '2026-09-26T22:00:00.000Z',
    }),
    /Numero invalido/,
  );
  assert.throws(
    () => buildManualContactCacheRow({
      channelId: 'channel-1',
      phoneNumber: '5521982965495',
      displayName: '5521982965495',
      nowIso: '2026-09-26T22:00:00.000Z',
    }),
    /Nome invalido/,
  );
});
