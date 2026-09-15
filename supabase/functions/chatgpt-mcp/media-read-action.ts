import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';

type Args = Record<string, unknown>;
type MediaActor = { actorId: string };
type ActionResult = { success: boolean; [key: string]: unknown };

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const MEDIA_ID_PATH = /^[A-Za-z0-9._=-]{1,160}$/;
const MEDIA_BUCKET = 'comm-whatsapp-media';
const SIGNED_URL_TTL_SECONDS = 120;
const MEDIA_TYPES = new Set(['image', 'video', 'gif', 'short', 'document', 'audio', 'voice', 'sticker']);
const MIME_TYPE = /^[A-Za-z0-9!#$&^_.+-]{1,80}\/[A-Za-z0-9!#$&^_.+-]{1,80}$/;

const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const invalid = (message: string): ActionResult => ({ success: false, error_code: 'INVALID_INPUT', message });
const internal = (): ActionResult => ({ success: false, error_code: 'INTERNAL_ERROR', message: 'Não foi possível recuperar a mídia da conversa.' });
const notFound = (): ActionResult => ({ success: false, error_code: 'MEDIA_NOT_FOUND', message: 'Não há mídia recebida disponível na storage segura para esta mensagem.' });

export const MCP_WHATSAPP_MEDIA_READ_TOOL = {
  name: 'kifer_get_whatsapp_media',
  description: 'Gera uma URL assinada válida por 120 segundos para mídia de uma mensagem recebida e existente da conversa indicada. Só usa a storage privada comm-whatsapp-media; não retorna URL do provedor nem URL pública permanente. Informe chat_id e message_id retornados pela leitura da Inbox. OAuth admin obrigatório.',
  inputSchema: {
    type: 'object', required: ['chat_id', 'message_id'], additionalProperties: false,
    properties: {
      chat_id: { type: 'string', format: 'uuid' },
      message_id: { type: 'string', format: 'uuid' },
    },
  },
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
} as const;

export const MCP_WHATSAPP_MEDIA_READ_TOOL_NAMES = [MCP_WHATSAPP_MEDIA_READ_TOOL.name] as const;

export async function executeMcpWhatsAppMediaReadAction(params: {
  supabase: SupabaseClient;
  toolName: string;
  arguments: Args;
  actor: MediaActor;
}): Promise<ActionResult | null> {
  const { supabase, toolName, arguments: args, actor } = params;
  if (toolName !== MCP_WHATSAPP_MEDIA_READ_TOOL.name) return null;
  if (!isRecord(args) || Object.keys(args).some((key) => key !== 'chat_id' && key !== 'message_id')) {
    return invalid('Informe somente chat_id e message_id.');
  }
  if (!UUID.test(text(actor.actorId))) return { success: false, error_code: 'UNAUTHORIZED', message: 'OAuth admin obrigatório.' };

  const chatId = text(args.chat_id);
  const messageId = text(args.message_id);
  if (!UUID.test(chatId) || !UUID.test(messageId)) return invalid('chat_id e message_id devem ser UUIDs válidos.');

  const { data: chat, error: chatError } = await supabase
    .from('comm_whatsapp_chats')
    .select('id,deleted_at,merged_into_chat_id')
    .eq('id', chatId)
    .maybeSingle();
  if (chatError) return internal();
  if (!isRecord(chat) || chat.deleted_at !== null || chat.merged_into_chat_id !== null) return notFound();

  const { data: message, error: messageError } = await supabase
    .from('comm_whatsapp_messages')
    .select('id,chat_id,direction,message_type,media_id,media_mime_type,media_file_name')
    .eq('id', messageId)
    .eq('chat_id', chatId)
    .maybeSingle();
  if (messageError) return internal();
  if (!isRecord(message)
    || message.id !== messageId
    || message.chat_id !== chatId
    || message.direction !== 'inbound'
    || !MEDIA_TYPES.has(text(message.message_type).toLowerCase())) return notFound();

  const mediaId = text(message.media_id);
  // The cache helper stores media at the sanitized media_id as a single path
  // segment. Only IDs that survive that sanitizer unchanged are signable here;
  // this avoids collisions caused by translating arbitrary provider strings.
  if (!MEDIA_ID_PATH.test(mediaId) || mediaId === '.' || mediaId === '..') return notFound();

  const { data: signed, error: signError } = await supabase
    .storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(mediaId, SIGNED_URL_TTL_SECONDS);
  if (signError || !isRecord(signed) || typeof signed.signedUrl !== 'string') return notFound();

  let signedUrl: URL;
  try {
    signedUrl = new URL(signed.signedUrl);
  } catch {
    return internal();
  }
  const expectedPrefix = `/storage/v1/object/sign/${MEDIA_BUCKET}/`;
  let signedMediaPath = '';
  try {
    signedMediaPath = decodeURIComponent(signedUrl.pathname.slice(expectedPrefix.length));
  } catch {
    return internal();
  }
  if (signedUrl.protocol !== 'https:'
    || !signedUrl.pathname.startsWith(expectedPrefix)
    || signedMediaPath !== mediaId
    || !signedUrl.searchParams.get('token')) return internal();

  const mimeType = text(message.media_mime_type).split(';', 1)[0]?.trim() || '';
  const fileName = text(message.media_file_name)
    .split('')
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 0x20 && (code < 0x7f || code > 0x9f);
    })
    .join('')
    .replace(/[\\/]/g, '_')
    .slice(0, 255);
  return {
    success: true,
    media: {
      message_id: messageId,
      message_type: text(message.message_type).toLowerCase(),
      mime_type: MIME_TYPE.test(mimeType) ? mimeType : 'application/octet-stream',
      file_name: fileName || null,
      signed_url: signedUrl.toString(),
      signed_url_expires_in: SIGNED_URL_TTL_SECONDS,
    },
  };
}
