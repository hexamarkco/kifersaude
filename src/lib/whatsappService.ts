import { supabase, supabaseFunctionsUrl } from './supabase';
import type {
  WhatsAppChat,
  WhatsAppMessage,
  WhatsAppWebhookEvent,
} from './supabase';

export const whatsappWebhookUrl = `${supabaseFunctionsUrl}/whatsapp-webhook`;

export type WhatsAppChatSummary = WhatsAppChat & {
  whatsapp_messages?: WhatsAppMessage[];
  latestMessage?: WhatsAppMessage | null;
};

export async function fetchChatSummaries(): Promise<WhatsAppChatSummary[]> {
  const { data, error } = await supabase
    .from('whatsapp_chats')
    .select(
      'id,name,is_group,last_message_at,created_at,updated_at,whatsapp_messages(id,chat_id,from_number,to_number,type,body,has_media,direction,timestamp,payload,created_at)',
    )
    .order('timestamp', { foreignTable: 'whatsapp_messages', ascending: false })
    .limit(1, { foreignTable: 'whatsapp_messages' })
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (
    data?.map((chat) => ({
      ...chat,
      latestMessage: chat.whatsapp_messages?.[0] ?? null,
    })) ?? []
  );
}

export async function fetchMessagesByChat(chatId: string): Promise<WhatsAppMessage[]> {
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('id,chat_id,from_number,to_number,type,body,has_media,direction,timestamp,payload,created_at')
    .eq('chat_id', chatId)
    .order('timestamp', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function fetchWebhookEvents(limit = 50): Promise<WhatsAppWebhookEvent[]> {
  const { data, error } = await supabase
    .from('whatsapp_webhook_events')
    .select('id,event,payload,headers,created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}
