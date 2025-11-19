import { createClient, User } from 'npm:@supabase/supabase-js@2.57.4';
import webpush, { PushSubscription as WebPushSubscription } from 'npm:web-push@3.6.6';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-API-Key',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabaseFunctionsUrl = Deno.env.get('SUPABASE_FUNCTIONS_URL') ?? `${supabaseUrl}/functions/v1`;
const ackUrlOverride = Deno.env.get('PUSH_NOTIFICATIONS_ACK_URL');
const ackUrl = ackUrlOverride ?? `${supabaseFunctionsUrl.replace(/\/$/, '')}/push-notifications`;
const supabaseClient = createClient(supabaseUrl, supabaseServiceRole);

const vapidPublicKey = Deno.env.get('WEB_PUSH_PUBLIC_KEY');
const vapidPrivateKey = Deno.env.get('WEB_PUSH_PRIVATE_KEY');
const vapidContact = Deno.env.get('WEB_PUSH_CONTACT') ?? 'mailto:suporte@kifersaude.com';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidContact, vapidPublicKey, vapidPrivateKey);
}

interface StoredSubscriptionRow {
  id: string;
  raw_subscription: WebPushSubscription;
  is_revoked: boolean;
}

interface PushPayload {
  type: 'lead' | 'reminder';
  id: string;
  title: string;
  body: string;
  link: string;
  icon?: string;
  lead?: Record<string, any>;
  reminder?: Record<string, any>;
  meta?: Record<string, any>;
}

async function getUserFromRequest(req: Request): Promise<User | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return null;
  }

  const token = authHeader.replace(/Bearer\s+/i, '').trim();
  if (!token) {
    return null;
  }

  const { data, error } = await supabaseClient.auth.getUser(token);
  if (error || !data?.user) {
    console.error('Falha ao resolver usuário autenticado', error);
    return null;
  }

  return data.user;
}

async function handleSubscribe(req: Request, subscription: any) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Não autenticado' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!subscription?.endpoint) {
    return new Response(JSON.stringify({ error: 'Subscription inválida' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const expirationTime = typeof subscription.expirationTime === 'number'
    ? new Date(subscription.expirationTime).toISOString()
    : subscription.expirationTime ?? null;

  const { error } = await supabaseClient
    .from('web_push_subscriptions')
    .upsert(
      {
        user_id: user.id,
        endpoint: subscription.endpoint,
        raw_subscription: subscription,
        expiration_time: expirationTime,
        is_revoked: false,
        failure_reason: null,
        last_failure_at: null,
      },
      { onConflict: 'endpoint' }
    );

  if (error) {
    console.error('Erro ao salvar subscription', error);
    return new Response(JSON.stringify({ error: 'Não foi possível registrar a subscription' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ status: 'ok' }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function buildLeadPayload(record: Record<string, any>): PushPayload {
  const bodyParts = [record.telefone, record.origem, record.responsavel].filter(Boolean);
  return {
    type: 'lead',
    id: record.id,
    title: `Novo lead: ${record.nome_completo ?? record.id}`,
    body: bodyParts.join(' • '),
    link: `/painel?tab=leads&leadId=${record.id}`,
    lead: record,
  };
}

function buildReminderPayload(record: Record<string, any>): PushPayload {
  const date = record.data_lembrete ? new Date(record.data_lembrete).toLocaleString('pt-BR') : null;
  const bodyParts = [record.tipo, date].filter(Boolean);
  return {
    type: 'reminder',
    id: record.id,
    title: record.titulo ?? 'Lembrete vencido',
    body: bodyParts.join(' • '),
    link: `/painel?tab=reminders&reminderId=${record.id}`,
    reminder: record,
  };
}

async function deliverPayload(payload: PushPayload) {
  if (!vapidPublicKey || !vapidPrivateKey) {
    throw new Error('Chaves VAPID não configuradas no ambiente');
  }

  const { data: subscriptions, error } = await supabaseClient
    .from('web_push_subscriptions')
    .select('id, raw_subscription, is_revoked')
    .eq('is_revoked', false);

  if (error) {
    throw error;
  }

  let delivered = 0;
  for (const record of subscriptions ?? []) {
    const payloadWithMeta: PushPayload = {
      ...payload,
      meta: {
        ...(payload.meta ?? {}),
        subscriptionId: record.id,
        ackUrl,
      },
    };

    try {
      await webpush.sendNotification(record.raw_subscription as WebPushSubscription, JSON.stringify(payloadWithMeta));
      delivered += 1;
      await supabaseClient
        .from('web_push_subscriptions')
        .update({
          last_success_at: new Date().toISOString(),
          last_failure_at: null,
          failure_reason: null,
        })
        .eq('id', record.id);
    } catch (error) {
      console.error('Erro ao enviar push', error);
      const statusCode = (error as any)?.statusCode ?? (error as any)?.status ?? null;
      const shouldRevoke = statusCode === 404 || statusCode === 410;

      await supabaseClient
        .from('web_push_subscriptions')
        .update({
          is_revoked: shouldRevoke ? true : record.is_revoked,
          last_failure_at: new Date().toISOString(),
          failure_reason: (error as Error).message ?? 'Falha desconhecida',
        })
        .eq('id', record.id);
    }
  }

  return delivered;
}

async function handleLead(record: any) {
  if (!record?.id) {
    return new Response(JSON.stringify({ error: 'Lead inválido' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const payload = buildLeadPayload(record);
  const delivered = await deliverPayload(payload);
  return new Response(JSON.stringify({ delivered }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleReminder(record: any) {
  if (!record?.id) {
    return new Response(JSON.stringify({ error: 'Lembrete inválido' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const payload = buildReminderPayload(record);
  const delivered = await deliverPayload(payload);
  return new Response(JSON.stringify({ delivered }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleAck(body: any) {
  if (!body?.subscriptionId || !body?.itemId || !body?.itemType) {
    return new Response(JSON.stringify({ error: 'Payload inválido' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  await supabaseClient
    .from('web_push_subscriptions')
    .update({ last_ack_at: new Date().toISOString() })
    .eq('id', body.subscriptionId);

  if (body.itemType === 'reminder') {
    await supabaseClient.from('reminders').update({ push_notified_at: new Date().toISOString() }).eq('id', body.itemId);
  } else if (body.itemType === 'lead') {
    await supabaseClient.from('leads').update({ push_notified_at: new Date().toISOString() }).eq('id', body.itemId);
  }

  return new Response(JSON.stringify({ status: 'acknowledged' }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  if (req.method === 'GET' && url.pathname.endsWith('/health')) {
    return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não suportado' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch (_error) {
    body = {};
  }

  const action = body?.action;

  switch (action) {
    case 'subscribe':
      return handleSubscribe(req, body.subscription);
    case 'ack':
      return handleAck(body);
    case 'lead.created':
      return handleLead(body.record);
    case 'reminder.due':
      return handleReminder(body.record);
    default:
      return new Response(JSON.stringify({ error: 'Ação inválida' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
  }
});
