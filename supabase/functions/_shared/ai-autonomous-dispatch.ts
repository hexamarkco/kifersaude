import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
declare const Deno: { env: { get: (key: string) => string | undefined } };

/** Best effort acceleration only. The persisted queue and cron own recovery. */
export const dispatchPendingAutonomousReply = async (client: SupabaseClient, chatId: string): Promise<void> => {
  try {
    const pending = await client.from('ai_autonomous_reply_jobs').select('id')
      .eq('chat_id', chatId).eq('status', 'pending').limit(1).maybeSingle();
    if (pending.error || !pending.data) return;
    const baseUrl = Deno.env.get('SUPABASE_URL');
    const token = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!baseUrl || !token) return;
    const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/functions/v1/ai-autonomous-reply-worker`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ source: 'webhook_debounce', chatId, waitUntilDue: true }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!response.ok) console.warn('[autonomous-dispatch] worker_unavailable', { status: response.status });
    await response.body?.cancel();
  } catch {
    console.warn('[autonomous-dispatch] worker_unavailable');
  }
};
