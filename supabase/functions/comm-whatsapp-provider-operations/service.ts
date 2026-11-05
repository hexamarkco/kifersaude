import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import type { AuthorizedDashboardUser } from '../_shared/dashboard-auth.ts';
import { assertContactPermissionForSend } from '../_shared/contact-permissions.ts';
import {
  ensureCommWhatsAppSettings, ensurePrimaryChannel,
  persistCommWhatsAppMessage, resolveCommWhatsAppCanonicalChatRoute,
} from '../_shared/comm-whatsapp.ts';
import {
  beginWhatsAppOperation, finishWhatsAppOperation, getZapiCredentials,
  readWhatsAppTransport, verifyZapiNumber, WhatsAppTransportError,
} from '../_shared/comm-whatsapp/transport.ts';
import { createZapiAdapter, ZapiRequestError, zapiExternalId, zapiRecord, zapiString } from '../_shared/comm-whatsapp/zapi.ts';
import {
  canonicalZapiInput, isZapiDirectPhone, prepareZapiOperation, ZapiInputError, zapiMessageSummary,
} from '../_shared/comm-whatsapp/zapi-operation-input.ts';
import type { ZapiJson } from '../_shared/comm-whatsapp/zapi-operation-contract.ts';

type Prepared = ReturnType<typeof prepareZapiOperation>;
export type ProviderOperationRequest = { operation?: unknown; input?: unknown; requestId?: unknown; revision?: unknown };

const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))))
  .map((byte) => byte.toString(16).padStart(2, '0')).join('');

async function checkPermissions(admin: SupabaseClient, adapter: ReturnType<typeof createZapiAdapter>, prepared: Prepared) {
  const { definition, data } = prepared;
  const phones: string[] = [];
  if (definition.permissions === 'recipient' && typeof data.phone === 'string') {
    if (isZapiDirectPhone(data.phone)) phones.push(data.phone);
    if (/^\d+@broadcast$/.test(data.phone)) {
      let found = false;
      for (let page = 1; page <= 25 && !found; page++) {
        const result = await adapter.request(`broadcast?page=${page}&pageSize=100`);
        if (!Array.isArray(result)) throw new WhatsAppTransportError('Não foi possível conferir os destinatários da lista.', false, 503);
        const list = result.map(zapiRecord).find((item) => item.broadcastId === data.phone);
        if (list) {
          if (!Array.isArray(list.phones) || !list.phones.length || list.phones.some((value) => typeof value !== 'string' || !isZapiDirectPhone(value))) {
            throw new WhatsAppTransportError('A lista não possui destinatários confirmados.', false, 422);
          }
          phones.push(...list.phones as string[]);
          found = true;
        } else if (result.length < 100) break;
      }
      if (!found) throw new WhatsAppTransportError('A lista não foi localizada. Atualize os destinatários antes de enviar.', false, 422);
    }
  }
  if (definition.permissions === 'members' && Array.isArray(data.phones)) {
    phones.push(...data.phones.filter((value): value is string => typeof value === 'string'));
  }
  for (const phone of new Set(phones)) await assertContactPermissionForSend(admin, phone, 'commercial');
}

function inboxRoute(data: Record<string, ZapiJson>): string | null {
  const phone = zapiString(data.phone);
  if (isZapiDirectPhone(phone)) return `${phone}@s.whatsapp.net`;
  return /^\d+(?:-\d+)?-group$/.test(phone) ? phone.replace(/-group$/, '@g.us') : null;
}

async function projectMessage(admin: SupabaseClient, prepared: Prepared, context: {
  channelId: string; actorId: string; instanceId: string; externalId: string; occurredAt: string;
}) {
  if (!prepared.definition.sendsMessage || !context.externalId) return;
  const externalChatId = inboxRoute(prepared.data);
  // Newsletter and broadcast publishing is audited by the dispatch ledger; these
  // are not direct/group Inbox conversations and must never be assigned to leads.
  if (!externalChatId) return;
  const route = await resolveCommWhatsAppCanonicalChatRoute(admin, { channelId: context.channelId, externalChatId });
  if (route.identityConflict) throw new WhatsAppTransportError('A conversa exige revisão de identidade.');
  const editId = ['editMessageId', 'editImageMessageId', 'editVideoMessageId', 'editDocumentMessageId']
    .map((key) => zapiString(prepared.data[key])).find(Boolean);
  const summary = zapiMessageSummary(prepared.operation, prepared.data);
  // Queue acceptance does not prove an edit was applied. The authenticated
  // edit callback updates the original message; never create another outbound.
  if (editId) return;
  await persistCommWhatsAppMessage(admin, {
    channelId: context.channelId, externalChatId: route.externalChatId, phoneNumber: route.phoneNumber,
    displayName: route.displayName, pushName: route.pushName, lastMessageText: summary,
    lastMessageDirection: 'outbound', lastMessageAt: context.occurredAt, incrementUnread: false,
    externalMessageId: context.externalId, direction: 'outbound', messageType: 'text', deliveryStatus: 'queued',
    textContent: summary, createdBy: context.actorId, source: 'manual', senderName: null, senderPhone: null,
    statusUpdatedAt: context.occurredAt, errorMessage: null,
    mediaId: null, mediaUrl: null, mediaMimeType: null, mediaFileName: null, mediaSizeBytes: null,
    mediaDurationSeconds: null, mediaCaption: null,
    metadata: { provider: 'zapi', provider_operation: prepared.operation, contact_permission_scope: 'commercial' },
  });
}

export async function executeProviderOperation(admin: SupabaseClient, actor: AuthorizedDashboardUser, request: ProviderOperationRequest) {
  const state = await readWhatsAppTransport(admin);
  if (state.provider !== 'zapi') throw new WhatsAppTransportError('Ative a Z-API no canal principal antes de usar esta operação.');
  const credentials = getZapiCredentials(state);
  if (!credentials) throw new WhatsAppTransportError('Configure a conexão da Z-API.', false, 503);
  const prepared = prepareZapiOperation(request.operation, request.input ?? {}, credentials.instanceId);
  const { definition } = prepared;
  if (definition.mutation && !actor.canEditModule) throw new WhatsAppTransportError('Você não tem permissão para alterar o WhatsApp.', false, 403);
  if (definition.mutation && !definition.sendsMessage && actor.role !== 'admin') {
    throw new WhatsAppTransportError('Esta alteração precisa ser feita por um administrador.', false, 403);
  }
  if (request.revision !== state.revision) throw new WhatsAppTransportError('A conexão mudou. Atualize o painel antes de continuar.');
  const requestId = zapiString(request.requestId);
  if (definition.mutation && !/^[a-zA-Z0-9_-]{8,128}$/.test(requestId)) throw new ZapiInputError('Identificador da solicitação inválido. Atualize o painel.');
  const settings = await ensureCommWhatsAppSettings(admin);
  if (!settings.enabled) throw new WhatsAppTransportError('A integração WhatsApp está desabilitada.', false, 403);
  const channel = await ensurePrimaryChannel(admin);
  const adapter = createZapiAdapter(credentials);
  const fingerprint = await hash(canonicalZapiInput({ operation: prepared.operation, input: prepared.data }));
  const attempt = await beginWhatsAppOperation(admin, state, definition.mutation ? `provider:${actor.userId}:${requestId}` : null);
  const finish = async (result: Record<string, unknown>) => {
    const { error } = await admin.from('whatsapp_transport_attempts')
      .update({ finished_at: new Date().toISOString(), result }).eq('id', attempt.id);
    if (error) throw new WhatsAppTransportError('A operação ficou sem confirmação. Confira o WhatsApp antes de tentar novamente.', true, 503);
  };
  let dispatched = false;
  let recorded = attempt.result;
  try {
    if (recorded && recorded.fingerprint !== fingerprint) throw new ZapiInputError('Esta solicitação já foi usada com outros dados. Inicie uma nova operação.');
    if (recorded?.failure) throw new WhatsAppTransportError('A Z-API recusou esta solicitação. Corrija os dados antes de iniciar outra.', false, 422);
    if (!recorded) {
      await verifyZapiNumber(adapter, channel.phone_number);
      const externalChatId = definition.sendsMessage ? inboxRoute(prepared.data) : null;
      if (externalChatId) {
        const route = await resolveCommWhatsAppCanonicalChatRoute(admin, { channelId: channel.id, externalChatId });
        if (route.identityConflict || (isZapiDirectPhone(zapiString(prepared.data.phone)) && route.phoneNumber && route.phoneNumber !== prepared.data.phone)) {
          throw new WhatsAppTransportError('Revise a identidade da conversa antes de enviar.');
        }
      }
      await checkPermissions(admin, adapter, prepared);
      dispatched = true;
      const result = await adapter.request(prepared.path, {
        method: definition.method, body: prepared.body, dispatch: definition.mutation,
      });
      const externalId = definition.sendsMessage ? zapiExternalId(credentials.instanceId, zapiRecord(result).messageId) : '';
      if (definition.sendsMessage && !externalId) throw new WhatsAppTransportError('O envio ainda não foi confirmado. Confira a conversa antes de tentar novamente.', true);
      // Never return server credentials embedded in an upstream response.
      const sanitized = JSON.parse(JSON.stringify(result).split(credentials.instanceToken).join('[redigido]').split(credentials.clientToken).join('[redigido]')) as ZapiJson;
      recorded = { operation: prepared.operation, fingerprint, result: sanitized, externalId, occurredAt: new Date().toISOString() };
      if (definition.mutation) await finish(recorded);
      else await finishWhatsAppOperation(admin, attempt.id);
    }
  } catch (error) {
    if (attempt.id) {
      const uncertain = (error instanceof ZapiRequestError || error instanceof WhatsAppTransportError) && error.uncertain;
      if (dispatched && uncertain) {
        await admin.from('whatsapp_transport_attempts').update({ uncertain: true }).eq('id', attempt.id);
      } else if (dispatched && definition.mutation) {
        await finish({ operation: prepared.operation, fingerprint, failure: true });
      } else if (!attempt.result) await finishWhatsAppOperation(admin, attempt.id);
    }
    throw error;
  }
  // Retry local projections using the stored acceptance, never resend externally.
  let historyPending = false;
  try {
    await projectMessage(admin, prepared, {
      channelId: channel.id, actorId: actor.userId, instanceId: credentials.instanceId,
      externalId: zapiString(recorded?.externalId), occurredAt: zapiString(recorded?.occurredAt),
    });
    if (prepared.operation === 'contacts/add-contacts' || prepared.operation === 'contacts/remove-contacts') {
      const { error } = await admin.from('comm_whatsapp_phone_contacts_sync_state').delete().eq('channel_id', channel.id);
      if (error) historyPending = true;
    }
  } catch {
    historyPending = true;
  }
  return { result: recorded?.result ?? null, externalMessageId: recorded?.externalId || null,
    state: definition.sendsMessage ? 'queued' : definition.mutation ? 'processed' : 'queried', historyPending };
}
