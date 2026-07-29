# Auditoria Tecnica: Whapi e Inbox

Data: 2026-07-29

Esta auditoria foi concluida sem alteracoes de codigo, banco, configuracoes ou dados.

## 1. Resumo Executivo

Conclusao: a integracao funciona para mensagens diretas, envio, status e recuperacao manual, mas ha riscos relevantes de seguranca e consistencia antes de considera-la robusta para operacao continua.

| Prioridade | Achado principal | Impacto |
|---|---|---|
| P0 | `webhook_secret` pode ser lido por usuarios autenticados com acesso ao Inbox | Forja de webhooks e insercao indevida de mensagens |
| P1 | Payloads oficiais `messages.patch` nao sao processados | Edicoes e atualizacoes podem sumir silenciosamente |
| P1 | Worker de campanhas pode duplicar envios em falhas ambiguas | Cliente recebe mensagens repetidas |
| P1 | Limites, locks e `stop_on_reply` nao sao estritamente garantidos | Excesso de disparos ou follow-up apos resposta |
| P1 | Webhook bloqueia em consultas e downloads remotos por mensagem | Latencia, retries e perda de estabilidade sob volume |
| P2 | Sincronizacao de historico e uma pagina unica e nao suporta `@LID` | Historico incompleto e chats potencialmente ignorados |
| P2 | Atualizacoes de reacoes/link previews podem nao atualizar a tela | Inbox fica visualmente desatualizado |

Fatos confirmados sao baseados no codigo e migrations atuais. Hipoteses dependem da configuracao remota atual da Whapi, que nao esta versionada no repositorio.

Validacoes executadas:

- `npm test`: 72 testes aprovados.
- `npm run migrations:check`: aprovado.
- `npm run lint`: falha existente em `supabase/functions/comm-whatsapp-suggest-reply/index.ts` por `no-misleading-character-class`.
- Nao ha cobertura automatizada suficiente para Edge Functions, payloads reais da Whapi, concorrencia de campanhas ou recuperacao de webhooks.

## 2. Visao Geral Da Implementacao Atual

```text
Whapi
  -> comm-whatsapp-webhook
  -> comm_whatsapp_persist_message
  -> comm_whatsapp_chats / comm_whatsapp_messages
  -> Realtime + polling
  -> WhatsAppInboxScreen

Usuario do Inbox
  -> comm-whatsapp-send
  -> comm-whatsapp-manage-message
  -> comm-whatsapp-react
  -> Whapi

Campanhas / automacoes
  -> comm-whatsapp-campaign-worker
  -> Whapi /messages/text
  -> persistencia local

Recuperacao manual
  -> comm-whatsapp-sync-chat
  -> Whapi /messages/list/{chatId}
  -> persistencia local
```

| Area | Implementacao atual |
|---|---|
| Entrada | `comm-whatsapp-webhook` aceita `POST`, `PUT`, `PATCH` e `DELETE` |
| Persistencia | RPC `comm_whatsapp_persist_message`, com deduplicacao por `external_message_id` |
| Status | `comm_whatsapp_update_message_status` mantem status pendente antes da mensagem existir |
| Midia | Arquivamento proprio em Storage e proxy por `comm-whatsapp-media` |
| Inbox | Realtime por conversa selecionada, polling de chats e mensagens |
| Campanhas | Worker com claim SQL via `FOR UPDATE SKIP LOCKED` |
| Identidade | Busca nome do chat/contato na Whapi e associa lead por telefone quando ha uma unica correspondencia |
| Escopo | Chats diretos `@s.whatsapp.net`; grupos e `@LID` nao sao suportados no fluxo atual |

Pontos positivos:

- Tokens da Whapi sao tratados no backend; o cliente nao recebe o token.
- Midias nao dependem apenas de URLs temporarias da Whapi.
- Status recebidos antes da mensagem possuem tabela pendente e trigger de reconciliacao.
- Envio manual possui reserva por `clientRequestId`.
- O worker usa locks SQL, o que reduz duplicidade em cenarios normais.

### Compatibilidade Com A Whapi

| Recurso Whapi | Estado atual |
|---|---|
| `POST /messages/text` | Compativel |
| Status `statuses.post` e `statuses.put` | Compativel |
| Webhook por `POST`/`PUT`/`PATCH`/`DELETE` | Metodo aceito, mas payload `PATCH` nao e totalmente interpretado |
| `messages.patch` com `messages_updates` | Nao compativel |
| `chats.patch` com labels/mute/archive | Nao consumido |
| Identificadores `@LID` | Nao compativel |
| Header customizado de webhook | Nao usado |
| Resync de mensagem ausente | Nao usado |
| Marcacao individual de leitura na Whapi | Nao usada |

Referencias oficiais:

- [Webhooks e modos de entrega](https://support.whapi.cloud/help-desk/receiving/webhooks/detailed-webhook-settings.md)
- [Formato de mensagens recebidas](https://support.whapi.cloud/help-desk/receiving/webhooks/incoming-webhooks-format/incoming-message.md)
- [Status de mensagens](https://support.whapi.cloud/help-desk/receiving/webhooks/incoming-webhooks-format/sent-message.md)
- [Eventos de chat](https://support.whapi.cloud/help-desk/receiving/webhooks/incoming-webhooks-format/chats.md)

## 3. Bugs, Riscos E Inconsistencias

### P0-01. Segredo Do Webhook Exposto A Usuarios Do Inbox `[Confirmado]`

**Evidencia.** `comm_whatsapp_channels.webhook_secret` e uma coluna comum da tabela em `supabase/migrations/20260910100000_add_comm_whatsapp_inbox_mvp.sql:77-95`. A policy em `supabase/migrations/20260911407000_allow_comm_whatsapp_channel_read_for_inbox.sql:5-9` permite `SELECT` da tabela inteira para usuarios autorizados do Inbox.

**Comportamento atual.** O segredo e usado como query string em `supabase/functions/comm-whatsapp-webhook/index.ts:515-531` e e incluido na URL por `supabase/functions/_shared/comm-whatsapp.ts:1784-1791`.

**Impacto tecnico.** Um usuario autenticado com permissao de visualizacao pode consultar a tabela via API REST e obter o segredo. Com ele, pode enviar payloads forjados ao webhook.

**Impacto para usuarios.** Conversas falsas, mensagens nao lidas falsas, associacao indevida a leads e possivel disparo de automacoes baseadas em mensagens inbound.

**Correcao.** Rotacionar o segredo, remove-lo da leitura direta, mover a validacao para Edge Secret e configurar um header secreto na Whapi. A Whapi suporta headers customizados via `/settings`.

### P1-02. `messages.patch` Documentado Pela Whapi E Descartado Silenciosamente `[Confirmado]`

**Evidencia.** A Whapi envia atualizacoes em `messages_updates` para eventos `messages.patch`. O parser atual aceita apenas `messages`, `message` ou `data` em `supabase/functions/_shared/comm-whatsapp.ts:1638-1668`.

**Comportamento atual.** O webhook aceita HTTP `PATCH`, mas em `supabase/functions/comm-whatsapp-webhook/index.ts:558-587` nao encontra itens no payload oficial `messages_updates`, responde `200 {"success":true}` e nao persiste nada.

**Impacto tecnico.** Edicoes, mudancas parciais, votos de enquete e outras atualizacoes podem ser confirmadas para a Whapi sem chegar ao banco.

**Impacto para usuarios.** O Inbox pode mostrar texto antigo, preview antigo ou estado divergente do WhatsApp.

**Correcao.** Criar um adaptador explicito para envelopes Whapi:

```text
messages.post/put    -> payload.messages
messages.patch       -> payload.messages_updates[].after_update
messages.delete      -> payload especifico de remocao
statuses.post/put    -> payload.statuses
chats.patch          -> payload.chats_updates
```

O reparo manual da conversa do Junior recuperou dados por `comm-whatsapp-sync-chat`; isso nao comprova que o webhook processa `messages.patch`.

### P1-03. Envio De Campanhas Nao E Idempotente Apos Aceitacao Ambigua Da Whapi `[Confirmado]`

**Evidencia.** O worker chama a Whapi em `supabase/functions/comm-whatsapp-campaign-worker/index.ts:898-906` e so depois persiste a mensagem e finaliza o alvo em `919-972`.

**Comportamento atual.** Se a Whapi aceitar a mensagem, mas a persistencia local falhar ou a conexao cair antes da resposta, o `catch` libera o alvo para retry.

**Impacto tecnico.** A nova tentativa pode enviar a mesma mensagem novamente.

**Impacto para usuarios.** Clientes recebem mensagens duplicadas e a equipe perde confianca na regua.

**Correcao.** Usar uma outbox transacional por alvo, com estados como `reserved`, `provider_accepted`, `persisted` e `reconciliation_required`. So permitir retry quando houver prova de que a Whapi nao aceitou o envio.

O envio manual esta melhor protegido em `supabase/functions/comm-whatsapp-send/index.ts:1020-1037`, mas ainda depende do webhook para recuperar mensagens aceitas com `persistencePending`.

### P1-04. Regras De Campanha Nao Sao Estritamente Aplicadas `[Confirmado]`

**Evidencia.** `lock_token` e criado no claim SQL, mas updates posteriores filtram somente por `id`, como em `supabase/functions/comm-whatsapp-campaign-worker/index.ts:957-972`.

**Comportamento atual.** Um worker antigo pode concluir ou liberar um alvo apos seu lock expirar e ser reassumido por outro worker. O limite diario e consultado antes de claimar o lote. Se faltava uma vaga, o worker ainda pode claimar e enviar ate o tamanho inteiro do lote. `pacing_per_minute` controla tamanho do lote, nao ritmo temporal real. `stop_on_reply` e carregado, mas nao e consultado pelo processamento. Respostas sao detectadas por polling no inicio da execucao, nao como evento imediato.

**Impacto tecnico.** Race conditions, ultrapassagem de limites, mensagens apos resposta e duplicidade sob concorrencia.

**Impacto para usuarios.** Follow-up apos o cliente responder, volume inadequado e maior risco operacional no WhatsApp.

**Correcao.** Toda transicao deve validar `id`, `status='sending'` e `lock_token`. O limite diario deve ser reservado atomicamente no banco. `stop_on_reply` precisa ter comportamento explicito e acionamento imediato por mensagem inbound.

```sql
UPDATE comm_whatsapp_campaign_targets
SET status = 'sent', lock_token = NULL
WHERE id = :target_id
  AND status = 'sending'
  AND lock_token = :lock_token;
```

### P1-05. Webhook Bloqueia Em Chamadas Remotas Por Mensagem `[Confirmado]`

**Evidencia.** Para cada mensagem, o webhook consulta nome do chat e possivelmente do contato antes de persistir em `supabase/functions/comm-whatsapp-webhook/index.ts:304-339`. Tambem aguarda o arquivamento de midia em `402-412`.

**Comportamento atual.** Uma mensagem inbound pode disparar multiplas chamadas remotas sincronas, sem timeout local.

**Impacto tecnico.** Webhooks lentos, retries do provedor, pressao na Whapi, duplicidade de trabalho e maior risco de timeout.

**Impacto para usuarios.** Mensagens podem demorar a aparecer no Inbox em picos de volume.

**Correcao.** Persistir primeiro o minimo necessario. Enriquecimento de nome e download de midia devem usar job deduplicado, TTL de cache e processamento assincrono confiavel.

### P2-06. Edicoes E Reacoes Nao Tem Ordenacao Duravel `[Confirmado]`

**Evidencia.** `applyCommWhatsAppMessageEdit` retorna sem acao quando a mensagem-base ainda nao existe em `supabase/functions/_shared/comm-whatsapp.ts:1333-1346`. Reacoes leem, alteram e regravam o JSON inteiro em `supabase/functions/comm-whatsapp-webhook/index.ts:220-251`.

**Comportamento atual.** Edicao ou exclusao que chega antes da mensagem-base nao e guardada para aplicacao posterior. Duas reacoes concorrentes podem sobrescrever uma a outra. Uma edicao antiga recebida depois de uma mais recente pode sobrescrever o texto atual.

**Impacto tecnico.** Estado eventual inconsistente entre Whapi e banco.

**Correcao.** Criar `comm_whatsapp_pending_message_mutations`, com chave por mensagem externa, timestamp do evento e aplicacao condicional apos insercao da mensagem-base. Atualizar reacoes em SQL atomico.

Observacao: status de entrega ja tem tratamento pendente adequado em `supabase/migrations/20260911414000_harden_comm_whatsapp_message_status_resolution.sql`.

### P2-07. Sincronizacao Nao Pagina Historico E Rejeita `@LID` `[Confirmado]`

**Evidencia.** `fetchWhapiChatMessages` faz uma unica chamada para `/messages/list/{chatId}` em `supabase/functions/_shared/comm-whatsapp.ts:1833-1851`. `isDirectWhapiChatId` aceita apenas `@s.whatsapp.net` em `271-274`.

**Comportamento atual.** A sincronizacao recupera somente a pagina retornada pela Whapi. Nao ha cursor, offset ou mecanismo de continuacao. Chats individuais identificados como `@LID` sao recusados, embora a documentacao os suporte.

**Impacto tecnico.** Recuperacao parcial de historico e possiveis mensagens ignoradas apos mudancas de identificadores do WhatsApp.

**Correcao.** Implementar paginacao conforme a referencia atual da Whapi, suportar resolucao de `@LID` para telefone e usar resync somente para recuperacao controlada.

A Whapi alerta que `resync=true` dispara novo webhook; o fluxo precisa evitar reprocessamento indevido.

### P2-08. Eventos De Chat Da Whapi Nao Sao Consumidos `[Confirmado]`

**Evidencia.** O webhook trata mensagens, status, canal e usuario. Nao ha tratamento para `chats.post`, `chats.patch` ou `chats.delete`.

**Comportamento atual.** Labels, archive, mute, pin, unread e mudancas feitas no celular/WhatsApp Web nao atualizam o estado local.

**Impacto para usuarios.** O Inbox pode divergir do WhatsApp principal.

**Decisao necessaria.** Definir se o Inbox e a fonte de verdade para estado operacional ou se deve espelhar o WhatsApp. Se o estado for local por decisao de produto, desabilitar eventos irrelevantes na Whapi e documentar a diferenca.

### P2-09. Reacoes E Previews Podem Nao Atualizar Na Tela `[Confirmado]`

**Evidencia.** `getMessageMetadataSignature` considera apenas `quote` e `contact_card` em `src/features/communication/whatsapp/WhatsAppInboxScreen.tsx:835-840`. A assinatura usada para aceitar updates em `3408-3416` ignora `reactions`, `link_preview`, `edited_at` e `status_updated_at`.

**Comportamento atual.** Um update realtime que altere apenas reacoes ou preview pode ser descartado porque a assinatura visual parece igual.

**Impacto para usuarios.** Reacoes enviadas por outra pessoa ou atualizacoes de link preview podem aparecer apenas depois de recarregar a conversa.

**Correcao.** Incluir no diff os metadados exibidos pela UI ou usar uma versao/`updated_at` da mensagem para aceitar updates.

### P2-10. Salvar Contato Salva Apenas No Cache Local `[Confirmado]`

**Evidencia.** `saveContactToCache` grava em `comm_whatsapp_phone_contacts_cache` em `supabase/functions/comm-whatsapp-contacts/index.ts:288-336`; nao existe chamada a Whapi para criar o contato.

**Comportamento atual.** Um contato marcado como salvo no Inbox pode nao existir como contato salvo no WhatsApp conectado.

**Impacto para usuarios.** A semantica de salvar contato pode induzir expectativa errada.

**Decisao necessaria.** Definir se salvar e um recurso interno de CRM ou se deve refletir no WhatsApp. Se for espelhado, integrar o endpoint oficial de criacao de contatos.

### P2-11. Baixa Capacidade De Auditoria E Replay `[Confirmado]`

**Evidencia.** O webhook armazena apenas resumo em `comm_whatsapp_event_receipts`; nao preserva payload bruto recebido.

**Comportamento atual.** Nao e possivel reproduzir com precisao um payload historico de edicao, exclusao ou mudanca parcial.

**Impacto tecnico.** Diagnostico de perda de evento, divergencia e bugs de parser fica limitado.

**Correcao.** Retomar o padrao definido no projeto: payload bruto em Storage privado, resumo leve em banco, retencao curta, acesso administrativo e mascaramento de campos sensiveis quando necessario.

### P3-12. Chamadas HTTP Nao Tem Politica Uniforme De Timeout `[Confirmado]`

**Evidencia.** Chamadas para Whapi em webhook, sync, campanhas e contatos usam `fetch` direto, sem `AbortController` ou classificacao centralizada de erro.

**Impacto tecnico.** Funcoes podem ficar presas ate o timeout da plataforma; falhas transitorias e respostas ambiguas tem tratamento desigual.

**Correcao.** Centralizar cliente Whapi com timeout, classificacao `4xx`/`429`/`5xx`/rede, retry seguro e telemetria por endpoint.

## 4. Recursos Da Whapi Ainda Nao Aproveitados

| Recurso | Uso recomendado | Prioridade |
|---|---|---|
| [Headers customizados de webhook](https://support.whapi.cloud/help-desk/account-and-whapi-channels/customizable-webhook-headers.md) | Substituir segredo na query string por header privado | P0 |
| [Webhook persistente e backoff](https://support.whapi.cloud/help-desk/receiving/webhooks/detailed-webhook-settings.md) | Garantir retry de callbacks apos indisponibilidade | P1 |
| [`messages.patch`](https://support.whapi.cloud/help-desk/receiving/webhooks/incoming-webhooks-format/incoming-message.md) | Atualizar edicoes, votos e mutacoes de mensagem | P1 |
| [`chats.patch` e labels](https://support.whapi.cloud/help-desk/receiving/webhooks/incoming-webhooks-format/chats/how-to-track-chat-labels-via-webhook.md) | Espelhar labels e estado operacional, se for decisao de produto | P2 |
| [Resync de mensagem](https://support.whapi.cloud/help-desk/receiving/http-api/restoring-missing-messages-using-resync.md) | Recuperar mensagem especifica ausente, com protecao contra reprocessamento | P2 |
| [Suporte a `@LID`](https://support.whapi.cloud/help-desk/receiving/http-api/retrieve-a-specific-users-chat-history.md) | Resolver identificadores novos de contatos individuais | P2 |
| [Marcar mensagem como lida](https://support.whapi.cloud/help-desk/hints/automatically-mark-incoming-whatsapp-messages-as-read.md) | Definir politica explicita entre leitura interna e recibo azul no WhatsApp | P2 |
| [Adicionar contatos](https://support.whapi.cloud/help-desk/contacts/add-contacts.md) | Espelhar salvar contato, se esse for o comportamento esperado | P3 |
| Presence e calls | Util apenas se houver necessidade operacional real | P3 |

Nao e recomendado ativar `auto_read_messages` globalmente sem decisao de produto. Para atendimento humano, marcar tudo como lido automaticamente pode induzir recibo azul antes da analise de um operador.

## 5. Plano De Acao Priorizado

| Fase | Acao | Criterio de aceite |
|---|---|---|
| P0 | Remover segredo do webhook da query e da leitura direta da tabela | Usuario do Inbox nao consegue selecionar o segredo; callback valido ainda e aceito |
| P0 | Rotacionar o segredo atual e configurar header customizado Whapi | Callback com segredo antigo falha; novo header funciona |
| P1 | Implementar parser tipado para `messages`, `messages_updates`, remocoes e status | Fixtures oficiais de `post`, `put`, `patch` e `delete` persistem corretamente |
| P1 | Criar outbox idempotente para campanhas | Dois workers concorrentes nao duplicam envio; falha pos-aceite nao reenvia |
| P1 | Tornar locks, limite diario e `stop_on_reply` atomicos | Limite nao e ultrapassado; resposta interrompe proximos passos corretamente |
| P1 | Tirar lookup de nomes e download de midia do hot path | Webhook responde rapidamente mesmo quando Whapi esta lenta |
| P2 | Paginar sync e suportar `@LID` | Historico completo e chat `@LID` e reconciliado |
| P2 | Criar fila de mutacoes pendentes | Edit/delete/reaction antes da mensagem-base e aplicado depois |
| P2 | Corrigir assinatura de metadata no frontend | Reacao, preview e edicao aparecem sem reload |
| P2 | Definir fonte de verdade para archive, mute, pin, labels e leitura | Comportamento documentado e consistente entre Inbox e WhatsApp |
| P2 | Arquivar payloads de webhook com retencao e acesso restrito | Evento problematico pode ser reproduzido sem expor dados ao painel |
| P3 | Centralizar cliente HTTP da Whapi | Timeout, retry e metricas padronizados em todas as funcoes |

Ordem recomendada de implementacao:

1. Seguranca do webhook.
2. Parser de eventos `PATCH` e testes com fixtures oficiais.
3. Idempotencia e concorrencia de campanhas.
4. Reducao de latencia do webhook.
5. Sync, `@LID`, UI e observabilidade.

Nenhuma mudanca foi aplicada durante esta auditoria.
