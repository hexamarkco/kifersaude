import assert from 'node:assert/strict';
import { test } from 'vitest';

import { isTrustedWhapiMediaUrl } from '../comm-whatsapp';

test('aceita URL https em subdomínio *.whapi.cloud', () => {
  assert.equal(isTrustedWhapiMediaUrl('https://gate.whapi.cloud/media/abc123'), true);
  assert.equal(isTrustedWhapiMediaUrl('https://media.whapi.cloud/file.jpg'), true);
});

test('rejeita protocolo não-https', () => {
  assert.equal(isTrustedWhapiMediaUrl('http://gate.whapi.cloud/media/abc123'), false);
  assert.equal(isTrustedWhapiMediaUrl('ftp://gate.whapi.cloud/media/abc123'), false);
});

test('rejeita host que não é subdomínio de whapi.cloud (guarda anti-SSRF)', () => {
  assert.equal(isTrustedWhapiMediaUrl('https://attacker.com/media/abc123'), false);
  assert.equal(isTrustedWhapiMediaUrl('https://notwhapi.cloud/media/abc123'), false);
  assert.equal(isTrustedWhapiMediaUrl('https://whapi.cloud.attacker.com/media/abc123'), false);
  assert.equal(isTrustedWhapiMediaUrl('https://169.254.169.254/latest/meta-data'), false);
  assert.equal(isTrustedWhapiMediaUrl('https://localhost/media'), false);
});

test('rejeita hostname exatamente igual a whapi.cloud sem subdomínio', () => {
  assert.equal(isTrustedWhapiMediaUrl('https://whapi.cloud/media/abc123'), false);
});

test('rejeita URL com credenciais embutidas', () => {
  assert.equal(isTrustedWhapiMediaUrl('https://user:pass@gate.whapi.cloud/media/abc123'), false);
  assert.equal(isTrustedWhapiMediaUrl('https://user@gate.whapi.cloud/media/abc123'), false);
});

test('rejeita URL com porta explícita', () => {
  assert.equal(isTrustedWhapiMediaUrl('https://gate.whapi.cloud:8443/media/abc123'), false);
});

test('rejeita valores vazios, nulos ou malformados', () => {
  assert.equal(isTrustedWhapiMediaUrl(''), false);
  assert.equal(isTrustedWhapiMediaUrl(null), false);
  assert.equal(isTrustedWhapiMediaUrl(undefined), false);
  assert.equal(isTrustedWhapiMediaUrl('   '), false);
  assert.equal(isTrustedWhapiMediaUrl('não é uma url'), false);
  assert.equal(isTrustedWhapiMediaUrl(12345), false);
});

test('path/query maliciosos no host correto não escapam a checagem de hostname', () => {
  // O hostname continua sendo o domínio real mesmo com tentativa de path traversal ou
  // parâmetro de redirecionamento no path/query.
  assert.equal(isTrustedWhapiMediaUrl('https://gate.whapi.cloud/../../attacker.com'), true);
  assert.equal(isTrustedWhapiMediaUrl('https://gate.whapi.cloud/media?redirect=https://attacker.com'), true);
});
