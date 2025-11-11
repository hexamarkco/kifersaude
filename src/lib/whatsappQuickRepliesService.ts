import { supabase } from './supabase';

export type WhatsAppQuickReply = {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at?: string | null;
};

const TABLE_NAME = 'whatsapp_quick_replies';

const mapQuickReply = (reply: any): WhatsAppQuickReply => ({
  id: reply.id,
  title: reply.title,
  content: reply.content,
  created_at: reply.created_at,
  updated_at: reply.updated_at ?? null,
});

export const listWhatsAppQuickReplies = async (): Promise<WhatsAppQuickReply[]> => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('id, title, content, created_at, updated_at')
    .order('title', { ascending: true });

  if (error) {
    console.error('Erro ao buscar respostas rápidas:', error);
    throw new Error(error.message || 'Não foi possível carregar as respostas rápidas.');
  }

  return (data ?? []).map(mapQuickReply);
};

export const createWhatsAppQuickReply = async (
  payload: Pick<WhatsAppQuickReply, 'title' | 'content'>
): Promise<WhatsAppQuickReply> => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert({ title: payload.title, content: payload.content })
    .select('id, title, content, created_at, updated_at')
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
  payload: Pick<WhatsAppQuickReply, 'title' | 'content'>
): Promise<WhatsAppQuickReply> => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update({ title: payload.title, content: payload.content })
    .eq('id', id)
    .select('id, title, content, created_at, updated_at')
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

