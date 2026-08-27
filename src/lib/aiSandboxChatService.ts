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

type GenerateReplyResult = {
  reply: string;
  handoffReason: string | null;
  provider: string | null;
  model: string | null;
};

type GenerateOpeningResult = {
  messages: string[];
  handoffReason: string | null;
  provider: string | null;
  model: string | null;
};

const buildTitleFromMessage = (message: string): string => {
  const clean = message.trim().replace(/\s+/g, ' ');
  if (!clean) return 'Nova simulação';
  return clean.length > 60 ? `${clean.slice(0, 57)}...` : clean;
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

  async createConversation(firstMessage: string, createdBy: string): Promise<AiSandboxConversation> {
    const { data, error } = await supabase
      .from('ai_sandbox_conversations')
      .insert({ title: buildTitleFromMessage(firstMessage), created_by: createdBy })
      .select('*')
      .single();

    if (error) throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel criar a simulacao.'));
    return data as AiSandboxConversation;
  },

  async appendLeadMessage(conversationId: string, content: string): Promise<AiSandboxMessage> {
    const { data, error } = await supabase
      .from('ai_sandbox_messages')
      .insert({ conversation_id: conversationId, role: 'lead', content })
      .select('*')
      .single();

    if (error) throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel enviar a mensagem.'));
    return data as AiSandboxMessage;
  },

  async generateReply(conversationId: string): Promise<GenerateReplyResult> {
    const result = await callGenerate({ conversationId });
    const reply = result.messages[0];
    if (!reply) {
      throw new Error('A IA nao retornou uma resposta valida.');
    }

    return {
      reply,
      handoffReason: result.handoffReason,
      provider: result.provider,
      model: result.model,
    };
  },

  async generateOpening(conversationId: string, leadName?: string): Promise<GenerateOpeningResult> {
    const result = await callGenerate({ conversationId, leadName });
    if (result.messages.length === 0) {
      throw new Error('A IA nao retornou uma abordagem valida.');
    }

    return result;
  },
};

async function callGenerate(body: { conversationId: string; leadName?: string }): Promise<GenerateOpeningResult> {
  const { data, error } = await supabase.functions.invoke('ai-sandbox-chat', { body });

  if (error) {
    throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel obter resposta da IA.'));
  }

  const payload = (data ?? {}) as {
    messages?: string[];
    handoffReason?: string | null;
    provider?: string | null;
    model?: string | null;
    error?: string;
  };

  if (payload.error) {
    throw new Error(payload.error);
  }

  return {
    messages: payload.messages ?? [],
    handoffReason: payload.handoffReason ?? null,
    provider: payload.provider ?? null,
    model: payload.model ?? null,
  };
}
