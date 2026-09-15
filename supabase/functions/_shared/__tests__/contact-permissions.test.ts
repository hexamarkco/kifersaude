import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  assertContactPermissionForSend,
  ContactPermissionBlockedError,
  ContactPermissionCheckError,
  type ContactPermissionRpcClient,
} from '../contact-permissions';

const createClient = (result: { data: unknown; error: { message?: string } | null }): {
  client: ContactPermissionRpcClient;
  calls: Array<{ functionName: string; params: Record<string, unknown> }>;
} => {
  const calls: Array<{ functionName: string; params: Record<string, unknown> }> = [];
  const client = {
    rpc: async (functionName: string, params: Record<string, unknown>) => {
      calls.push({ functionName, params });
      return result;
    },
  } as unknown as ContactPermissionRpcClient;
  return { client, calls };
};

test('consults the server policy using a normalized WhatsApp endpoint and commercial scope', async () => {
  const { client, calls } = createClient({ data: { allowed: true, blocked_scope: null }, error: null });

  await assertContactPermissionForSend(client, '+55 (21) 99999-1234', 'commercial');

  assert.deepEqual(calls, [{
    functionName: 'check_contact_permission_for_send',
    params: {
      p_channel: 'whatsapp',
      p_endpoint_normalized: '5521999991234',
      p_purpose_scope: 'commercial',
    },
  }]);
});

test('returns a clear block error without including the contact endpoint', async () => {
  const { client } = createClient({
    data: { allowed: false, blocked_scope: 'global', reason: 'Solicitação explícita do contato.' },
    error: null,
  });

  await assert.rejects(
    assertContactPermissionForSend(client, '5521999991234', 'service_reply'),
    (error: unknown) => {
      assert.ok(error instanceof ContactPermissionBlockedError);
      assert.equal(error.code, 'CONTACT_PERMISSION_BLOCKED');
      assert.match(error.message, /Solicitação explícita/);
      assert.doesNotMatch(error.message, /5521999991234/);
      return true;
    },
  );
});

test('fails closed when permission lookup fails', async () => {
  const { client } = createClient({ data: null, error: { message: 'connection refused' } });

  await assert.rejects(
    assertContactPermissionForSend(client, '5521999991234', 'commercial'),
    ContactPermissionCheckError,
  );
});

test('fails closed for malformed endpoint and malformed RPC response', async () => {
  const { client } = createClient({ data: { allowed: 'yes' }, error: null });

  await assert.rejects(assertContactPermissionForSend(client, '', 'commercial'), ContactPermissionCheckError);
  await assert.rejects(assertContactPermissionForSend(client, '5521999991234', 'commercial'), ContactPermissionCheckError);
});

test('keeps service replies separate from commercial follow-up scope', async () => {
  const { client, calls } = createClient({ data: { allowed: true }, error: null });

  await assertContactPermissionForSend(client, '5521999991234', 'service_reply');

  assert.equal(calls[0]?.params.p_purpose_scope, 'service_reply');
});
