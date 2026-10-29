import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import { dispatchPendingAutonomousReply } from '../ai-autonomous-dispatch.ts';
const client = (pending: boolean) => {
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: pending ? { id: 'job' } : null, error: null }) };
  return { from: vi.fn().mockReturnValue(query) } as unknown as SupabaseClient;
};
beforeEach(() => {
  vi.stubGlobal('Deno', { env: { get: (key: string) => key === 'SUPABASE_URL' ? 'https://supabase.test' : 'synthetic-key' } });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
test('inactive/nonpending chats do not invoke the worker', async () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  await dispatchPendingAutonomousReply(client(false), 'chat');
  expect(fetch).not.toHaveBeenCalled();
});
test('persisted pending job starts the same worker with debounce, without sending WhatsApp', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response('{}')); vi.stubGlobal('fetch', fetch);
  await dispatchPendingAutonomousReply(client(true), 'chat');
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][0]).toBe('https://supabase.test/functions/v1/ai-autonomous-reply-worker');
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ source: 'webhook_debounce', chatId: 'chat', waitUntilDue: true });
});
test('worker HTTP failure leaves the durable queue alone and never logs its body or key', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('private upstream payload', { status: 503 })));
  await dispatchPendingAutonomousReply(client(true), 'chat');
  expect(JSON.stringify(warn.mock.calls)).not.toMatch(/private upstream|synthetic-key/);
  expect(warn).toHaveBeenCalledWith('[autonomous-dispatch] worker_unavailable', { status: 503 });
});
