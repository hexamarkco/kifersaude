import assert from 'node:assert/strict';
import { test } from 'vitest';

import { hasCommWhatsAppEventReceipt, recordCommWhatsAppEventReceipt } from '../webhook-event-receipts';

const makeReceiptsTableStub = (existingEventKeys: Set<string> = new Set()) => {
  const insertCalls: Record<string, unknown>[] = [];

  const client = {
    from: (_table: string) => ({
      insert: async (row: Record<string, unknown>) => {
        insertCalls.push(row);
        const eventKey = row.event_key as string;
        if (existingEventKeys.has(eventKey)) {
          // Simula violação da constraint única de event_key no Postgres.
          return { error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
        }
        existingEventKeys.add(eventKey);
        return { error: null };
      },
      select: (_columns: string) => ({
        eq: (_column: string, value: string) => ({
          maybeSingle: async () => ({
            data: existingEventKeys.has(value) ? { id: 'receipt-1' } : null,
            error: null,
          }),
        }),
      }),
    }),
  } as any;

  return { client, insertCalls, existingEventKeys };
};

test('registra um evento novo com sucesso', async () => {
  const { client, insertCalls } = makeReceiptsTableStub();

  const accepted = await recordCommWhatsAppEventReceipt(
    client,
    'channel-1',
    'event-key-1',
    'message',
    'msg-1',
    { foo: 'bar' },
  );

  assert.equal(accepted, true);
  assert.equal(insertCalls.length, 1);
  assert.equal(insertCalls[0].event_key, 'event-key-1');
});

test('retorna false (não lança) quando o event_key já existe — retry legítimo do provedor é no-op', async () => {
  const { client } = makeReceiptsTableStub(new Set(['event-key-1']));

  const accepted = await recordCommWhatsAppEventReceipt(
    client,
    'channel-1',
    'event-key-1',
    'message',
    'msg-1',
    { foo: 'bar' },
  );

  assert.equal(accepted, false);
});

test('propaga erro de banco que não seja violação de unicidade', async () => {
  const client = {
    from: () => ({
      insert: async () => ({ error: { code: '42501', message: 'permission denied' } }),
    }),
  } as any;

  await assert.rejects(
    () => recordCommWhatsAppEventReceipt(client, 'channel-1', 'event-key-1', 'message', 'msg-1', {}),
    /Erro ao registrar dedupe do webhook/,
  );
});

test('hasCommWhatsAppEventReceipt detecta evento já processado', async () => {
  const { client } = makeReceiptsTableStub(new Set(['event-key-1']));

  assert.equal(await hasCommWhatsAppEventReceipt(client, 'event-key-1'), true);
  assert.equal(await hasCommWhatsAppEventReceipt(client, 'event-key-2'), false);
});

test('fluxo completo de dedupe: mesmo evento entregue duas vezes só é processado uma', async () => {
  const { client } = makeReceiptsTableStub();
  const eventKey = 'webhook-event-replay-test';

  const processEvent = async () => {
    if (await hasCommWhatsAppEventReceipt(client, eventKey)) return 'skipped';
    const accepted = await recordCommWhatsAppEventReceipt(client, 'channel-1', eventKey, 'message', 'msg-1', {});
    return accepted ? 'processed' : 'skipped';
  };

  const first = await processEvent();
  const second = await processEvent();

  assert.equal(first, 'processed');
  assert.equal(second, 'skipped');
});
