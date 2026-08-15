import assert from 'node:assert/strict';
import { test } from 'vitest';

import { checkCommWhatsAppActionRateLimit } from '../rate-limit';

const makeRpcStub = (results: Array<{ data: unknown; error: unknown }>) => {
  let callIndex = -1;
  const calls: Record<string, unknown>[] = [];

  const client = {
    rpc: async (fnName: string, params: Record<string, unknown>) => {
      calls.push({ fnName, ...params });
      callIndex += 1;
      return results[callIndex] ?? { data: null, error: null };
    },
  } as any;

  return { client, calls };
};

test('permite a requisição quando a RPC retorna true', async () => {
  const { client, calls } = makeRpcStub([{ data: true, error: null }]);

  const allowed = await checkCommWhatsAppActionRateLimit(client, 'user-1', 'comm-whatsapp-send', 60, 60);

  assert.equal(allowed, true);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    fnName: 'consume_comm_whatsapp_action_rate_limit',
    p_user_id: 'user-1',
    p_scope: 'comm-whatsapp-send',
    p_max_requests: 60,
    p_window_seconds: 60,
  });
});

test('bloqueia a requisição quando a RPC retorna false', async () => {
  const { client } = makeRpcStub([{ data: false, error: null }]);

  const allowed = await checkCommWhatsAppActionRateLimit(client, 'user-1', 'comm-whatsapp-send', 60, 60);

  assert.equal(allowed, false);
});

test('falha aberta: se a RPC der erro, permite a requisição em vez de bloquear o Inbox inteiro', async () => {
  const { client } = makeRpcStub([{ data: null, error: { message: 'connection refused' } }]);

  const allowed = await checkCommWhatsAppActionRateLimit(client, 'user-1', 'comm-whatsapp-send', 60, 60);

  assert.equal(allowed, true);
});

test('escopos diferentes (send/react/manage/retry) usam o mesmo mecanismo com parâmetros próprios', async () => {
  const { client, calls } = makeRpcStub([
    { data: true, error: null },
    { data: true, error: null },
    { data: true, error: null },
    { data: true, error: null },
  ]);

  await checkCommWhatsAppActionRateLimit(client, 'user-1', 'comm-whatsapp-send', 60, 60);
  await checkCommWhatsAppActionRateLimit(client, 'user-1', 'comm-whatsapp-react', 60, 60);
  await checkCommWhatsAppActionRateLimit(client, 'user-1', 'comm-whatsapp-manage-message', 40, 60);
  await checkCommWhatsAppActionRateLimit(client, 'user-1', 'comm-whatsapp-retry-message', 20, 60);

  const scopes = calls.map((call) => call.p_scope);
  assert.deepEqual(scopes, [
    'comm-whatsapp-send',
    'comm-whatsapp-react',
    'comm-whatsapp-manage-message',
    'comm-whatsapp-retry-message',
  ]);
});
