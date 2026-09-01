# Auditoria do estado atual — geração de follow-up

Data da auditoria: 01/09/2026. Escopo: código em uso no repositório e leitura dos registros existentes no Supabase para os dez casos solicitados. Nenhum código de produção, prompt, migration, UI ou schema foi alterado.

## Como ler este documento

- **Fato de código**: comportamento verificado no fonte atual.
- **Fato de banco**: registro consultado na base nesta auditoria.
- **Hipótese/risco**: conclusão provável, explicitamente não comprovada por telemetria.
- O termo “IA” se refere à chamada da Edge Function `comm-whatsapp-generate-follow-up`; não há uma segunda camada determinística que classifique comercialmente a conversa.

## A. Arquitetura atual

```text
Inbox / Agenda
  ├─ modal individual ou lote
  ├─ commWhatsAppService.generateFollowUp(chatId, ajustes, variantes)
  └─ Edge Function comm-whatsapp-generate-follow-up
       ├─ autentica dashboard (permissão WhatsApp:view)
       ├─ resolve chat canônico
       ├─ carrega chat, lead, histórico completo, settings e prompt customizado
       ├─ monta transcript + fatos temporais + style profile
       ├─ chama ai-router(task=follow_up_generation)
       ├─ faz no máximo um retry para JSON inválido
       └─ devolve texto, metadados comerciais e nextAction

Envio individual: usuário edita e envia; agendamento sugerido só ocorre ao clicar.
Envio em lote: usuário revisa/envia mensagens; após cada envio bem-sucedido,
o frontend fecha o reminder atual e grava automaticamente o próximo, se houver data.
```

Arquivos centrais:

- `src/features/communication/whatsapp/WhatsAppInboxScreen.tsx`: orquestra geração, envio, lote, RPC de agenda e audit log.
- `src/features/communication/whatsapp/components/WhatsAppFollowUpModal.tsx`: modal individual.
- `src/features/communication/whatsapp/components/WhatsAppBatchFollowUpModal.tsx`: carregamento, geração concorrente (3 por vez), revisão e envio em lote.
- `src/lib/commWhatsAppService.ts`: invoca a Edge Function e normaliza a resposta para a UI.
- `supabase/functions/comm-whatsapp-generate-follow-up/index.ts`: contexto, prompt, chamada de IA, parsing e cálculo de `nextAction`.
- `supabase/functions/_shared/ai-router.ts`: roteamento de provider/model/fallback.
- `supabase/functions/_shared/comm-whatsapp-transcript.ts`: profile e exemplos de estilo.
- `supabase/functions/_shared/comm-whatsapp-follow-up-commercial-thread.ts`: regra textual do fio comercial pendente.
- `supabase/migrations/20260911386000_schedule_follow_up_reminder_rpc.sql`: criação deduplicada do reminder e atualização de `leads.proximo_retorno`.

## B. Frontend e API

### Individual

O Inbox abre `WhatsAppFollowUpModal` para o `selectedChat`. `handleGenerateFollowUp` chama `generateFollowUp(chatId, { customInstructions, variantCount })`. O chat, e não o lead, é obrigatório; a Edge Function usa o `lead_id` eventualmente vinculado ao chat. Não existe seleção manual de estágio, tom, cenário ou técnica comercial — esses presets foram removidos do fluxo atual. Ainda existem:

- **Ajustes extras** livres, enviados como `customInstructions`.
- **Gerar agora / gerar novamente** (`variantCount` ausente ou 1).
- **Gerar 3 opções** (`variantCount: 3`; servidor limita a 5).
- Edição direta no `Textarea`, preview dividido por uma linha contendo somente `---`, e envio do texto editado.
- Refinamentos simples (`shorter`, `friendly`, `professional`) pela função separada `rewriteMessage`, que só recebe o texto.
- Refinamentos contextuais (`add-context`, `reduce-pressure`, `clear-next-step`, `more-assertive`, `find-blocker`) via `mode: 'refine'`, com `currentMessage` e `adjustmentInstruction`; esse modo recarrega o chat, mas devolve somente texto, sem novo `nextAction`.

O modal mostra `rationale` e contexto emocional, mas **não exibe `stage`, `blocker` ou `goal`**, embora eles retornem da Edge Function. Para `schedule` e `wait` com data, exibe “Agendar sugestão”; o usuário deve clicar. Para `mark_lost_recommended`, não há botão de agendar nem ação automática de perda no modal individual. Erros de invoke/parsing são mostrados por toast.

### Serviço e contrato HTTP

Payload normal:

```json
{
  "chatId": "uuid",
  "customInstructions": "texto opcional",
  "variantCount": 1
}
```

Payload de refino:

```json
{
  "chatId": "uuid",
  "mode": "refine",
  "currentMessage": "mensagem obrigatória",
  "adjustmentInstruction": "instrução obrigatória"
}
```

A Edge Function aceita somente `POST`, exige sessão de dashboard com permissão `COMM_WHATSAPP_MODULE:view`, rejeita chat ausente (400), chat não encontrado após resolução canônica (404) e, no refine, os dois campos obrigatórios (400). Chat sem lead é aceito: usa nome/telefone do chat e informa `Lead vinculado: Não`; sem lead não há como o UI individual agendar a próxima ação.

### Lote

Ao abrir, `WhatsAppBatchFollowUpModal` chama a RPC `comm_whatsapp_pending_follow_up_chats()`: reminders não lidos, `tipo='Follow-up'`, vencidos até `CURRENT_DATE`, com lead não arquivado e chat não excluído. Deduplica apenas por `reminder_id`, não por lead/chat. Cada item chama exatamente a mesma Edge Function individualmente. A geração trabalha em grupos de 3, com `Promise.allSettled`; o envio é sequencial, aguarda 1,5 s entre leads e envia cada segmento separado por `---`.

Antes do envio há revisão de **mensagem** (seleção do lead, edição, variantes, refinamentos e ajustes extras). Não há etapa de aprovação/edição da recomendação de agenda. Ao terminar o envio, o resumo informa “Reagendado”, “Retorno agendado”, “Sem novo reagendamento” ou “IA recomenda marcar como perdido”. Só o último caso tem botão humano explícito para atualizar o status para `Perdido`.

## C. Dados carregados e transcript

### Consultas feitas pela Edge Function

Em paralelo, para o chat canônico, são carregados:

1. Todas as mensagens de `comm_whatsapp_messages`, em páginas de 1.000, ordenadas `message_at ASC, id ASC`.
2. `leads` pelo `chat.lead_id`, com lookup de label para status, origem e responsável quando necessário. Apesar de `select('*')`, apenas nome, telefone, email, cidade, origem, status e responsável são materializados pelo helper; o prompt usa só nome, telefone, status e responsável.
3. `system_settings.company_name, timezone`.
4. `integration_settings.settings` onde `slug='ai_follow_up_prompt'`.

Não são carregados para o prompt: tags, observações do lead, oportunidade, produto/operadora/valor estruturados, contratos, `proximo_retorno`, reminders, logs de auditoria, histórico de sugestões, `stage/blocker/goal` anteriores ou um dono da próxima ação. Produtos, valores, decisor e combinado só entram se estiverem no transcript ou nos ajustes extras.

### Formato real do transcript

Linhas úteis seguem este formato, no timezone de `system_settings` (fallback `America/Sao_Paulo`):

```text
[HH:mm, DD/MM/AAAA] Eu: texto
[HH:mm, DD/MM/AAAA] Nome do contato: texto
```

- Carrega histórico inteiro, sem limite além da paginação.
- Mensagens `system` são removidas.
- Outbound com `delivery_status='failed'` é removido.
- Mensagem apagada entra marcada como `[Mensagem apagada] ...` ou, sem conteúdo, `[Imagem apagada]`, `[Audio apagado]` etc.
- Texto usa `text_content`; imagem/vídeo/documento usam legenda, com marcador quando ausente; áudio/voice usa transcrição ou `[Áudio sem transcrição]`; mídia não é enviada ao modelo como arquivo. `action`, sticker e tipos desconhecidos podem entrar como marcador (`[Ação]`, `[Sticker]`, etc.).
- Timestamps inválidos viram `[--:--, --/--/----]`; conteúdo em branco é normalizado/removido quando não há marcador aplicável.
- Não há deduplicação semântica nem por `external_message_id` nessa carga. Nos casos há inbound duplicado `received/read`; eles chegam ao transcript como linhas repetidas.

### Fatos temporais determinísticos

O backend calcula e injeta: tempo desde última mensagem útil, último inbound, último outbound; se houve contato de qualquer lado no mesmo dia; período (`manha` 05–11, `tarde` 12–17, `noite` restante); e tentativas outbound consecutivas desde o último inbound.

Tentativas são grupos de outbounds com conteúdo após o último inbound. Só abre novo grupo se a distância para o outbound anterior for **maior que 2 horas**. Assim, uma proposta enviada em vários balões é uma tentativa; vários envios em dias distintos contam separadamente. A contagem não distingue função comercial, reminder, mensagem administrativa ou proposta longa. Para o cálculo de agenda, ela é limitada a 1–5; `maxAttempts` é 4.

`contactedToday` considera qualquer última mensagem útil do chat, não somente outbound. A saudação é instrução para a IA: se houve contato hoje, não saudar; se não, normalmente saudar. Não existe pós-processamento que corrija “bom dia/tarde/noite”. Isso explica tecnicamente Marco: às 09:19 BRT do dia 01/09 o fato temporal era `manha`, mas o modelo retornou “Boa tarde”; o backend aceitou e enviou o texto sem validação.

## D. Prompt atual completo e ordem de composição

O `systemPrompt` é a concatenação, separada por linhas em branco, dos blocos abaixo; vazios são removidos. Este quadro é um **mapa de composição**. A transcrição literal das regras está no Apêndice 1; os blocos variáveis são indicados entre `<...>` porque seu conteúdo vem da base/chat no momento da chamada.

```text
Você gera follow-ups de WhatsApp para a operacao <companyName>.
Cada mensagem deve ser contextualizada no historico real do chat: recupere o ultimo fio comercial ainda nao resolvido quando ele for mais relevante que o ultimo assunto cronologico, use os detalhes especificos da conversa e evite frases que sirvam para qualquer lead.
A mensagem precisa soar como uma continuacao natural do ultimo contato, nao como um template pre-definido.

Voce e responsavel por decidir e escrever o proximo follow-up de vendas mais eficaz para fazer esta oportunidade comercial avancar pelo WhatsApp.
Antes de escrever qualquer mensagem, raciocine internamente (nao precisa mostrar esse raciocinio, so aplica-lo) respondendo: 1) qual e o ultimo fio comercial ainda nao resolvido? 2) em que estagio da venda este lead esta? 3) o que ele realmente quer? 4) o que ja sabemos sobre ele e a negociacao? 5) o que ainda precisamos descobrir? 6) qual e o principal bloqueio atual? 7) existem sinais de compra? 8) qual foi a ultima microdecisao solicitada a ele? 9) ele executou essa acao? 10) ja houve follow-up tentando provocar exatamente a mesma acao, sem resposta? 11) qual e a proxima microdecisao mais adequada agora? 12) qual funcao comercial esta nova mensagem precisa cumprir?
PRINCIPIO CENTRAL: toda mensagem de follow-up precisa ter uma funcao comercial clara. Nunca gere uma mensagem apenas para "manter contato" ou por habito de cadencia.
A pergunta que guia a mensagem e sempre: qual e o melhor proximo movimento para aumentar a chance desta venda avancar?

<INSTRUCAO ESPECIFICA DESTA GERACAO, se customInstructions não vazio>

<PERSONALIZACAO DA OPERACAO, se ai_follow_up_prompt.instructions não vazio>

A mensagem deve soar NATURAL, como se fosse escrita por um humano — jamais como texto gerado por IA.

MECANISMO DO SISTEMA: uma linha contendo APENAS "---" (...) e reconhecida como separador entre mensagens distintas do WhatsApp (...).

DIVISAO EM MENSAGENS: sempre que o follow-up tiver mais de uma ideia (...) quebre em 2 a 3 mensagens curtas em sequencia usando o separador "---" (...). Exemplo: Oi Fernanda, tudo bem? / --- / Vi que ficou de dar uma olhada na proposta. Ainda faz sentido pra você?

ESTILO: escreva como uma excelente corretora humana conversando no WhatsApp — acolhedora, consultiva, tecnicamente segura, natural, persuasiva sem manipulacao, relativamente curta, facil de responder, contextualizada e sem cara de template.
Evite: linguagem robotica, frases de coach, excesso de emojis, formalidade excessiva, falsa intimidade, pressao artificial, textos enormes e cliches comerciais.
NUNCA use abreviacoes como "pra" ou "pro" — use sempre "para", "para o", "para a", etc.

REGRAS DE CONDUTA:
- Cada mensagem individual deve ser curta e direta, como uma mensagem real de WhatsApp: normalmente 1 a 2 frases curtas. Nao escreva paragrafos longos.
- NUNCA use listas, bullets ou numeracao. Markdown so e permitido na forma do separador "---" descrito acima.
- Dentro de cada mensagem, uma unica pergunta ou proximo passo por vez — nao empilhe varias perguntas na mesma mensagem.
- Use o nome do lead se fizer sentido. Nao force.

REGRAS DE ESTILO (aprendidas do historico real de mensagens da operacao — use apenas o padrao de tom e estrutura; se algum exemplo real usar abreviacoes como "pra"/"pro" ou contrariar as regras de estilo obrigatorias acima, ignore esse detalhe e mantenha as regras obrigatorias):
<styleProfileText>

<COMMERCIAL_THREAD_RULE completo do helper>

REGRA CRITICA — NAO REPETIR A MESMA ESTRATEGIA: releia com atencao suas proprias mensagens anteriores ("Eu") no historico. Nunca repita a mesma funcao comercial de um follow-up anterior que ficou sem resposta, mesmo trocando as palavras (...).
Quando uma abordagem ja foi tentada sem resposta, mude o angulo. Uma progressao natural (...) tende a ser: 1a tentativa = pedir a acao pendente; 2a = facilitar a microdecisao ou mudar o angulo; tentativa seguinte = investigar o verdadeiro bloqueio; tentativa posterior = pedir posicionamento sobre continuidade ou recomendar pausar a oportunidade.

RECONHECA O ESTAGIO DA VENDA: nao trate a conversa como se estivesse sempre no inicio. Se o cliente ja escolheu o plano, nao continue "vendendo" beneficios (...). Se documentos foram pedidos repetidamente e ele nao envia, considere que o bloqueio real pode nao ser a documentacao (...).

FOLLOW-UP NAO E COBRANCA: evite depender repetidamente de frases genericas como "Conseguiu analisar?", "Viu minha mensagem?", "Ficou com alguma duvida?", "Conseguiu separar os documentos?", "Gostaria de prosseguir?", "Estou a disposicao." ou "Quando puder me avisa." (...).

BUSQUE UMA MICRODECISAO CONCRETA sempre que possivel: escolher entre duas opcoes, confirmar qual plano agradou mais, definir enfermaria ou apartamento, escolher vigencia, confirmar beneficiarios, validar se ainda existe interesse, descobrir o que esta impedindo a contratacao, enviar documentos, iniciar a proposta, ou confirmar quem participa da decisao.

OBJECOES E "ENROLACAO": nao trate toda resposta evasiva como uma objecao final e definitiva. Frases como "Vou pensar.", "Vou falar com meu marido.", "Depois vejo.", "Estou comparando.", "Agora nao.", "Vou te chamar." ou "Deixa eu analisar." podem esconder (...) terceiro decisor (...). O follow-up deve tentar reduzir ou descobrir esse bloqueio real — nunca apenas perguntar de novo (...).

NUNCA INVENTAR URGENCIA: nao crie ou insinue prazo, reajuste, promocao, desconto, escassez, disponibilidade limitada, regra de operadora ou qualquer condicao comercial que nao esteja explicitamente no historico (...).

CONTEXTO HUMANO E EMPATIA (...) procure no historico sinais de doenca, luto, dificuldade pessoal, ansiedade ou frustracao (...). Contexto emocional detectado tem prioridade sobre qualquer objetivo comercial planejado (...).

ATENCAO A SUA PROPRIA ULTIMA MENSAGEM (...) NUNCA reformule ou repita (...) o mesmo pedido, prazo ou referencia de dia. O follow-up precisa ser uma CONTINUACAO real (...).

COMO DECIDIR (nesta ordem): 1) interprete o que realmente aconteceu na conversa e o historico completo; 2) reconstrua o ultimo fio comercial ainda nao resolvido, sem confundi-lo com a ultima mensagem cronologica; 3) entenda o momento; 4) entenda a pessoa; 5) identifique estagio, bloqueio e ultima microdecisao; 6) defina a funcao comercial; 7) so entao escreva.

Leia todo o historico antes de responder e respeite a cronologia do transcript. Considere os fatos temporais acima como referencia principal.
Nao invente fatos, promessas, dados, respostas do cliente ou combinados que nao estejam no historico.
USE DETALHES ESPECIFICOS do historico na mensagem (...) jamais use frases coringas que caberiam em qualquer chat.

Retorne SOMENTE um JSON valido, sem markdown, no formato exato: <jsonShape>.
```

As reticências no quadro são apenas para tornar visível a ordem sem duplicar o Apêndice 1. A regra do fio comercial exige reconstruir assunto/produto, microdecisão, responsável e terceiro decisor; declara que assunto jurídico, pessoal, administrativo ou pós-venda não apaga pendência comercial anterior, mas não retorna campos estruturados nem é validada por código.

O `userPrompt` contém, nesta ordem:

```text
Contexto do chat:
- Nome do contato: <nome>
- Telefone: <telefone>
- Lead vinculado: Sim|Nao
- Status do lead: <status>
- Responsavel: <responsavel>
- Fuso do sistema: <timezone>
- Agora no sistema: <DD/MM/AAAA HH:mm>

FATOS TEMPORAIS (calculados pelo sistema — use exatamente estes fatos, nao tente recalcular tempo decorrido lendo os timestamps do historico):
- Ultima mensagem nesta conversa, de qualquer lado: <...>.
- Ultima mensagem do cliente: <...>.
- Sua ultima mensagem: <...>.
- Ja houve contato (de qualquer lado) hoje, antes de agora: sim|nao.
- Periodo do dia agora: manha|tarde|noite.
- Tentativas consecutivas de follow-up sem resposta do cliente desde a ultima mensagem dele: <n>.
- REGRA DE SAUDACAO: se ja houve contato hoje, NUNCA repita saudacao (...).

Historico completo da conversa:
<transcriptLines>

--- EXEMPLOS REAIS DO SEU ESTILO (copie o padrao, nao o conteudo) ---
1. <outbound literal>
...
12. <outbound literal>

Interprete a conversa acima e gere o proximo follow-up mais adequado para enviar agora neste chat. Deve soar humano, comercialmente coerente e pronto para copiar e enviar no WhatsApp.
```

Para variações, a última frase pede exatamente N variações da **mesma** função comercial. O JSON normal contém `stage`, `blocker`, `goal`, `emotionalContext`, `nextAction`, `rationale` e `text`; com variações troca `text` por `variations`. Em refine, o system prompt remove regras de estágio/microdecisão/output JSON, acrescenta `Mensagem atual a refinar` e `Ajuste solicitado`, e solicita somente texto puro.

### Prompt customizado e style profile

**Fato de banco:** `integration_settings.slug='ai_follow_up_prompt'` está com `{ "instructions": "" }`; portanto não há personalização operacional ativa nesta auditoria. Se preenchido, entra após instrução pontual do operador e antes das regras de estilo. Ele complementa, não substitui regras nucleares, nem schema, nem conduta.

Style profile é sempre calculado dos últimos 120 outbounds **do próprio chat**, com `message_type='text'`, não `failed` e texto não vazio. Não há classificação comercial antes da seleção: follow-ups antigos, cotações, mensagens administrativas, pós-venda, saudações e textos longos podem entrar. O profile estatístico ignora textos menores de 12 ou maiores de 1.200 caracteres; os exemplos literais selecionam até 12, 12–900 caracteres, com ao menos uma palavra. Como o array já foi ordenado cronologicamente e o helper usa `.slice(0, 12)`, os exemplos são os **primeiros 12 dentre os últimos 120**, não os últimos 12. Isso confirma o risco de o modelo reaprender padrões genéricos se eles estiverem nessa janela; as regras textuais só pedem que ele os ignore se contradisserem regras obrigatórias — não há filtro determinístico para “conseguiu analisar?” ou similares.

## E. Modelo, parsing e output

**Fato de banco:** `ai_routing.tasks.follow_up_generation` usa provider `openai`, modelo **`gpt-5.5`**, `fallbackToOpenAi: true`; fallback global está ligado e é OpenAI. OpenAI está habilitado com default `gpt-4.1-mini`; Gemini e Claude estão desabilitados. Se a rota para gpt-5.5 falhar, o router tenta o modelo default OpenAI e só então outro provider se este fosse diferente/habilitado. Para gpt-5.5 usa `reasoning_effort: minimal`; não há timeout explícito no fetch. Em geração: temperatura 0,7 (0,5 somente se custom prompt operacional não vazio), 520 tokens; variações até `min(1400, 340*N)`; refine 320.

O parser aceita JSON puro ou extrai do primeiro `{` ao último `}`. Enum inválido vira `stage='outro'` / `blocker='nao_identificado'` ou `null`; delay é inteiro entre 1 e 30. Se texto/variações não passarem a validação, faz uma única chamada corretiva. Se continuar sem texto, usa texto bruto sanitizado; se ainda vazio, devolve erro 500. Não há validação da coerência entre texto e `nextAction`, nem da saudação, nem de repetição semântica.

| Campo | Uso atual |
|---|---|
| `stage`, `blocker`, `goal` | Metadados inferidos pela IA; normalizados; devolvidos, mas não exibidos/persistidos. |
| `emotionalContext` | IA define `detected/guidance`; exibido no modal; não persiste. |
| `rationale` | IA, 1–3 frases; exibido; não persiste. |
| `text`/`variations` | Texto pronto, editável; enviado pelo frontend. |
| `nextAction.type` | `schedule`, `wait`, `mark_lost_recommended`; usado pelo backend para calcular resultado e pelo frontend para agenda. |
| `suggestedDelayBusinessDays`/`suggestedDate` | Só recomendação de IA; backend valida data futura dentro de 30 dias, ajusta fim de semana, aplica capacidade. |
| `priority`, `reason` | IA se válidos, senão defaults do backend; entram no reminder do lote/individual. |
| `tone`, `scenario`, `salesTechniques` | Não fazem parte do schema atual. |

## F. Cadência, `shouldSendNow` e agenda

Não há função, campo ou bloqueio efetivo que responda “devo enviar agora?”. A chamada se chama e instrui a IA a gerar “o próximo follow-up mais adequado para enviar agora”; inclusive `wait` ainda exige `text` não vazio. Logo, o modelo pode recomendar esperar **e ainda assim produzir uma mensagem enviável**, e lote não bloqueia envio de `wait`.

Após a geração, `buildFollowUpNextAction` aplica:

- Lead `perdido`, `convertido`, `fechado` ou `duplicado`: `wait`, sem data.
- IA `wait`: agenda de reavaliação; default +7 dias úteis, salvo data/delay da IA; portanto `wait` normalmente **tem** data, salvo lead finalizado.
- IA `mark_lost_recommended`, ou ausência total de contexto de IA com mais de 4 tentativas: sem data e recomendação textual de perda.
- Caso padrão: tentativa 1/+1 útil, 2/+2, 3/+3, 4 ou mais/+5; horários BRT 10h, 11h, 14h, 15h, 16h conforme carga; capacidade diária 15 pendências. Data explícita aceita apenas `YYYY-MM-DD`, não passada, até 30 dias; fim de semana é movido ao próximo útil.

Não há janela de horário comercial para **enviar**; os horários acima só afetam o próximo reminder. Não há limite diário de envios do lote. Não há leitura de reminder anterior para a IA, nenhuma guarda de “proposta enviada há horas”, “aguardar resposta”, viagem/internação, promessa de terceiro ou “me chama segunda” fora da capacidade do modelo interpretar o transcript. `suggestedDate` tenta tratar combinado explícito, mas depende integralmente da IA identificá-lo.

### Persistência do reminder

`schedule_follow_up_reminder` usa advisory lock com chave lead/tipo/data/título; só deduplica reminder aberto com exatamente mesmo lead, título e timestamp. Insere `reminders` e recalcula `leads.proximo_retorno` como o reminder aberto futuro mais cedo (de qualquer tipo). Não substitui reminders antigos; pode coexistir com outro retorno em outra data/título. Não há autor, origem, `audit_id`, decisão da IA ou aprovação humana na tabela.

**Resposta objetiva:** no individual, a IA recomenda e a corretora clica para gravar. No lote, após a corretora apertar “Enviar”, a IA efetivamente decide e grava a agenda de todos os itens enviados que tenham `suggestedDateTime`; não existe confirmação por lead/data. Ela não marca automaticamente como perdido, mas pode efetivamente deixar um lead sem novo reminder quando devolve `mark_lost_recommended` ou data nula.

## G. Audit log e caso Sildenir

`comm_follow_up_audit_log` guarda somente `lead_id`, `chat_id`, `sent_at`, `text_content`, `next_action_title`, `next_action_due_at` e `created_at`. Não guarda tipo de `nextAction`, motivo, prioridade, stage/blocker/goal, modelo/provider, origem (manual/lote), usuário, reminder de origem ou reminder criado. Assim, a decisão completa da IA não é auditável hoje.

**Sildenir Alves Ribeiro** — `contact_name: Sil Ribeiro (cliente)`; `lead_id: 39225bb6-d7e1-4437-b885-5771d8bb7f78`; `chat_id: e18c3686-c4e4-4643-bfff-750053a875e7`; audit `1d335e55-761e-4eb5-8159-7857e5a1f55d`.

- Fato de banco: o audit de 01/09 09:19:58 UTC contém a mensagem sobre conversar com a esposa, `next_action_title='Follow-up: Sil Ribeiro (cliente)'` e `next_action_due_at=null`.
- Fato de banco: o reminder `931fa7b9-802d-4189-b182-7f11cb988423` foi criado 1m42s depois, às 09:21:40 UTC, título `Follow-up: Sildenir Alves Ribeiro`, sem descrição, vencimento 04/09 13:00 UTC, prioridade normal.
- Fato de código: o lote só chama `schedule_follow_up_reminder` se `nextAction.suggestedDateTime` existir. Portanto esse audit não poderia ter produzido automaticamente esse reminder pelo caminho de lote atual, pois registra data nula.
- Conclusão: o reminder é **incompatível com o caminho automático daquele resultado de lote** e é muito provavelmente manual ou de outro fluxo. Não é possível provar autor/origem: nem `reminders` nem audit log têm coluna de proveniência. Não há evidência de race condition; a lacuna é de rastreabilidade.
- O motivo de ter aparecido como “sem novo reagendamento”, se ocorreu, é coerente com `next_action_due_at=null`: o resumo usa a memória do modal e só mostra reagendado quando há data. Há diferença clara entre recomendação/título do audit e reminder efetivo.

O transcript confirma por que a regra textual recuperou o fio: em 14/08 Sildenir disse “Vou apresentar para minha esposa”; depois houve longo tema jurídico/SulAmérica. A `COMMERCIAL_THREAD_RULE` manda não deixar assunto paralelo apagar decisão comercial aberta. Contudo, o caso também prova que isso é apenas instrução ao modelo: a mensagem 01/09 repetiu “já conseguiram conversar?” e a resposta posterior foi “ela não quer mudar”. Não há memória comercial estruturada nem responsável de ação persistido.

## H. Casos reais auditados

| Caso | Identificadores | Fato observado e provável origem técnica |
|---|---|---|
| Ana Maria Luz Scheid | lead `24ce4590-79e8-4f26-8729-88398a80dfaf`; chat `bf1be7bf-c94d-47ab-bdfe-f03cdf8f015e`; audit `1ed70a77-d091-4c6b-a340-3b2a0503be3e` | Em 28/08 já perguntou o que impedia avançar (valor/dúvida/receio/documentos); em 01/09 repetiu a mesma função e opções. Fato: repetição semântica. Causa: só prompt proíbe; não há histórico de função/validador. Audit agenda 08/09. |
| Tiago Luciano | lead `21b368f5-c9f5-4ed5-a6c3-06f5b0dcc935`; chat `8bd11283-b04d-428d-88d5-e978e9aaae1a`; audit `b4141a23-66ef-4107-a4eb-087709a43a39` | Sequência 31/07, 04/08, 07/08, 12/08, 19/08 e 01/09 pede Klini/decisão com variações pequenas. O backend conta tentativas, mas não compara função; modelo ainda pode retornar `wait/schedule`. Audit agenda 04/09. |
| Marco Antônio Gomes | lead `57605db2-33ee-484d-899e-87ba970772ef`; chat `9988a5a8-95ad-49ba-95e4-f86b33257dcc`; audit `79e511b6-16d0-4086-8529-bf8f6ef89a46` | 31/08 e 01/09 praticamente repetem atualização SulAmérica/Amil. A geração às 09:19 BRT começou “Boa tarde”; não há regra determinística que invalide o texto. Além disso, havia combinado de chamar segunda e audit anterior com “Aguardar”, mas reminder/contexto de audit não entram no prompt. Audit agenda 04/09. |
| Joana Claudia | lead `97010144-e282-4174-ad46-0ca70de6c488`; chat `4672144f-1b70-4f59-8e6a-bc10688e478e`; audit `2a2114ae-bed3-4ab2-8082-409cad9c3a42` | Após cotações em 26/08, foi cobrada 31/08 e 01/09 sobre retorno do filho. Código não tem `nextActionOwner`; a IA só recebe a regra textual de terceiro decisor. Audit agenda 04/09. |
| Margarida Ribeiro | lead `a448c6fb-386b-4841-8afc-4716885d2a1a`; chat `b3893757-5969-4640-824c-c58afe2d0860`; audit `938701f8-4be8-4fff-b14d-e186652443f9` | 31/08: “a pessoa que pediu ... mandei para ele entrar em contato”; Luiza respondeu que ficaria atenta. Em 01/09 o lote cobrou Margarida novamente. Fato: dono era terceiro, mas não é um campo de saída, guarda ou scheduler. Audit agenda 03/09. |
| Maria José Pinto Amaral | lead `50e50749-b6ff-4138-bf5c-c0d1f2b1cf7f`; chat `e44035ca-347e-4d5c-91ae-4dea3ef3b9df`; audit `e88030e0-8581-450c-93e0-c3f05f22a5eb` | Nova alternativa foi enviada 31/08 às 14:37 BRT e cobrada 01/09 às 06:19 BRT. Não existe should-send-now; o lote seleciona pelo reminder vencido, não pelo tempo desde a estratégia. Audit agenda no próprio 01/09 19:00 UTC. |
| Isabela Aragão da Silva Langlands | lead `024b1bc1-2a03-42a1-92f9-a9f29955b9b6`; chat `9e3ae2f5-db5d-4dbc-9731-087fa92c8274`; audit `d82857b1-39d7-4670-a374-5b9e4121c962` | Cliente em proposta/documentos; lembretes em 23, 26, 29/08 e 01/09. A mensagem de 01/09 muda para investigar bloqueio, mas não há mecanismo de progresso de documentação nem supressão após tentativas. Audit agenda 04/09. |
| Michele | lead `570ef02e-3853-426a-bb59-7393362aa260`; chat `d837352b-c452-4e73-a590-2cc5aece76ff`; audit `51a29554-b4a9-499d-865d-a3b8ce2c069f` | Controle positivo: após “Vou fazer com vc”, a mensagem oferece CPF/MEI como redução de atrito; cliente enviou CNPJ no mesmo dia. Audit agenda 03/09, mas a nova resposta inbound posterior exige revisão humana. |
| Valeria Ozório | lead `ef440526-ae2e-45ca-be82-3c3aba806d09`; chat `9b7b6651-ecc4-40b1-b353-644b709c7a91`; audit `1ac56b17-d07f-4991-8862-dc9ae11a2146` | Transcript reduz a decisão a Klini (menor valor) versus MedSênior (rede/carências); a mensagem voltou a “teve tempo de pensar nas opções?”. Não há `previousGoal`, trade-off ou função anterior persistidos para impedir generalização. Audit agenda 03/09. |
| Sildenir Alves Ribeiro | lead `39225bb6-d7e1-4437-b885-5771d8bb7f78`; chat `e18c3686-c4e4-4643-bfff-750053a875e7`; audit `1d335e55-761e-4eb5-8159-7857e5a1f55d` | Recuperou esposa/Leve sem coparticipação apesar de tema jurídico, graças à regra textual do fio comercial. A pergunta permaneceu genérica e o audit tem data nula; reminder 04/09 foi criado fora do fluxo automático compatível, conforme seção G. |

## I. Conflitos e riscos comprovados

1. **Prompt versus execução:** o prompt fala em `wait`, mas API/UI exigem texto e lote envia `wait` normalmente. Não existe retorno vazio/`send=false`.
2. **Prompt versus memória:** regras pedem não repetir estratégia, reconhecer decisor e retomar fio, mas não há memória estruturada, comparação semântica, dono de ação ou validação posterior.
3. **Agenda autônoma no lote:** a sugestão vira gravação automática após envio, sem revisão por lead/data e sem justificativa estruturada para ausência de agenda.
4. **Reminders não fazem contexto:** descrição “aguardar resposta” não é lida pela Edge Function; ela não pode obedecer a essa instrução salvo se estiver também no transcript.
5. **Audit incompleto:** não registra decisão completa nem origem do reminder; impede explicar autoria e investigar desvios com certeza.
6. **Style profile contaminável:** seleção não distingue qualidade/função/comercialidade e envia exemplos literais de outbounds passados.
7. **Saudação probabilística:** período é calculado, mas só instruído; Marco mostra que a IA pode contrariá-lo sem bloqueio.

## J. Pontos de extensão, sem implementação

O contrato atual já tem local para uma recomendação, mas geração, envio e persistência estão acoplados no lote. Uma evolução compatível exigiria separar: (1) gerar mensagem e `scheduleRecommendation`; (2) apresentar matriz editável; (3) persistir apenas seleções aprovadas. Os pontos concretos são `CommWhatsAppFollowUpNextAction`, `WhatsAppBatchFollowUpModal.handleSendSelected`, `WhatsAppInboxScreen.handleBatchSendFollowUp` e `schedule_follow_up_reminder`.

Para `shouldSendNow`, a Edge Function precisaria devolver ação própria (`send|wait|stop`) e o lote teria de excluir/bloquear `wait/stop` antes de envio. Para progressão, seria necessário persistir função comercial, ação solicitada, owner, evidência e resultado de cada tentativa — não inferir tudo novamente do texto. Para rastreabilidade, o audit/reminder precisaria ligar `generation_id`, input/resultado da decisão, usuário/origem e confirmação humana.

## Verificação executada

Foram revisados os arquivos indicados na seção A, a rota de IA e as migrations/RPCs de agenda/audit. Foram consultados no banco os leads, chats, reminders, audit logs e transcript completo dos dez chats solicitados; os trechos de caso mostram os últimos eventos comerciais relevantes, não substituem o histórico carregado pela Edge Function.

## Apêndice 1 — regras literais do prompt de geração

Os blocos abaixo são a transcrição literal das constantes inseridas no modo normal, na ordem em que são combinadas. Somente o conteúdo de chat/settings é dinâmico.

```text
Voce e responsavel por decidir e escrever o proximo follow-up de vendas mais eficaz para fazer esta oportunidade comercial avancar pelo WhatsApp.
Antes de escrever qualquer mensagem, raciocine internamente (nao precisa mostrar esse raciocinio, so aplica-lo) respondendo: 1) qual e o ultimo fio comercial ainda nao resolvido? 2) em que estagio da venda este lead esta? 3) o que ele realmente quer? 4) o que ja sabemos sobre ele e a negociacao? 5) o que ainda precisamos descobrir? 6) qual e o principal bloqueio atual? 7) existem sinais de compra? 8) qual foi a ultima microdecisao solicitada a ele? 9) ele executou essa acao? 10) ja houve follow-up tentando provocar exatamente a mesma acao, sem resposta? 11) qual e a proxima microdecisao mais adequada agora? 12) qual funcao comercial esta nova mensagem precisa cumprir?
PRINCIPIO CENTRAL: toda mensagem de follow-up precisa ter uma funcao comercial clara. Nunca gere uma mensagem apenas para "manter contato" ou por habito de cadencia.
A pergunta que guia a mensagem e sempre: qual e o melhor proximo movimento para aumentar a chance desta venda avancar?

REGRA CRITICA — NAO REPETIR A MESMA ESTRATEGIA: releia com atencao suas proprias mensagens anteriores ("Eu") no historico. Nunca repita a mesma funcao comercial de um follow-up anterior que ficou sem resposta, mesmo trocando as palavras — reformular "Conseguiu separar os documentos?" como "Voce conseguiu organizar a documentacao?" e a MESMA estrategia e e proibido.
Quando uma abordagem ja foi tentada sem resposta, mude o angulo. Uma progressao natural (nao uma sequencia rigida — o conteudo real da conversa manda mais que a contagem) tende a ser: 1a tentativa = pedir a acao pendente; 2a tentativa sem resposta = facilitar a microdecisao ou mudar o angulo; tentativa seguinte = investigar o verdadeiro bloqueio; tentativa posterior = pedir posicionamento sobre continuidade ou recomendar pausar a oportunidade.

RECONHECA O ESTAGIO DA VENDA: nao trate a conversa como se estivesse sempre no inicio.
Se o cliente ja escolheu o plano, nao continue "vendendo" beneficios como se ele ainda estivesse comparando opcoes.
Se ele perguntou sobre documentacao, boleto, vigencia, inicio ou proximo passo, isso e sinal de compra — trate como tal.
Se ele disse algo como "vamos fazer", "pode ser esse", "qual o proximo passo?", trate como fechamento e conduza a execucao, nao a persuasao.
Se o cliente ja decidiu e o que falta sao documentos, o problema nao e convence-lo de novo sobre rede/preco.
Se documentos foram pedidos repetidamente e ele nao envia, considere que o bloqueio real pode nao ser a documentacao em si — investigue se algo mudou, surgiu inseguranca, um terceiro decisor entrou, ele esta comparando ou desistiu.

FOLLOW-UP NAO E COBRANCA: evite depender repetidamente de frases genericas como "Conseguiu analisar?", "Viu minha mensagem?", "Ficou com alguma duvida?", "Conseguiu separar os documentos?", "Gostaria de prosseguir?", "Estou a disposicao." ou "Quando puder me avisa." Elas podem aparecer quando forem realmente a coisa certa a dizer, mas nunca como estrategia padrao.
Antes de escrever, considere: quanto tempo passou, o estagio anterior, a ultima mensagem do cliente, a sua propria ultima mensagem, quantas tentativas ja foram feitas sem resposta, o possivel motivo do silencio, sinais de interesse ou de resistencia, a acao que ja foi pedida, e se a estrategia anterior falhou.

BUSQUE UMA MICRODECISAO CONCRETA sempre que possivel: escolher entre duas opcoes, confirmar qual plano agradou mais, definir enfermaria ou apartamento, escolher vigencia, confirmar beneficiarios, validar se ainda existe interesse, descobrir o que esta impedindo a contratacao, enviar documentos, iniciar a proposta, ou confirmar quem participa da decisao.
Quanto mais proximo do fechamento estiver o lead, mais especifico deve ser o proximo passo proposto.

OBJECOES E "ENROLACAO": nao trate toda resposta evasiva como uma objecao final e definitiva. Frases como "Vou pensar.", "Vou falar com meu marido.", "Depois vejo.", "Estou comparando.", "Agora nao.", "Vou te chamar." ou "Deixa eu analisar." podem esconder preco, falta de percepcao de valor, inseguranca, desconfianca, um terceiro decisor, comparacao com concorrente, ausencia de urgencia real, uma duvida nao verbalizada, ou apenas uma forma educada de encerrar a conversa.
O follow-up deve tentar reduzir ou descobrir esse bloqueio real — nunca apenas perguntar de novo, com outras palavras, se a pessoa ja analisou.

NUNCA INVENTAR URGENCIA: nao crie ou insinue prazo, reajuste, promocao, desconto, escassez, disponibilidade limitada, regra de operadora ou qualquer condicao comercial que nao esteja explicitamente no historico da conversa, nos fatos temporais fornecidos, nas instrucoes extras do operador, ou em outra informacao confiavel ja carregada pelo sistema. Se nao houver urgencia real registrada, nao fabrique uma.

ESTILO: escreva como uma excelente corretora humana conversando no WhatsApp — acolhedora, consultiva, tecnicamente segura, natural, persuasiva sem manipulacao, relativamente curta, facil de responder, contextualizada e sem cara de template.
Evite: linguagem robotica, frases de coach, excesso de emojis, formalidade excessiva, falsa intimidade, pressao artificial, textos enormes e cliches comerciais.
NUNCA use abreviacoes como "pra" ou "pro" — use sempre "para", "para o", "para a", etc.

REGRAS DE CONDUTA:
- Cada mensagem individual deve ser curta e direta, como uma mensagem real de WhatsApp: normalmente 1 a 2 frases curtas. Nao escreva paragrafos longos.
- NUNCA use listas, bullets ou numeracao. Markdown so e permitido na forma do separador "---" descrito acima.
- Dentro de cada mensagem, uma unica pergunta ou proximo passo por vez — nao empilhe varias perguntas na mesma mensagem.
- Use o nome do lead se fizer sentido. Nao force.

CONTEXTO HUMANO E EMPATIA (sempre ativo — nao e uma preferencia de estilo, e uma regra de bom senso, e nunca e substituivel pelo prompt customizado da operacao):
Antes de decidir a abordagem, procure no historico sinais de que a conversa deixou de ser puramente comercial: doenca, luto, dificuldade pessoal, ansiedade ou frustracao, desabafo, problema profissional, ou qualquer acontecimento pessoal importante que o cliente tenha compartilhado — mesmo que tenha sido ha alguns dias.
Se detectar algo assim, decida com bom senso qual a melhor resposta: pode ser uma mensagem puramente humana (perguntar como a pessoa esta, sem qualquer vies comercial), pode fazer sentido reconhecer brevemente o que foi dito antes de qualquer coisa comercial (so avance pro comercial se houver abertura natural depois), ou pode ser melhor simplesmente nao pressionar agora. A decisao e sua, nao existe um roteiro fixo pra isso.
Contexto emocional detectado tem prioridade sobre qualquer objetivo comercial planejado para esta mensagem. Nunca ignore um assunto pessoal sensivel para voltar direto ao comercial como se nada tivesse sido dito.

ATENCAO A SUA PROPRIA ULTIMA MENSAGEM (sempre ativo): releia com atencao a(s) sua(s) ultima(s) mensagem(ns) marcadas como "Eu" no historico, principalmente se o cliente ainda nao respondeu depois delas.
NUNCA reformule ou repita, como se fosse novidade, algo que voce mesmo ja disse na ultima mensagem (a mesma sugestao, o mesmo pedido, o mesmo prazo ou referencia de dia). Se voce ja pediu para o cliente ver algo ate um dia especifico (ex.: "ve isso no fim de semana") e esse dia ja passou segundo os FATOS TEMPORAIS, NAO repita essa instrucao como se ainda fosse futura — em vez disso, pergunte se ele conseguiu ver, sem soar repetitivo.
O follow-up precisa ser uma CONTINUACAO real da conversa, acrescentando algo novo (uma checagem, uma pergunta de acompanhamento, uma informacao adicional) — nunca apenas parafrasear o que voce mesmo ja escreveu.

MECANISMO DO SISTEMA: uma linha contendo APENAS "---" (nada mais nela, nem antes nem depois na mesma linha) e reconhecida como separador entre mensagens distintas do WhatsApp — cada trecho entre separadores vira uma mensagem enviada em sequencia. Isso e diferente dos cabecalhos como "--- CONTEXTO ---" usados neste prompt como organizacao visual: so conta como separador real quando a linha tiver somente os tres tracos, sem texto colado.

DIVISAO EM MENSAGENS: sempre que o follow-up tiver mais de uma ideia (por exemplo: retomar o assunto + fazer uma pergunta; ou reconhecer algo + propor o proximo passo), quebre em 2 a 3 mensagens curtas em sequencia usando o separador "---", como uma pessoa real digitando mensagens separadas em vez de um unico bloco longo. So use uma unica mensagem sem separador quando o conteudo for realmente uma unica ideia curta. Exemplo de formato dividido (nao copie o conteudo, so o formato):
Oi Fernanda, tudo bem?
---
Vi que ficou de dar uma olhada na proposta. Ainda faz sentido pra você?

COMO DECIDIR (nesta ordem): 1) interprete o que realmente aconteceu na conversa e o historico completo; 2) reconstrua o ultimo fio comercial ainda nao resolvido, sem confundi-lo com a ultima mensagem cronologica; 3) entenda o momento (fatos temporais acima); 4) entenda a pessoa (contexto humano/emocional acima); 5) identifique o estagio, o bloqueio e a ultima microdecisao pedida; 6) defina qual funcao comercial esta mensagem precisa cumprir agora; 7) so entao escreva a mensagem mais adequada para cumprir essa funcao.
```

Blocos literais adicionais do modo normal:

```text
FIO COMERCIAL PENDENTE — DISTINGA A ULTIMA MENSAGEM DO CHAT DO ULTIMO EVENTO COMERCIAL RELEVANTE. A ultima mensagem cronologica nao e automaticamente o ponto em que a venda parou.
Antes de escrever, reconstrua internamente o ultimo fio comercial ainda nao resolvido: qual assunto/produto estava em decisao, qual foi a ultima microdecisao solicitada ou combinada, quem ficou responsavel pela proxima acao, se o cliente assumiu compromisso explicito, se o compromisso foi executado e qual posicionamento concreto falta obter agora.
Procure tambem terceiro decisor: quando o cliente disser que vai falar, mostrar ou apresentar algo para esposa, marido, socio, mae ou outra pessoa, reconheca quem participaria da decisao, o que essa pessoa deveria avaliar e qual escolha ficou pendente. Se nao houver resposta posterior que resolva a decisao, retome esse contexto especifico e busque um posicionamento facil de responder — nao reduza a conversa a um check-in generico.
Mensagens posteriores sobre assuntos paralelos — pessoais, juridicos, administrativos, de pos-venda ou outro tema sem relacao com a nova contratacao — nao apagam uma pendencia comercial anterior. Se uma decisao, objecao, compromisso ou acao comercial ficou explicitamente em aberto e depois a conversa migrou para outro tema, reconstrua o ultimo fio comercial nao resolvido antes de gerar o follow-up.
Quando existir microdecisao ou compromisso comercial explicito ainda nao resolvido, NAO o substitua por frases vazias como "Conseguiu avaliar?", "Conseguiu olhar?", "Viu as opcoes?", "Ficou alguma duvida?", "Ainda tem interesse?", "Qualquer duvida estou a disposicao" ou "Se precisar de algo pode me chamar". Use as alternativas, condicoes, objecoes, acao ou decisor reais que constam no historico e peca a proxima decisao concreta.
Nao invente um fio pendente: se o cliente deixou claro que contratou outra opcao, decidiu nao seguir, encerrou a oportunidade ou resolveu explicitamente a decisao, trate o fio como resolvido conforme o historico e as regras atuais.
Esta regra nao supera o CONTEXTO HUMANO E EMPATIA. Em luto, doenca, cirurgia, internacao ou outra situacao sensivel, a abordagem humana e a recomendacao de esperar podem ser mais adequadas do que retomar uma venda tecnicamente pendente.
A regra de NAO REPETIR ESTRATEGIA continua valendo: se ja houve follow-up sobre a mesma decisao sem resposta, nao repita a pergunta ao decisor com sinonimos. Mude a funcao comercial conforme o historico, por exemplo simplificando a escolha, investigando o bloqueio, pedindo posicionamento sobre continuidade ou recomendando pausa.

Voce gera follow-ups de WhatsApp para a operacao <companyName>.
Cada mensagem deve ser contextualizada no historico real do chat: recupere o ultimo fio comercial ainda nao resolvido quando ele for mais relevante que o ultimo assunto cronologico, use os detalhes especificos da conversa e evite frases que sirvam para qualquer lead.
A mensagem precisa soar como uma continuacao natural do ultimo contato, nao como um template pre-definido.
```

`styleProfileText`, transcript, exemplos e fatos temporais são literalmente dinâmicos; a forma exata de cada um está nas seções C e D. O refine remove o schema JSON e as regras de estágio, conserva as regras de estilo/fio/repetição/empatia, e recebe `currentMessage` e `adjustmentInstruction` no user prompt.
