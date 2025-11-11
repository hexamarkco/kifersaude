import {
  supabase,
  Reminder,
  Lead,
  Contract,
  AIGeneratedMessage,
  WhatsAppConversation,
} from './supabase';
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

export interface ChatReplySuggestionOptions {
  lead?: Lead;
  conversationHistory?: WhatsAppConversation[];
  tone?: 'professional' | 'friendly' | 'urgent' | 'casual';
  customInstructions?: string;
  quantity?: number;
}

export interface ChatReplySuggestionResult {
  success: boolean;
  suggestions?: string[];
  tokensUsed?: number;
  costEstimate?: number;
  error?: string;
}

export interface RewriteMessageOptions {
  message: string;
  lead?: Lead;
  conversationHistory?: WhatsAppConversation[];
  tone?: 'professional' | 'friendly' | 'urgent' | 'casual';
  customInstructions?: string;
}

export interface RewriteMessageResult {
  success: boolean;
  rewrittenMessage?: string;
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

  private buildConversationSummary(
    conversationHistory: WhatsAppConversation[] | undefined,
    lead?: Lead
  ): string {
    if (!conversationHistory || conversationHistory.length === 0) {
      return 'Sem mensagens anteriores.';
    }

    const maxMessages = 12;
    const leadName = lead?.nome_completo?.trim() || 'Contato';
    const recentMessages = conversationHistory.slice(-maxMessages);

    return recentMessages
      .map((message) => {
        const date = new Date(message.timestamp).toLocaleString('pt-BR');
        const sender = message.message_type === 'sent' ? 'Você' : message.sender_name?.trim() || leadName;

        let content = message.message_text?.trim();

        if (!content) {
          if (message.media_caption?.trim()) {
            content = `${message.media_caption.trim()} [${message.media_type ?? 'mídia'}]`;
          } else if (message.media_type) {
            content = `[${message.media_type} enviado]`;
          } else {
            content = '[Mensagem sem texto]';
          }
        }

        if (message.quoted_message_text) {
          const quotedSender = message.quoted_message_from_me ? 'Você' : leadName;
          content += ` | Em resposta a ${quotedSender}: "${message.quoted_message_text.trim()}"`;
        }

        return `[${date}] ${sender}: ${content}`;
      })
      .join('\n');
  }

  private cleanJsonContent(content: string | undefined | null): string | null {
    if (!content) {
      return null;
    }

    let cleaned = content.trim();
    cleaned = cleaned.replace(/```json/gi, '').replace(/```/g, '').trim();

    if (!cleaned) {
      return null;
    }

    return cleaned;
  }

  private parseSuggestionsFromContent(content: string | null): string[] | null {
    if (!content) {
      return null;
    }

    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed.filter((entry): entry is string => typeof entry === 'string' && entry.trim());
      }
      if (Array.isArray(parsed.sugestoes)) {
        return parsed.sugestoes.filter((entry: unknown): entry is string => typeof entry === 'string' && entry.trim());
      }
    } catch {
      // Ignore and fallback to heuristic parsing below
    }

    const suggestionCandidates = content
      .split(/\n+/)
      .map((line) => line.replace(/^[-*\d\.\)\s]+/, '').trim())
      .filter(Boolean);

    if (suggestionCandidates.length === 0) {
      return null;
    }

    return suggestionCandidates;
  }

  private parseRewrittenMessage(content: string | null): string | null {
    if (!content) {
      return null;
    }

    try {
      const parsed = JSON.parse(content);
      if (typeof parsed === 'string' && parsed.trim()) {
        return parsed.trim();
      }
      if (typeof parsed.mensagem === 'string' && parsed.mensagem.trim()) {
        return parsed.mensagem.trim();
      }
      if (typeof parsed.rewritten === 'string' && parsed.rewritten.trim()) {
        return parsed.rewritten.trim();
      }
    } catch {
      // Fallback below
    }

    return content.trim();
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

  async generateChatReplySuggestions(
    options: ChatReplySuggestionOptions
  ): Promise<ChatReplySuggestionResult> {
    try {
      const config = await this.getConfig();
      if (!config) {
        return { success: false, error: 'GPT não configurado ou desabilitado' };
      }

      const {
        lead,
        conversationHistory,
        tone = 'friendly',
        customInstructions,
        quantity = 3,
      } = options;

      const leadName = lead?.nome_completo?.trim() || 'o contato';
      const toneDescriptions: Record<string, string> = {
        professional: 'Mantenha tom profissional, cordial e direto.',
        friendly: 'Use tom amigável, acolhedor e próximo.',
        urgent: 'Transmita urgência com clareza e empatia.',
        casual: 'Seja descontraído, natural e objetivo.',
      };

      const conversationSummary = this.buildConversationSummary(conversationHistory, lead);

      let prompt = `Você é um especialista em atendimento via WhatsApp e conhece a realidade da corretora UnitedClass.`;
      prompt += `\n\nDados do lead: ${lead ? `${lead.nome_completo} (${lead.telefone})` : 'Não informados'}.`;
      if (lead?.status) {
        prompt += ` Status atual: ${lead.status}.`;
      }
      if (lead?.origem) {
        prompt += ` Origem: ${lead.origem}.`;
      }
      if (lead?.observacoes) {
        prompt += ` Observações importantes: ${lead.observacoes}.`;
      }

      prompt += `\n\nHistórico recente da conversa (do mais antigo para o mais recente):\n${conversationSummary}`;

      if (customInstructions?.trim()) {
        prompt += `\n\nInstruções adicionais: ${customInstructions.trim()}`;
      }

      prompt += `\n\nGere ${quantity} sugestões de resposta em português para continuar a conversa com ${leadName}.`;
      prompt += ` Use o seguinte tom: ${toneDescriptions[tone] ?? toneDescriptions.friendly}`;
      prompt += `\nAs sugestões devem ser curtas (até 4 parágrafos curtos), objetivas e manter continuidade natural.`;
      prompt += ` Podem incluir perguntas abertas ou próximos passos quando fizer sentido.`;
      prompt += `\nResponda apenas em JSON válido no formato {"sugestoes": ["sugestao 1", "sugestao 2"]}.`;

      const response = await fetch(this.openaiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            {
              role: 'system',
              content:
                'Você é um assistente virtual especializado em comunicação via WhatsApp. Seja empático, natural e mantenha respostas curtas.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: config.temperature,
          max_tokens: Math.max(256, config.maxTokens),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.error?.message || 'Falha ao gerar sugestões com GPT',
        };
      }

      const data = await response.json();
      const content = this.cleanJsonContent(data.choices?.[0]?.message?.content);
      const suggestions = this.parseSuggestionsFromContent(content);
      const tokensUsed = data.usage?.total_tokens || 0;
      const costEstimate = this.calculateCost(config.model, tokensUsed);

      if (!suggestions || suggestions.length === 0) {
        return { success: false, error: 'Resposta vazia do GPT' };
      }

      return {
        success: true,
        suggestions,
        tokensUsed,
        costEstimate,
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async rewriteMessage(options: RewriteMessageOptions): Promise<RewriteMessageResult> {
    try {
      const config = await this.getConfig();
      if (!config) {
        return { success: false, error: 'GPT não configurado ou desabilitado' };
      }

      const { message, lead, conversationHistory, tone = 'friendly', customInstructions } = options;

      const leadName = lead?.nome_completo?.trim() || 'o contato';
      const conversationSummary = this.buildConversationSummary(conversationHistory, lead);
      const toneDescriptions: Record<string, string> = {
        professional: 'Reescreva com tom profissional, cordial e direto.',
        friendly: 'Reescreva com tom amigável, acolhedor e próximo.',
        urgent: 'Reescreva enfatizando urgência, mas com empatia.',
        casual: 'Reescreva de forma leve, natural e objetiva.',
      };

      let prompt = `Reescreva a mensagem abaixo para enviá-la a ${leadName} pelo WhatsApp, mantendo a intenção original.`;
      prompt += `\nUse este tom: ${toneDescriptions[tone] ?? toneDescriptions.friendly}`;
      prompt += `\nConsidere o histórico recente:\n${conversationSummary}`;
      if (customInstructions?.trim()) {
        prompt += `\nInstruções adicionais: ${customInstructions.trim()}`;
      }

      prompt += `\n\nMensagem original:\n"""${message.trim()}"""`;
      prompt += `\n\nRetorne apenas a versão reescrita em JSON válido no formato {"mensagem": "..."}.`;

      const response = await fetch(this.openaiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            {
              role: 'system',
              content:
                'Você ajuda consultores de vendas a aprimorarem mensagens de WhatsApp mantendo autenticidade e empatia.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: config.temperature,
          max_tokens: Math.max(256, config.maxTokens),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.error?.message || 'Falha ao reescrever mensagem com GPT',
        };
      }

      const data = await response.json();
      const content = this.cleanJsonContent(data.choices?.[0]?.message?.content);
      const rewritten = this.parseRewrittenMessage(content);
      const tokensUsed = data.usage?.total_tokens || 0;
      const costEstimate = this.calculateCost(config.model, tokensUsed);

      if (!rewritten) {
        return { success: false, error: 'Resposta vazia do GPT' };
      }

      return {
        success: true,
        rewrittenMessage: rewritten,
        tokensUsed,
        costEstimate,
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
}

export const gptService = new GPTService();
