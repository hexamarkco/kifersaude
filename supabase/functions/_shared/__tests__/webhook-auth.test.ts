import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  buildWebhookUrl,
  corsHeaders,
  isCommWhatsAppWebhookRequestAuthorized,
  isCommWhatsAppWebhookSecretValid,
  resolveCommWhatsAppWebhookProvidedSecret,
} from '../comm-whatsapp';

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

test('resolveCommWhatsAppWebhookProvidedSecret prioriza o header quando presente', () => {
  assert.equal(
    resolveCommWhatsAppWebhookProvidedSecret('do-header', 'da-query'),
    'do-header',
  );
});

test('resolveCommWhatsAppWebhookProvidedSecret cai para o query param quando o header nao vem (Whapi sem campo de header custom)', () => {
  assert.equal(
    resolveCommWhatsAppWebhookProvidedSecret(null, 'da-query'),
    'da-query',
  );
  assert.equal(
    resolveCommWhatsAppWebhookProvidedSecret(undefined, 'da-query'),
    'da-query',
  );
  assert.equal(
    resolveCommWhatsAppWebhookProvidedSecret('   ', 'da-query'),
    'da-query',
  );
});

test('resolveCommWhatsAppWebhookProvidedSecret retorna null quando nenhum dos dois vem preenchido', () => {
  assert.equal(resolveCommWhatsAppWebhookProvidedSecret(null, null), null);
  assert.equal(resolveCommWhatsAppWebhookProvidedSecret('', ''), null);
  assert.equal(resolveCommWhatsAppWebhookProvidedSecret('  ', undefined), null);
});

test('buildWebhookUrl embute o segredo na query quando informado, para colar direto na Whapi', () => {
  const url = buildWebhookUrl('https://exemplo.supabase.co', 'meu-segredo-123');
  assert.equal(
    url,
    'https://exemplo.supabase.co/functions/v1/comm-whatsapp-webhook?channel=primary&secret=meu-segredo-123',
  );
});

test('buildWebhookUrl omite o parametro secret quando nenhum segredo e informado', () => {
  const url = buildWebhookUrl('https://exemplo.supabase.co');
  assert.equal(
    url,
    'https://exemplo.supabase.co/functions/v1/comm-whatsapp-webhook?channel=primary',
  );
});

test('isCommWhatsAppWebhookRequestAuthorized aceita quando so o header bate', () => {
  assert.equal(
    isCommWhatsAppWebhookRequestAuthorized('meu-segredo-123', 'errado', 'meu-segredo-123'),
    true,
  );
});

test('isCommWhatsAppWebhookRequestAuthorized aceita quando so o query param bate (header desatualizado)', () => {
  assert.equal(
    isCommWhatsAppWebhookRequestAuthorized('header-velho-e-invalido', 'meu-segredo-123', 'meu-segredo-123'),
    true,
  );
});

test('isCommWhatsAppWebhookRequestAuthorized rejeita quando nenhum dos dois bate', () => {
  assert.equal(
    isCommWhatsAppWebhookRequestAuthorized('errado-1', 'errado-2', 'meu-segredo-123'),
    false,
  );
});

test('isCommWhatsAppWebhookRequestAuthorized rejeita quando nenhum dos dois vem preenchido', () => {
  assert.equal(isCommWhatsAppWebhookRequestAuthorized(null, null, 'meu-segredo-123'), false);
});
