# Central de IA — Kifer Saude CRM

## Visão Geral da Arquitetura

O sistema de IA do CRM Kifer Saude é composto por **12 features** que usam inteligência artificial para differentes tarefas. Toda configuração dessas features (prompts, parâmetros, comportamento) é editável pela tela **Configurações > IA** sem alterar código.

### Features Existentes

| Feature Key | Nome | Tipo | Função |
|------------|------|------|--------|
| `autonomous.reply` | Resposta Autônoma | text | Responde automaticamente mensagens inbound (persona Luiza) |
| `followup.analysis` | Análise Comercial | structured_output | Analisa conversa e define estratégia de follow-up |
| `followup.generate` | Gerar Follow-up | structured_output | Gera mensagem de follow-up |
| `followup.refine` | Refinar Follow-up | text | Refina mensagem existente com ajustes do operador |
| `message.suggest` | Sugerir Resposta | text | Sugere próxima mensagem no composer |
| `message.rewrite` | Reescrever Mensagem | text | Reescreve mensagem com tom/naturalidade melhor |
| `attendance.critique` | Avaliar Atendimento | structured_output | Audita qualidade do atendimento humano |
| `campaign.intent` | Classificar Intenção | structured_output | Classifica respostas de campanhas WhatsApp |
| `agenda.organize` | Organizar Agenda | structured_output | Prioriza follow-ups pendentes com scoring |
| `audio.transcribe` | Transcrever Áudio | transcription | Transcreve áudios do WhatsApp |
| `sandbox.chat` | Chat Sandbox | text | Simulação interativa para testes |
| `sandbox.scenario` | Cenário Automatizado | structured_output | Teste automatizado multi-turn |

---

## Camadas de Prompt (Prompt Composition)

O system prompt de CADA feature é composto em camadas, nesta ordem:

```
CAMADA 1: Instruções Globais (Closer PRO persona)
    ↓
CAMADA 2: Estilo Global (regras de comunicação WhatsApp)
    ↓
CAMADA 3: Prompt da Feature (instruções específicas)
    ↓
CAMADA 4: Instruções de Saída (formato de resposta)
    ↓
CAMADA 5: Instruções Customizadas (do operador, se houver)
    ↓
= SYSTEM PROMPT final
```

Cada feature pode desativar as Camadas 1 e 2 individualmente.

---

## Campos da Tela de Configurações — Explicação Detalhada

### 1. Instruções Globais

- **O que controla:** Texto livre que define a "personalidade base" do Closer PRO
- **Onde é usado:** Toda feature com `use_global_instructions = true`
- **Efeito prático:** A IA recebe esse texto como PRIMEIRA parte do system prompt. Define quem ela é e qual seu objetivo geral.
- **Escopo:** GLOBAL — afeta todas as features com a flag ativa
- **Exemplo de conteúdo:** "Você é um copiloto comercial especializado em vendas de planos de saúde. Seu objetivo é ajudar o corretor a avançar a venda de forma estratégica e humana."
- **Combinação:** Junto com Estilo Global, forma o contexto base compartilhado

### 2. Estilo Global

- **O que controla:** Regras de comunicação e escrita (tom, formalidade, tamanho, emojis)
- **Onde é usado:** Toda feature com `use_global_style = true`
- **Efeito prático:** Afeta COMO a IA escreve, não O QUE escreve. Regras como "evite linguagem robótica", "não use excesso de emojis", "respeite o estilo da conversa anterior"
- **Escopo:** GLOBAL
- **Combinação:** Segunda camada, após Instruções Globais

### 3. Prompt da Feature

- **O que controla:** Instruções ESPECÍFICAS de cada funcionalidade
- **Onde é usado:** Cada Edge Function carrega via `loadFeatureConfig()` e usa o campo `featurePrompt`
- **Efeito prático:** Define o "papel" da IA naquela feature específica
- **Escopo:** POR FEATURE — cada uma tem o seu
- **Exemplos:**
  - `autonomous.reply`: "Você é a Luiza, corretora especialista em planos de saúde da Kifer Saude, falando no WhatsApp..."
  - `followup.generate`: "Sua tarefa é escrever a mensagem de follow-up que executa exatamente a estratégia definida..."
  - `message.rewrite`: "Reescreva a mensagem mantendo a intenção, melhorando a naturalidade..."
- **Combinação:** Terceira camada. É onde a maioria das customizações deve acontecer
- **Dica:** Pode usar variáveis `{{nome}}`, `{{transcript}}` etc. que são substituídas pelo sistema

### 4. Instruções de Saída

- **O que controla:** O FORMATO que a IA deve retornar
- **Onde é usado:** Incluída como quarta camada do system prompt
- **Efeito prático:** Define se a IA retorna JSON, texto puro, ou schema específico
- **Escopo:** POR FEATURE
- **Exemplos:**
  - `autonomous.reply`: "Retorne a resposta em texto puro, usando '---' para separar mensagens."
  - `campaign.intent`: "Retorne somente JSON válido, sem markdown."
  - `attendance.critique`: "Retorne SOMENTE um objeto JSON válido com resumo, avaliação, pontos fortes, pontos de atenção e erros."
- **Combinação:** Funciona junto com o `taskType` da feature (que define se o sistema espera JSON ou texto)

### 5. Temperature

- **O que controla:** Quanto a IA é "criativa" vs "determinística"
- **Onde é usado:** Passado diretamente para a API da OpenAI como parâmetro `temperature`
- **Efeito prático:**
  - `0.0 - 0.2`: Quase determinística — para classificação e transcrição
  - `0.3 - 0.5`: Moderada — análise e reescrita
  - `0.6 - 0.7`: Criativa — geração de texto, respostas autônomas
  - `0.8+`: Muito criativa (raramente usado)
- **Escopo:** POR FEATURE
- **Valores atuais por feature:**
  - `campaign.intent`: 0.1 (classificação precisa)
  - `followup.analysis`: 0.3 (análise objetiva)
  - `message.rewrite`: 0.45 (reescrita criativa mas controlada)
  - `autonomous.reply`: 0.6 (resposta natural)
  - `followup.generate`: 0.7 (geração criativa)
  - `agenda.organize`: 0.15 (scoring determinístico)

### 6. Max Tokens

- **O que controla:** Tamanho máximo da resposta da IA (em tokens)
- **Onde é usado:** Passado como `max_tokens` para a API
- **Efeito prático:** Limita quanto a IA pode escrever
  - 280 tokens ≈ 1-2 mensagens curtas (`campaign.intent`)
  - 350 tokens ≈ 2-3 mensagens (`autonomous.reply`)
  - 520 tokens ≈ resposta de follow-up (`followup.generate`)
  - 900 tokens ≈ análise completa (`followup.analysis`)
  - 1800 tokens ≈ resposta longa (`agenda.organize`)
- **Escopo:** POR FEATURE

### 7. Variáveis Disponíveis

Placeholders que o sistema substitui pelos dados reais antes de enviar o prompt à IA.

| Variável | O que é | Onde é usado |
|----------|---------|-------------|
| `{{transcript}}` | Histórico completo da conversa WhatsApp | Todas as features conversacionais |
| `{{style_profile}}` | Regras de estilo aprendidas do operador | Follow-up, sugestão, resposta autônoma |
| `{{reference_prompt}}` | Respostas rápidas + situações similares | Resposta autônoma, sandbox |
| `{{lead_name}}` | Nome do lead | Features que precisam se referir ao lead |
| `{{temporal_facts}}` | Datas, horários, intervalos | Follow-up, análise |
| `{{lead_context}}` | Dados do lead no CRM | Follow-up, análise, resposta autônoma |
| `{{current_message}}` | Mensagem atual para refinar | Refinamento |
| `{{adjustment_instruction}}` | Instrução de ajuste do operador | Refinamento |
| `{{original_text}}` | Texto a ser reescrito | Reescrita |
| `{{tone}}` | Tom desejado | Reescrita |
| `{{draft_text}}` | Rascunho do operador | Sugestão |

**No sistema:** As variáveis são interpoladas pelo `PromptComposer` (`prompt-composer.ts`). O suporte é `{{snake_case}}` e `{{camelCase}}` (conversão automática).

### 8. Versões Anteriores

- **O que é:** Histórico de todas as configurações salvas para aquela feature
- **No banco:** Tabela `ai_feature_configs` com coluna `version` incrementando
- **Regra:** Apenas UMA versão pode ter `is_active = true` por feature
- **Funcionalidade:** Permite ver data de criação, comparar, e restaurar (que cria nova versão baseada na antiga)

### 9. Valores Padrão (System)

- **O que são:** Fallbacks em código definidos em `ai-feature-registry.ts`
- **Quando são usados:** Quando NÃO existe configuração ativa no banco
- **Garantia:** O sistema funciona mesmo sem nenhuma configuração salva — é o comportamento "de fábrica"
- **No código:** `ai-config-resolver.ts` → `buildDefaultConfig()` retorna esses valores

### 10. Restaurar Padrão

- **O que é:** Botão que reseta os campos do editor para os valores "de fábrica"
- **Efeito prático:** Preenche a interface com os defaults. NÃO salva automaticamente — precisa clicar "Salvar" depois
- **Não perde:** O histórico de versões continua intacto

### 11. Salvar Versão e Ativar

- **O que faz:** Cria uma nova linha em `ai_feature_configs` com `version + 1` e `is_active = true`
- **Efeito prático:** A partir desse momento, toda chamada àquela feature usa a nova config
- **Cache:** O cache TTL de 60s é invalidado, então a mudança reflete em até 1 minuto

### 12. Feature Key

- **O que é:** Identificador estável e imutável de cada funcionalidade
- **Exemplo:** `autonomous.reply`
- **Onde é usado:** No registry, no banco, e em toda chamada de Edge Function
- **NUNCA muda:** Mesmo que o nome ou descrição sejam alterados, a key permanece

### 13. Modelo de IA

- **Onde é configurado:** NÃO na tela de IA. É em **Configurações > Integrações** na seção de roteamento de IA
- **Tabela:** `integration_settings` com slug `ai_routing`
- **No código:** `ai-router.ts` → `loadAiRuntimeConfig()` carrega de `integration_settings`
- **Efeito prático:** O modelo usado é o configurado para aquela "task" no roteamento global
- **Configuração por task:** Cada task (`autonomous_attendance`, `follow_up_generation`, etc.) tem provider + model + fallback definidos no roteamento

---

## Fluxo Completo: Exemplo `autonomous.reply`

Quando uma mensagem inbound chega e o worker gera uma resposta automática:

```
1. WORKER BUSCA A CONFIG
   loadFeatureConfig(supabaseAdmin, 'autonomous.reply')
   → Retorna: { featurePrompt, temperature: 0.6, maxOutputTokens: 350, ... }

2. WORKER MONTA O SYSTEM PROMPT
   systemPrompt = [
     autonomousConfig.featurePrompt,     ← "Você é a Luiza, corretora..."
     '',
     buildStylePrompt(styleMessages),     ← Regras de estilo do operador
     referenceBlock                       ← Respostas rápidas + situações similares
   ].join('\n')

3. WORKER MONTA O USER PROMPT
   userPrompt = buildReplyUserPrompt(history, { leadFirstName, isFirstReply })
   → Histórico formatado como "LEAD: ...\nVOCE: ..."

4. WORKER CHAMA A IA
   generateTextWithRouting({
     task: 'autonomous_attendance',
     systemPrompt,
     userPrompt,
     temperature: 0.6,
     maxTokens: 350,
   })

5. O AI-ROUTER RESOLVE O MODELO
   → Busca em integration_settings o provider/model para 'autonomous_attendance'
   → Geralmente: openai / gpt-4o-mini
   → Se falhar, tenta fallback

6. RESPOSTA VOLTA
   → text: "Oi, tudo bem? Vi que você tem interesse..."
   → Worker divide em mensagens separadas por "---"
   → Envia para o WhatsApp
```

---

## Fluxo Visual Simplificado

```
┌─────────────────────────────────────────────────┐
│              INSTRUÇÕES GLOBAIS                  │
│    (se use_global_instructions = true)           │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│               ESTILO GLOBAL                      │
│       (se use_global_style = true)               │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│            PROMPT DA FEATURE                     │
│     (featurePrompt do banco de dados)            │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│          INSTRUÇÕES DE SAÍDA                     │
│     (outputInstructions do banco)                │
└─────────────────────┬───────────────────────────┘
                      │
                      ▼
              SYSTEM PROMPT final
                      │
┌─────────────────────▼───────────────────────────┐
│            USER PROMPT                           │
│  (histórico + contexto + variáveis resolvidas)   │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│          PARÂMETROS                              │
│  temperature: 0.6    maxTokens: 350             │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│          MODELO DE IA                            │
│  (resolvido pelo ai-router em integration_settings) │
│  provider: openai    model: gpt-4o-mini          │
└─────────────────────┬───────────────────────────┘
                      │
                      ▼
              RESPOSTA DA IA
```

---

## Tabelas do Banco de Dados

### `ai_features`
Registry de todas as features. Dados estáticos (nome, key, categoria, defaults).

### `ai_feature_configs`
Configurações versionadas por feature. Cada linha é uma versão. Apenas uma tem `is_active = true`.

### `ai_global_configs`
Configurações globais (instruções Closer PRO, estilo). Schema simples: key → value.

### `ai_config_versions`
Snapshots imutáveis para histórico e rollback.

---

## Cache

- **TTL:** 60 segundos em memória
- **Invalidação:** Quando "Salvar e ativar" é chamado
- **Fallback:** Se o banco estiver indisponível, usa defaults do registry em código

---

## Pontos Importantes

1. **O modelo NÃO é configurado na tela de IA** — é em Configurações > Integrações > Roteamento de IA
2. **Temperature e Max Tokens são parâmetros da chamada** — não afetam o modelo escolhido
3. **Variáveis no prompt são seguras** — o sistema não faz interpolação recursiva (se o conteúdo do cliente tiver `{{algo}}`, não é reprocessado)
4. **Uma feature pode desativar as globais** — desmarcando "Usar Instruções Globais" ou "Usar Estilo Global"
5. **O PromptComposer não é usado por todas as features** — algumas montam o prompt manualmente (como `autonomous.reply`)
6. **Fallback automático** — se a config do banco falhar, o sistema usa os defaults em código
