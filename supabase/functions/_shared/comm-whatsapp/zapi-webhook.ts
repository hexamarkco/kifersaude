import { zapiExternalId, zapiPhone, zapiRecord, zapiString } from './zapi.ts';

export type ZapiWebhookEvent =
  | { kind: 'status'; ids: string[]; status: string; at: string; error: string | null }
  | { kind: 'connection'; connected: boolean; at: string }
  | { kind: 'mutation'; id: string; targetId: string; at: string; mutation: 'edit' | 'delete' | 'reaction'; data: Record<string, string | boolean | null> }
  | { kind: 'presence'; chatId: string; status: 'typing' | 'recording'; at: string }
  | { kind: 'identity_review'; id: string; at: string; lid: string }
  | { kind: 'message'; id: string; at: string; message: Record<string, unknown>;
      media: { url: string; mimeType: string; type: string } | null }
  | { kind: 'ignored'; reason: 'unknown_event' | 'unverified_identity' | 'technical' };

const statuses: Record<string, string> = {
  SENT: 'sent', RECEIVED: 'delivered', READ: 'read', PLAYED: 'played',
};
const inboundMedia = ['image', 'video', 'audio', 'document', 'sticker', 'gif'];
const toIso = (value: unknown): string | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 1_000_000_000_000 &&
    value <= Date.now() + 5 * 60_000 ? new Date(value).toISOString() : null;

const zapiGroupChatId = (value: unknown) => {
  const group = /^(\d+(?:-\d+)?)-group$/.exec(zapiString(value));
  return group ? `${group[1]}@g.us` : '';
};

export function normalizeZapiWebhook(
  raw: unknown, instanceId: string, channelPhone: string | null,
): ZapiWebhookEvent | null {
  const payload = zapiRecord(raw);
  if (payload.instanceId !== instanceId) return null;
  if (payload.type === 'ConnectedCallback' || payload.type === 'DisconnectedCallback') {
    return { kind: 'connection', connected: payload.type === 'ConnectedCallback', at: toIso(payload.momment) || new Date().toISOString() };
  }
  if (payload.type === 'MessageStatusCallback' || payload.type === 'DeliveryCallback') {
    const at = toIso(payload.momment);
    const rawIds = payload.type === 'DeliveryCallback' ? [payload.messageId] : payload.ids;
    const ids = Array.isArray(rawIds) ? rawIds.slice(0, 500).map((id) => zapiExternalId(instanceId, id)).filter(Boolean) : [];
    const failed = payload.type === 'DeliveryCallback' && Boolean(zapiString(payload.error));
    const status = payload.type === 'DeliveryCallback' ? (failed ? 'failed' : 'sent') : statuses[zapiString(payload.status)];
    if (!at || !ids.length || !status) return { kind: 'ignored', reason: 'unknown_event' };
    return { kind: 'status', ids, status, at, error: failed ? 'A Z-API informou falha no envio.' : null };
  }
  if (payload.type === 'PresenceChatCallback') {
    const phone = zapiPhone(payload.phone);
    if (phone && (payload.status === 'COMPOSING' || payload.status === 'RECORDING')) {
      return {
        kind: 'presence', chatId: `${phone}@s.whatsapp.net`,
        status: payload.status === 'COMPOSING' ? 'typing' : 'recording',
        at: new Date().toISOString(),
      };
    }
    return { kind: 'ignored', reason: 'technical' };
  }
  if (payload.type !== 'ReceivedCallback') return { kind: 'ignored', reason: 'unknown_event' };
  if (!channelPhone || zapiPhone(payload.connectedPhone) !== channelPhone) return null;
  if (payload.isNewsletter === true || payload.broadcast === true || payload.isStatusReply === true || payload.waitingMessage === true) {
    return { kind: 'ignored', reason: 'technical' };
  }
  const phone = zapiPhone(payload.phone);
  const isGroup = payload.isGroup === true;
  const chatId = isGroup ? zapiGroupChatId(payload.phone) : phone ? `${phone}@s.whatsapp.net` : '';
  const at = toIso(payload.momment);
  const id = zapiExternalId(instanceId, payload.messageId);
  if (!id || !at || typeof payload.fromMe !== 'boolean') return null;
  if (!chatId) {
    const lid = [payload.chatLid, payload.phone, payload.senderLid].map(zapiString).find((value) => /^\d{5,25}@lid$/.test(value));
    return lid ? { kind: 'identity_review', id, at, lid } : { kind: 'ignored', reason: 'unverified_identity' };
  }

  const fromMe = payload.fromMe;
  const sender = isGroup ? zapiPhone(payload.participantPhone) : phone;
  const text = zapiString(zapiRecord(payload.text).message);
  const reaction = zapiRecord(payload.reaction);
  const referenceId = zapiExternalId(instanceId, payload.referenceMessageId);
  if (Object.keys(reaction).length) {
    const referenced = zapiRecord(reaction.referencedMessage);
    const targetId = zapiExternalId(instanceId, referenced.messageId);
    const actor = fromMe ? 'me' : sender;
    if (!targetId || !actor || typeof reaction.value !== 'string') return { kind: 'ignored', reason: 'unverified_identity' };
    return {
      kind: 'mutation', id, targetId, at: toIso(reaction.time) || at, mutation: 'reaction',
      data: { actor_key: actor, emoji: reaction.value.trim() || null, from_me: fromMe, from: sender || null },
    };
  }
  if (payload.isEdit === true && text) {
    return { kind: 'mutation', id, targetId: referenceId || id, at, mutation: 'edit',
      data: { edited_text: text, action_type: 'edit' } };
  }
  if (payload.notification === 'REVOKE' && referenceId) {
    return { kind: 'mutation', id, targetId: referenceId, at, mutation: 'delete', data: { action_type: 'revoke' } };
  }
  if (payload.notification) return { kind: 'ignored', reason: 'technical' };

  const message: Record<string, unknown> = {
    id, chat_id: chatId, from_me: fromMe, timestamp: Date.parse(at) / 1000,
    from: sender, from_name: zapiString(payload.senderName), chat_name: zapiString(payload.chatName),
    ...(referenceId ? { context: { quoted_id: referenceId } } : {}),
    ...(payload.forwarded === true ? { forwarded: true } : {}),
  };
  const mediaType = inboundMedia.find((field) => Object.keys(zapiRecord(payload[field])).length > 0);
  if (mediaType) {
    const rawMedia = zapiRecord(payload[mediaType]);
    const url = zapiString(rawMedia[`${mediaType}Url`]);
    const mimeType = zapiString(rawMedia.mimeType);
    const type = mediaType === 'audio' && rawMedia.ptt === true ? 'voice' : mediaType;
    message.type = type;
    message[type] = {
      mime_type: mimeType, file_name: zapiString(rawMedia.fileName),
      seconds: rawMedia.seconds, caption: zapiString(rawMedia.caption),
    };
    return { kind: 'message', id, at, message, media: url ? { url, mimeType, type } : null };
  }
  if (text) {
    message.type = 'text';
    message.text = { body: text };
  } else if (payload.location) {
    const location = zapiRecord(payload.location);
    message.type = 'location';
    message.location = { latitude: location.latitude, longitude: location.longitude, address: location.address, name: location.name };
  } else if (payload.contact) {
    message.type = 'contact';
    message.contact = { name: zapiRecord(payload.contact).displayName, vcard: zapiRecord(payload.contact).vCard };
  } else {
    return { kind: 'ignored', reason: 'technical' };
  }
  return { kind: 'message', id, at, message, media: null };
}
