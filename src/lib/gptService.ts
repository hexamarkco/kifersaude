import { supabase, Reminder, Lead, Contract, AIGeneratedMessage } from './supabase';
import { ZAPIMessage } from './zapiService';

export interface GPTConfig {
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface MessageGenerationOptions {
  reminder: Reminder;
  lead: Lead;
  contract?: Contract;
  conversationHistory?: ZAPIMessage[];
  tone?: 'professional' | 'friendly' | 'urgent' | 'casual';
  customInstructions?: string;
}

export interface GeneratedMessageResult {
  success: boolean;
  message?: string;
  tokensUsed?: number;
  costEstimate?: number;
  error?: string;
}

class GPTService {
  private openaiUrl = 'https://api.openai.com/v1/chat/completions';

  async getConfig(): Promise<GPTConfig | null> {
    try {
      const { data, error } = await supabase
        .from('api_integrations')
        .select('openai_api_key, openai_model, openai_temperature, openai_max_tokens, openai_enabled')
        .maybeSingle();

      if (error || !data || !data.openai_enabled) {
        return null;
      }

      if (!data.openai_api_key) {
        throw new Error('Chave API da OpenAI não configurada');
      }

      return {
        apiKey: data.openai_api_key,
        model: data.openai_model || 'gpt-3.5-turbo',
        temperature: data.openai_temperature || 0.7,
        maxTokens: data.openai_max_tokens || 500,
      };
    } catch (error) {
      console.error('Erro ao buscar configuração GPT:', error);
      return null;
    }
  }

  buildPrompt(options: MessageGenerationOptions): string {
    const { reminder, lead, contract, conversationHistory, tone, customInstructions } = options;

    const toneInstructions: Record<string, string> = {
      professional: 'Use um tom profissional e formal, mas cordial.',
      friendly: 'Use um tom amigável, descontraído e próximo.',
      urgent: 'Use um tom que transmita urgência e importância, mas sem ser agressivo.',
      casual: 'Use um tom casual e descontraído, como uma conversa entre conhecidos.',
    };

    const selectedTone = tone || 'professional';

    let prompt = `Você é Luiza Kifer, especialista em planos de saúde da UnitedClass. Sua tarefa é gerar uma mensagem de WhatsApp contextualizada.\n\n`;

    prompt += `**Tom de voz:** ${toneInstructions[selectedTone]}\n\n`;

    prompt += `**Informações do Lead:**\n`;
    prompt += `- Nome: ${lead.nome_completo}\n`;
    prompt += `- Telefone: ${lead.telefone}\n`;
    prompt += `- Status: ${lead.status}\n`;
    prompt += `- Origem: ${lead.origem}\n`;
    if (lead.cidade) prompt += `- Cidade: ${lead.cidade}\n`;
    if (lead.observacoes) prompt += `- Observações: ${lead.observacoes}\n`;

    if (contract) {
      prompt += `\n**Informações do Contrato:**\n`;
      prompt += `- Código: ${contract.codigo_contrato}\n`;
      prompt += `- Status: ${contract.status}\n`;
      prompt += `- Operadora: ${contract.operadora}\n`;
      prompt += `- Plano: ${contract.produto_plano}\n`;
      if (contract.mensalidade_total) prompt += `- Mensalidade: R$ ${contract.mensalidade_total.toFixed(2)}\n`;
    }

    prompt += `\n**Contexto do Lembrete:**\n`;
    prompt += `- Tipo: ${reminder.tipo}\n`;
    prompt += `- Título: ${reminder.titulo}\n`;
    if (reminder.descricao) prompt += `- Descrição: ${reminder.descricao}\n`;
    prompt += `- Prioridade: ${reminder.prioridade}\n`;

    if (conversationHistory && conversationHistory.length > 0) {
      prompt += `\n**Histórico da Conversa (últimas mensagens):**\n`;
      const recentMessages = conversationHistory.slice(-10);
      recentMessages.forEach((msg) => {
        const sender = msg.fromMe ? 'Você (Luiza)' : lead.nome_completo;
        const date = new Date(msg.timestamp * 1000).toLocaleString('pt-BR');
        prompt += `[${date}] ${sender}: ${msg.text}\n`;
      });
    } else {
      prompt += `\n**Histórico da Conversa:** Não há histórico disponível (primeira mensagem).\n`;
    }

    if (customInstructions) {
      prompt += `\n**Instruções Adicionais:** ${customInstructions}\n`;
    }

    prompt += `\n**Tarefa:**\n`;
    prompt += `Com base nas informações acima, gere uma mensagem de WhatsApp apropriada para ${lead.nome_completo}. `;
    prompt += `A mensagem deve abordar o motivo do lembrete ("${reminder.tipo}") de forma natural e contextualizada. `;

    if (conversationHistory && conversationHistory.length > 0) {
      prompt += `Considere o histórico da conversa para dar continuidade natural ao diálogo. `;
    }

    prompt += `A mensagem deve ser concisa (máximo 3-4 parágrafos), usar formatação WhatsApp quando apropriado (*negrito* para ênfase), `;
    prompt += `e incluir uma call-to-action clara se necessário.\n\n`;
    prompt += `Não inclua cumprimentos formais como "Atenciosamente" ou assinaturas, pois é uma mensagem de WhatsApp. `;
    prompt += `Mantenha naturalidade e proximidade.\n\n`;
    prompt += `Gere APENAS a mensagem, sem explicações adicionais.`;

    return prompt;
  }

  async generateMessage(options: MessageGenerationOptions): Promise<GeneratedMessageResult> {
    try {
      const config = await this.getConfig();
      if (!config) {
        return { success: false, error: 'GPT não configurado ou desabilitado' };
      }

      const prompt = this.buildPrompt(options);

      const response = await fetch(this.openaiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            {
              role: 'system',
              content: 'Você é Luiza Kifer, especialista em planos de saúde. Seja profissional, empática e objetiva.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: config.temperature,
          max_tokens: config.maxTokens,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.error?.message || 'Falha ao gerar mensagem com GPT'
        };
      }

      const data = await response.json();
      const message = data.choices[0]?.message?.content?.trim();
      const tokensUsed = data.usage?.total_tokens || 0;
      const costEstimate = this.calculateCost(config.model, tokensUsed);

      if (!message) {
        return { success: false, error: 'Resposta vazia do GPT' };
      }

      return {
        success: true,
        message,
        tokensUsed,
        costEstimate,
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  calculateCost(model: string, tokens: number): number {
    const pricing: Record<string, number> = {
      'gpt-4': 0.03 / 1000,
      'gpt-4-turbo': 0.01 / 1000,
      'gpt-3.5-turbo': 0.002 / 1000,
    };

    const pricePerToken = pricing[model] || pricing['gpt-3.5-turbo'];
    return tokens * pricePerToken;
  }

  async saveGeneratedMessage(
    reminderId: string,
    leadId: string,
    generatedMessage: string,
    promptUsed: string,
    conversationContext: any,
    tokensUsed: number,
    costEstimate: number,
    tone: string,
    generatedBy: string,
    contractId?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const messageData: Partial<AIGeneratedMessage> = {
        reminder_id: reminderId,
        lead_id: leadId,
        contract_id: contractId,
        prompt_used: promptUsed,
        message_generated: generatedMessage,
        status: 'draft',
        tone: tone as any,
        tokens_used: tokensUsed,
        cost_estimate: costEstimate,
        conversation_context: conversationContext,
        generated_by: generatedBy,
      };

      const { data, error } = await supabase
        .from('ai_generated_messages')
        .insert(messageData)
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, messageId: data.id };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async updateMessageStatus(
    messageId: string,
    status: 'approved' | 'sent' | 'failed',
    editedMessage?: string,
    approvedBy?: string,
    errorMessage?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: any = { status };

      if (editedMessage) updateData.message_edited = editedMessage;
      if (approvedBy) updateData.approved_by = approvedBy;
      if (status === 'sent') updateData.sent_at = new Date().toISOString();
      if (errorMessage) updateData.error_message = errorMessage;

      const { error } = await supabase
        .from('ai_generated_messages')
        .update(updateData)
        .eq('id', messageId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
}

export const gptService = new GPTService();
