# AI Token Audit

Auditoria executada sobre o commit-base `320c47db6acd6adbb9f4b2a62d1fd72d9a7f1a17`, com inspeção estática do repositório e leitura somente de metadados/configuração/telemetria do ambiente Supabase. A fotografia de produção cobre 349 chamadas lógicas entre 2026-09-06 15:11 e 2026-09-10 12:39. Nenhuma chave, mensagem ou documento sensível foi copiado para este relatório.

As estimativas de prompt usam aproximadamente 4 caracteres por token quando não há métrica do provedor. Números de produção têm prioridade sobre essa aproximação.

# Resumo executivo

O projeto tinha 12 features registradas de IA, 11 habilitadas, 18 pontos estáticos de invocação de modelo e um servidor MCP para uso pelo ChatGPT. O runtime possuía três adapters, embora toda a configuração ativa de produção já apontasse para OpenAI e as integrações dos outros provedores estivessem desativadas e sem chave.

O maior custo é inequivocamente a leitura de PDFs de contrato. Em apenas 7 chamadas, ela consumiu 6.239.127 tokens, 80,7% de todos os tokens medidos. Cada leitura usou em média cerca de 891 mil tokens de entrada porque até quatro PDFs, com até 28 MB no total, eram enviados integralmente à Responses API. Um retry repetia os documentos completos.

O segundo foco é follow-up. O fluxo normal faz duas inferências — geração e revisão semântica — e cada etapa pode repetir uma vez. O histórico completo é enviado nas duas etapas. A revisão é necessária para a qualidade comercial; o desperdício está na repetição de política/contexto e em retries de contrato de saída, não na existência da revisão.

O terceiro foco é atendimento autônomo: histórico de até 100 mensagens, referências de até 120 mensagens, até duas tentativas e uma segunda chamada lógica quando o texto contém apenas uma tag técnica. Uma ação pode gerar até quatro chamadas de texto, além de uma transcrição.

Nesta implementação:

- o runtime, banco e UI foram reduzidos a OpenAI;
- Structured Outputs foi aplicado a extração de contrato, validação de follow-up, intenção de campanha e ranking de agenda;
- extração de contrato e agenda ficaram limitadas a uma tentativa cara, com fallback determinístico onde já existia;
- a duplicação da mensagem de campanha foi removida;
- o caminho de leitura de `cached_tokens` foi corrigido;
- o payload máximo do MCP foi reduzido e seus defaults de paginação ficaram menores;
- nenhum corte agressivo de histórico comercial foi feito.

# Mapa de IA

| # | Funcionalidade | Feature | Entrada principal | Ponto(s) de chamada | Estado |
|---:|---|---|---|---:|---|
| 1 | Gerar follow-up | `followup.generate` | histórico completo, lead, datas, auditorias, lembretes, estilo | 2 | ativo |
| 2 | Refinar follow-up | `followup.refine` | histórico completo, mensagem atual, ajuste | 1 | ativo |
| 3 | Resposta autônoma | `autonomous.reply` | até 100 mensagens, respostas rápidas, exemplos de estilo | 2 caminhos | ativo |
| 4 | Chat sandbox | usa `autonomous.reply` | histórico de sandbox e referências | 1 | ativo, sem feature própria |
| 5 | Cenário automatizado | `sandbox.scenario` + `autonomous.reply` | persona, histórico crescente, juiz final | 4 sites em loop | ativo/teste |
| 6 | Sugestão de resposta | `message.suggest` | até 80 mensagens, rascunho, estado comercial | 1 | ativo/manual |
| 7 | Reescrita | `message.rewrite` | texto, ajuste, até 24 mensagens opcionais | 1 | ativo/manual |
| 8 | Crítica de atendimento | `attendance.critique` | sessão recente extraída de até 250 mensagens | 1 | ativo/manual |
| 9 | Transcrição de áudio | `audio.transcribe` | áudio e prompt curto | 2 chamadores | ativo/manual e automático |
| 10 | Classificação de intenção | `campaign.intent` | mensagem inbound e últimas 8 mensagens | 1 | ativo/evento |
| 11 | Organização de agenda | `agenda.organize` | até 35 candidatos, 10 mensagens por chat | 1 | ativo/manual |
| 12 | Extração de contrato | `contract.document_extract` | até 4 PDFs/28 MB e perfil | 1 | ativo/manual |
| 13 | Análise comercial antiga | `followup.analysis` | histórico/contexto | 0 atual | desabilitado/deprecated |
| 14 | MCP somente leitura | `chatgpt-mcp` | registros do CRM devolvidos ao ChatGPT | sem inferência interna | ativo quando conectado |

Os 18 sites de inferência ficam em `comm-whatsapp-generate-follow-up` (3), `ai-autonomous-reply-worker` (3, contando transcrição), `ai-sandbox-run-scenario` (4), `ai-sandbox-chat` (1), `comm-whatsapp-suggest-reply` (1), `comm-whatsapp-rewrite-message` (1), `comm-whatsapp-critique-attendance` (1), `comm-whatsapp-transcribe` (1), `comm-whatsapp-campaign-worker` (1), `organize-follow-up-agenda` (1) e `contract-document-extract` (1).

Além deles, `list-ai-models` e `sync-ai-models` chamam a API de catálogo da OpenAI, mas não executam inferência e não consomem tokens de geração.

# Fluxo de cada funcionalidade

## 1. Geração e refinamento de follow-up

- Arquivo: `supabase/functions/comm-whatsapp-generate-follow-up/index.ts`, regiões 840–1.540.
- Chamadores: telas/modal de follow-up individual e em lote no domínio WhatsApp/lembretes.
- Execução: manual; no lote, uma execução independente por item selecionado.
- Fluxo: request → autenticação → chat/lead → todas as mensagens paginadas em lotes de 1.000 → auditorias/lembretes/configuração/estilo → montagem do prompt → geração → validação estrutural → revisão semântica por IA → parsing → auditoria/agendamento → resposta.
- Fixo: prompt de feature (~3.084 tokens na versão ativa), regras de fio comercial, runtime guardrails, formato de saída e prompt do validador.
- Variável: transcript completo, dados do lead, fatos temporais, 8 auditorias, 8 lembretes, perfil de estilo e instrução do operador.
- Modelo ativo observado: OpenAI `gpt-5.6-sol`, temperatura 0,7 quando suportada, `max_output_tokens=1800`, reasoning `high`.
- Chamadas: normal 2; máximo 4 com os dois retries. Refinamento usa 1 chamada lógica.
- Saída: mensagem curta ou sinal `WAIT`; revisão retorna JSON. A revisão agora usa JSON Schema estrito.
- Token necessário: fatos distintos do histórico e revisão semântica. Token desperdiçado: política extensa repetida na entrada do validador, contexto duplicado entre as duas chamadas e retry integral por erro puramente sintático.

## 2. Atendimento autônomo

- Arquivo: `supabase/functions/ai-autonomous-reply-worker/index.ts`, regiões 190–780.
- Chamador: fila/job de atendimento autônomo após debounce.
- Fluxo: job → trava/idempotência → até 100 mensagens → transcrição do último áudio se necessário → 120 mensagens outbound para estilo/referências → prompt → resposta → validação → checagem de mensagem obsoleta → envio Whapi → persistência.
- Fixo: prompt ativo de ~1.736 tokens, playbook, referências e instruções de estilo.
- Variável: histórico, nome/estado do lead, respostas rápidas e amostras reais.
- Modelo: OpenAI `gpt-5.6-terra`, temperatura 0,6 quando suportada, máximo 350, reasoning `high` na fotografia.
- Multiplicador: até 2 tentativas; se a saída tiver apenas tag técnica, uma segunda chamada lógica também pode ter até 2 tentativas. Áudio adiciona transcrição.
- Proteções existentes: lease, debounce, deduplicação de job e verificação de inbound mais recente evitam envio obsoleto. A chamada já paga não é cancelada quando a obsolescência só é detectada depois.

## 3. Chat e cenários de sandbox

- Arquivos: `supabase/functions/ai-sandbox-chat/index.ts` (90–175) e `supabase/functions/ai-sandbox-run-scenario/index.ts` (178–405).
- Execução: manual, ambiente de teste.
- Chat: até 100 mensagens e referências/estilo; uma chamada lógica por turno.
- Cenário: 8 turnos por padrão, máximo 15. Cada turno pode chamar simulador de lead e atendente; há abertura opcional e juiz final. O pior caso chega a aproximadamente 32–34 inferências físicas, com histórico crescente.
- Modelos: atendente usa `autonomous.reply`; cenário usa OpenAI `gpt-6-astra`, máximo 350, reasoning `high` na fotografia.
- Desperdício: reconstruir o mesmo system prompt a cada turno e reenviar todo o diálogo. Por ser teste, é candidato forte a modelo/effort mais baratos e orçamento explícito por execução.

## 4. Sugestão de resposta

- Arquivo: `supabase/functions/comm-whatsapp-suggest-reply/index.ts`, regiões 200–330.
- Chamador: botão manual no inbox; frontend usa request id para ignorar resultado obsoleto, mas isso não cancela a chamada paga.
- Entrada fixa: prompt ativo ~368 tokens e instruções de saída ~31.
- Entrada variável: até 80 mensagens, estágio inferido, última mensagem, rascunho de até 1.800 caracteres e perfil/referências.
- Modelo: OpenAI `gpt-5.6-terra`, temperatura 0,4, máximo 420, reasoning `high` na fotografia.
- Complexidade: simples/média. Reasoning alto é desproporcional e deve ser reduzido somente após eval de respostas reais.

## 5. Reescrita de mensagem

- Arquivo: `supabase/functions/comm-whatsapp-rewrite-message/index.ts`, regiões 70–205.
- Chamador: botão manual e correção opcional de instrução ditada.
- Entrada fixa: prompt ~232 tokens e saída ~27.
- Variável: texto original, ajuste, tom e, quando há chat, até 24 mensagens.
- Modelo: OpenAI `gpt-5.6-luna`, temperatura 0,2, máximo 420, reasoning `high` na fotografia.
- Complexidade: muito simples/simples. Correções puramente mecânicas poderiam usar código; reescrita de tom/contexto ainda se beneficia de LLM.

## 6. Crítica de atendimento

- Arquivo: `supabase/functions/comm-whatsapp-critique-attendance/index.ts`, regiões 180–290.
- Execução: manual no inbox.
- Entrada: até 250 mensagens são carregadas, mas somente a última sessão, separada por intervalo de 6 horas, segue para o modelo.
- Fixo: ~495 tokens de prompt e ~97 de contrato de saída.
- Modelo: OpenAI `gpt-5.6-terra`, temperatura 0,3, máximo 1.100.
- Saída: JSON com resumo/listas; limites são aplicados depois da geração. Candidato a Structured Outputs para evitar campos excedentes e retries futuros.

## 7. Transcrição

- Arquivos: `supabase/functions/comm-whatsapp-transcribe/index.ts` e caminho automático em `ai-autonomous-reply-worker/index.ts`.
- Entrada: blob de áudio, nome/MIME e prompt fixo curto (~111 tokens na configuração).
- Modelo: OpenAI `gpt-transcribe` na fotografia; configuração também conhece `gpt-4o-mini-transcribe`/`whisper-1`.
- Problema: o adapter retorna somente texto. Tokens e duração faturável não entram em `ai_call_logs`; 25 chamadas aparecem com zero tokens/custo.

## 8. Intenção de campanha

- Arquivo: `supabase/functions/comm-whatsapp-campaign-worker/index.ts`, regiões 490–610.
- Execução: automática ao receber resposta relacionada a campanha.
- Deduplicação: consulta por `message_id + campaign_id` antes de chamar IA.
- Entrada: mensagem corrente e últimas 8 mensagens. Antes da correção, a mensagem corrente podia aparecer três vezes: interpolada no system prompt, como bloco `inboundMessage` e como chave remanescente do contexto.
- Modelo: OpenAI `gpt-5.6-luna`, temperatura 0,1, máximo efetivo 280.
- Saída: seis campos JSON; `recommended_action` é recalculado deterministicamente no backend.
- Implementado: remoção das cópias redundantes, exclusão das camadas globais de persona/estilo nessa feature e JSON Schema estrito.

## 9. Organização de agenda

- Arquivo: `supabase/functions/organize-follow-up-agenda/index.ts`, regiões 330–520.
- Execução: preview manual e posterior aplicação explícita.
- Entrada: até 500 candidatos são calculados por código; só os 35 primeiros seguem à IA, com até 10 mensagens de 220 caracteres por chat.
- Modelo: OpenAI `gpt-5.6-terra`, temperatura 0,15, máximo 1.800.
- Saída: lista de `{id, score, reason}`. O agendamento final é determinístico.
- Implementado: JSON Schema, uma única tentativa de IA e manutenção do fallback determinístico já existente.

## 10. Extração de documentos de contrato

- Arquivos: `supabase/functions/contract-document-extract/index.ts` e `domain.ts`.
- Execução: botão manual no cadastro de contrato.
- Entrada fixa: instruções de extração, regras por administradora e perfil escolhido.
- Entrada variável: 1–4 PDFs, máximo 16 MB por arquivo e 28 MB total, codificados como `input_file`.
- Modelo: OpenAI `gpt-4o-mini`, temperatura 0, máximo 1.800, Responses API, `store=false`.
- Baseline: JSON descrito em texto e validação após a resposta; fallback/retry podia reenviar todos os PDFs.
- Implementado: Structured Outputs estrito, cache key estável e uma única tentativa física/lógica para não duplicar centenas de milhares de tokens. Falha agora é explícita em vez de repetir o lote caro.
- Próximo passo de maior impacto: extrair texto localmente e enviar o PDF somente quando o arquivo for escaneado/ilegível. Exige testes por layout antes de produção.

## 11. MCP do ChatGPT

- Arquivo: `supabase/functions/chatgpt-mcp/index.ts`.
- Não chama modelo internamente, mas seu retorno entra no contexto de um ChatGPT conectado.
- Baseline: `SELECT *`, página padrão 50/máximo 100, resposta de até 90 mil caracteres; `lead_360` podia retornar centenas de objetos completos.
- Implementado: padrão 20, máximo 50, resposta de até 40 mil caracteres e limites menores nas coleções de `lead_360`. Paginação continua disponível.
- Risco restante: `SELECT *` em `list_records`, `get_record`, transcript e lead 360. A solução ideal é projeção por recurso e parâmetro `fields` validado.

# Consumo estimado

## Telemetria real da janela auditada

| Feature | Chamadas lógicas | Input | Output | Reasoning | Total | Retry | Falhas |
|---|---:|---:|---:|---:|---:|---:|---:|
| `contract.document_extract` | 7 | 6.236.371 | 2.756 | 0 | 6.239.127 | 2 | 2 |
| `followup.generate` | 107 | 991.850 | 31.656 | 26.564 | 1.023.506 | 14 | 20 |
| `autonomous.reply` | 128 | 355.768 | 7.942 | 4.656 | 363.710 | 2 | 22 |
| `sandbox.scenario` | 65 | 33.496 | 2.508 | 1.248 | 36.004 | 4 | 18 |
| `followup.analysis` histórico | 6 | 30.742 | 2.291 | 0 | 33.033 | 0 | 3 |
| `message.suggest` | 8 | 25.390 | 604 | 422 | 25.994 | 1 | 0 |
| `agenda.organize` | 1 | 12.130 | 926 | 0 | 13.056 | 0 | 0 |
| `message.rewrite` | 2 | 748 | 309 | 0 | 1.057 | 0 | 0 |
| `audio.transcribe` | 25 | não medido | não medido | n/a | não medido | 0 | 5 |
| **Total registrado** | **349** | **7.686.495** | **48.992** | **32.890** | **7.735.487** | **24** | **70** |

O custo persistido foi US$ 1,042079, mas está subestimado: a tabela `ai_model_pricing` não tinha preço para vários modelos ativos novos, então diversas chamadas ficaram com custo nulo. `cached_tokens` também era lido do caminho errado no Chat Completions e aparecia como zero.

## Estimativa por ação

| Funcionalidade | Input aprox. | Output aprox. | Chamadas por ação | Total aproximado |
|---|---:|---:|---:|---:|
| Extração de contrato | 891.000 | 394 | 1; antes podia repetir | 891.400 |
| Follow-up completo | 18.500 | 590 | 2; pior caso 4 | 19.100; pior ~38.000 |
| Resposta autônoma | 2.780 | 62 | 1; pior 4 + áudio | 2.840 a 11.400 |
| Cenário sandbox 8 turnos | 8.000–15.000 | 1.000–3.000 | ~17–20 | 9.000–18.000 |
| Agenda | 12.130 | 926 | 1 | 13.056 |
| Sugestão | 3.174 | 76 | 1–2 | 3.250–6.500 |
| Classificação campanha | 2.000–3.000 | 50–150 | 1 | 2.050–3.150 |
| Crítica | 4.000–12.000 | 400–1.100 | 1–2 | 4.400–13.100 |
| Reescrita | 374 | 155 | 1 | 529 |

# Histórico de conversas

| Fluxo | Limite atual | Estratégia | Risco |
|---|---:|---|---|
| Follow-up | sem limite | transcript completo, só colapsa duplicatas consecutivas | crescimento indefinido; enviado duas vezes |
| Autônomo | 100 | janela por quantidade | linear por chamada até o teto |
| Sandbox chat | 100 | janela por quantidade | linear por chamada |
| Sugestão | 80 | janela por quantidade | linear por chamada |
| Reescrita | 24 | janela curta opcional | baixo |
| Campanha | 8 | janela curta | baixo |
| Crítica | carrega 250; envia última sessão | corte semântico por 6 h | moderado |
| Agenda | 10 × 35 chats | batch compacto | controlado, mas grande |

Exemplo ilustrativo para follow-up, assumindo 60 tokens por mensagem e cerca de 8 mil tokens fixos/contextuais nas duas etapas:

| Mensagens | Histórico | Input total da ação normal |
|---:|---:|---:|
| 10 | ~600 | ~9.200 |
| 20 | ~1.200 | ~10.400 |
| 50 | ~3.000 | ~14.000 |
| 100 | ~6.000 | ~20.000 |

Como cada nova resposta conversacional reenvia o passado, o custo acumulado de uma conversa cresce aproximadamente de forma quadrática até o limite da janela. Para follow-up, que não tem teto, o risco não estabiliza. A estratégia segura é preservar uma janela recente mais uma memória comercial estruturada e fatos antigos relevantes, validada contra casos reais. Um corte cego para “últimas N” mensagens violaria invariantes comerciais.

# Prompts fixos

Fotografia das versões ativas do banco antes das mudanças:

| Feature | Prompt fixo | Instruções de saída | Classificação |
|---|---:|---:|---|
| `followup.generate` | ~3.084 tokens | ~198 | excessivo/repetido |
| `autonomous.reply` | ~1.736 | ~83 | grande |
| `followup.refine` | ~771 | ~83 | aceitável |
| `campaign.intent` | ~677 | ~144 | aceitável, mas redundante para classificar |
| `agenda.organize` | ~560 | ~74 | aceitável |
| `attendance.critique` | ~495 | ~97 | pequeno/aceitável |
| `message.suggest` | ~368 | ~31 | pequeno |
| `message.rewrite` | ~232 | ~27 | pequeno |
| `sandbox.scenario` | ~135 | ~43 | pequeno |
| `contract.document_extract` | ~29 | ~15 | pequeno; custo está nos PDFs |
| `audio.transcribe` | ~111 | ~28 | pequeno |
| global instructions | ~127 | — | pequeno, mas recorrente |
| global style | ~101 | — | pequeno, mas recorrente |

O prompt de follow-up não deve ser simplesmente encurtado: muitas regras protegem progressão comercial. A otimização correta é remover duplicatas, separar contrato de saída em schema e manter regras estáveis no início para cache.

# Problemas encontrados

1. PDFs integrais dominam o consumo e qualquer retry repete o lote completo.
2. Follow-up faz duas chamadas necessárias, porém reenviava política/contexto extensos e dependia de JSON textual no validador.
3. `cached_tokens` do Chat Completions era lido em `usage.cached_tokens`; a API retorna em `usage.prompt_tokens_details.cached_tokens`.
4. Preços ausentes para modelos ativos tornam custo por feature incompleto.
5. Transcrição não registra duração/tokens/custo.
6. Atendimento autônomo pode fazer quatro chamadas de texto para uma mensagem.
7. Sandbox multiplica chamadas dentro de loop e reenvia histórico crescente.
8. Intenção de campanha duplicava a mensagem atual até três vezes.
9. O Prompt Composer buscava chaves globais antigas (`closer_global_instructions`, `whatsapp_style`) enquanto a UI/banco usam `global_instructions` e `global_style`.
10. MCP usava `SELECT *`, páginas grandes e payload máximo equivalente a cerca de 22,5 mil tokens.
11. `generateTextWithRouting` não possui chamadores de produção e duplica parte da infraestrutura moderna.
12. Feature antiga `followup.analysis` segue no registry/configuração, embora desabilitada.
13. `ai-sandbox-chat` continua acessível, mas a feature `sandbox.chat` foi removida; ele usa `autonomous.reply`, o que mistura telemetria/configuração.
14. O frontend ignorava respostas obsoletas por request id, mas não cancelava a chamada de rede paga.
15. Não há cache de aplicação por hash para documentos ou classificações repetidas.
16. O catálogo aceitava provedores que não eram usados em produção, ampliando UI, testes, rotas, secrets e superfície de falha.

# TOP consumidores

| Rank | Consumidor | Por que | Frequência | Desperdício | Dificuldade | Economia potencial |
|---:|---|---|---|---|---|---|
| 1 | Extração de contrato | PDFs multimodais completos | baixa, impacto enorme | retry integral; sem cache por hash; sem extração textual local | média/alta | muito alta |
| 2 | Follow-up | duas etapas + histórico completo + prompt grande | alta | política/contexto repetidos; retries | média | alta |
| 3 | Autônomo | janela 100 + referências + segunda geração | muito alta | repetição e chamada extra por tag | média | alta |
| 4 | Sandbox cenário | 17–34 chamadas por execução | interna | histórico crescente e modelos fortes | baixa/média | alta |
| 5 | Sugestão/agenda | contextos batch/janelas grandes | baixa/média | effort alto, schema textual, retry evitável | baixa | média |

# Quick wins

| Prioridade | Funcionalidade | Problema | Solução | Economia estimada | Risco | Estado |
|---:|---|---|---|---:|---|---|
| P0 | Contratos | retry reenvia PDFs | Structured Outputs + uma tentativa | 0–50% por ação com falha | baixo/médio | implementado |
| P0 | Todas | cache contabilizado como zero | ler `prompt_tokens_details.cached_tokens` | observabilidade; habilita decisões reais | baixo | implementado |
| P0 | Campanha | mensagem triplicada | uma única ocorrência contextual | 10–25% nessa feature | baixo | implementado |
| P0 | Agenda | retry caro apesar de fallback local | schema + uma tentativa | até 50% em falhas | baixo | implementado |
| P0 | Providers | adapters/configuração mortos | OpenAI-only em runtime/UI/DB | custo operacional, não tokens | baixo | implementado |
| P1 | MCP | respostas enormes | paginação 20/50 e teto 40k | até 55% por tool result | baixo | implementado |
| P1 | Pricing | custo nulo | manter preços dos modelos ativos | medição | baixo | pendente operacional |
| P1 | Áudio | custo desconhecido | registrar duração e preço/minuto | medição | baixo | pendente |
| P1 | Frontend | resposta obsoleta ainda paga | `AbortController` até Edge Function | variável | baixo/médio | pendente |
| P1 | Sandbox | execução sem orçamento | limite de tokens/chamadas por run | 30–70% em testes | baixo | pendente |

# Otimizações intermediárias

- Follow-up: criar memória comercial estruturada com decisor, preferências, objeções, ações concluídas e compromisso; enviar memória + janela recente + trechos antigos relevantes. Economia provável de 25–55%, risco médio e necessidade de eval.
- Autônomo: substituir a segunda chamada “somente tag” por saída estruturada única `{action,text,handoff_reason}`. Economia de até uma chamada inteira nos casos afetados, risco médio.
- Contratos: extrair camada textual do PDF localmente; usar PDF multimodal apenas em arquivos escaneados ou quando campos críticos faltarem. Economia potencial de 60–95% na feature, risco médio/alto por layout/OCR.
- MCP: projeções permitidas por recurso e `fields` validado; remover `SELECT *` dos fluxos 360/transcript. Economia alta no contexto externo, risco baixo/médio.
- Crítica: JSON Schema e campos com limites no próprio schema. Economia baixa/média, risco baixo.
- UI: cancelar requests de sugestão/reescrita ao trocar chat ou fechar modal. Economia variável, risco baixo.

# Otimizações avançadas

Uma arquitetura adequada continua simples:

1. Um único AI Gateway (`ai-router`) OpenAI-only.
2. Registry por feature com modelo, budget, schema, política de retry e versão do prompt.
3. Prefixo estável: developer/system → regras fixas → schema/tools → contexto variável → mensagem atual.
4. Memória estruturada para conversas longas, sem resumo livre como única fonte.
5. Cache por hash para documentos e classificações idênticas.
6. Um orçamento por ação, além do máximo por request, para impedir multiplicadores silenciosos.
7. Telemetria agregável por mês/feature/model com custo completo.
8. Evals de regressão antes de reduzir histórico, effort ou trocar modelo.

Não se justifica introduzir framework de agentes, vector database ou gateway externo apenas por elegância. O roteador atual já é o ponto central correto.

# Código legado

| Item | Classificação | Evidência |
|---|---|---|
| `generateTextWithRouting` | provavelmente morto | nenhuma referência fora do próprio módulo/testes |
| `followup.analysis` | legado | feature deprecated, desabilitada, sem ponto de invocação atual; há telemetria histórica |
| `sandbox.chat` feature | removido | migration removeu a feature, mas endpoint `ai-sandbox-chat` segue usando `autonomous.reply` |
| `gpt_transcription` integration setting | compatibilidade legada | ainda lido como fallback de defaults OpenAI |
| prompts `closer_global_instructions`/`whatsapp_style` | legado quebrado | código procurava chaves diferentes das usadas pela UI/banco; corrigido |
| adapters Gemini/Claude | legado removido | desativados em produção, sem chaves e sem rotas ativas; removidos do runtime/UI/sync |
| migrations antigas multi-provider | histórico imutável | permanecem por obrigação de integridade do histórico; migration nova neutraliza o estado final |
| `docs/auditoria-tecnica-follow-ups.md` | documento histórico | descreve arquitetura anterior e deve ser lido como fotografia, não fonte do runtime atual |

# Estratégia de modelos

Somente modelos já observados/configurados no projeto:

| Complexidade | Tarefas | Estratégia OpenAI |
|---|---|---|
| Muito simples | intenção, normalização, reescrita gramatical | `gpt-5.6-luna` ou `gpt-4o-mini`, reasoning `none`; preferir código quando determinístico |
| Simples | sugestão curta, ranking de agenda | `gpt-5.6-luna`/`terra`, reasoning `none` ou `low`, schema mínimo |
| Média | conversa autônoma, crítica | `gpt-5.6-terra`, reasoning `low/medium`; escalar somente se eval justificar |
| Complexa | follow-up com negociação longa | `gpt-5.6-sol`, manter `high` até eval comparar qualidade |
| Teste complexo | juiz/cenário | `gpt-6-astra` apenas no juiz/casos difíceis; simulação comum em modelo intermediário |
| Documento | PDF | `gpt-4o-mini`; priorizar redução de input, não modelo mais caro |
| Áudio | transcrição | `gpt-transcribe`/modelo de transcrição configurado |

Routing recomendado: determinístico primeiro → modelo barato → modelo intermediário → modelo avançado só quando sinais de complexidade justificarem. Não usar erro de parsing como razão para escalar inteligência; schema resolve o contrato.

# Estratégia de contexto

- Manter conteúdo fixo antes do variável para maximizar cache de prefixo.
- Separar “memória comercial” de “transcript recente”.
- Nunca descartar fatos antigos relevantes apenas por idade.
- Remover duplicatas exatas e dados já representados em JSON/schema.
- Para follow-up: memória + 20–30 mensagens recentes + trechos ancorados por evento; full transcript disponível apenas para casos ambíguos.
- Para autônomo: mesma estratégia, com budget máximo e cancelamento quando novo inbound chegar.
- Para agenda: manter batch de 35, mas enviar somente campos que influenciam score.
- Para MCP: projetar colunas e paginar; o modelo pode pedir a próxima página.
- Para documentos: texto extraído + imagens/páginas problemáticas, nunca o PDF completo por padrão sem diagnóstico.

# Estratégia de caching

## Cache do provedor

A OpenAI aplica prompt caching a prefixes elegíveis. O código já posiciona system antes do contexto variável; a correção de telemetria permite medir hits. Responses de documento agora recebem `prompt_cache_key` estável. A ordem deve permanecer: regras fixas → schema → contexto/documentos variáveis.

## Cache de aplicação

| Caso | Chave | Armazenamento | Invalidação | Impacto |
|---|---|---|---|---|
| Documento idêntico | SHA-256 dos bytes + perfil + versão prompt/modelo | Postgres | mudança de prompt/modelo | muito alto quando repetido |
| Intenção | `message_id + campaign_id + prompt_version` | tabela existente | nova mensagem/versão | já parcialmente implementado |
| Agenda preview | hash candidatos + opções + versão | memória/DB curto | mudança em lembrete/chat | médio |
| Config/model list | provider + TTL | cache Edge curto | TTL/sync | baixo em tokens, reduz latência |
| Memória de conversa | chat + last_message_id + versão | Postgres | novo evento | alto |

Redis não é necessário neste estágio. Postgres e cache em memória da Edge Function bastam para resultados versionados e dados estáticos.

# Observabilidade

Já existem `ai_call_logs` e `ai_call_attempts` com feature, task, função, modelo, provider, input/output/cached/reasoning/total, duração, retry, fallback, erro e custo. Isso já permite a consulta “quantos tokens a feature consumiu no mês”.

Lacunas:

- atualizar `ai_model_pricing` sempre que um modelo ativo entrar no catálogo;
- registrar duração faturável da transcrição;
- registrar `prompt_version`/config version e tamanho dos principais blocos de contexto;
- criar view/RPC mensal agrupada por feature/modelo/status;
- alertar para `cached_tokens / input_tokens`, retry rate, falha e p95 de duração;
- distinguir chamada iniciada de request cancelada pelo cliente;
- não usar custo zero quando preço está ausente: manter `NULL` e emitir alerta.

Consulta operacional sugerida:

```sql
SELECT
  date_trunc('month', created_at) AS month,
  feature_key,
  final_model,
  count(*) AS calls,
  sum(total_input_tokens) AS input_tokens,
  sum(total_cached_tokens) AS cached_tokens,
  sum(total_output_tokens) AS output_tokens,
  sum(total_reasoning_tokens) AS reasoning_tokens,
  sum(total_tokens) AS total_tokens,
  sum(total_estimated_cost_usd) AS estimated_cost_usd
FROM ai_call_logs
GROUP BY 1, 2, 3;
```

# Matriz de otimização

| Prioridade | Funcionalidade | Problema | Solução | Economia estimada | Qualidade | Risco | Dificuldade |
|---:|---|---|---|---:|---|---|---|
| P0 | Contratos | PDF integral repetido | uma tentativa + schema | muito alta em falhas | melhora contrato | baixo/médio | baixa |
| P0 | Contratos | PDF integral sempre | extração textual híbrida | 60–95% | neutra se fallback multimodal | médio/alto | média |
| P0 | Follow-up | histórico/política duas vezes | memória estruturada + seleção | 25–55% | neutra com eval | médio | média |
| P0 | Autônomo | até 4 calls | ação/texto em uma saída estruturada | 20–50% nos casos afetados | tende a melhorar | médio | média |
| P1 | Sandbox | loop sem budget | teto por run e routing barato | 30–70% | baixo impacto por ser teste | baixo | baixa |
| P1 | MCP | `SELECT *` e payload grande | projeções por recurso | 30–70% externo | neutra | baixo | média |
| P1 | Sugestão/reescrita | reasoning alto | `none/low` após eval | 10–35% de output | provável neutra | médio | baixa |
| P1 | Crítica | JSON livre | schema | 5–20% | melhora confiabilidade | baixo | baixa |
| P2 | Todas | sem cache por resultado | cache hash/versionado | variável | neutra | baixo/médio | média |
| P2 | UI | request obsoleta | cancelamento propagado | variável | neutra | baixo/médio | média |

# Roadmap

## Fase 1 — quick wins

| Arquivo afetado | Mudança | Economia | Risco | Prioridade | Estado |
|---|---|---:|---|---:|---|
| `_shared/ai-router.ts` | OpenAI-only; corrigir cached tokens; suportar schema | medição + retries | baixo | P0 | feito |
| `contract-document-extract/*` | schema e uma tentativa | muito alta em falhas | baixo/médio | P0 | feito |
| `organize-follow-up-agenda/index.ts` | schema e fallback após uma tentativa | até 50% em falhas | baixo | P0 | feito |
| `comm-whatsapp-campaign-worker` | deduplicar contexto e schema | 10–25% local | baixo | P0 | feito |
| UI/config/functions de catálogo | remover providers externos | operacional | baixo | P0 | feito |
| migration OpenAI-only | normalizar dados e checks | operacional | baixo | P0 | criada, não aplicada |
| `chatgpt-mcp/index.ts` | reduzir defaults/teto | até 55% externo | baixo | P1 | feito |
| `ai_model_pricing` | preencher preços dos modelos ativos | medição | baixo | P1 | pendente |

## Fase 2 — redução estrutural

| Arquivo afetado | Mudança proposta | Economia | Risco | Prioridade |
|---|---|---:|---|---:|
| `contract-document-extract` | parser textual + fallback multimodal | 60–95% da feature | médio/alto | P0 |
| follow-up + novas tabelas de memória | memória estruturada/versionada | 25–55% da feature | médio | P0 |
| autonomous worker | saída única ação/texto | 20–50% em casos de tag | médio | P0 |
| suggest/rewrite frontend+Edge | AbortController propagado | variável | baixo/médio | P1 |
| critique | Structured Outputs | 5–20% | baixo | P1 |
| MCP | projeções por ferramenta | 30–70% externo | baixo/médio | P1 |

## Fase 3 — arquitetura/observabilidade

| Arquivo afetado | Mudança proposta | Economia | Risco | Prioridade |
|---|---|---:|---|---:|
| migrations + dashboard IA | view mensal por feature/modelo | habilitadora | baixo | P1 |
| router/registry | orçamento por ação e política de retry | 10–30% em falhas | médio | P1 |
| documentos/classificação | cache por hash+versão | até 100% em repetição | baixo/médio | P1 |
| suite de evals | comparar janela/modelo/effort | habilitadora | baixo | P0 |
| legado | remover `generateTextWithRouting` após caracterização | manutenção | baixo/médio | P2 |

# Cenários de redução

- Conservador: 15–25%. Mantém histórico integral, reduz retries caros, duplicações, payloads MCP e contratos de saída inválidos.
- Recomendado: 35–55%. Soma memória estruturada/janela híbrida, saída única no autônomo, effort calibrado por eval e projeções MCP.
- Agressivo: 65–85%. Depende principalmente de substituir PDFs integrais por extração textual híbrida e cache por hash. Sem isso, como documentos são 80,7% do volume observado, o teto global de economia fica muito menor.

Esses intervalos variam com o mix de uso. A economia agressiva não deve ser ativada sem corpus de PDFs e conversas para medir perda de campos, progressão comercial e taxa de fallback.
