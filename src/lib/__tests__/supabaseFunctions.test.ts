import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  getSupabaseErrorMessage,
  getSupabaseRequestTimeoutMs,
  supabaseFunctionsUrl,
} from '../../infrastructure/supabase';

test('allows the observed follow-up durations inside the long request window', () => {
  const timeoutMs = getSupabaseRequestTimeoutMs(
    `${supabaseFunctionsUrl}/comm-whatsapp-generate-follow-up`,
  );

  assert.equal(timeoutMs, 180_000);
  assert.equal([61_000, 76_000, 81_000].every((durationMs) => durationMs < timeoutMs), true);
});

test('keeps the default timeout for ordinary Edge Functions', () => {
  assert.equal(getSupabaseRequestTimeoutMs(`${supabaseFunctionsUrl}/ordinary-function`), 60_000);
});

test('allows automated sandbox scenarios to finish their multi-turn evaluation', () => {
  assert.equal(
    getSupabaseRequestTimeoutMs(`${supabaseFunctionsUrl}/ai-sandbox-run-scenario`),
    180_000,
  );
});

test('reads the JSON payload from an HTTP function error', async () => {
  const error = new FunctionsHttpError(new Response(
    JSON.stringify({ error: 'Falha interna da função.' }),
    { status: 500, headers: { 'Content-Type': 'application/json' } },
  ));

  assert.equal(await getSupabaseErrorMessage(error, 'fallback'), 'Falha interna da função.');
});

test('reads the relay response message', async () => {
  const error = new FunctionsRelayError(new Response(
    JSON.stringify({ message: 'Relay temporariamente indisponível.' }),
    { status: 503, headers: { 'Content-Type': 'application/json' } },
  ));

  assert.equal(await getSupabaseErrorMessage(error, 'fallback'), 'Relay temporariamente indisponível.');
});

test('keeps the specific legacy function payload ahead of a generic context message', async () => {
  const error = Object.assign(new Error('Falha genérica.'), {
    context: {
      message: 'Contexto genérico.',
      data: { error: 'Falha específica da função.' },
    },
  });

  assert.equal(await getSupabaseErrorMessage(error, 'fallback'), 'Falha específica da função.');
});

for (const message of [
  'Falha de rede ao conectar com o Supabase. Tempo limite atingido apos 180s.',
  'Falha de rede ao conectar com o Supabase. Erro original: Failed to fetch',
]) {
  test(`unwraps the original FunctionsFetchError cause: ${message}`, async () => {
    const error = new FunctionsFetchError(new Error(message));

    assert.equal(await getSupabaseErrorMessage(error, 'fallback'), message);
  });
}
