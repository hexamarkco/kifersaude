import { supabase } from './supabase';

export interface MessageHistoryEntry {
  id: string;
  message_id: string;
  chat_id: string;
  action_type: 'created' | 'edited' | 'deleted' | 'restored';
  old_body: string | null;
  new_body: string | null;
  old_payload: Record<string, unknown>;
  new_payload: Record<string, unknown>;
  changed_by: string | null;
  changed_at: string;
  created_at: string;
}

export interface MessageWithHistory {
  id: string;
  chat_id: string;
  body: string | null;
  original_body: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
  edited_at: string | null;
  edit_count: number;
  timestamp: string | null;
  from_number: string | null;
  type: string | null;
  direction: 'inbound' | 'outbound';
  author: string | null;
}

export interface DeletedMessage extends MessageWithHistory {
  is_deleted: true;
  deleted_at: string;
  deleted_by: string;
}

export interface EditedMessage extends MessageWithHistory {
  edit_count: number;
  edited_at: string;
  original_body: string;
}

export async function getMessageHistory(messageId: string): Promise<MessageHistoryEntry[]> {
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('id, chat_id, body, original_body, is_deleted, deleted_at, edited_at, edit_count, payload, created_at')
    .eq('id', messageId)
    .maybeSingle();

  if (error) {
    console.error('Erro ao buscar mensagem:', error);
    throw new Error(`Erro ao buscar mensagem: ${error.message}`);
  }

  if (!data) return [];

  const entries: MessageHistoryEntry[] = [];
  entries.push({
    id: `created-${data.id}`,
    message_id: data.id,
    chat_id: data.chat_id,
    action_type: 'created',
    old_body: null,
    new_body: data.body,
    old_payload: {},
    new_payload: data.payload || {},
    changed_by: null,
    changed_at: data.created_at,
    created_at: data.created_at,
  });

  if (data.edit_count && data.edited_at) {
    entries.push({
      id: `edited-${data.id}`,
      message_id: data.id,
      chat_id: data.chat_id,
      action_type: 'edited',
      old_body: data.original_body,
      new_body: data.body,
      old_payload: {},
      new_payload: data.payload || {},
      changed_by: null,
      changed_at: data.edited_at,
      created_at: data.created_at,
    });
  }

  if (data.is_deleted && data.deleted_at) {
    entries.push({
      id: `deleted-${data.id}`,
      message_id: data.id,
      chat_id: data.chat_id,
      action_type: 'deleted',
      old_body: data.body,
      new_body: null,
      old_payload: data.payload || {},
      new_payload: {},
      changed_by: null,
      changed_at: data.deleted_at,
      created_at: data.created_at,
    });
  }

  return entries;
}

export async function getDeletedMessages(
  chatId?: string,
  startDate?: string,
  endDate?: string,
  limit: number = 50,
  offset: number = 0
): Promise<DeletedMessage[]> {
  let query = supabase
    .from('whatsapp_messages')
    .select('*')
    .eq('is_deleted', true);

  if (chatId) {
    query = query.eq('chat_id', chatId);
  }

  if (startDate) {
    query = query.gte('deleted_at', startDate);
  }

  if (endDate) {
    query = query.lte('deleted_at', endDate);
  }

  const { data, error } = await query
    .order('deleted_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Erro ao buscar mensagens deletadas:', error);
    throw new Error(`Erro ao buscar mensagens deletadas: ${error.message}`);
  }

  return (data || []) as DeletedMessage[];
}

export async function getEditedMessages(
  chatId?: string,
  startDate?: string,
  endDate?: string,
  limit: number = 50,
  offset: number = 0
): Promise<EditedMessage[]> {
  let query = supabase
    .from('whatsapp_messages')
    .select('*')
    .gt('edit_count', 0);

  if (chatId) {
    query = query.eq('chat_id', chatId);
  }

  if (startDate) {
    query = query.gte('edited_at', startDate);
  }

  if (endDate) {
    query = query.lte('edited_at', endDate);
  }

  const { data, error } = await query
    .order('edited_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Erro ao buscar mensagens editadas:', error);
    throw new Error(`Erro ao buscar mensagens editadas: ${error.message}`);
  }

  return (data || []) as EditedMessage[];
}

export async function getChatMessagesWithHistory(
  chatId: string,
  includeDeleted: boolean = false,
  limit: number = 100,
  offset: number = 0
): Promise<MessageWithHistory[]> {
  let query = supabase
    .from('whatsapp_messages')
    .select('*')
    .eq('chat_id', chatId);

  if (!includeDeleted) {
    query = query.eq('is_deleted', false);
  }

  const { data, error } = await query
    .order('timestamp', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Erro ao buscar mensagens do chat:', error);
    throw new Error(`Erro ao buscar mensagens: ${error.message}`);
  }

  return (data || []) as MessageWithHistory[];
}

export async function getMessageEditCount(chatId: string): Promise<number> {
  const { count, error } = await supabase
    .from('whatsapp_messages')
    .select('*', { count: 'exact', head: true })
    .eq('chat_id', chatId)
    .gt('edit_count', 0);

  if (error) {
    console.error('Erro ao contar mensagens editadas:', error);
    return 0;
  }

  return count || 0;
}

export async function getMessageDeleteCount(chatId: string): Promise<number> {
  const { count, error } = await supabase
    .from('whatsapp_messages')
    .select('*', { count: 'exact', head: true })
    .eq('chat_id', chatId)
    .eq('is_deleted', true);

  if (error) {
    console.error('Erro ao contar mensagens deletadas:', error);
    return 0;
  }

  return count || 0;
}

export async function getRecentHistoryActivity(
  daysBack: number = 7
): Promise<MessageHistoryEntry[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('id, chat_id, body, original_body, is_deleted, deleted_at, edited_at, edit_count, payload, created_at')
    .or('edit_count.gt.0,is_deleted.eq.true')
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Erro ao buscar atividade recente:', error);
    throw new Error(`Erro ao buscar atividade: ${error.message}`);
  }

  return (data || []).flatMap((message) => {
    const entries: MessageHistoryEntry[] = [];
    if (message.edit_count && message.edited_at) {
      entries.push({
        id: `edited-${message.id}`,
        message_id: message.id,
        chat_id: message.chat_id,
        action_type: 'edited',
        old_body: message.original_body,
        new_body: message.body,
        old_payload: {},
        new_payload: message.payload || {},
        changed_by: null,
        changed_at: message.edited_at,
        created_at: message.created_at,
      });
    }
    if (message.is_deleted && message.deleted_at) {
      entries.push({
        id: `deleted-${message.id}`,
        message_id: message.id,
        chat_id: message.chat_id,
        action_type: 'deleted',
        old_body: message.body,
        new_body: null,
        old_payload: message.payload || {},
        new_payload: {},
        changed_by: null,
        changed_at: message.deleted_at,
        created_at: message.created_at,
      });
    }
    return entries;
  });
}

export function formatActionType(actionType: string): string {
  const labels: Record<string, string> = {
    created: 'Criada',
    edited: 'Editada',
    deleted: 'Deletada',
    restored: 'Restaurada',
  };
  return labels[actionType] || actionType;
}

export function getActionTypeColor(actionType: string): string {
  const colors: Record<string, string> = {
    created: 'text-green-600',
    edited: 'text-blue-600',
    deleted: 'text-red-600',
    restored: 'text-purple-600',
  };
  return colors[actionType] || 'text-gray-600';
}
