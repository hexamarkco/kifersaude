# Auditoria Técnica Completa — Sistema de Geração de Follow-ups

Data: 02/09/2026
Escopo: Código-fonte do repositório, migrations, Edge Functions, frontend e documentação existente.
Método: Leitura completa dos arquivos envolvidos, sem alteração de código.

---

## 1. RESUMO EXECUTIVO

O follow-up é gerado por uma Edge Function Supabase (`comm-whatsapp-generate-follow-up`) que recebe o chatId, carrega em paralelo o histórico completo de mensagens, dados do lead, configurações do sistema, prompt customizado, auditorias de follow-ups anteriores e lembretes. Tudo é comprimido em um único prompt (system + user) enviado a uma chamada LLM que, na mesma saída JSON, interpreta o cenário comercial E redige a mensagem.

O sistema V2 (01/09/2026) adicionou taxonomia comercial (stage/blocker/goal/commercial_function), memória de tentativas anteriores via audit log, regra de fio comercial e proteção contra repetição — mas a arquitetura continua sendo **uma única chamada** para análise + estratégia + redação, sem memória comercial estruturada persistida, sem validação pós-geração e sem feedback loop.

---

## 2. FLUXO END-TO-END

```
[1] Operator clicks "Gerar follow-up" in WhatsAppInboxScreen
    ↓
[2] commWhatsAppService.generateFollowUp(chatId, {customInstructions, variantCount})
    ↓
[3] Edge Function: comm-whatsapp-generate-follow-up/index.ts
    ↓
[4] Auth check (authorizeDashboardUser, COMM_WHATSAPP_MODULE, 'view')
    ↓
[5] resolveCommWhatsAppCanonicalChatRouteByUuid(chatId) → canonical chat
    ↓
[6] PARALLEL LOAD:
    ├── loadAllMessagesForChat(chat.id) → comm_whatsapp_messages (ALL, paginated 1000)
    ├── loadLeadContext(lead_id) → leads + lead_status_config + lead_origens + lead_responsaveis
    ├── system_settings → company_name, timezone
    ├── integration_settings (slug='ai_follow_up_prompt') → custom prompt
    ├── loadRecentFollowUpAudits(chat_id) → last 8 from comm_follow_up_audit_log
    └── loadFollowUpReminders(lead_id) → last 8 from reminders
    ↓
[7] BUILD CONTEXT:
    ├── transcriptLines = messages.map(buildTranscriptLine) (format: [HH:mm, DD/MM/AAAA] Author: text)
    ├── styleProfile = buildStyleProfile(last 120 outbound text messages)
    ├── styleProfileText = buildStyleProfileText(profile)
    ├── temporalFacts = buildTemporalFacts(messages, now, tz)
    ├── baseContextPrompt = nome + telefone + lead + status + responsavel + tz + now + temporalFacts + recentFollowUps + reminders + transcript
    ├── baseIdentityBlock = companyName + contextualização
    ├── userCustomInstructionsBlock = if customInstructions provided
    └── operationCustomPromptBlock = ai_follow_up_prompt.instructions
    ↓
[8] ASSEMBLE systemPrompt (20+ blocks concatenated)
    ↓
[9] ASSEMBLE userPrompt = baseContextPrompt + instruction
    ↓
[10] generateTextWithRouting({task:'follow_up_generation', systemPrompt, userPrompt, temperature, maxTokens})
    ↓
[11] ai-router.ts: loads config from integration_settings, resolves provider/model
    ↓
[12] Provider API call (OpenAI /chat/completions, Claude /messages, or Gemini /generateContent)
    ↓
[13] parseFollowUpGenerationResult(raw JSON) → aiContext + text/variations
    ↓
[14] RETRY if invalid JSON (1 correction attempt)
    ↓
[15] RETRY if same commercialFunction repeated without inbound
    ↓
[16] hasRecentOutboundWithoutInbound → force wait if true
    ↓
[17] normalizeGreetingForTemporalFacts → fix greeting based on period
    ↓
[18] buildFollowUpNextAction → compute schedule with business day cadence
    ↓
[19] INSERT INTO comm_follow_up_audit_log (all V2 fields)
    ↓
[20] Return {text, variations, aiContext, scheduleRecommendation, generationId, provider, model}
```

---

## 3. ARQUIVOS ENVOLVIDOS

| Arquivo | Função | Responsabilidade |
|---|---|---|
| `supabase/functions/comm-whatsapp-generate-follow-up/index.ts` | Edge Function principal (1832 linhas) | Prompt, contexto, IA, parsing, agenda, audit |
| `supabase/functions/_shared/ai-router.ts` | Roteador de IA (900 linhas) | Provider/model selection, fallback, API calls |
| `supabase/functions/_shared/comm-whatsapp-transcript.ts` | Transcript builder (228 linhas) | Style profile, exemplos, formatação |
| `supabase/functions/_shared/comm-whatsapp-follow-up-commercial-thread.ts` | Regra de fio comercial (14 linhas) | Prompt block compartilhado |
| `supabase/functions/_shared/comm-whatsapp.ts` | Infra compartilhada | CORS, auth helpers, canonical chat |
| `src/lib/commWhatsAppService.ts` | Service frontend | Invoca Edge Functions, tipa respostas |
| `src/features/communication/whatsapp/WhatsAppInboxScreen.tsx` | Inbox principal | Orquestra geração, envio, lote, agenda |
| `src/features/communication/whatsapp/components/WhatsAppFollowUpModal.tsx` | Modal individual | UI de geração individual |
| `src/features/communication/whatsapp/components/WhatsAppBatchFollowUpModal.tsx` | Modal lote | Geração em lote, revisão, envio |
| `src/features/communication/whatsapp/components/followUpModalUi.tsx` | Componentes compartilhados UI | Elementos visuais dos modais |
| `supabase/migrations/20261001002000_add_follow_up_v2_audit_and_reminder_provenance.sql` | Migration V2 | Audit log + reminders expandidos |
| `supabase/migrations/20260911419000_add_comm_follow_up_audit_log.sql` | Migration base audit | Tabela audit log original |
| `supabase/functions/comm-whatsapp-suggest-reply/index.ts` | Sugerir resposta | Função separada, mesmo task de IA |

---

## 4. DADOS DISPONÍVEIS

### O que o sistema SABE sobre o lead (carregado para o prompt):

| Campo | Origem | Uso no prompt |
|---|---|---|
| `nome_completo` | `leads` | Sim — contexto do chat |
| `telefone` | `leads` | Sim — contexto do chat |
| `email` | `leads` | **NÃO** — carregado mas não usado |
| `cidade` | `leads` | **NÃO** — carregado mas não usado |
| `origem` | `leads` + lookup | **NÃO** — carregado mas não usado |
| `status` | `leads` + lookup | Sim — contexto do chat |
| `responsavel` | `leads` + lookup | Sim — contexto do chat |
| `arquivado` | `leads` | **NÃO** — não carregado |
| `skip_automation` | `leads` | **NÃO** — não carregado |
| `favorito` | `leads` | **NÃO** — não carregado |
| `observacoes` | `leads` | **NÃO** — não carregado |
| `proximo_retorno` | `leads` | **NÃO** — não carregado |
| `tipo_contratacao` | `leads` | **NÃO** — não carregado |
| `operadora_atual` | `leads` | **NÃO** — não carregado |
| `data_criacao` | `leads` | **NÃO** — não carregado |
| `ultimo_contato` | `leads` | **NÃO** — não carregado |

### O que o transcript fornece (tudo via texto):

- Todas as mensagens do chat (inbound + outbound), sem limite além da paginação
- Timestamps formatados
- Identificação de autor (Eu / nome do contato)
- Dados de mídia como marcadores (`[Imagem]`, `[Áudio sem transcrição]`)
- Mensagens deletadas marcadas

### Contexto temporal (calculado no backend):

- `lastMessageElapsed` — tempo desde última mensagem de qualquer lado
- `lastInboundElapsed` — tempo desde última mensagem do cliente
- `lastOutboundElapsed` — tempo desde última mensagem enviada
- `contactedToday` — se houve contato hoje
- `periodOfDay` — manhã/tarde/noite
- `consecutiveOutboundAttempts` — tentativas consecutivas sem resposta

### Audit log (últimos 8):

- `sent_at`, `commercial_function`, `goal`, `generated_text`, `sent_text`
- Se cliente respondeu depois (calculado em runtime)

### Lembretes (últimos 8):

- `titulo`, `descricao`, `data_lembrete`, `lido`, `follow_up_origin`

---

## 5. DADOS QUE NÃO EXISTEM

| Informação comercial | Status |
|---|---|
| Decisor identificado | **NÃO EXISTE** como dado estruturado — só no texto da conversa |
| Microdecisão pendente | **NÃO EXISTE** como dado persistido entre gerações — IA infera a cada chamada |
| Terceiro envolvido | **NÃO EXISTE** — identificado pelo prompt via regra textual |
| Estágio da venda | **NÃO EXISTE** como dado persistido — IA infera a cada chamada e descarta |
| Bloqueio identificado | **NÃO EXISTE** como dado persistido |
| Objeção do lead | **NÃO EXISTE** como dado persistido |
| Preferência de rede | **NÃO EXISTE** como dado estruturado |
| Orçamento | **NÃO EXISTE** como dado estruturado |
| Planos cotados | **NÃO EXISTE** como dado estruturado |
| Preços apresentados | **NÃO EXISTE** como dado estruturado |
| Beneficiários | **NÃO EXISTE** como dado estruturado |
| Idade do beneficiário | **NÃO EXISTE** como dado estruturado |
| Operadora atual | **NÃO EXISTE** no prompt (carregado mas não injetado) |
| Cidade | **NÃO EXISTE** no prompt (carregado mas não injetado) |
| Tipo de contratação | **NÃO EXISTE** no prompt |
| Sinais de compra | **NÃO EXISTE** como dado persistido |
| Última ação comercial | **NÃO EXISTE** como dado persistido — audit log V2 tem `commercial_function` mas não a ação executada pelo lead |
| Histórico de estratégias usadas | **PARCIAL** — audit log V2 tem `commercial_function` + `goal` dos últimos 8 |
| Resultado de follow-ups anteriores | **PARCIAL** — calculado em runtime se houve inbound após envio |
| Interceptações/comparações com concorrentes | **NÃO EXISTE** — só se estiver no transcript |
| Número de follow-ups já enviados | **PARCIAL** — calculado via `consecutiveOutboundAttempts` (contagem de grupos de outbounds) |
| Avaliação de qualidade do follow-up | **NÃO EXISTE** |

---

## 6. PROMPTS

### System Prompt (modo normal) — ordem de composição:

1. **baseIdentityBlock** — "Você gera follow-ups de WhatsApp para a operação {companyName}..."
2. **CORE_STRATEGY_RULES** — 12 perguntas de raciocínio + princípio central
3. **userCustomInstructionsBlock** — ajustes extras do operador (opcional)
4. **operationCustomPromptBlock** — `ai_follow_up_prompt.instructions` (opcional)
5. **"Mensagem NATURAL"** — instrução anti-IA
6. **MULTI_MESSAGE_MECHANISM_NOTE** — explicação do `---`
7. **MESSAGE_SPLITTING_INSTRUCTION** — regra de divisão em mensagens
8. **STYLE_RULE** — "escreva como uma excelente corretora humana"
9. **DEFAULT_CONDUCT_RULES** — conduta WhatsApp (curta, sem listas, etc.)
10. **Style Profile** — "REGRAS DE ESTILO" + `styleProfileText` (estatísticas)
11. **COMMERCIAL_THREAD_RULE** — regra de fio comercial pendente
12. **NO_REPEAT_STRATEGY_RULE** — não repetir mesma estratégia
13. **STAGE_AWARENESS_RULE** — reconhecer estágio da venda
14. **NOT_A_COLLECTION_CALL_RULE** — não é cobrança genérica
15. **MICRODECISION_RULE** — buscar microdecisão concreta
16. **OBJECTION_READING_RULE** — ler objeções e enrolação
17. **NO_INVENTED_URGENCY_RULE** — não inventar urgência
18. **EMOTIONAL_CONTEXT_INSTRUCTION** — contexto humano e empatia
19. **OWN_LAST_MESSAGE_AWARENESS_INSTRUCTION** — atenção à última mensagem
20. **GUIDELINE_FRAMING_INSTRUCTION** — ordem de decisão em 7 passos
21. **Instruções finais** — cronologia, não inventar, usar detalhes específicos
22. **responseFormatInstruction** — formato JSON de saída

### User Prompt — ordem:

1. Contexto do chat (nome, telefone, lead, status, responsavel, timezone, agora)
2. FATOS TEMPORAIS (última mensagem, último inbound, último outbound, contactedToday, período, tentativas)
3. FOLLOW-UPS RECENTES (audit log compacto)
4. LEMBRETES RELACIONADOS
5. **Histórico completo da conversa** (transcript)
6. Instrução de tarefa ("Interprete a conversa acima e gere o proximo follow-up...")

### Ordem de montagem final (system → user):

```
[SYSTEM] 22 blocos concatenados (ver acima)
[USER] Contexto + Temporais + Audits + Reminders + Transcript + Tarefa
```

**NOTA:** O V2 **removeu** exemplos literais de estilo do user prompt. O `FOLLOW_UP_GENERATION_V2_IMPLEMENTATION.md` confirma: "Exemplos literais do histórico outbound não são enviados ao modelo; só o perfil estatístico de estilo permanece." O test `doesNotMatch(edgeSource, /buildStyleExamples/)` confirma que o generate-follow-up não chama `buildStyleExamples`.

---

## 7. MODELOS E CONFIGURAÇÕES

| Parâmetro | Valor |
|---|---|
| Modelo principal (produção) | **gpt-5.5** (via `ai_routing.tasks.follow_up_generation`) |
| Modelo fallback OpenAI | **gpt-4.1-mini** (default do provider) |
| Provider fallback global | OpenAI (se o primário falhar) |
| Gemini | Desabilitado |
| Claude | Desabilitado |
| `reasoning_effort` | **minimal** (para gpt-5.5, que é deep reasoning task) |
| `temperature` | **0.7** (ou 0.5 se `ai_follow_up_prompt.instructions` não vazio) |
| `maxTokens` | **520** (geração normal), **1400** (variações, 340×N), **320** (refine) |
| `top_p` | Não configurado (padrão do provider) |
| `response_format` | JSON via instruction (não structured output) |
| Timeout | Não configurado explicitamente |
| Retries | 3 tentativas em `callOpenAi` para erros de parâmetro; 1 retry corretivo no follow-up para JSON inválido |
| Fallback automático | Sim — se provider primário falhar, tenta default model, depois outro provider se habilitado |
| Log de modelo efetivo | Sim — `result.provider` e `result.model` retornados e salvos em `comm_follow_up_audit_log` |

---

## 8. STYLE PROFILE E EXEMPLOS

### Implementação:
- `supabase/functions/_shared/comm-whatsapp-transcript.ts` — funções `buildStyleProfile`, `buildStyleProfileText`

### Dados de entrada:
- Últimas **120 mensagens outbound** do chat (apenas `message_type='text'`, não failed, com `text_content` não vazio)
- Ordenação cronológica (ASC por `message_at`), slice de `.slice(-STYLE_SAMPLE_LIMIT)` (últimas 120)

### StyleProfile extraído:
- `avgLengthLabel` — muito curta/curta/média/longa/muito longa
- `greetingPatterns` — saudacao frequente/ocasional/sem
- `closingPatterns` — fechamento frequente/ocasional/sem
- `questionRate` — % de mensagens com "?"
- `usesEmoji` — boolean (>5% usa)
- `formality` — formal/informal/neutro
- `commonOpenings` — primeiras 30 chars das 4 aberturas mais frequentes
- `messageStructure` — multiplas linhas/linha unica/bloco unico
- `avgMessagesPerSession` — estimativa

### O que NÃO entra no style profile:
- Mensagens inbound — **não entram**
- Mensagens de áudio — **não entram** (só `message_type='text'`)
- Mensagens deletadas — **não entram**
- Imagens/vídeos/documentos — **não entram** (só texto)
- Mensagens de sistema — **não entram**
- Cotações — **podem entrar** se estiverem como texto outbound
- Follow-ups antigos — **podem entrar** (sem filtro de tipo)
- Mensagens geradas por IA — **podem entrar** (sem filtro de source)
- Saudações — **podem entrar** (sem filtro semântico)
- Mensagens administrativas — **podem entrar** (sem filtro)

### Curadoria: NÃO EXISTE
- Não há classificação de qualidade
- Não há filtro por função comercial
- Não há avaliação de se a mensagem é um bom exemplo
- Mensagens ruins podem virar exemplo de estilo

### Exemplos literais: REMOVIDOS no V2
- O test `doesNotMatch(edgeSource, /buildStyleExamples/)` confirma que o generate-follow-up não envia exemplos literais ao modelo
- Apenas o `styleProfileText` (estatísticas) é injetado no system prompt
- O suggest-reply (função separada) AINDA usa `buildStyleExamples` e envia até 12 exemplos literais

### Quando é recalculado: a cada chamada (runtime)

---

## 9. ESTADO COMERCIAL

### O que existe (V2):

| Campo | Onde é calculado | Quando | Persiste? | Envia ao follow-up? |
|---|---|---|---|---|
| `stage` | IA (inferência) | A cada chamada | **NÃO** — audit log V2 salva mas não é lido de volta | Não diretamente — a IA infera do zero |
| `blocker` | IA (inferência) | A cada chamada | **NÃO** — audit log V2 salva mas não é lido de volta | Não diretamente |
| `goal` | IA (inferência) | A cada chamada | **NÃO** — audit log V2 salva mas não é lido de volta | Não diretamente |
| `commercialFunction` | IA (inferência) | A cada chamada | **NÃO** — audit log V2 salva | Sim — `getLastUnansweredCommercialFunction` lê dos audits recentes |
| `nextActionOwner` | IA (inferência) | A cada chamada | **NÃO** | Não diretamente — só via JSON output |
| `pendingMicrodecision` | IA (inferência) | A cada chamada | **NÃO** | Não diretamente |
| `decisionMaker` | IA (inferência) | A cada chamada | **NÃO** | Não diretamente |
| `emotionalContext` | IA (inferência) | A cada chamada | **NÃO** | Exibido no modal mas não persistido |
| `rationale` | IA (inferência) | A cada chamada | **NÃO** | Exibido no modal mas não persistido |
| `lastCommercialCommitment` | IA (inferência) | A cada chamada | **NÃO** | Não diretamente |
| `consecutiveOutboundAttempts` | Código determinístico | A cada chamada | **NÃO** | Sim — no user prompt |

### O que NÃO existe:

- **Memória comercial persistida** entre gerações (stage/blocker/goal/descisor/microdecisão descartam entre chamadas)
- **Decisor estruturado** (só inferido pelo transcript)
- **Microdecisão pendente estruturada** (só inferida)
- **Última ação do lead** como dado (só texto do transcript)
- **Trade-off real** como dado (só texto do transcript)
- **Progressão de funis** (não existe pipeline estruturado)

---

## 10. ESTRATÉGIA DE FOLLOW-UP

### Como é escolhida hoje:

**É decidida pelo próprio modelo LLM dentro da mesma chamada.** Não existe uma etapa separada de seleção de estratégia.

O prompt fornece:
1. Uma árvore de decisão de 7 passos (GUIDELINE_FRAMING_INSTRUCTION)
2. Uma progressão sugerida (1ª tentativa → 2ª → 3ª → 4ª)
3. Uma lista de `commercial_function` como enums para a IA escolher
4. Uma lista de `goal` como enums
5. A regra de não repetir a mesma função sem resposta (retry semântico)

O único controle determinístico pós-geração é:
- `getLastUnansweredCommercialFunction()` — se a IA repetiu a mesma `commercial_function` do último audit sem resposta, faz 1 retry pedindo mudança
- `hasRecentOutboundWithoutInbound()` — se há outbound recente (<12h) sem resposta, força `wait`
- Lead `perdido`/`convertido`/`fechado`/`duplicado` → sempre `wait`

### Enum de `commercial_function` (14 valores):

```
retomar_contexto, obter_microdecisao, reduzir_opcoes, remover_atrito,
esclarecer_objecao, diagnosticar_bloqueio, cobrar_acao_combinada,
confirmar_decisao, facilitar_documentacao, retomar_em_data_combinada,
obter_posicionamento, reativar, encerrar_elegantemente, nenhuma
```

### Enum de `goal` (11 valores):

```
retomar_conversa, obter_preferencia, reduzir_objecao, descobrir_bloqueio,
confirmar_decisao, solicitar_documentos, avancar_proposta, definir_vigencia,
envolver_decisor, reativar_oportunidade, encerrar_sem_pressao
```

### Enum de `stage` (11 valores):

```
qualificacao, cotacao_apresentada, avaliando_opcoes, objecao,
aguardando_decisor, sinal_de_compra, aguardando_acao, proposta_em_andamento,
reativacao, pos_venda, outro
```

### Enum de `blocker` (10 valores):

```
preco, inseguranca, comparacao, terceiro_decisor, sem_urgencia,
falta_de_informacao, acao_nao_executada, silencio, contexto_pessoal,
nao_identificado
```

---

## 11. VALIDAÇÃO

### Após geração, acontece:

1. **Parse JSON** — tenta extrair `aiContext` + `text`/`variations`
2. **Validação de schema** — `isValidFollowUpGenerationResult()`:
   - Se variações: precisa ter pelo menos 1 variação com texto
   - Se normal: precisa ter `currentAction === 'wait'` OU `text` não vazio
3. **Retry para JSON inválido** — 1 chamada corretiva com instrução de formato
4. **Retry semântico** — se `commercialFunction` repete a do último audit sem resposta, 1 retry com instrução explícita de mudança; se repetir novamente, lança `FollowUpValidationError`
5. **Proteção outbound recente** — se há outbound sem inbound em <12h e não há custom instructions, força `wait`
6. **Normalização de saudação** — `normalizeGreetingForTemporalFacts` ajusta "bom dia/tarde/noite" baseado no período

### O que NÃO existe como validação:

- ❌ Validação de genéricidade (e.g., "conseguiu analisar?")
- ❌ Validação de pergunta repetida
- ❌ Validação de informação já conhecida
- ❌ Validação de comprimento adequado
- ❌ Validação de tom
- ❌ Validação de CTA adequado
- ❌ Validação de microdecisão adequada
- ❌ Validação de estágio correto
- ❌ Segunda chamada de IA (critique/revision)
- ❌ Regex ou regras determinísticas de conteúdo
- ❌ Score de qualidade
- ❌ Regeneração automática
- ❌ Validação de coerência texto ↔ nextAction

---

## 12. REGENERAÇÃO

Quando o usuário clica "Gerar novamente":

- **Sim**, o sistema sabe que a versão anterior foi gerada (gera nova chamada)
- **NÃO**, a mensagem rejeitada **não é salva** como rejeitada
- **NÃO**, não existe feedback de rejeição persistido
- **NÃO**, o modelo **não recebe** informação de que a versão anterior foi rejeitada
- A nova chamada é idêntica à anterior (mesmo prompt, mesmo contexto)
- Não há histórico de versões
- Não há tentativa de estratégia diferente

---

## 13. FEEDBACK E APRENDIZADO

### O que existe:

| Evento | É armazenado? |
|---|---|
| Mensagem gerada | Sim — `comm_follow_up_audit_log.generated_text` |
| Mensagem enviada | Parcialmente — `comm_follow_up_audit_log.sent_text` (V2) |
| Data de envio | Parcialmente — `comm_follow_up_audit_log.sent_at_actual` (V2) |
| Aprovação humana | **NÃO** — não existe campo de aprovação no audit log individual |
| Edição antes de envio | **NÃO** — não é rastreado |
| Resposta do cliente | Sim — calculado em runtime comparando timestamps |
| Venda avançou | **NÃO** |
| Venda fechou | **NÃO** |

### O que NÃO existe:

- Feedback loop de aprovação/reprovação
- Seleção de bons exemplos baseada em sucesso
- Aprendizado entre gerações
- Métricas de taxa de resposta por estratégia
- Correlação entre tipo de follow-up e resultado

---

## 14. TESTES E EVALS

### Testes existentes:

| Arquivo | Tipo | Casos |
|---|---|---|
| `comm-whatsapp-follow-up-commercial-thread.test.ts` | Unit test | 7 testes de validação textual da regra de fio comercial |
| `comm-whatsapp-follow-up-v2-contract.test.ts` | Contract test | 4 testes que validam que o código fonte contém padrões V2 esperados |

### O que NÃO está testado:

- ❌ Geração de conteúdo (sem mock de IA)
- ❌ Qualidade comercial da mensagem gerada
- ❌ Contextualização (se a mensagem usa detalhes reais)
- ❌ Não repetição semântica
- ❌ Progressão de funis
- ❌ Leitura de decisor
- ❌ Leitura de objeção
- ❌ Adequação de estágio
- ❌ Naturalidade do texto
- ❌ Integração end-to-end com conversation real
- ❌ Fallback behavior
- ❌ Retry semântico
- ❌ Proteção outbound recente

### Evals de qualidade: **NÃO EXISTEM**

- Não há suíte de avaliação de qualidade comercial
- Não há critérios de eval (contextualização, continuidade, personalização, etc.)
- Não há comparação com resposta ideal
- Não há benchmarking

---

## 15. DRY-RUN DO CASO FERNANDA

### Dados que seriam carregados:

**Chat:** Fernanda Muzitano Reis — phone_number, display_name, lead_id (vinculado)

**Lead:**
- `nome_completo`: Fernanda Muzitano Reis (ou similar)
- `telefone`: (telefone dela)
- `status`: (provavelmente "Contato Inicial" ou "Em Analise")
- `responsavel`: Luiza
- `cidade`: **NÃO** disponível como campo estruturado

**Mensagens:** Todas do transcript acima (12 mensagens inbound+outbound)

### Style Profile:
- Baseado nas últimas 120 outbounds de Fernanda
- Luiza escreve mensagens curtas, 1-2 frases, com emojis ocasionais

### Temporal Facts:
- Última mensagem: "Perfeito. Obrigada" (Fernanda, 13:52, 01/09)
- Último inbound: "Perfeito. Obrigada" (13:52)
- Último outbound: "Perfeito, Fernanda! Se ele ficar em dúvida..." (13:37)
- contactedToday: true (01/09)
- periodOfDay: tarde
- consecutiveOutboundAttempts: 2 (proposta + Assim + "Entre essas opções" = 1 tentativa com 3 mensagens; depois "Perfeito, Fernanda!" = 2ª tentativa)

### Contexto que a IA veria:

```
[09:27] Eu: Oi Fernanda, tudo bem? Sou a Luiza Kifer...
[09:27] Eu: Vi que você demonstrou interesse...
[09:27] Eu: Você busca um plano só para você ou...
[10:13] Fernanda: Para meu filho
[10:14] Fernanda: De 25 anos
[11:55] Eu: Perfeito, Fernanda! Ele mora em qual cidade?
[12:22] Fernanda: Cabo Frio
[12:22] Eu: Certo, ele já tem plano de saúde hoje...
[12:59] Fernanda: Não tem
[13:05] Eu: Ótimo! Vou montar sua cotação agora...
[13:07] Eu: Fernanda, terminei a cotação... R$ 490,75...
[13:08] Eu: R$ 490,75 ficou dentro do que você imaginava...
[13:22] Fernanda: Estou vendo outros planos também
[13:25] Eu: Fernanda, como você comentou que está olhando...
[13:27] Eu: Entre essas opções, qual ficou mais próxima...
[13:29] Fernanda: Sim. Vou passar pra ele
[13:37] Eu: Perfeito, Fernanda! Se ele ficar em dúvida...
[13:52] Fernanda: Perfeito. Obrigada
```

### Audit log (recentes):
- Nenhum follow-up auditado anteriormente para este chat (primeira geração)

### Audit log — últimos follow-ups:
- `Nenhum follow-up auditado anteriormente.`

### Prompt que seria montado:
- System: 22 blocos (ver seção 6)
- User: contexto + fatos temporais + "Nenhum follow-up auditado anteriormente" + "Nenhum lembrete relevante" + transcript + "Gere o proximo follow-up mais adequado"

### Modelo:
- gpt-5.5, reasoning_effort minimal, temperature 0.7, maxTokens 520

### Por que o resultado foi genérico:

1. **Ausência de memória comercial estruturada**: A IA não tem "Fernanda não é decedora, o plano é para o filho de 25 anos, ela disse que vai passar para ele, surgiu um terceiro participante". Tudo isso está no transcript, mas a IA precisa "enxergar" isso em meio a 18 linhas de conversa.

2. **Ausência de microdecisão persistida**: A IA não sabe que a última microdecisão foi "Fernanda apresentar as opções ao filho" — precisa inferir a cada chamada.

3. **Ausência de nextActionOwner estruturado**: A IA não tem "actor=Fernanda, third_party=filho" — precisa inferir do transcript.

4. **Prompt genérico demais**: São 22+ blocos de regras concorrentes. A IA precisa equilibrar: fio comercial, não repetição, microdecisão, contexto humano, fatos temporais, estilo, formato JSON. Em 520 tokens de saída, a mensagem tende a ser superficial.

5. **Ausência de dados do lead**: A cidade (Cabo Frio), idade (25 anos), plano atual (não tem) — tudo está no transcript mas não como dados estruturados que a IA possa usar diretamente.

6. **Style profile sem filtro**: O estilo de Luiza é curto e direto, mas isso não ajuda a IA a escolher a estratégia comercial correta.

7. **Ausência de validação pós-geração**: "Conseguiu olhar?" e "ficou alguma dúvida?" são validados apenas se a IA escolher a commercial_function correta — mas a IA não tem memória de que já tentou algo similar.

---

## 16. PONTOS DE FRAGILIDADE

| # | Fragilidade | Severidade | Evidência no código |
|---|---|---|---|
| 1 | **Única chamada faz análise + estratégia + redação** — sem separação de etapas | **CRÍTICA** | `index.ts:1619-1626` — uma chamada `generateTextWithRouting` faz tudo |
| 2 | **Ausência de memória comercial estruturada persistida** — stage/blocker/goal/decisor/microdecisão são recalculados a cada chamada e descartados | **CRÍTICA** | Audit log V2 salva mas NUNCA é lido de volta para contexto da IA |
| 3 | **Ausência de microdecisão estruturada persistida** — a IA precisa inferir "qual é a menor decisão" a cada chamada sem saber qual foi a última pedida | **CRÍTICA** | `pendingMicrodecision` é output da IA, não input para próxima chamada |
| 4 | **Ausência de nextActionOwner estruturado** — quem deveria agir (Fernanda → filho) não é persistido | **ALTA** | `nextActionOwner` é output da IA, não input |
| 5 | **Ausência de decision_maker estruturado** — quem decide (filho de 25 anos) não é persistido | **ALTA** | `decisionMaker` é output da IA, não input |
| 6 | **Ausência de validação pós-geração** — mensagens genéricas, repetidas ou inadequadas passam sem filtro | **ALTA** | Sem regex, sem score, sem segunda chamada de IA |
| 7 | **Ausência de dados do lead no prompt** — cidade, idade, plano atual, beneficiários não são injetados | **ALTA** | `loadLeadContext` carrega mas `baseContextPrompt` não usa cidade/email/origem |
| 8 | **Reasoning effort "minimal"** — gpt-5.5 com reasoning mínimo pode pular raciocínio profundo | **MÉDIA** | `ai-router.ts:376` — `needsDeepReasoning ? 'minimal' : 'none'` |
| 9 | **Ausência de histórico de estratégias persistido entre sessões** — audit log V2 tem commercial_function mas não é usado como contexto de entrada | **ALTA** | `getLastUnansweredCommercialFunction` lê apenas o último sem resposta |
| 10 | **Style profile pode estar contaminado** — follow-ups antigos, cotações, mensagens automáticas entram na amostra | **MÉDIA** | `comm-whatsapp-transcript.ts:115-118` — sem filtro por tipo de mensagem |
| 11 | **Prompt com 22+ blocos concorrentes** — sobrecarga cognitiva do modelo | **MÉDIA** | System prompt com ~4000+ tokens de regras |
| 12 | **Ausência de feedback loop** — aprovação/reprovação/edição da Luiza não é rastreada | **ALTA** | Nenhum campo de feedback no audit log |
| 13 | **Ausência de evals** — sem métrica de qualidade comercial | **ALTA** | Nenhum teste de conteúdo, nenhum benchmark |
| 14 | **maxTokens baixo (520)** — pode limitar raciocínio complexo em conversas longas | **MÉDIA** | `index.ts:1610` — 520 tokens para output JSON + texto |
| 15 | **hasRecentOutboundWithoutInbound pode silenciar follow-ups legítimos** — 12h é arbitrário | **BAIXA** | `index.ts:100` — RECENT_OUTBOUND_WAIT_MS = 12h fixo |
| 16 | **Ausência de shouldSendNow determinístico** — IA decide enviar mas não há validação temporal independente | **MÉDIA** | Documentado em `FOLLOW_UP_GENERATION_CURRENT_STATE.md` seção F |

---

## 17. ARQUIVOS QUE PROVAVELMENTE TERÃO DE SER ALTERADOS

| Arquivo | Função | Por que seria alterado | Risco | Dependências |
|---|---|---|---|---|
| `supabase/functions/comm-whatsapp-generate-follow-up/index.ts` | Edge Function principal | Separar análise/estratégia/redação; injetar memória comercial estruturada; adicionar validação pós-geração | **ALTO** — altera behavior de produção | ai-router, transcript, audit log, reminders |
| `supabase/functions/_shared/ai-router.ts` | Roteador de IA | Possível nova task type; ajustar reasoning effort; adicionar modelo mais potente para análise | **MÉDIO** — infra compartilhada | Todos os consumidores de IA |
| `supabase/functions/_shared/comm-whatsapp-transcript.ts` | Transcript + style profile | Filtrar style profile; enriquecer transcript com dados estruturados | **MÉDIO** | generate-follow-up, suggest-reply, autonomous-reply, sandbox |
| `supabase/migrations/*_add_commercial_state_to_leads_or_new_table.sql` | Migration nova | Criar tabela/colunas de memória comercial persistida | **ALTO** — nova tabela ou colunas | Toda a stack que lê lead state |
| `supabase/functions/comm-whatsapp-generate-follow-up/index.ts` | Prompt blocks | Redesenhar prompts para 2+ etapas; reduzir carga cognitiva | **ALTO** — afeta qualidade | Modelo, validação |
| `src/features/communication/whatsapp/components/WhatsAppFollowUpModal.tsx` | Modal individual | Exibir memória comercial; mostrar estágio/bloqueio; validação pós-geração | **MÉDIO** | Edge Function |
| `src/features/communication/whatsapp/components/WhatsAppBatchFollowUpModal.tsx` | Modal lote | Filtrar wait; revisão de memória comercial | **MÉDIO** | Edge Function |
| `supabase/functions/_shared/comm-whatsapp-follow-up-commercial-thread.ts` | Regra de fio | Pode ser expandida ou substituída por memória estruturada | **BAIXO** | Prompt |
| `supabase/functions/comm-whatsapp-suggest-reply/index.ts` | Sugerir resposta | Compartilhar memória comercial; usar mesmo state | **BAIXO** | Independente |
| `src/lib/commWhatsAppService.ts` | Service frontend | Tipar novos campos de memória comercial | **BAIXO** | UI |

---

## 18. INFORMAÇÕES QUE AINDA FALTAM

Nenhuma informação inacessível foi identificada. Todos os arquivos relevantes foram lidos por completo. O sistema é inteiramente acessível via código-fonte.

Pontos que merecem investigação adicional (mas são acessíveis):
- Conteúdo atual de `integration_settings` com `slug='ai_follow_up_prompt'` em produção (para saber se há personalização ativa)
- Conteúdo atual de `ai_routing.tasks.follow_up_generation` em produção (confirmar modelo exato)
- Logs de produção da Edge Function (para verificar taxa de fallback, erros de parsing, etc.)
- Dados reais de `comm_follow_up_audit_log` para validar se a taxonomia V2 está sendo preenchida corretamente pela IA

---

## REFERÊNCIAS

### Documentação existente no repositório:

- `FOLLOW_UP_GENERATION_V2_IMPLEMENTATION.md` — documenta a implementação V2 de 01/09/2026
- `FOLLOW_UP_GENERATION_CURRENT_STATE.md` — auditoria completa do estado anterior à V2
- `AGENTS.md` — memória de projeto e decisões acumuladas
- `docs/plano-acao-4-etapas.md` — plano de ação referenciado
- `docs/auditoria-whapi-inbox-2026-07-29.md` — auditoria da integracao Whapi

### Migrations relevantes:

- `20260911419000_add_comm_follow_up_audit_log.sql` — criação da tabela de audit
- `20261001002000_add_follow_up_v2_audit_and_reminder_provenance.sql` — expansão V2
- `20260911386000_schedule_follow_up_reminder_rpc.sql` — RPC de agenda
- `20260911418000_add_comm_whatsapp_pending_follow_up_chats_rpc.sql` — RPC de chats pendentes

---

*Documento gerado automaticamente a partir de auditoria técnica do código-fonte. Nenhum código foi alterado.*
