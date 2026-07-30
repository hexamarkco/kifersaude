# Plano de Ação: Correções da Integração Whapi e Inbox

Dividido em 4 etapas sequenciais. Cada etapa deve ser concluída e validada antes de iniciar a próxima.

---

## Etapa 1 — Segurança e Sobrevivência (P0)

**Objetivo:** Eliminar riscos críticos que permitem forja de webhook e perda de dados confirmada.

### 1.1 Remover exposição do segredo do webhook

**Arquivos:**
- `supabase/migrations/20260911407000_allow_comm_whatsapp_channel_read_for_inbox.sql`
- `supabase/functions/_shared/comm-whatsapp.ts:184-185,1860-1871`
- `supabase/functions/comm-whatsapp-webhook/index.ts:475-499`

**O que fazer:**
1. Criar migration que remove `webhook_secret` do SELECT permitido pela RLS policy (ou criar uma view que exclui a coluna)
2. Configurar a env var `COMM_WHATSAPP_WEBHOOK_SECRET` no Supabase
3. No painel da Whapi, configurar o header customizado `X-Kifer-Webhook-Secret` com o mesmo valor
4. Remover o fallback `legacySecret` de `buildWebhookUrl()` e do webhook handler
5. Rotacionar o segredo antigo

**Validação:**
- Usuário do Inbox não consegue ler `webhook_secret` via API REST
- Webhook sem o header correto retorna 401
- Callback legado com `?secret=` antigo retorna 401

### 1.2 Implementar parser de `messages.patch` (messages_updates)

**Arquivos:**
- `supabase/functions/_shared/whapi-webhook-parser.ts:57-84`
- `supabase/functions/comm-whatsapp-webhook/index.ts:523-561`

**O que fazer:**
1. Em `whapi-webhook-parser.ts`, garantir que `extractWhapiWebhookMessageItems` processe corretamente `payload.messages_updates[].after_update`
2. No webhook handler, aplicar as mudanças do patch (edit/text/caption) ao persistir
3. Adicionar fixture de teste com payload real de `messages.patch`

**Validação:**
- Enviar um payload PATCH simulado → mensagem original é atualizada no banco
- Webhook responde 200 e `comm_whatsapp_messages` reflete a edição

### 1.3 Adicionar timeout em chamadas Whapi sem proteção

**Arquivos:**
- `supabase/functions/_shared/comm-whatsapp.ts:2047,2353`
- `supabase/functions/comm-whatsapp-send/index.ts` (todas as chamadas fetch)
- `supabase/functions/comm-whatsapp-manage-message/index.ts:234,296,375`
- `supabase/functions/comm-whatsapp-react/index.ts:99`
- `supabase/functions/comm-whatsapp-retry-message/index.ts:350`

**O que fazer:**
1. Substituir todo `fetch` direto para Whapi por `fetchWhapiWithTimeout`
2. Definir timeouts específicos por tipo de operação (media: 30s, text: 15s, contacts: 10s)

**Validação:**
- Todas as chamadas Whapi passam por `fetchWhapiWithTimeout`
- Simular lentidão da Whapi → função não trava além do timeout configurado

### Checklist de conclusão da Etapa 1

- [ ] Segredo do webhook removido da RLS e da query string
- [ ] Header customizado configurado na Whapi
- [ ] `messages.patch` processado corretamente
- [ ] Timeout em todas as chamadas Whapi
- [ ] Testes automatizados para os três itens

---

## Etapa 2 — Consistência e Correção de Bugs (P1)

**Objetivo:** Eliminar bugs confirmados que causam duplicidade, falha de envio e divergência de dados.

### 2.1 Unificar `leads-api` com shared library

**Arquivos:**
- `supabase/functions/leads-api/index.ts:1165-1249`

**O que fazer:**
1. Substituir `WHAPI_BASE_URL`, `parseWhapiError`, `normalizeWhapiChatId`, `sanitizeWhapiToken`, `getWhapiToken`, `readWhapiPayload` locais pelos imports de `_shared/comm-whatsapp.ts`
2. Ajustar `normalizeWhapiChatId` do shared para garantir compatibilidade com fluxo de auto-contact
3. Testar fluxo completo de `checkWhatsAppExistence` e `sendAutoContactMessage`

**Validação:**
- Auto-contact flow funciona com chats `@s.whatsapp.net` e `@lid`
- Cobertura de testes existentes continua passando

### 2.2 Refatorar envio de áudio para priorizar FormData

**Arquivos:**
- `supabase/functions/comm-whatsapp-send/index.ts:371-398,413-527`

**O que fazer:**
1. Inverter a ordem: tentar `FormData` primeiro (já implementado como fallback)
2. Mover `fileBytesToDataUrl` para fallback apenas quando FormData falhar
3. Remover o loop char-by-char ineficiente

**Validação:**
- Envio de áudio de 5MB completa em < 5s
- Envio de áudio com `waveform` preserva metadados

### 2.3 Corrigir `sendDocumentWhapi` para usar FormData

**Arquivos:**
- `supabase/functions/comm-whatsapp-send/index.ts:529-587`

**O que fazer:**
1. Substituir o upload com `Content-Type` fixo por `FormData`
2. Enviar o arquivo como parte do multipart, similar ao fallback de áudio

**Validação:**
- Envio de PDF/DOCX preserva o nome original do arquivo no WhatsApp
- Download do documento no destino mantém extensão correta

### 2.4 Tornar campanhas idempotentes

**Arquivos:**
- `supabase/functions/comm-whatsapp-campaign-worker/index.ts`

**O que fazer:**
1. Implementar outbox transacional por alvo com estados: `reserved → provider_accepted → persisted`
2. Só permitir retry se houver prova de que Whapi rejeitou o envio (4xx confirmado)
3. Validar `id + status + lock_token` em toda transição de estado
4. Reservar limite diário atomicamente (decrementar saldo no mesmo UPDATE do claim)
5. Implementar `stop_on_reply` via trigger/evento imediato de mensagem inbound

**Validação:**
- Dois workers concorrentes não duplicam envio
- Limite diário não é ultrapassado
- Resposta do cliente interrompe próximos passos em < 30s

### 2.5 Remover lookup de nome do hot path do webhook

**Arquivos:**
- `supabase/functions/comm-whatsapp-webhook/index.ts:304-339`

**O que fazer:**
1. Persistir a mensagem com nome/displayName mínimo primeiro
2. Mover `fetchWhapiChatName` e `fetchWhapiContactName` para processamento assíncrono
3. Usar TTL de cache de nomes para evitar consultas repetidas

**Validação:**
- Webhook responde em < 500ms mesmo quando Whapi está lenta
- Nomes de contato aparecem no Inbox em até 10s (job assíncrono)

### Checklist de conclusão da Etapa 2

- [ ] `leads-api` usa shared library (sem duplicação)
- [ ] Áudio envia via FormData como primeira tentativa
- [ ] Documento envia com FormData e preserva nome do arquivo
- [ ] Campanhas são idempotentes com outbox transacional
- [ ] Lock de campanha valida `id + status + lock_token`
- [ ] Limite diário reservado atomicamente
- [ ] Webhook não faz chamadas Whapi síncronas por mensagem
- [ ] `stop_on_reply` é acionado por evento imediato

---

## Etapa 3 — Resiliência e Observabilidade (P2)

**Objetivo:** Garantir que o sistema se recupera de falhas, não perde eventos e permite diagnóstico.

### 3.1 Paginar sync de histórico e suportar `@lid`

**Arquivos:**
- `supabase/functions/_shared/comm-whatsapp.ts:1950-1995`
- `supabase/functions/comm-whatsapp-sync-chat/index.ts`

**O que fazer:**
1. Implementar paginação completa em `fetchWhapiChatMessages` usando `offset` e `hasMore`
2. Garantir que `isDirectWhapiChatId` aceite `@lid` após resolução
3. Usar `resolveWhapiLidToPhone` para reconciliar chats `@lid`

**Validação:**
- Sync de chat com 500 mensagens recupera todas (em páginas)
- Chat identificado como `@lid` é resolvido e associado ao telefone correto

### 3.2 Criar fila de mutações pendentes

**Arquivos:**
- `supabase/functions/_shared/comm-whatsapp.ts`
- Nova migration para `comm_whatsapp_pending_message_mutations`

**O que fazer:**
1. Criar tabela `comm_whatsapp_pending_message_mutations` com: `channel_id`, `target_external_message_id`, `mutation_type`, `payload`, `occurred_at`, `applied_at`
2. Quando edit/delete/reaction chega antes da mensagem-base, inserir na fila
3. Trigger pós-insert em `comm_whatsapp_messages` aplica mutações pendentes
4. Job de limpeza para mutações com mais de 7 dias

**Validação:**
- Edição que chega 5s antes da mensagem-base é aplicada após a inserção
- Duas reações concorrentes não sobrescrevem (a mais recente vence por timestamp)

### 3.3 Arquivar payload bruto de webhook

**Arquivos:**
- `supabase/functions/comm-whatsapp-webhook/index.ts`

**O que fazer:**
1. Antes de processar, salvar payload bruto em Storage (`whapi-webhook-archive/{date}/{event_key}.json`)
2. Manter apenas resumo em `comm_whatsapp_webhook_events`
3. Script de purga com retenção de 30 dias

**Validação:**
- Payload de webhook pode ser baixado do Storage para replay
- Consulta de eventos históricos via banco é leve (sem JSON gigante)

### 3.4 Adicionar log estruturado e health check

**Arquivos:**
- Todas as Edge Functions

**O que fazer:**
1. Gerar `correlationId` (UUID) no início de cada requisição de webhook
2. Logar entrada/saída com correlationId, event_type, tempo de processamento
3. Criar RPC `comm_whatsapp_health_check` que retorna:
   - `last_webhook_received_at`
   - `last_health_check_at`
   - `pending_messages_count` (outbound sem confirmação há > 5min)
   - `stale_campaign_targets`
4. Configurar alerta externo se `last_webhook_received_at > 15min`

**Validação:**
- Logs de webhook têm correlationId rastreável
- Dashboard de admin mostra health check com métricas básicas
- Alerta dispara se webhook ficar 15min sem callback

### 3.5 Corrigir assinatura de metadata no frontend

**Arquivos:**
- `src/features/communication/whatsapp/messageStatus.ts`
- `src/features/communication/whatsapp/WhatsAppInboxScreen.tsx`

**O que fazer:**
1. Incluir `reactions`, `link_preview`, `edited_at`, `status_updated_at` na assinatura de metadados
2. Usar `updated_at` da mensagem como critério adicional para aceitar updates

**Validação:**
- Reação enviada por outro operador aparece sem recarregar
- Link preview atualizado aparece sem recarregar

### Checklist de conclusão da Etapa 3

- [ ] Sync recupera histórico completo com paginação
- [ ] Chats `@lid` são resolvidos e reconciliados
- [ ] Mutações pendentes são enfileiradas e aplicadas
- [ ] Payload bruto arquivado em Storage
- [ ] Logs com correlation-id em todas as funções
- [ ] Health check com alerta de webhook silencioso
- [ ] Frontend reage a updates de reação/preview/edição

---

## Etapa 4 — Qualidade e desempenho (P3)

**Objetivo:** Melhorar manutenibilidade, performance e experiência do usuário.

### 4.1 Centralizar cliente HTTP Whapi

**Arquivos:**
- `supabase/functions/_shared/comm-whatsapp.ts`

**O que fazer:**
1. Criar `createWhapiClient(token)` que retorna objeto com métodos tipados:
   - `sendText(chatId, text, opts?)`
   - `sendMedia(kind, chatId, file, opts?)`
   - `uploadMedia(file)` → mediaId
   - `fetchMessage(messageId)`
   - `fetchChatMessages(chatId, pagination?)`
   - `fetchContact(contactId)`
   - `checkContact(phone)` → exists
2. Cada método usa `fetchWhapiWithTimeout`, retry configurável e log estruturado
3. Substituir chamadas espalhadas nas funções pelo cliente unificado

**Validação:**
- Nenhum `fetch` direto para `gate.whapi.cloud` fora do cliente
- Retry automático para 429/5xx com backoff
- Métricas de latência por endpoint disponíveis

### 4.2 Otimizar polling do frontend com backoff adaptativo

**Arquivos:**
- `src/features/communication/whatsapp/WhatsAppInboxScreen.tsx:87-89`
- Hooks de polling

**O que fazer:**
1. Implementar backoff progressivo: 5s → 10s → 20s → 30s (máx) quando não há mudanças
2. Resetar para 5s imediatamente após receber um evento Realtime
3. Reduzir polling de estado operacional para 60s

**Validação:**
- Polling médio cai para ~15s em períodos ociosos
- Mensagem nova aparece em < 5s graças ao Realtime

### 4.3 Extrair constantes mágicas

**Arquivos:**
- `supabase/functions/comm-whatsapp-send/index.ts:900` (900ms)
- `supabase/functions/_shared/comm-whatsapp.ts:2134` (hostname fixo)

**O que fazer:**
1. Substituir `900` por constante `TEXT_SEND_RETRY_DELAY_MS = 900`
2. Tornar validação de hostname Whapi mais flexível (ex: `endsWith('.whapi.cloud')` ou usar `WHAPI_BASE_URL` como base)

**Validação:**
- Nenhum número mágico não nomeado
- Se Whapi mudar para `media.whapi.cloud`, a validação continua funcionando

### 4.4 Adicionar testes automatizados

**O que fazer:**
1. Testes de unidade para `whapi-webhook-parser.ts` com fixtures de cada tipo de payload (text, image, video, document, audio, voice, reaction, edit, delete, patch, statuses)
2. Testes de integração para `comm-whatsapp-send` com mock de servidor HTTP
3. Testes de concorrência para `comm-whatsapp-campaign-worker` (lock, limite, retry)
4. Teste de replay: arquivar payload → reprocessar → comparar resultado

**Validação:**
- Cobertura > 70% das Edge Functions críticas (webhook, send, campaign-worker)
- Pipeline CI falha se parser quebra com fixture existente

### 4.5 Simplificar subscription do notificationService

**Arquivos:**
- `src/lib/notificationService.ts:131-147`

**O que fazer:**
1. Substituir subscription sem filtro por uma channel específica ou Realtime com filtro por `channel_id`
2. Ou criar RPC que retorna apenas chats com mudanças recentes

**Validação:**
- Número de eventos Realtime processados cai proporcionalmente ao número de usuários ativos

### Checklist de conclusão da Etapa 4

- [ ] Cliente HTTP Whapi centralizado com métodos tipados
- [ ] Polling do frontend com backoff adaptativo
- [ ] Constantes mágicas extraídas e nomeadas
- [ ] Testes automatizados com fixtures reais
- [ ] Subscription Realtime otimizada

---

## Resumo das etapas

| Etapa | Foco | Riscos endereçados | Esforço estimado |
|---|---|---|---|
| 1 — Segurança e Sobrevivência | P0: webhook seguro, parser PATCH, timeouts | Forja de webhook, perda de edições, funções travadas | ~3-5 dias |
| 2 — Consistência e Bugs | P1: duplicação, idempotência, upload correto | Mensagens duplicadas, upload quebrado, divergência leads-api | ~5-8 dias |
| 3 — Resiliência e Observabilidade | P2: sync completo, mutações pendentes, logs, health check | Perda de eventos, diagnóstico cego, estado inconsistente | ~5-7 dias |
| 4 — Qualidade e Desempenho | P3: cliente HTTP, testes, performance | Manutenibilidade, cobertura de testes, carga excessiva | ~4-6 dias |

**Ordem recomendada:** Etapa 1 → Etapa 2 → Etapa 3 → Etapa 4. Cada etapa entrega um sistema mais estável que o anterior e pode ser deployada de forma independente.
