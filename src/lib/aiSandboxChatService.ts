import { getSupabaseErrorMessage, supabase } from './supabase';

export type AiSandboxConversation = {
  id: string;
  title: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AiSandboxMessage = {
  id: string;
  conversation_id: string;
  role: 'lead' | 'ai';
  content: string;
  handoff_reason: string | null;
  provider: string | null;
  model: string | null;
  created_at: string;
};

type SendMessageResult = {
  conversationId: string;
  reply: string;
  handoffReason: string | null;
  provider: string | null;
  model: string | null;
};

export const aiSandboxChatService = {
  async listConversations(): Promise<AiSandboxConversation[]> {
    const { data, error } = await supabase
      .from('ai_sandbox_conversations')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel carregar as simulacoes.'));
    return (data ?? []) as AiSandboxConversation[];
  },

  async listMessages(conversationId: string): Promise<AiSandboxMessage[]> {
    const { data, error } = await supabase
      .from('ai_sandbox_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel carregar as mensagens.'));
    return (data ?? []) as AiSandboxMessage[];
  },

  async renameConversation(conversationId: string, title: string): Promise<void> {
    const { error } = await supabase
      .from('ai_sandbox_conversations')
      .update({ title: title.trim() || 'Nova simulação' })
      .eq('id', conversationId);

    if (error) throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel renomear a simulacao.'));
  },

  async deleteConversation(conversationId: string): Promise<void> {
    const { error } = await supabase
      .from('ai_sandbox_conversations')
      .delete()
      .eq('id', conversationId);

    if (error) throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel apagar a simulacao.'));
  },

  async sendMessage(options: { conversationId: string | null; message: string }): Promise<SendMessageResult> {
    const { data, error } = await supabase.functions.invoke('ai-sandbox-chat', {
      body: {
        conversationId: options.conversationId ?? undefined,
        message: options.message,
      },
    });

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel obter resposta da IA.'));
    }

    const payload = (data ?? {}) as {
      conversationId?: string;
      reply?: string;
      handoffReason?: string | null;
      provider?: string | null;
      model?: string | null;
      error?: string;
    };

    if (payload.error) {
      throw new Error(payload.error);
    }

    if (!payload.conversationId || !payload.reply) {
      throw new Error('A IA nao retornou uma resposta valida.');
    }

    return {
      conversationId: payload.conversationId,
      reply: payload.reply,
      handoffReason: payload.handoffReason ?? null,
      provider: payload.provider ?? null,
      model: payload.model ?? null,
    };
  },
};
