import { supabase } from './supabase';

export type WhatsAppQuickReply = {
  id: string;
  title: string;
  content: string;
  category: string | null;
  is_favorite: boolean;
  created_at: string;
  updated_at?: string | null;
};

type WhatsAppQuickReplyInput = {
  title: string;
  content: string;
  category?: string | null;
  is_favorite?: boolean;
};

const TABLE_NAME = 'whatsapp_quick_replies';

const mapQuickReply = (reply: any): WhatsAppQuickReply => ({
  id: reply.id,
  title: reply.title,
  content: reply.content,
  category: reply.category ?? null,
  is_favorite: reply.is_favorite ?? false,
  created_at: reply.created_at,
  updated_at: reply.updated_at ?? null,
});

export const listWhatsAppQuickReplies = async (): Promise<WhatsAppQuickReply[]> => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('id, title, content, category, is_favorite, created_at, updated_at')
    .order('category', { ascending: true, nullsFirst: false })
    .order('title', { ascending: true });

  if (error) {
    console.error('Erro ao buscar respostas rápidas:', error);
    throw new Error(error.message || 'Não foi possível carregar as respostas rápidas.');
  }

  return (data ?? []).map(mapQuickReply);
};

export const createWhatsAppQuickReply = async (
  payload: WhatsAppQuickReplyInput
): Promise<WhatsAppQuickReply> => {
  const insertPayload = {
    title: payload.title,
    content: payload.content,
    category: payload.category ?? null,
    is_favorite: payload.is_favorite ?? false,
  };
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert(insertPayload)
    .select('id, title, content, category, is_favorite, created_at, updated_at')
    .single();

  if (error) {
    console.error('Erro ao criar resposta rápida:', error);
    throw new Error(error.message || 'Não foi possível criar a resposta rápida.');
  }

  if (!data) {
    throw new Error('Resposta rápida criada, mas dados não retornados.');
  }

  return mapQuickReply(data);
};

export const updateWhatsAppQuickReply = async (
  id: string,
  payload: Partial<WhatsAppQuickReplyInput>
): Promise<WhatsAppQuickReply> => {
  const updatePayload: Record<string, unknown> = {};

  if (payload.title !== undefined) {
    updatePayload.title = payload.title;
  }
  if (payload.content !== undefined) {
    updatePayload.content = payload.content;
  }
  if (payload.category !== undefined) {
    updatePayload.category = payload.category ?? null;
  }
  if (payload.is_favorite !== undefined) {
    updatePayload.is_favorite = payload.is_favorite;
  }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update(updatePayload)
    .eq('id', id)
    .select('id, title, content, category, is_favorite, created_at, updated_at')
    .single();

  if (error) {
    console.error('Erro ao atualizar resposta rápida:', error);
    throw new Error(error.message || 'Não foi possível atualizar a resposta rápida.');
  }

  if (!data) {
    throw new Error('Resposta rápida atualizada, mas dados não retornados.');
  }

  return mapQuickReply(data);
};

export const deleteWhatsAppQuickReply = async (id: string): Promise<void> => {
  const { error } = await supabase.from(TABLE_NAME).delete().eq('id', id);

  if (error) {
    console.error('Erro ao excluir resposta rápida:', error);
    throw new Error(error.message || 'Não foi possível excluir a resposta rápida.');
  }
};

