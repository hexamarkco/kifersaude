/*
  # Update campaign.intent Feature to v2 (Dual Classification)

  ## Description
  Creates version 2 of the campaign.intent Feature config with:
  - Dual classification prompt (contact_permission + commercial_intent)
  - {{transcript}} variable available (not in default prompt to avoid duplication)
  - recommended_action removed from output schema (derived deterministically)

  ## Safety
  - Explicitly deactivates any active v1 config before inserting v2
  - Guarantees exactly one active config for campaign.intent
*/

-- 1. Update available_variables to include transcript
UPDATE ai_features
SET available_variables = '["message_text", "company_name", "transcript"]'::jsonb
WHERE key = 'campaign.intent';

-- 2. Deactivate any active config for campaign.intent (transactional safety)
UPDATE ai_feature_configs
SET is_active = false, deactivated_at = now()
WHERE feature_id = (SELECT id FROM ai_features WHERE key = 'campaign.intent')
  AND is_active = true;

-- 3. Insert v2 as the only active config
INSERT INTO ai_feature_configs (
  feature_id, version, is_active,
  provider, model, temperature, max_output_tokens, reasoning_effort,
  use_global_instructions, use_global_style,
  feature_prompt, output_instructions, context_config_json,
  activated_at
)
VALUES (
  (SELECT id FROM ai_features WHERE key = 'campaign.intent'),
  2, true,
  'openai', 'gpt-4o-mini', 0.1, 280, null,
  false, false,
  'Você classifica respostas recebidas no WhatsApp após campanhas comerciais da Kifer Saúde.

CONTEXTO DO NEGÓCIO:
A Kifer Saúde oferece revisão de benefícios, comparação de valor, rede credenciada e alternativas de planos de saúde. Nosso público-alvo INCLUI pessoas que JÁ POSSUEM plano de saúde.

REGRAS FUNDAMENTAIS:
1. "Já tenho plano" NÃO é sinal negativo por si só — é JA_POSSUI_PLANO em commercial_intent e NENHUM_SINAL em contact_permission.
2. Classifique DUAS coisas INDEPENDENTEMENTE:
   - contact_permission: Há risco para permissão de contato? (OPT_OUT_EXPLICITO, NUMERO_ERRADO, DESTINATARIO_INCORRETO, RECLAMACAO_CONTATO, AMBIGUO, NENHUM_SINAL)
   - commercial_intent: Qual a intenção comercial? (JA_POSSUI_PLANO, INTERESSADO, SEM_INTERESSE, QUER_SABER_MAIS, ADIAR_CONTATO, OUTRO)
3. Analise a mensagem no CONTEXTO da conversa, não apenas keywords isoladas.
4. Use OPT_OUT_EXPLICITO apenas quando houver pedido claro para não receber mais contato.
5. Use NUMERO_ERRADO quando a mensagem indicar que o número não pertence à pessoa.
6. Use DESTINATARIO_INCORRETO quando a pessoa disser que não é quem procuramos.
7. NUNCA classifique "já tenho plano" como OPT_OUT, NUMERO_ERRADO ou RECLAMACAO_CONTATO.
8. A IA apenas SINALIZA — bloqueio depende de confirmação humana.

EXEMPLOS:
"Não me mande mais mensagem" → OPT_OUT_EXPLICITO / SEM_INTERESSE
"Já tenho plano" → NENHUM_SINAL / JA_POSSUI_PLANO
"Já tenho plano, não me mande mais" → OPT_OUT_EXPLICITO / JA_POSSUI_PLANO
"Número errado" → NUMERO_ERRADO / OUTRO
"Não sou o Carlos" → DESTINATARIO_INCORRETO / OUTRO
"Obrigada, já tenho" → NENHUM_SINAL / JA_POSSUI_PLANO
"Me chama mês que vem" → NENHUM_SINAL / ADIAR_CONTATO
"Vocês estão me incomodando" → RECLAMACAO_CONTATO / SEM_INTERESSE
"Não tenho interesse em trocar" → NENHUM_SINAL / SEM_INTERESSE',

  'Retorne SOMENTE um JSON válido com a estrutura:
{
  "contact_permission": "OPT_OUT_EXPLICITO | NUMERO_ERRADO | DESTINATARIO_INCORRETO | RECLAMACAO_CONTATO | AMBIGUO | NENHUM_SINAL",
  "commercial_intent": "JA_POSSUI_PLANO | INTERESSADO | SEM_INTERESSE | QUER_SABER_MAIS | ADIAR_CONTATO | OUTRO",
  "confidence": 0.0-1.0,
  "reason": "motivo curto em português",
  "evidence": "trecho que sustenta a classificação"
}
Sem markdown. Não inclua recommended_action — o código deriva isso automaticamente.',

  '{"inboundMessage": true, "campaignContext": true, "conversationHistory": true}'::jsonb,
  now()
);
