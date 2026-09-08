import { getSupabaseErrorMessage, supabase } from './supabase';

export type AiSandboxConversation = {
  id: string;
  title: string;
  created_by: string | null;
  is_automated: boolean;
  created_at: string;
  updated_at: string;
};

export type AiSandboxMessage = {
  id: string;
  conversation_id: string;
  role: 'lead' | 'ai';
  content: string;
  handoff_reason: string | null;
  handoff_code: string | null;
  provider: string | null;
  model: string | null;
  created_at: string;
};

export type AiSandboxTestRun = {
  id: string;
  conversation_id: string;
  scenario_key: string;
  scenario_label: string;
  turns: number;
  handoff_triggered: boolean;
  handoff_code: string | null;
  passed: boolean | null;
  verdict: {
    violations?: unknown;
    notes?: unknown;
    playbook_improvements?: unknown;
  };
  provider: string | null;
  model: string | null;
  created_at: string;
};

type SandboxRealtimeHandlers = {
  onMessageInserted: (message: AiSandboxMessage) => void;
  onTestRunInserted: (testRun: AiSandboxTestRun) => void;
  onConversationUpdated: (conversation: AiSandboxConversation) => void;
};

type GenerateReplyResult = {
  reply: string;
  handoffCode: string | null;
  handoffReason: string | null;
  provider: string | null;
  model: string | null;
};

type GenerateOpeningResult = {
  messages: string[];
  handoffCode: string | null;
  handoffReason: string | null;
  provider: string | null;
  model: string | null;
  alreadyHandedOff: boolean;
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

    if (error) throw new Error(await getSupabaseErrorMessage(error, 'Nao foi possivel carregar as simulacoes.'));
    return (data ?? []) as AiSandboxConversation[];
  },

  async listMessages(conversationId: string): Promise<AiSandboxMessage[]> {
    const { data, error } = await supabase
      .from('ai_sandbox_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(await getSupabaseErrorMessage(error, 'Nao foi possivel carregar as mensagens.'));
    return (data ?? []) as AiSandboxMessage[];
  },

  async getLatestTestRun(conversationId: string): Promise<AiSandboxTestRun | null> {
    const { data, error } = await supabase
      .from('ai_sandbox_test_runs')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(await getSupabaseErrorMessage(error, 'Nao foi possivel carregar a avaliacao do cenário.'));
    return data ? data as AiSandboxTestRun : null;
  },

  subscribeToConversation(conversationId: string, handlers: SandboxRealtimeHandlers): () => void {
    const channel = supabase
      .channel(`ai-sandbox-conversation-${conversationId}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ai_sandbox_messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => handlers.onMessageInserted(payload.new as AiSandboxMessage),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ai_sandbox_test_runs', filter: `conversation_id=eq.${conversationId}` },
        (payload) => handlers.onTestRunInserted(payload.new as AiSandboxTestRun),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ai_sandbox_conversations', filter: `id=eq.${conversationId}` },
        (payload) => handlers.onConversationUpdated(payload.new as AiSandboxConversation),
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  },

  async renameConversation(conversationId: string, title: string): Promise<void> {
    const { error } = await supabase
      .from('ai_sandbox_conversations')
      .update({ title: title.trim() || 'Nova simulação' })
      .eq('id', conversationId);

    if (error) throw new Error(await getSupabaseErrorMessage(error, 'Nao foi possivel renomear a simulacao.'));
  },

  async deleteConversation(conversationId: string): Promise<void> {
    const { error } = await supabase
      .from('ai_sandbox_conversations')
      .delete()
      .eq('id', conversationId);

    if (error) throw new Error(await getSupabaseErrorMessage(error, 'Nao foi possivel apagar a simulacao.'));
  },

  async createConversation(firstMessage: string, createdBy: string): Promise<AiSandboxConversation> {
    const { data, error } = await supabase
      .from('ai_sandbox_conversations')
      .insert({ title: buildTitleFromMessage(firstMessage), created_by: createdBy })
      .select('*')
      .single();

    if (error) throw new Error(await getSupabaseErrorMessage(error, 'Nao foi possivel criar a simulacao.'));
    return data as AiSandboxConversation;
  },

  async createAutomatedConversation(title: string, createdBy: string): Promise<AiSandboxConversation> {
    const { data, error } = await supabase
      .from('ai_sandbox_conversations')
      .insert({ title: `[Teste automatizado] ${title}`, created_by: createdBy, is_automated: true })
      .select('*')
      .single();

    if (error) throw new Error(await getSupabaseErrorMessage(error, 'Nao foi possivel iniciar o cenário.'));
    return data as AiSandboxConversation;
  },

  async appendLeadMessage(conversationId: string, content: string): Promise<AiSandboxMessage> {
    const { data, error } = await supabase
      .from('ai_sandbox_messages')
      .insert({ conversation_id: conversationId, role: 'lead', content })
      .select('*')
      .single();

    if (error) throw new Error(await getSupabaseErrorMessage(error, 'Nao foi possivel enviar a mensagem.'));
    return data as AiSandboxMessage;
  },

  async generateReply(conversationId: string): Promise<GenerateReplyResult | null> {
    const result = await callGenerate({ conversationId });
    if (result.alreadyHandedOff) {
      return null;
    }

    const reply = result.messages[0];
    if (!reply) {
      throw new Error('A IA nao retornou uma resposta valida.');
    }

    return {
      reply,
      handoffCode: result.handoffCode,
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

  async runScenario(scenarioKey: string, scenarioLabel: string, leadPersonaPrompt: string, conversationId: string): Promise<{ conversationId: string; passed: boolean; violations: string[]; notes: string; playbookImprovements: string[] }> {
    const { data, error } = await supabase.functions.invoke('ai-sandbox-run-scenario', {
      body: { scenarioKey, scenarioLabel, leadPersonaPrompt, conversationId },
    });

    if (error) throw new Error(await getSupabaseErrorMessage(error, 'Erro ao rodar cenário de teste.'));
    const payload = (data ?? {}) as { conversationId?: string; passed?: boolean; violations?: string[]; notes?: string; playbookImprovements?: string[]; error?: string };
    if (payload.error) throw new Error(payload.error);
    return {
      conversationId: payload.conversationId ?? '',
      passed: payload.passed ?? false,
      violations: payload.violations ?? [],
      notes: payload.notes ?? '',
      playbookImprovements: payload.playbookImprovements ?? [],
    };
  },
};

async function callGenerate(body: { conversationId: string; leadName?: string }): Promise<GenerateOpeningResult> {
  const { data, error } = await supabase.functions.invoke('ai-sandbox-chat', { body });

  if (error) {
    throw new Error(await getSupabaseErrorMessage(error, 'Nao foi possivel obter resposta da IA.'));
  }

  const payload = (data ?? {}) as {
    messages?: string[];
    handoffCode?: string | null;
    handoffReason?: string | null;
    provider?: string | null;
    model?: string | null;
    alreadyHandedOff?: boolean;
    error?: string;
  };

  if (payload.error) {
    throw new Error(payload.error);
  }

  return {
    messages: payload.messages ?? [],
    handoffCode: payload.handoffCode ?? null,
    handoffReason: payload.handoffReason ?? null,
    provider: payload.provider ?? null,
    model: payload.model ?? null,
    alreadyHandedOff: payload.alreadyHandedOff === true,
  };
}
