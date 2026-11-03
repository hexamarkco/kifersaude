import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import { fetchWhapiWithTimeout, getHealthStatusText, getWhapiToken, WHAPI_BASE_URL } from '../_shared/comm-whatsapp.ts';
import {
  getZapiCredentials, readWhatsAppTransport, WhatsAppTransportError, type WhatsAppProvider,
} from '../_shared/comm-whatsapp/transport.ts';
import { createZapiAdapter, zapiPhone, zapiRecord, zapiString, type WhatsAppConnection } from '../_shared/comm-whatsapp/zapi.ts';

declare const Deno: { env: { get(key: string): string | undefined } };

export async function inspectWhatsAppProvider(provider: WhatsAppProvider): Promise<WhatsAppConnection> {
  if (provider === 'zapi') {
    const credentials = getZapiCredentials();
    if (!credentials) throw new WhatsAppTransportError('Configure as credenciais da Z-API.', false, 422);
    return createZapiAdapter(credentials).getConnection();
  }
  const token = getWhapiToken();
  if (!token) throw new WhatsAppTransportError('Configure a chave de acesso da WHAPI Cloud.', false, 422);
  const response = await fetchWhapiWithTimeout(`${WHAPI_BASE_URL}/health?wakeup=false`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!response.ok) throw new WhatsAppTransportError('A WHAPI Cloud recusou a consulta de conexão.', false, 503);
  const payload = zapiRecord(await response.json());
  const user = zapiRecord(payload.user);
  const idPhone = /^([1-9]\d{7,14})(?:@s\.whatsapp\.net)?$/.exec(zapiString(user.id))?.[1];
  return { connected: getHealthStatusText(payload).toUpperCase() === 'AUTH', phone: zapiPhone(user.phone) || idPhone || null };
}

export async function verifyWhatsAppProvider(admin: SupabaseClient, provider: WhatsAppProvider) {
  const checkedAt = new Date().toISOString();
  let state: WhatsAppConnection = { connected: false, phone: null };
  let error: string | null = null;
  try {
    state = await inspectWhatsAppProvider(provider);
    if (!state.connected) error = 'A instância está desconectada. Conecte o número no painel do provedor.';
    else if (!state.phone) error = 'O provedor não confirmou o número conectado.';
  } catch (failure) {
    error = failure instanceof WhatsAppTransportError
      ? failure.message : 'O provedor não respondeu à verificação. Confira a conexão e as credenciais.';
  }
  const { error: writeError } = await admin.from('whatsapp_transport_diagnostics').upsert({
    provider, checked_at: checkedAt, connected: state.connected, phone: state.phone, error,
  }, { onConflict: 'provider' });
  if (writeError) throw new WhatsAppTransportError('Não foi possível registrar a verificação.', false, 503);
  return { ...state, error };
}

export async function switchWhatsAppProvider(admin: SupabaseClient, params: {
  provider: WhatsAppProvider; revision: number; actorId: string; transferPending: boolean;
}) {
  const active = await readWhatsAppTransport(admin);
  if (active.revision !== params.revision) {
    throw new WhatsAppTransportError('O provedor mudou. Atualize a tela e verifique novamente.');
  }
  if (active.provider === params.provider) return;
  let instanceId: string | null = null;
  if (params.provider === 'zapi') {
    instanceId = getZapiCredentials()?.instanceId ?? null;
    if (!instanceId) throw new WhatsAppTransportError('Configure as credenciais da Z-API.');
    const secret = Deno.env.get('ZAPI_WEBHOOK_SECRET')?.trim();
    if (!secret || secret.length < 32) {
      throw new WhatsAppTransportError('Configure a chave de recebimento da Z-API antes de ativar o provedor.');
    }
    const { data, error } = await admin.from('whatsapp_transport_diagnostics')
      .select('last_webhook_at').eq('provider', 'zapi').eq('instance_id', instanceId).maybeSingle();
    if (error || !data?.last_webhook_at) {
      throw new WhatsAppTransportError('Ainda não houve uma atualização autenticada da Z-API. Confira a configuração de recebimento.');
    }
  }
  const connection = await verifyWhatsAppProvider(admin, params.provider);
  if (connection.error || !connection.phone) {
    throw new WhatsAppTransportError(connection.error ?? 'Não foi possível confirmar o número conectado.');
  }
  const { error } = await admin.rpc('whatsapp_transport_switch', {
    p_revision: params.revision, p_provider: params.provider, p_actor_id: params.actorId, p_phone: connection.phone,
    p_instance_id: instanceId,
    p_transfer_pending: params.transferPending,
  });
  if (error) throw new WhatsAppTransportError(error.code === 'P0001' ? error.message :
    error.code === '55P03' ? 'As filas do WhatsApp estão sendo atualizadas. Tente a troca novamente em instantes.'
      : 'Não foi possível concluir a troca de provedor.');
}
