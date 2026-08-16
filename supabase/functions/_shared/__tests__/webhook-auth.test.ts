import assert from 'node:assert/strict';
import { test } from 'vitest';

import { corsHeaders, isCommWhatsAppWebhookSecretValid } from '../comm-whatsapp';

test('CORS não usa mais wildcard — Access-Control-Allow-Origin aponta para uma origem específica', () => {
  assert.notEqual(corsHeaders['Access-Control-Allow-Origin'], '*');
  assert.ok(corsHeaders['Access-Control-Allow-Origin'].startsWith('https://'));
  assert.equal(corsHeaders.Vary, 'Origin');
});

test('aceita quando o header bate exatamente com o segredo configurado', () => {
  assert.equal(isCommWhatsAppWebhookSecretValid('meu-segredo-123', 'meu-segredo-123'), true);
});

test('rejeita quando o header está ausente', () => {
  assert.equal(isCommWhatsAppWebhookSecretValid(null, 'meu-segredo-123'), false);
  assert.equal(isCommWhatsAppWebhookSecretValid(undefined, 'meu-segredo-123'), false);
  assert.equal(isCommWhatsAppWebhookSecretValid('', 'meu-segredo-123'), false);
  assert.equal(isCommWhatsAppWebhookSecretValid('   ', 'meu-segredo-123'), false);
});

test('rejeita quando o header não bate com o segredo', () => {
  assert.equal(isCommWhatsAppWebhookSecretValid('segredo-errado', 'meu-segredo-123'), false);
});

test('rejeita quando o segredo esperado (env) não está configurado', () => {
  assert.equal(isCommWhatsAppWebhookSecretValid('qualquer-coisa', ''), false);
});

test('não aceita por prefixo/substring — precisa ser igualdade exata após trim', () => {
  assert.equal(isCommWhatsAppWebhookSecretValid('meu-segredo-123-extra', 'meu-segredo-123'), false);
  assert.equal(isCommWhatsAppWebhookSecretValid('meu-segredo-12', 'meu-segredo-123'), false);
  assert.equal(isCommWhatsAppWebhookSecretValid('  meu-segredo-123  ', 'meu-segredo-123'), true);
});

test('é case-sensitive', () => {
  assert.equal(isCommWhatsAppWebhookSecretValid('Meu-Segredo-123', 'meu-segredo-123'), false);
});
