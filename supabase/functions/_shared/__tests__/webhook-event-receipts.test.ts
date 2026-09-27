import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  findCommWhatsAppEventReceipt,
  hasCommWhatsAppEventReceipt,
  recordCommWhatsAppEventReceipt,
} from '../webhook-event-receipts';

type WebhookReceiptClient = Parameters<typeof recordCommWhatsAppEventReceipt>[0];

const makeReceiptsTableStub = (existingEventKeys: Set<string> = new Set()) => {
  const insertCalls: Record<string, unknown>[] = [];
  const insertOptions: Record<string, unknown>[] = [];

  const client = {
    from: (_table: string) => ({
      insert: (row: Record<string, unknown>, options: Record<string, unknown>) => ({
        select: async (_columns: string) => {
          insertCalls.push(row);
          insertOptions.push(options);
          const eventKey = row.event_key as string;
          if (existingEventKeys.has(eventKey)) {
            return { data: [], error: null };
          }
          existingEventKeys.add(eventKey);
          return { data: [{ id: 'receipt-1' }], error: null };
        },
        }),
      select: (_columns: string) => ({
        eq: (_column: string, value: string) => ({
          maybeSingle: async () => ({
            data: existingEventKeys.has(value) ? {
              id: 'receipt-1',
              channel_id: 'channel-1',
              event_key: value,
              event_type: 'message',
              resource_id: 'msg-1',
              received_at: '2026-08-30T12:00:00.000Z',
              payload_archive_path: '2026-08-30/first.json',
            } : null,
            error: null,
          }),
        }),
      }),
    }),
  } as unknown as WebhookReceiptClient;

  return { client, insertCalls, insertOptions, existingEventKeys };
};

test('registra um evento novo com sucesso usando inserção idempotente', async () => {
  const { client, insertCalls, insertOptions } = makeReceiptsTableStub();

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
  assert.deepEqual(insertOptions[0], { onConflict: 'event_key', ignoreDuplicates: true });
});

test('retorna false (sem 409) quando o event_key já existe — retry legítimo é no-op', async () => {
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
      insert: () => ({
        select: async () => ({ error: { code: '42501', message: 'permission denied' } }),
      }),
    }),
  } as unknown as WebhookReceiptClient;

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

test('findCommWhatsAppEventReceipt retorna metadados da entrega que causou a colisão', async () => {
  const { client } = makeReceiptsTableStub(new Set(['event-key-1']));

  assert.deepEqual(await findCommWhatsAppEventReceipt(client, 'event-key-1'), {
    id: 'receipt-1',
    channel_id: 'channel-1',
    event_key: 'event-key-1',
    event_type: 'message',
    resource_id: 'msg-1',
    received_at: '2026-08-30T12:00:00.000Z',
    payload_archive_path: '2026-08-30/first.json',
  });
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
