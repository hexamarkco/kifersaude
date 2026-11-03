import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import { ContactPermissionBlockedError, ContactPermissionCheckError } from '../contact-permissions.ts';
import {
  archiveCommWhatsAppMedia, extractWhapiMediaId, extractWhapiMessageId, fetchWhapiWithTimeout,
  getWhapiToken, readResponsePayload, resolveWhapiOutboundDeliveryStatus, WHAPI_BASE_URL,
} from '../comm-whatsapp.ts';
import {
  createZapiAdapter, zapiDestination, zapiMediaId, zapiNativeId, zapiRecord, zapiString,
  ZapiRequestError, type MediaKind, type ZapiCredentials, type ZapiSend,
} from './zapi.ts';

declare const Deno: { env: { get(key: string): string | undefined } };

export type WhatsAppProvider = 'whapi' | 'zapi';
export type WhatsAppTransportState = {
  provider: WhatsAppProvider;
  instanceId: string | null;
  revision: number;
  changedAt: string;
};
export type DispatchRequest = (url: string, init: RequestInit, timeoutMs?: number) => Promise<Response>;

export class WhatsAppTransportError extends Error {
  constructor(message: string, readonly uncertain = false, readonly status = 409) {
    super(message);
  }
}

export function getZapiCredentials(state?: WhatsAppTransportState): ZapiCredentials | null {
  const instanceId = Deno.env.get('ZAPI_INSTANCE_ID')?.trim();
  const instanceToken = Deno.env.get('ZAPI_INSTANCE_TOKEN')?.trim();
  const clientToken = Deno.env.get('ZAPI_CLIENT_TOKEN')?.trim();
  if (state?.provider === 'zapi' && state.instanceId !== instanceId) return null;
  return instanceId && /^[\w.-]{1,128}$/.test(instanceId) && instanceToken && clientToken
    ? { instanceId, instanceToken, clientToken }
    : null;
}

export async function readWhatsAppTransport(admin: SupabaseClient): Promise<WhatsAppTransportState> {
  const { data, error } = await admin.from('whatsapp_transport_state')
    .select('provider,instance_id,revision,changed_at').eq('singleton', true).single();
  if (error || !data || !['whapi', 'zapi'].includes(data.provider)) {
    throw new WhatsAppTransportError('Não foi possível confirmar o provedor de WhatsApp.', false, 503);
  }
  return { provider: data.provider, instanceId: data.instance_id, revision: data.revision, changedAt: data.changed_at };
}

export async function beginWhatsAppOperation(
  admin: SupabaseClient,
  state: WhatsAppTransportState,
  operationKey?: string | null,
) {
  const { data, error } = await admin.rpc('whatsapp_transport_begin', {
    p_revision: state.revision,
    p_provider: state.provider,
    p_operation_key: operationKey ?? null,
  });
  const attempt = zapiRecord(data);
  if (error) throw new WhatsAppTransportError('Não foi possível reservar a operação de WhatsApp.', false, 503);
  if (attempt.state === 'recorded') return { id: '', result: zapiRecord(attempt.result) };
  if (attempt.state === 'uncertain') {
    throw new WhatsAppTransportError('Já existe uma tentativa sem confirmação para esta operação.', true);
  }
  if (attempt.state !== 'started' || typeof attempt.id !== 'string') {
    throw new WhatsAppTransportError('O provedor de WhatsApp mudou durante a operação.');
  }
  return { id: attempt.id, result: null };
}

export async function finishWhatsAppOperation(
  admin: SupabaseClient,
  id: string,
  result: Record<string, string | number | null> | null = null,
) {
  const query = admin.from('whatsapp_transport_attempts');
  const { error } = await (result ? query.update({ finished_at: new Date().toISOString(), result }) : query.delete()).eq('id', id);
  if (error) console.error('[whatsapp-transport] falha ao registrar conclusão', { code: error.code });
}

async function markUncertain(admin: SupabaseClient, id: string) {
  const { error } = await admin.from('whatsapp_transport_attempts').update({ uncertain: true }).eq('id', id);
  if (error) console.error('[whatsapp-transport] falha ao registrar tentativa sem confirmação', { code: error.code });
}

export async function withWhatsAppOperation<T>(
  admin: SupabaseClient, state: WhatsAppTransportState, action: () => Promise<T>,
): Promise<T> {
  const { id } = await beginWhatsAppOperation(admin, state);
  try {
    return await action();
  } finally {
    await finishWhatsAppOperation(admin, id);
  }
}

export async function getZapiContactStatus(phone: string, state: WhatsAppTransportState): Promise<'valid' | 'invalid' | 'unknown'> {
  const credentials = getZapiCredentials(state);
  if (!credentials || !/^\d{8,15}$/.test(phone)) return 'unknown';
  try {
    const result = await createZapiAdapter(credentials).request(`phone-exists/${phone}`);
    const contact = zapiRecord(Array.isArray(result) ? result[0] : result);
    if (contact.exists === false) return 'invalid';
    return contact.exists === true && contact.phone === phone ? 'valid' : 'unknown';
  } catch {
    return 'unknown';
  }
}

export async function verifyZapiNumber(adapter: ReturnType<typeof createZapiAdapter>, channelPhone?: string | null) {
  const connection = await adapter.getConnection();
  if (!connection.connected || !channelPhone || connection.phone !== channelPhone) {
    throw new WhatsAppTransportError('Confirme a conexão da Z-API com o número do canal principal.', false, 503);
  }
}

export function resolveMessageProvider(state: WhatsAppTransportState, externalId: string) {
  const provider = externalId.startsWith('zapi:') ? 'zapi' : 'whapi';
  if (state.provider !== provider) {
    throw new WhatsAppTransportError('Esta mensagem pertence ao provedor anterior. O histórico continua disponível.');
  }
  return provider;
}

export async function runZapiMutation(
  admin: SupabaseClient,
  state: WhatsAppTransportState,
  channelPhone: string | null,
  operation: (adapter: ReturnType<typeof createZapiAdapter>, instanceId: string) => Promise<Response>,
  operationKey?: string,
): Promise<Response> {
  const credentials = getZapiCredentials(state);
  if (state.provider !== 'zapi' || !credentials) {
    throw new WhatsAppTransportError('Configure a Z-API antes de realizar esta ação.', false, 503);
  }
  const adapter = createZapiAdapter(credentials);
  const attempt = await beginWhatsAppOperation(admin, state, operationKey);
  if (attempt.result) return Response.json(attempt.result);
  try {
    await verifyZapiNumber(adapter, channelPhone);
    const response = await operation(adapter, credentials.instanceId);
    const recorded = operationKey ? zapiRecord(await response.clone().json()) : null;
    await finishWhatsAppOperation(admin, attempt.id, recorded ? { id: zapiString(recorded.id), status: 'queued' } : null);
    return response;
  } catch (error) {
    if ((error instanceof ZapiRequestError || error instanceof WhatsAppTransportError) && error.uncertain) {
      await markUncertain(admin, attempt.id);
    } else {
      await finishWhatsAppOperation(admin, attempt.id);
    }
    if (error instanceof ZapiRequestError) throw new WhatsAppTransportError(error.message, error.uncertain, error.status);
    throw error;
  }
}

export function decodeDispatchRequest(
  instanceId: string,
  url: string,
  body: RequestInit['body'],
  verifiedPhone?: string | null,
): ZapiSend {
  const kind = url.startsWith(`${WHAPI_BASE_URL}/messages/`)
    ? url.slice(`${WHAPI_BASE_URL}/messages/`.length) : '';
  const data = body instanceof FormData
    ? Object.fromEntries(body.entries())
    : zapiRecord(typeof body === 'string' ? JSON.parse(body) : null);
  const phone = zapiDestination(zapiString(data.to), verifiedPhone);
  if (!phone) throw new WhatsAppTransportError('A conversa precisa de um telefone confirmado para envio pela Z-API.', false, 422);
  const quotedId = zapiString(data.quoted) || zapiString(zapiRecord(data.quoted).id);
  const quote = quotedId ? zapiNativeId(instanceId, quotedId) : undefined;
  if (quotedId && !quote) {
    throw new WhatsAppTransportError('A Z-API só pode citar mensagens da própria instância.', false, 422);
  }
  if (kind === 'text') return { kind, phone, text: zapiString(data.body), quote };
  const media = data.media ?? data.mediaUrl;
  if (['image', 'video', 'audio', 'voice', 'document', 'sticker', 'gif'].includes(kind) &&
      (media instanceof Blob || (typeof media === 'string' && /^(https:\/\/|data:)/.test(media)))) {
    const fileName = zapiString(data.filename ?? data.fileName) || (media instanceof File ? media.name : '') ||
      (typeof media === 'string' && media.startsWith('https://') ? new URL(media).pathname.split('/').pop() : undefined);
    return { kind: kind as MediaKind, phone, media, fileName, caption: zapiString(data.caption), quote };
  }
  throw new WhatsAppTransportError('Esse formato de envio não está disponível na Z-API.', false, 422);
}

export async function createWhatsAppDispatch(admin: SupabaseClient, options: {
  state?: WhatsAppTransportState;
  key?: string | null;
  phone?: string | null;
  channelPhone?: string | null;
  beforeAttempt?: () => void | Promise<void>;
  legacy?: DispatchRequest;
} = {}): Promise<DispatchRequest> {
  const state = options.state ?? await readWhatsAppTransport(admin);
  const legacy = options.legacy ?? fetchWhapiWithTimeout;
  if (state.provider === 'whapi') {
    return async (url, init, timeoutMs) => {
      const isMessage = url.startsWith(`${WHAPI_BASE_URL}/messages/`);
      const key = isMessage ? options.key : null;
      const attempt = await beginWhatsAppOperation(admin, state, key);
      if (attempt.result) return Response.json(attempt.result);
      try {
        await options.beforeAttempt?.();
      } catch (error) {
        await finishWhatsAppOperation(admin, attempt.id);
        throw error;
      }
      try {
        const response = await legacy(url, init, timeoutMs);
        if (response.status >= 500 || response.status === 408) {
          await markUncertain(admin, attempt.id);
          throw new WhatsAppTransportError('O envio pela WHAPI Cloud ficou sem confirmação. Confira a conversa antes de tentar de novo.', true, response.status);
        }
        if (response.ok && key) {
          const payload = await readResponsePayload(response.clone());
          const id = extractWhapiMessageId(payload);
          if (zapiRecord(payload).sent === false) {
            await finishWhatsAppOperation(admin, attempt.id);
          } else if (id) {
            await finishWhatsAppOperation(admin, attempt.id, {
              id, status: resolveWhapiOutboundDeliveryStatus(payload, id), media_id: extractWhapiMediaId(payload) || null,
            });
          } else {
            await markUncertain(admin, attempt.id);
          }
        } else {
          await finishWhatsAppOperation(admin, attempt.id);
        }
        return response;
      } catch (error) {
        if (error instanceof WhatsAppTransportError && error.uncertain) throw error;
        if (error instanceof ContactPermissionBlockedError || error instanceof ContactPermissionCheckError) {
          await finishWhatsAppOperation(admin, attempt.id);
          throw error;
        }
        await markUncertain(admin, attempt.id);
        throw new WhatsAppTransportError('O envio pela WHAPI Cloud ficou sem confirmação. Confira a conversa antes de tentar de novo.', true, 502);
      }
    };
  }

  const credentials = getZapiCredentials(state);
  if (!credentials) throw new WhatsAppTransportError('As credenciais da Z-API precisam ser configuradas.', false, 503);
  const adapter = createZapiAdapter(credentials);
  return async (url, init, timeoutMs) => {
    const input = decodeDispatchRequest(credentials.instanceId, url, init.body, options.phone);
    if (!options.key) throw new WhatsAppTransportError('O envio pela Z-API exige um identificador da operação.', false, 422);
    const attempt = await beginWhatsAppOperation(admin, state, options.key);
    if (attempt.result) {
      const status = Number(attempt.result.http_status) || 200;
      if (status !== 200) throw new WhatsAppTransportError('A Z-API recusou esta tentativa de envio.', false, status);
      return Response.json(attempt.result);
    }
    let dispatched = false;
    try {
      const channelPhone = options.channelPhone || (await admin.from('comm_whatsapp_channels')
        .select('phone_number').eq('slug', 'primary').single()).data?.phone_number;
      await verifyZapiNumber(adapter, channelPhone);
      await options.beforeAttempt?.();
      dispatched = true;
      const accepted = await adapter.send(input, timeoutMs);
      const result = {
        id: accepted.messageId,
        zaap_id: accepted.queueId,
        status: 'queued',
        media_id: input.kind === 'text' ? null : await zapiMediaId(accepted.messageId),
      };
      await finishWhatsAppOperation(admin, attempt.id, result);
      if (result.media_id && input.kind !== 'text' && input.media instanceof Blob) {
        await archiveCommWhatsAppMedia(admin, {
          mediaId: result.media_id, blob: input.media, mimeType: input.media.type,
        }).catch(() => console.error('[whatsapp-transport] falha ao arquivar anexo de saída'));
      }
      return Response.json(result);
    } catch (error) {
      if (error instanceof ZapiRequestError && error.uncertain) {
        await markUncertain(admin, attempt.id);
        throw new WhatsAppTransportError(error.message, true, error.status);
      }
      const status = error instanceof ZapiRequestError || error instanceof WhatsAppTransportError ? error.status : 409;
      await finishWhatsAppOperation(admin, attempt.id, dispatched ? { http_status: status } : null);
      if (error instanceof ZapiRequestError) throw new WhatsAppTransportError(error.message, false, status);
      throw error;
    }
  };
}

export const hasWhatsAppDispatchCredentials = (provider: WhatsAppProvider) =>
  provider === 'whapi' ? Boolean(getWhapiToken()) : Boolean(getZapiCredentials());
