import assert from 'node:assert/strict';
import type { WhatsappScheduledMessage } from '../whatsappScheduler';

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_FUNCTIONS_URL = '';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';

const schedulerModule = await import('../whatsappScheduler');
const { cancelScheduledMessage, processScheduledMessages, scheduleWhatsappMessage } = schedulerModule;

const supabaseModule = (await import('../../lib/supabaseAdmin')) as { supabaseAdmin: any };
const supabaseAdmin = supabaseModule.supabaseAdmin as any;

const originalFrom = supabaseAdmin.from;

const withSupabaseMock = async (
  implementation: typeof supabaseAdmin.from,
  callback: () => Promise<void>,
) => {
  supabaseAdmin.from = implementation;
  try {
    await callback();
  } finally {
    supabaseAdmin.from = originalFrom;
  }
};

const createUpdateRecorder = () => {
  const payloads: any[] = [];

  const implementation: typeof supabaseAdmin.from = () => ({
    select: () => ({
      eq: () => ({
        lte: () => ({
          order: async () => ({ data: [], error: null }),
        }),
      }),
    }),
    update: (payload: any) => {
      payloads.push(payload);
      return {
        eq: () => ({
          in: (_column: string, _values: string[]) => Promise.resolve({ data: null, error: null }),
        }),
      };
    },
  });

  return { implementation, payloads };
};

await withSupabaseMock(
  () => ({
    insert: (_payload: any) => ({
      select: () => ({
        single: async () => ({
          data: {
            id: 'schedule-1',
            chat_id: 'chat-1',
            phone: '5511999999999',
            message: 'Olá',
            scheduled_send_at: '2024-01-01T12:00:00.000Z',
            status: 'pending',
            created_at: null,
            updated_at: null,
            sent_at: null,
            cancelled_at: null,
            last_error: null,
          } satisfies WhatsappScheduledMessage,
          error: null,
        }),
      }),
    }),
  }),
  async () => {
    const result = await scheduleWhatsappMessage({
      chatId: 'chat-1',
      phone: '5511999999999',
      message: 'Olá',
      scheduledSendAt: '2024-01-01T12:00:00.000Z',
    });

    assert.equal(result.chat_id, 'chat-1');
    assert.equal(result.status, 'pending');
  },
);

const dueRecord: WhatsappScheduledMessage = {
  id: 'schedule-2',
  chat_id: 'chat-2',
  phone: '5511888888888',
  message: 'Mensagem agendada',
  scheduled_send_at: new Date(Date.now() - 1_000).toISOString(),
  status: 'pending',
  created_at: null,
  updated_at: null,
  sent_at: null,
  cancelled_at: null,
  last_error: null,
};

const updatePayloads: any[] = [];

await withSupabaseMock(
  () => ({
    select: () => ({
      eq: () => ({
        lte: () => ({
          order: async () => ({ data: [dueRecord], error: null }),
        }),
      }),
    }),
    update: (payload: any) => {
      updatePayloads.push(payload);
      return {
        eq: () => Promise.resolve({ data: null, error: null }),
        in: () => Promise.resolve({ data: null, error: null }),
      };
    },
  }),
  async () => {
    const fetchCalls: Array<{ url: string; body: any }> = [];

    const fetchMock: typeof fetch = (async (input: RequestInfo | URL, options: RequestInit = {}) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : '';
      fetchCalls.push({ url, body: options.body });
      return { ok: true, text: async () => '' } as any;
    }) as any;

    const results = await processScheduledMessages({ now: new Date(), fetchImpl: fetchMock });

    assert.equal(fetchCalls.length, 1);
    assert.equal(updatePayloads.length, 2);
    assert.equal(updatePayloads[0]?.status, 'processing');
    assert.equal(updatePayloads[1]?.status, 'sent');
    assert.deepEqual(results, [{ id: dueRecord.id, status: 'sent' }]);
  },
);

const { implementation: cancelImplementation, payloads: cancelPayloads } = createUpdateRecorder();

await withSupabaseMock(cancelImplementation, async () => {
  await cancelScheduledMessage('schedule-3');

  assert.equal(cancelPayloads.length, 1);
  assert.equal(cancelPayloads[0]?.status, 'cancelled');
});

console.log('whatsappScheduler tests passed');
