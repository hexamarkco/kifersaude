import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

type SlaStatus = 'healthy' | 'warning' | 'critical';

type SlaSnapshotRow = {
  chat_id: string;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  last_message_at: string | null;
  last_response_ms: number | null;
  pending_inbound_count: number | null;
  waiting_since: string | null;
  waiting_minutes: number | null;
};

type StoredSlaMetric = {
  chat_id: string;
  sla_status: SlaStatus;
  last_alert_status: SlaStatus | null;
  last_alert_at: string | null;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-API-Key',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

const minutesToMs = (minutes: number) => minutes * 60 * 1000;
const WARNING_MINUTES = Number(Deno.env.get('WHATSAPP_SLA_WARNING_MINUTES') ?? '15');
const CRITICAL_MINUTES = Number(Deno.env.get('WHATSAPP_SLA_CRITICAL_MINUTES') ?? '30');
const ALERT_COOLDOWN_MINUTES = Number(
  Deno.env.get('WHATSAPP_SLA_ALERT_COOLDOWN_MINUTES') ?? '15',
);

const WARNING_MS = minutesToMs(WARNING_MINUTES);
const CRITICAL_MS = minutesToMs(CRITICAL_MINUTES);
const ALERT_COOLDOWN_MS = minutesToMs(ALERT_COOLDOWN_MINUTES);

const determineStatus = (waitingMs: number | null): SlaStatus => {
  if (waitingMs === null || waitingMs < 0) {
    return 'healthy';
  }

  if (waitingMs >= CRITICAL_MS) {
    return 'critical';
  }

  if (waitingMs >= WARNING_MS) {
    return 'warning';
  }

  return 'healthy';
};

serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const [{ data: snapshots, error: snapshotError }, { data: storedMetrics, error: storedError }]
      = await Promise.all([
        supabaseAdmin.from('whatsapp_chat_sla_snapshot').select('*'),
        supabaseAdmin
          .from('whatsapp_chat_sla_metrics')
          .select('chat_id, sla_status, last_alert_status, last_alert_at'),
      ]);

    if (snapshotError) {
      throw snapshotError;
    }

    if (storedError) {
      throw storedError;
    }

    const storedMap = new Map<string, StoredSlaMetric>();
    for (const record of storedMetrics ?? []) {
      storedMap.set(record.chat_id, record as StoredSlaMetric);
    }

    const now = Date.now();
    const nowIso = new Date(now).toISOString();

    const upserts: Record<string, unknown>[] = [];
    const alertsToInsert: Record<string, unknown>[] = [];

    for (const snapshot of snapshots ?? []) {
      const normalized = snapshot as SlaSnapshotRow;
      const pendingCount = normalized.pending_inbound_count ?? 0;
      const waitingSince = normalized.waiting_since;
      const waitingMs = waitingSince ? now - Date.parse(waitingSince) : null;
      const longestWaitingResponseMs = waitingMs !== null && waitingMs >= 0 ? waitingMs : null;
      const slaStatus: SlaStatus = pendingCount > 0 ? determineStatus(waitingMs) : 'healthy';
      const waitingMinutes = typeof normalized.waiting_minutes === 'number'
        ? normalized.waiting_minutes
        : waitingMs !== null
          ? Math.floor(waitingMs / 60000)
          : null;

      const storedMetric = storedMap.get(normalized.chat_id);
      const lastAlertAt = storedMetric?.last_alert_at ?? null;
      const lastAlertStatus = storedMetric?.last_alert_status ?? null;
      const lastAlertAtMs = lastAlertAt ? Date.parse(lastAlertAt) : null;
      const isCooldownExpired = !lastAlertAtMs || now - lastAlertAtMs >= ALERT_COOLDOWN_MS;
      const statusChanged = lastAlertStatus !== slaStatus;
      const shouldSendAlert = slaStatus !== 'healthy' && (statusChanged || isCooldownExpired);

      let nextAlertStatus = lastAlertStatus;
      let nextAlertAt = lastAlertAt;

      if (shouldSendAlert) {
        nextAlertStatus = slaStatus;
        nextAlertAt = nowIso;
        alertsToInsert.push({
          chat_id: normalized.chat_id,
          sla_status: slaStatus,
          pending_inbound_count: pendingCount,
          waiting_since: waitingSince,
          waiting_minutes: waitingMinutes,
          alert_message:
            waitingMinutes !== null
              ? `SLA ${slaStatus} - aguardando resposta há ${waitingMinutes} minutos`
              : `SLA ${slaStatus} - aguardando resposta`,
          created_at: nowIso,
        });
      }

      upserts.push({
        chat_id: normalized.chat_id,
        last_inbound_at: normalized.last_inbound_at,
        last_outbound_at: normalized.last_outbound_at,
        last_message_at: normalized.last_message_at,
        last_response_ms: normalized.last_response_ms,
        pending_inbound_count: pendingCount,
        waiting_since: waitingSince,
        waiting_minutes: waitingMinutes,
        sla_status: slaStatus,
        sla_breach_started_at: slaStatus === 'healthy' ? null : waitingSince,
        longest_waiting_response_ms: longestWaitingResponseMs,
        last_alert_status: nextAlertStatus,
        last_alert_at: nextAlertAt,
        updated_at: nowIso,
      });
    }

    if (upserts.length > 0) {
      const { error: upsertError } = await supabaseAdmin
        .from('whatsapp_chat_sla_metrics')
        .upsert(upserts, { onConflict: 'chat_id' });

      if (upsertError) {
        throw upsertError;
      }
    }

    if (alertsToInsert.length > 0) {
      const { error: alertError } = await supabaseAdmin
        .from('whatsapp_chat_sla_alerts')
        .insert(alertsToInsert);

      if (alertError) {
        throw alertError;
      }
    }

    return new Response(
      JSON.stringify({ updated: upserts.length, alerts: alertsToInsert.length }),
      {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    );
  } catch (error) {
    console.error('Erro ao monitorar SLA do WhatsApp:', error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    );
  }
});
