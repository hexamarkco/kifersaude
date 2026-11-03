import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import {
  applyCommWhatsAppMessageMutation, isCommWhatsAppWebhookRequestAuthorized,
  isWhapiLidChatId, persistWhapiPresence, resolveCommWhatsAppCanonicalChatRoute,
  updateCommWhatsAppMessageStatus,
} from '../_shared/comm-whatsapp.ts';
import { beginWhatsAppOperation, finishWhatsAppOperation, getZapiCredentials, readWhatsAppTransport } from '../_shared/comm-whatsapp/transport.ts';
import { normalizeZapiWebhook } from '../_shared/comm-whatsapp/zapi-webhook.ts';
import { zapiMediaId, zapiRecord } from '../_shared/comm-whatsapp/zapi.ts';
import { findCommWhatsAppEventReceipt, recordCommWhatsAppEventReceipt } from '../_shared/webhook-event-receipts.ts';
import { archiveZapiMedia, isTrustedZapiMediaUrl } from '../_shared/comm-whatsapp/zapi-media.ts';

declare const Deno: { env: { get(key: string): string | undefined } };

export async function handleZapiCallback(
  req: Request,
  admin: SupabaseClient,
  channel: { id: string; phone_number: string | null; slug: string },
  persist: (message: Record<string, unknown>) => Promise<{ id: string } | null>,
): Promise<Response> {
  if (req.method !== 'POST') return Response.json({ error: 'Método inválido.' }, { status: 405 });
  const url = new URL(req.url);
  const credentials = getZapiCredentials();
  const secret = Deno.env.get('ZAPI_WEBHOOK_SECRET')?.trim() || '';
  if (!credentials || secret.length < 32 ||
      !isCommWhatsAppWebhookRequestAuthorized(null, url.searchParams.get('secret'), secret) ||
      url.searchParams.get('channel') !== channel.slug) {
    return Response.json({ error: 'Webhook não autorizado.' }, { status: 401 });
  }
  const payload: unknown = await req.json().catch(() => null);
  const event = normalizeZapiWebhook(payload, credentials.instanceId, channel.phone_number);
  if (!event) return Response.json({ error: 'Evento inválido para este canal.' }, { status: 400 });
  const at = new Date().toISOString();
  const diagnostic = async (fields: Record<string, string | boolean | null>) => {
    const { error } = await admin.from('whatsapp_transport_diagnostics')
      .upsert({ provider: 'zapi', instance_id: credentials.instanceId, last_webhook_at: at, ...fields }, { onConflict: 'provider' });
    if (error) console.warn('[zapi-webhook] falha ao registrar diagnóstico', { code: error.code });
  };

  let operationId = '';
  const recordIdentityReview = async (event: {
    id: string; at: string; lid?: string; phone?: string; reason: 'unverified_identity' | 'identity_conflict';
  }) => {
    const { error } = await admin.from('whatsapp_transport_identity_review').upsert({
      external_message_id: event.id, channel_id: channel.id, occurred_at: event.at,
      lid: event.lid ?? null, phone: event.phone ?? null, reason: event.reason,
    }, { onConflict: 'external_message_id', ignoreDuplicates: true });
    if (error) throw new Error('Falha ao registrar revisão de identidade.');
    await diagnostic({ error: 'Uma conversa exige revisão de identidade.' });
  };
  try {
    const transport = await readWhatsAppTransport(admin);
    if (transport.provider === 'zapi' && transport.instanceId !== credentials.instanceId) {
      return Response.json({ error: 'A instância não corresponde à configuração ativa.' }, { status: 409 });
    }
    if (event.kind === 'status') {
      for (const externalMessageId of event.ids) {
        await updateCommWhatsAppMessageStatus(admin, {
          channelId: channel.id, externalMessageId, deliveryStatus: event.status,
          statusUpdatedAt: event.at, errorMessage: event.error,
        });
      }
      await diagnostic({});
      return Response.json({ success: true });
    }
    if (event.kind === 'connection') {
      // The callback proves reachability, while /status + /device confirm the number and connection.
      await diagnostic(event.connected ? {} : { connected: false, error: 'A Z-API informou que a instância desconectou.' });
      return Response.json({ success: true });
    }
    if (event.kind === 'ignored') {
      console.info('[zapi-webhook] evento ignorado', { reason: event.reason });
      await diagnostic({});
      return Response.json({ success: true, skipped: event.reason });
    }
    if (transport.provider !== 'zapi' || Date.parse(event.at) < Date.parse(transport.changedAt)) {
      await diagnostic({});
      return Response.json({ success: true, skipped: 'inactive_or_delayed' });
    }
    operationId = (await beginWhatsAppOperation(admin, transport)).id;
    if (event.kind === 'identity_review') {
      await recordIdentityReview({ ...event, reason: 'unverified_identity' });
      return Response.json({ success: true, skipped: 'identity_review' });
    }
    if (event.kind === 'presence') {
      await persistWhapiPresence(admin, {
        channelId: channel.id,
        item: { entryId: event.chatId, status: event.status, lastSeenAt: null, raw: { provider: 'zapi' } },
      });
      return Response.json({ success: true });
    }
    if (event.kind === 'mutation') {
      await applyCommWhatsAppMessageMutation(admin, {
        channelId: channel.id, targetExternalMessageId: event.targetId,
        mutationType: event.mutation, eventExternalMessageId: event.id, occurredAt: event.at,
        payload: event.data, dedupeKey: `${event.mutation}:${event.id}:${event.at}`,
      });
      await diagnostic({});
      return Response.json({ success: true });
    }

    const chatId = String(event.message.chat_id);
    if (isWhapiLidChatId(chatId)) return Response.json({ success: true, skipped: 'unverified_identity' });
    const route = await resolveCommWhatsAppCanonicalChatRoute(admin, { channelId: channel.id, externalChatId: chatId });
    const phone = /^([1-9]\d{7,14})@s\.whatsapp\.net$/.exec(chatId)?.[1];
    if (route.identityConflict || (phone && route.phoneNumber && phone !== route.phoneNumber)) {
      await recordIdentityReview({ id: event.id, at: event.at, phone, reason: 'identity_conflict' });
      return Response.json({ success: true, skipped: 'identity_conflict' });
    }
    const eventKey = `message:${event.id}`;
    if (await findCommWhatsAppEventReceipt(admin, eventKey)) {
      return Response.json({ success: true, duplicate: true });
    }
    let pendingMedia: { id: string; url: string; mimeType: string; type: string } | null = null;
    let archiveFailed = false;
    if (event.media) {
      const id = await zapiMediaId(event.id);
      let mimeType = 'application/octet-stream';
      try {
        mimeType = await archiveZapiMedia(admin, id, event.media);
      } catch {
        archiveFailed = true;
        if (isTrustedZapiMediaUrl(event.media.url)) pendingMedia = { id, ...event.media };
      }
      event.message[event.media.type] = { ...zapiRecord(event.message[event.media.type]), id, mime_type: mimeType };
    }
    const chat = await persist(event.message);
    if (!chat) return Response.json({ success: true, skipped: 'invalid_chat' });
    if (pendingMedia) {
      const { error } = await admin.from('comm_whatsapp_enrichment_jobs').upsert({
        kind: 'media_archive', channel_id: channel.id, chat_id: chat.id,
        dedupe_key: `zapi-media:${pendingMedia.id}`,
        payload: {
          provider: 'zapi', media_id: pendingMedia.id, media_url: pendingMedia.url,
          media_mime_type: pendingMedia.mimeType, media_type: pendingMedia.type,
        },
      }, { onConflict: 'dedupe_key', ignoreDuplicates: true });
      if (error) throw new Error('Não foi possível agendar o arquivamento do anexo.');
    }
    await recordCommWhatsAppEventReceipt(admin, channel.id, eventKey, 'message', event.id, {
      provider: 'zapi', from_me: event.message.from_me === true,
    }, null);
    await diagnostic({
      error: archiveFailed ? 'Uma mensagem chegou e seu anexo ainda não está no histórico.' : null,
      ...(event.message.from_me === true ? {} : { last_inbound_at: at }),
    });
    return Response.json({ success: true });
  } catch {
    await diagnostic({ error: 'Falha ao processar um evento da Z-API.' });
    console.error('[zapi-webhook] falha no processamento', { kind: event.kind });
    return Response.json({ error: 'Não foi possível processar o evento.' }, { status: 503 });
  } finally {
    if (operationId) await finishWhatsAppOperation(admin, operationId);
  }
}
