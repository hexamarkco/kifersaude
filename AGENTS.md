# Project Operating Conventions

Este projeto adota, como referencia operacional permanente, os seguintes frameworks e colecoes de praticas:

- `claude-mem`
- `get-shit-done`
- `superpowers`
- `awesome-claude-code`
- design system proprio Kifer Saude

## Default workflow

Para qualquer tarefa, seguir este fluxo:

1. `discovery`
   - entender o problema, restricoes, contexto e impacto
   - revisar arquivos relevantes antes de propor mudancas
2. `planning`
   - definir a estrategia de menor risco
   - alinhar abordagem com decisoes ja existentes no projeto
3. `execution`
   - implementar de forma incremental, tipada, modular e manutenivel
   - preferir componentes reutilizaveis e baixo acoplamento
4. `verification`
   - validar comportamento, revisar regressao e registrar achados relevantes

Antes de gerar codigo grande, explicar rapidamente o plano e depois implementar.

## Memory and decision tracking

Aplicar uma memoria persistente inspirada em `claude-mem`:

- registrar decisoes importantes do projeto neste arquivo ou em documentacao dedicada
- respeitar padroes arquiteturais ja adotados antes de sugerir mudancas estruturais
- evitar recomendacoes que contradigam decisoes anteriores sem explicitar tradeoffs
- ao identificar uma nova convencao relevante, adiciona-la de forma sucinta e objetiva

## Frontend and UX

Ao trabalhar com interface, usar como criterio:

- UX clara e orientada a tarefa
- consistencia visual entre telas e estados
- componentes reutilizaveis e composiveis
- boas praticas modernas de UI
- acessibilidade, responsividade e feedback de estado como requisitos basicos

Mudancas visuais devem preservar a linguagem existente do produto, salvo quando a tarefa pedir evolucao de design.

## Engineering standards

Ao implementar ou corrigir:

- preferir solucoes tipadas, modulares, escalaveis e faceis de manter
- investigar bugs com profundidade antes de corrigir sintomas
- refatorar de forma estruturada quando isso reduzir risco ou complexidade
- considerar automacoes, verificacoes e organizacao de projeto quando agregarem valor real

## Working style

- nao pular direto para codigo sem contexto
- nao propor mudancas amplas sem verificar impacto no projeto atual
- comunicar o plano de forma curta quando a tarefa tiver mais de um passo relevante
- finalizar tarefas com validacao objetiva e riscos remanescentes, se houver

## Project memory

- 2026-03-10: Este repositorio passou a adotar como referencia permanente os frameworks `claude-mem`, `get-shit-done`, `superpowers` e `awesome-claude-code` para comportamento, planejamento e execucao.
- 2026-03-11: A paleta institucional padrao do front passa a priorizar marrom, laranja, preto e branco, com cinzas apenas como apoio neutro. Cores semanticas como verde, vermelho e azul devem ficar restritas a feedback funcional e status.
- 2026-03-11: Superficies de comunicacao/WhatsApp devem priorizar classes semanticas compartilhadas `.comm-*` e o comando `npm run audit:visual` passa a ser a referencia para rastrear hardcodes visuais remanescentes no `src`.
- 2026-03-22: O hot path de nao lidas do WhatsApp passa a priorizar cursores compartilhados por chat (`whatsapp_chat_read_cursors`) e a inbox deve evitar cargas globais antecipadas de fotos fallback e syncs agressivos quando o chat ainda esta fresco.
- 2026-03-22: O armazenamento bruto de webhooks barulhentos do WhatsApp deve priorizar archive em Storage (`whatsapp-webhook-archive`) com resumo leve em `whatsapp_webhook_events`, preservando compatibilidade para scripts operacionais.
- 2026-03-26: O modulo operacional `/painel/whatsapp` e sua stack de inbox/campanhas foram removidos; permanece apenas a integracao WhatsApp usada por automacoes e configurada em Integracoes/Automacoes.
- 2026-04-29: O projeto deixa de usar `ui-ux-pro-max-skill` como referencia de UI e passa a adotar o design system proprio Kifer Saude. Novas interfaces de `/painel` devem priorizar `src/design-system` e tratar `src/components/ui` como camada de compatibilidade temporaria durante a migracao.
- 2026-05-08: Mídias do WhatsApp operacional devem ser arquivadas em Storage (`comm-whatsapp-media`) no webhook/sync e servidas pela Edge Function `comm-whatsapp-media`, evitando depender de URLs/MediaIDs temporários da Whapi para histórico antigo.
- 2026-05-18: Raios de borda em novas telas de `/painel` devem usar tokens semanticos do design system (`--kds-radius-*`) via componentes DS; evitar valores arbitrarios como `rounded-[26px]` ou `rounded-[1.7rem]` salvo necessidade visual documentada.
- 2026-05-20: Sugestoes de IA no inbox WhatsApp devem seguir o padrao conversacional Kifer: mensagens curtas, condução passo a passo e uma unica pergunta por vez; evitar listas/checklists para coletar dados salvo pedido explicito do cliente.
- 2026-05-20: O desarquivamento automatico de chats do WhatsApp em `comm_whatsapp_persist_message` agora exige (a) mensagem recem inserida, (b) inbound real (`increment_unread=true` e `direction='inbound'`), (c) chat nao mutado e (d) `message_at > archived_at`. Syncs manuais de historico, envios outbound e eventos de status nao desarquivam mais conversas. O patch otimista de arquivamento no front passa a ter TTL de 30s e janela de protecao de 20s contra refetch/realtime.
- 2026-05-20: Excluir conversa no Inbox WhatsApp passa a ser soft-delete (`comm_whatsapp_chats.deleted_at`), removendo a conversa das listagens/search/unread; uma nova mensagem inbound real posterior a `deleted_at` reabre automaticamente o chat.
- 2026-06-30: A base do design system do CRM passa a ser dark-first em `src/design-system`, com tokens globais `--bg-*`, `--text-*`, `--brand-primary`, `--accent-gold`, estados semanticos e aliases `--panel-*` apenas como compatibilidade temporaria. Novas telas e a proxima varredura page-by-page devem usar os componentes DS em vez de hardcodes visuais.
- 2026-06-30: O design system do CRM passa a ter `theme-light` complementar ao dark mode, mantendo terracota/laranja queimado/dourado sobre canvas off-white, surfaces brancas, bordas bege suaves e sombras leves. O dark mode nao deve ser substituido; componentes DS devem funcionar nos dois temas via tokens semanticos.
- 2026-07-01: O sistema passa a usar somente duas fontes: `Playfair Display` para titulos/display e `Inter` para corpo, UI, dados, codigo e qualquer uso mono. Novas interfaces devem usar os tokens `--font-display`, `--font-sans`, `--ks-font-heading` e `--ks-font-body`, sem introduzir outras familias tipograficas.
- 2026-07-13: O design system visual do CRM passa a seguir a referencia Terracota CRM em light-first: canvas bege quente, superficies branco quente, terracota para acao primária, dourado para destaque e marrom profundo para titulos. Raios devem permanecer contidos (`6/8/12/16px`), sombras sutis e gradientes apenas quando comunicarem estado; o dark mode permanece opcional e deve reutilizar os mesmos tokens semânticos.
- 2026-07-31: Pipeline de automacoes de WhatsApp (fluxos de inatividade) passa a ter rede de seguranca definitiva: (a) `automation_run_log` registra toda execucao de cron (nada falha silenciosamente); (b) `automation_flows_health()` e a RPC de diagnostico unica; (c) `scripts/verify-automations.mjs` (npm `verify:automations`) e o smoke test pos-deploy obrigatorio — `run-supabase-migrations.sh` o executa ao final; (d) trigger `trg_preserve_inactivity_flow_activation` impede que qualquer save de settings apague `triggerActivatedAt` de fluxos de inatividade (fail-closed protege o fluxo); (e) a tabela `leads` NAO possui coluna `ativo` — usar `arquivado` e nunca referenciar `l.ativo` em SQL; (f) arquivamento de chat (`comm_whatsapp_chats.is_archived`) ou de lead (`leads.arquivado`) NAO exclui o lead dos fluxos — regra operacional.
- 2026-07-31: Execucao de fluxos de automacao e SEMPRE sequencial e ancorada na realidade: (a) `scheduleFlowJobs` cria apenas a 1a etapa; a proxima so e agendada quando a anterior COMPLETA (`scheduleNextFlowStep`, due = conclusao real + delay ajustado por janela); (b) o horario da 1a etapa de fluxos de inatividade e ancorado no momento em que o lead completou a elegibilidade (`inactivity_started_at + triggerDurationHours`), NAO no tick do cron — cada lead recebe no seu horario individual, nunca em lote; (c) elegibilidade atrasada e excedentes de cap diario usam `getSpreadSendAt` (hash deterministico do lead sobre a janela 07-19h) para espalhar envios; (d) etapa de envio suporta `step.messages[]` (lista de mensagens proprias do WhatsApp em ordem) — "enviar junto" = 1 etapa com N mensagens; nao existe modo `together`; (e) regra operacional: leads sem chat ativo sao movidos para Perdido (execucao unica via migration; exclui Convertido, leads com contrato, arquivados e criados ha <48h).
- 2026-08-01: Fluxos de automacao passam a ter flag `ativo` (default true) por fluxo — toggle na aba "Regras e agenda" (Switch + badge "Desativado"); todos os pontos de execucao respeitam o flag: cron de inatividade (SQL), `runAutoContactFlowEngine`, `check-inactivity-duration` (responde skipped) e `processFlowJobs` (jobs pendentes de fluxo inativo viram skipped 'Fluxo desativado' — self-healing, sem envio). Pausa global e `settings.autoSend=false` (crons no-op). `automation_flows_health()` expoe `ativo` por fluxo. Restricao WhatsApp (24h, sem novos chats/QR) impoe: caps conservadores pos-ban (CI 15/dia, EmAt 10/dia) e Abordagem com 1 mensagem ate o numero aquecer.
- 2026-08-01: Piso de duracao de inatividade removido — `triggerDurationHours` e configuravel a partir de 1h (antes forcava 24h); fluxo CI configurado com 2h. Lista operacional `scripts/spread-existing-leads.mjs` (npm `spread:leads`): zera a fila dos fluxos de inatividade e cria jobs de etapa 0 para todos os leads atuais em CI/EmAt, espacados deterministicamente (hash do lead) em 45 dias uteis (seg-sab, 07-19h BRT) — novos leads entram no fluxo normal (nao recebem job da lista). Caps pos-ban finais: CI 10/dia, EmAt 5/dia.
- 2026-08-01: Arquivamento NAO afeta fluxos nem filas — nem `comm_whatsapp_chats.is_archived` (organizacao do inbox) nem `leads.arquivado`. A funcionalidade de arquivar/desarquivar LEAD foi REMOVIDA da UI de Gestao de Leads (botoes individuais, bulk action, toggle "Ver arquivados", filtros no Kanban); o campo `leads.arquivado` permanece apenas como flag interna do sistema (auto-arquivo por numero invalido) e o script `spread:leads` nao filtra por arquivado.
- 2026-08-03: `leads.skip_automation` e a forma de criar um lead manual sem entrar no fluxo de abordagem (ja abordado manualmente). O flag PERSISTE (o trigger nao zera mais) e e respeitado em TODOS os pontos de entrada: trigger `trigger_auto_send_lead_messages` (nao dispara), cron `check_auto_contact_inactivity_triggers` (filtra `NOT COALESCE(l.skip_automation, false)`), `leads-api` actions `auto-contact` e `check-inactivity-duration` (respondem skipped `skip_automation`), `runAutoContactFlowEngine` (aborta) e `scripts/spread-existing-leads.mjs` (exclui). O toggle de criacao fica em `src/components/LeadForm.tsx`.
- 2026-08-04: O fluxo de abordagem (`triggerType='lead_created'`) NAO usa `getSpreadSendAt` — a 1a mensagem vai para o proximo horario permitido (`getNextAllowedSendAt(now)`): imediata se a deteccao ocorrer dentro da janela, ou na proxima abertura (07:00) se fora. O spread por hash fica restrito a fluxos de inatividade/status_duration (backlog, elegibilidade atrasada e excedentes de cap). O fluxo de abordagem nunca tera `dailySendLimit`.
- 2026-08-04: A semantica "sem resposta" dos fluxos de inatividade: o follow-up so e agendado quando a ULTIMA mensagem do chat e outbound (estamos aguardando o cliente). (a) O cron `check_auto_contact_inactivity_triggers` exclui leads com `comm_whatsapp_chats.last_message_direction = 'inbound'`; (b) as guardas em `check-inactivity-duration` e `processFlowJobs` skip/cancelam quando a ultima mensagem inbound e posterior a ultima outbound (ou ao `inactivity_started_at`) — motivo "Cliente respondeu após a última mensagem enviada"; (c) `getSpreadSendAt` so e aplicado para backlog real (>15min de atraso); elegibilidade fresca (cron a cada 5min) dispara no proximo tick do process. Regra operacional: cliente que respondeu fica aguardando resposta humana — nenhum follow-up automatico ate haver outbound novo.
- 2026-08-04: Regra sticky do "sem resposta": uma vez que o cliente RESPONDEU (mensagem inbound REAL — preview visivel, ignorando ruido tecnico como `[Mensagem]`/type unknown — posterior a 1a outbound real do lead), o fluxo de inatividade e CANCELADO e o lead nunca mais e elegivel para novas execucoes, mesmo que o operador responda depois. Implementado via: (a) predicado sticky no cron (EXISTS inbound real > first outbound via `comm_whatsapp_message_preview_text`; o outbound_activity ignora o filtro de preview por performance — ~1.2% das outbounds sao tecnicas); (b) cancelamento ativo no cron (jobs pending de leads que responderam viram skipped 'Cliente respondeu - fluxo de inatividade cancelado' em ate 5min); (c) guards do leads-api usam `visibleOnly` (so mensagens reais); (d) `spread:leads` exclui chats com `last_message_direction = 'inbound'`; (e) o predicado de resposta inclui chats soft-deleted (`deleted_at` e so organizacao de inbox; resposta em chat excluido continua valendo). O lead so volta a ser elegivel se o status sair e voltar a CI/EmAt com novo ciclo (jobs novos dependem da elegibilidade).
- 2026-08-30: O trigger `cancel_auto_contact_jobs_on_inbound_message()` deve cancelar jobs pendentes apenas de fluxos `triggerType='inactivity_duration'`. Respostas inbound reais nao podem cancelar etapas administrativas do fluxo de Abordagem (`lead_created`), especialmente `update_status -> Contato Inicial`. O atendimento autonomo pode ser acionado pela Abordagem, mas so deve ativar chats novos/sem historico visivel anterior ao lead; chats antigos, pessoais ou reaproveitados ficam manuais por seguranca.
- 2026-08-31: A fila de campanhas WhatsApp (`claim_comm_whatsapp_campaign_targets`) deve priorizar alvos ja admitidos em passos posteriores (`current_step_index > 0`) antes de novos contatos no passo 0. O limite diario/ritmo protege apenas admissao de contato novo; pacotes de mensagens imediatas e follow-ups vencidos nao podem ficar famintos atras de milhares de alvos iniciais rate-limited.
- 2026-08-31: Em campanhas WhatsApp, `stop_on_reply` nao deve interromper mensagens do mesmo pacote/estagio com `delay_amount=0`; respostas inbound devem ser registradas em `responded_at`, mas a parada efetiva ocorre antes do proximo passo com espera real (ex.: follow-up 24h ou mudanca de status apos 48h). Isso evita que auto-respostas/saudacoes rapidas do WhatsApp Business cortem a sequencia no primeiro "Oi".
- 2026-09-01: Em campanhas WhatsApp, eventos inbound tecnicos/invisiveis (`comm_whatsapp_message_preview_text(...) IS NULL`, ex.: `message_type='unknown'` com `[Mensagem]`) nao contam como resposta para `stop_on_reply`. A RPC `resolve_comm_whatsapp_campaign_stop_on_reply` e o worker devem usar a mesma semantica de preview visivel antes de marcar `responded_at` ou parar a sequencia.
- 2026-08-24: Nova pagina publica `/forms/:slug` (formularios de captacao configuraveis, estilo multipla escolha/uma pergunta por tela) com builder em Configuracoes > Formularios (`config-forms`). Modelo: `public_forms` + `public_form_steps` (tipos `single_choice`/`multi_choice`/`short_text`/`contact`, a etapa `contact` e sempre fixa e a ultima) + `public_form_submissions`. Envio publico passa OBRIGATORIAMENTE pela Edge Function `public-form-submit` (nunca insert direto via RLS), que replica o padrao de seguranca do `public-lead-submit`: allowlist de origem, honeypot, rate limit por IP hasheado (`consume_public_form_rate_limit`/`public_form_rate_limits`, tabela separada da do quote form) e validacao server-side das respostas contra a definicao real das perguntas (`supabase/functions/_shared/public-form-validation.ts`). Cada submissao valida cria um Lead de verdade (nome/telefone do passo `contact`; `cidade`/`tipo_contratacao_id` mapeados quando um step tiver `field_key`; demais respostas + link de geolocalizacao viram resumo em `observacoes`). Geolocalizacao (GPS do navegador) e opcional por formulario (`request_geolocation`), sempre "pulavel" no wizard publico, nunca bloqueia o envio.
- 2026-09-13: O fluxo de abordagem (`triggerType='lead_created'`) ganhou rede de seguranca propria: diferente dos fluxos de inatividade/status_duration, ele dependia 100% do trigger sincrono `trigger_auto_send_lead_messages` (INSERT em `leads`) chamar `leads-api?action=auto-contact` com sucesso — se essa chamada falhasse (cold start, erro transitorio, deploy em andamento), nenhum job era criado em `auto_contact_flow_jobs` e o lead ficava orfao para sempre (nenhum cron existente varria `leads` procurando leads sem job de abordagem), exigindo correcao manual do status para "Contato Inicial". Novo cron `check-lead-created-backlog-triggers` (5min, `check_lead_created_backlog_triggers()`) varre leads criados nas ultimas 72h sem `skip_automation`, fora de campanha e sem NENHUM job em `auto_contact_flow_jobs`, e redispara a avaliacao via nova action `check-lead-created-backlog` do `leads-api` (reusa `runAutoContactFlowEngine`, a mesma logica de matching/agendamento do trigger original). `automation_flows_health()` passa a reportar esse cron (`crons.leadCreatedBacklog`) e o tamanho do backlog (`eligibleLeadCreatedBacklog`).
- 2026-08-31: O gerador de follow-up deve distinguir a ultima mensagem cronologica do ultimo fio comercial ainda nao resolvido. Assuntos paralelos nao apagam decisao, objecao, compromisso ou acao comercial pendente; a retomada deve recuperar decisor, alternativas e microdecisao reais, sem substituir esse contexto por check-in generico. Contexto humano sensivel e a regra de nao repetir estrategia continuam prioritarios.
- 2026-09-01: A identidade de chats WhatsApp deve priorizar nome de perfil/push name retornado por `GET /contacts/{ContactID}` da Whapi sobre `chat_name` do evento/chat, pois este ultimo pode refletir conteudo de mensagens interativas. Botoes/listas recebidos no inbox respondem com o titulo escolhido citado na mensagem original; a Whapi nao expoe endpoint para sintetizar o evento nativo de clique de mensagem de terceiro.
- 2026-10-02: Chat arquivado deve ser desarquivado automaticamente quando o usuario envia uma mensagem OU quando o contato envia uma mensagem (exceto se silenciado). A protecao contra ecos outbound (mensagem antiga que chega depois do archive) e feita por `v_result.inserted` (dedup) e `v_message_at > archived_at` (mensagem posterior ao archive). No frontend, `pendingChatInboxState` libera o patch otimista de archive quando o servidor desarquiva (inbound ou outbound) — nao ha mais restricao de direcao. Ao enviar de um chat arquivado, o frontend troca automaticamente para a secao "Conversas".
- 2026-10-02: `comm_whatsapp_persist_message_internal` agora resolve o chat canônico via `comm_whatsapp_resolve_canonical_chat_uuid` ANTES de buscar/criar o chat, em vez de fazer match exato por `external_chat_id`. Isso garante que mensagens sempre vão para o chat correto quando existem variantes de telefone (12 vs 13 dígitos) ou chats mesclados. O wrapper `comm_whatsapp_persist_message` também foi atualizado para SEMPRE retornar `v_canonical_chat_id` e usar o canônico em `register_chat_identifier`, `try_auto_link_chat` e `refresh_chat_identity`, mesmo quando há divergência de identidade (log mas sem corromper o mapeamento).
- 2026-10-02: **Bug crítico corrigido**: as migrations 20261002003000 e 20261002005000 substituíram `comm_whatsapp_persist_message_internal` mas REMOVERAM o `INSERT ... ON CONFLICT DO NOTHING` do path com `external_message_id`, substituindo por SELECT+UPDATE condicional. Resultado: webhook e send atualizavam `last_message_text` no chat mas NUNCA criavam a mensagem em `comm_whatsapp_messages` — thread vazia, status travado em "Enviando". Corrigido na migration 20261002010000 restaurando o INSERT original. **Lição**: ao reescrever PL/pgSQL complexa, preservar TODOS os caminhos de INSERT/UPDATE, não apenas os visíveis no diff.
- 2026-10-02: Status de entrega WhatsApp (sent→delivered→read) agora usa fallback via `GET /statuses/{MessageID}` do Whapi quando o webhook de read não chega. `REFRESHABLE_OUTBOUND_STATUSES` e `REFRESHABLE_STATUSES` incluem "delivered" para continuar pollando até detectar "read". Frontend continua agendando refresh para mensagens delivered.
- 2026-10-02: Script de recuperação `scripts/recover-whatsapp-messages.mjs` (`npm run recover:messages` se configurado) recupera mensagens perdidas via `GET /messages/list/{ChatID}` do Whapi. Usa `comm_whatsapp_persist_message` para re-inserir com dedup por `external_message_id`. Execução: `node scripts/recover-whatsapp-messages.mjs --token=XXX [--chat=UUID] [--limit=N] [--apply]`.



