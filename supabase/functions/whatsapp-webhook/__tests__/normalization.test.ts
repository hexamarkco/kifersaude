import assert from 'node:assert/strict';
import {
  normalizePhoneNumber,
  extractNormalizedPhoneNumber,
  extractNormalizedTargetPhone,
} from '../phoneNumbers';

const normalizedWithLid = normalizePhoneNumber('5511987654321@lid');
assert.strictEqual(normalizedWithLid, '5511987654321');

const normalizedWithPrefixlessLid = normalizePhoneNumber('11987654321@lid');
assert.strictEqual(normalizedWithPrefixlessLid, '5511987654321');

const normalizedWithLidSuffix = normalizePhoneNumber('5511987654321:lid');
assert.strictEqual(normalizedWithLidSuffix, '5511987654321');

const outgoingPayload = {
  fromMe: true,
  senderPhone: '5511988887777@lid',
  targetPhone: '5511977776666@lid',
  to: '5511977776666@lid',
  message: {
    from: '5511988887777@lid',
    to: '5511977776666@lid',
    key: {
      remoteJid: '5511977776666@lid',
    },
  },
  connectedPhone: '5511988887777@lid',
  me: {
    id: '5511988887777@lid',
    jid: '5511988887777@lid',
    phone: '5511988887777@lid',
  },
};

const extractedPhone = extractNormalizedPhoneNumber(outgoingPayload);
assert.strictEqual(extractedPhone, '5511977776666');

const extractedTarget = extractNormalizedTargetPhone(outgoingPayload);
assert.strictEqual(extractedTarget, '5511977776666');

console.log('whatsapp webhook normalization tests passed');
