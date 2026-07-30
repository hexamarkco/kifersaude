# Auditoria Técnica: Integração Whapi e Módulo Inbox

**Data:** 2026-07-29
**Status:** Diagnóstico completo, sem alterações de código.

---

## 1. Resumo Executivo

A integração com a Whapi e o módulo de Inbox do WhatsApp estão funcionais para o fluxo principal (envio/recebimento de mensagens de texto, mídia, reações), mas apresentam riscos críticos de segurança, inconsistências de concorrência e lacunas de observabilidade que precisam de correção antes de considerar o sistema robusto para operação contínua em escala.

**Achados por severidade:**
| Severidade | Quantidade |
|---|---|
| Crítico | 1 |
| Alto | 9 |
| Médio | 9 |
| Baixo | 6 |

**Principais riscos:**
- **Crítico:** Segredo do webhook exposto a qualquer usuário autenticado do Inbox
- **Alto:** Mensagens do tipo `messages.patch` são silenciosamente descartadas
- **Alto:** Campanhas podem duplicar envios em falhas ambíguas de rede
- **Alto:** Timeouts inconsistentes — várias chamadas à Whapi sem proteção de timeout
- **Alto:** Token da Whapi pode estar exposto em variável de ambiente sem criptografia

---

## 2. Visão Geral da Implementação Atual

### Arquitetura

```
Whapi Cloud (gate.whapi.cloud)
  │
  ├─ POST /messages/text            → comm-whatsapp-send
  ├─ POST /messages/{kind}          → comm-whatsapp-send (mídia)
  ├─ POST /media                    → comm-whatsapp-send (upload)
  ├─ GET  /messages/{id}            → comm-whatsapp-refresh-message-status
  ├─ GET  /messages/list/{chatId}   → comm-whatsapp-sync-chat
  ├─ GET  /chats/{chatId}           → comm-whatsapp-sync-chat / comm-whatsapp-contacts
  ├─ GET  /contacts                 → comm-whatsapp-contacts
  ├─ POST /contacts                 → leads-api (verificação de existência)
  ├─ POST /messages/{id}/reaction   → comm-whatsapp-react
  ├─ POST /messages/{id} (forward)  → comm-whatsapp-manage-message
  ├─ DELETE /messages/{id}          → comm-whatsapp-manage-message
  └─ Webhook (POST/PUT/PATCH/DELETE) → comm-whatsapp-webhook
       │
       └─ Messages → comm_whatsapp_persist_message → comm_whatsapp_messages
       └─ Statuses → comm_whatsapp_update_message_status
       └─ Health   → comm_whatsapp_channels (health_snapshot)
```

### Edge Functions envolvidas (13)

| Função | Arquivo | Papel |
|---|---|---|
| comm-whatsapp-webhook | `supabase/functions/comm-whatsapp-webhook/index.ts` | Recebe callbacks da Whapi |
| comm-whatsapp-send | `supabase/functions/comm-whatsapp-send/index.ts` | Envia mensagens (texto e mídia) |
| comm-whatsapp-sync-chat | `supabase/functions/comm-whatsapp-sync-chat/index.ts` | Sincroniza histórico do chat |
| comm-whatsapp-contacts | `supabase/functions/comm-whatsapp-contacts/index.ts` | Gerencia contatos e cache |
| comm-whatsapp-manage-message | `supabase/functions/comm-whatsapp-manage-message/index.ts` | Editar, excluir, encaminhar |
| comm-whatsapp-react | `supabase/functions/comm-whatsapp-react/index.ts` | Reagir a mensagens |
| comm-whatsapp-refresh-message-status | `supabase/functions/comm-whatsapp-refresh-message-status/index.ts` | Atualizar status pendente |
| comm-whatsapp-retry-message | `supabase/functions/comm-whatsapp-retry-message/index.ts` | Reenviar mídia falha |
| comm-whatsapp-media | `supabase/functions/comm-whatsapp-media/index.ts` | Proxy de mídia (cache + Whapi) |
| comm-whatsapp-campaign-worker | `supabase/functions/comm-whatsapp-campaign-worker/index.ts` | Disparo de campanhas |
| comm-whatsapp-admin | `supabase/functions/comm-whatsapp-admin/index.ts` | Configuração do canal |
| leads-api | `supabase/functions/leads-api/index.ts` | Auto contact flow (reimplementa chamadas Whapi) |
| _shared/comm-whatsapp | `supabase/functions/_shared/comm-whatsapp.ts` | Biblioteca compartilhada (~2550 linhas) |

### Frontend

| Arquivo | Papel |
|---|---|
| `src/lib/commWhatsAppService.ts` | Service layer (1839 linhas) |
| `src/features/communication/whatsapp/WhatsAppInboxScreen.tsx` | Tela principal do Inbox (11187 linhas) |
| `src/lib/notificationService.ts` | Notificações e realtime |
| `src/features/communication/whatsapp/hooks/*` | Hooks (realtime, deep link, polling, gravação) |
| `src/features/communication/whatsapp/messageStatus.ts` | Utilitários de status |
| `src/features/communication/whatsapp/whatsAppChatId.ts` | Normalização de Chat ID |

### Banco de dados (tabelas principais)

- `comm_whatsapp_channels` — Canais configurados
- `comm_whatsapp_chats` — Conversas
- `comm_whatsapp_messages` — Mensagens
- `comm_whatsapp_event_receipts` — Deduplicação de webhooks
- `comm_whatsapp_phone_contacts_cache` — Cache de contatos
- `comm_whatsapp_send_requests` — Reserva de envio
- `comm_whatsapp_campaign_targets` — Alvos de campanha

---

## 3. Bugs e Usos Incorretos

### Críticos

#### C01. Segredo do Webhook Exposto a Usuários do Inbox `[Confirmado]`

- **Localização:** `supabase/migrations/20260911407000_allow_comm_whatsapp_channel_read_for_inbox.sql:5-9` (RLS policy); `supabase/functions/_shared/comm-whatsapp.ts:1860-1871` (buildWebhookUrl)
- **Comportamento atual:** A RLS policy permite SELECT em toda a tabela `comm_whatsapp_channels` para usuários autorizados do Inbox. O campo `webhook_secret` é legível via API REST. Além disso, `buildWebhookUrl()` inclui o segredo como query parameter na URL quando não há Edge Secret configurado.
- **Por que está incorreto:** Qualquer usuário autenticado com acesso ao módulo `whatsapp-inbox` pode obter o segredo e forjar webhooks.
- **Impacto:** Forja de mensagens, inserção indevida em conversas, ativação de automações baseadas em inbound.
- **Severidade:** Crítico
- **Correção:** (a) Rotacionar o segredo atual; (b) configurar Edge Secret `COMM_WHATSAPP_WEBHOOK_SECRET`; (c) configurar header customizado na Whapi; (d) remover `webhook_secret` das colunas selecionáveis pela RLS.

---

### Altos

#### A01. `messages.patch` Descartado Silenciosamente `[Confirmado]`

- **Localização:** `supabase/functions/comm-whatsapp-webhook/index.ts:523-561`; `supabase/functions/_shared/whapi-webhook-parser.ts:57-84`
- **Comportamento atual:** O webhook aceita HTTP PATCH, mas `extractWhapiWebhookMessageItems` só processa `payload.messages`, `payload.message` ou `payload.data`. Payloads `messages.patch` oficiais da Whapi com `messages_updates[].after_update` são ignorados.
- **Impacto:** Edições, votos em enquetes e mutações parciais são confirmadas (200 OK) mas nunca persistem.
- **Severidade:** Alto
- **Correção:** Implementar processamento explícito para envelopes `messages_updates` conforme a [documentação da Whapi](https://support.whapi.cloud/help-desk/receiving/webhooks/incoming-webhooks-format/incoming-message.md).

#### A02. Timeouts Inconsistentes — Chamadas sem `fetchWhapiWithTimeout` `[Confirmado]`

- **Localizações:**
  - `supabase/functions/_shared/comm-whatsapp.ts:2047` — `fetchWhapiContactsPage` usa `fetch` direto
  - `supabase/functions/_shared/comm-whatsapp.ts:2353` — `checkWhapiContactExists` usa `fetch` direto
  - `supabase/functions/comm-whatsapp-send/index.ts:413,446,467,511,536,572,871,889,901` — Todas as chamadas Whapi usam `fetch` direto
  - `supabase/functions/comm-whatsapp-manage-message/index.ts:234,296,375` — `fetch` direto sem timeout
  - `supabase/functions/comm-whatsapp-react/index.ts:99` — `fetch` direto
  - `supabase/functions/comm-whatsapp-retry-message/index.ts:350` — `fetch` direto
  - `supabase/functions/leads-api/index.ts:3165` — `fetch` direto
- **Comportamento atual:** Grande parte das chamadas HTTP para Whapi não usa `AbortController`. Dependem do timeout padrão da plataforma (Deno: 1min, Edge Runtime: variável).
- **Impacto:** Funções podem ficar suspensas até o timeout da plataforma, aumentando latência e custo.
- **Severidade:** Alto
- **Correção:** Centralizar cliente HTTP no `_shared/comm-whatsapp.ts` e usar exclusivamente `fetchWhapiWithTimeout` em todas as funções.

#### A03. Token da Whapi Redundante e Sem Criptografia em Duas Origens `[Confirmado]`

- **Localizações:**
  - `supabase/functions/_shared/comm-whatsapp.ts:182` — `getWhapiToken()` lê de `Deno.env.get('WHAPI_TOKEN')`
  - `supabase/functions/leads-api/index.ts:1173` — `getWhapiToken()` lê de `Deno.env.get('WHAPI_TOKEN')` (duplicado)
  - `supabase/functions/_shared/comm-whatsapp.ts:2440-2453` — `ensureCommWhatsAppSettings` retorna `token: getWhapiToken()`
- **Comportamento atual:** O token é armazenado prioritariamente na env var `WHAPI_TOKEN` (não no banco). As configurações da integração (`integration_settings.settings`) podem conter um `token` que é ignorado em favor da env var.
- **Impacto:** Rotação de token exige redeploy das Edge Functions. Se a env var não estiver definida, todas as operações falham silenciosamente.
- **Severidade:** Alto
- **Correção:** Unificar a fonte do token (banco com fallback para env var). Adicionar criptografia em repouso no banco e validação na inicialização.

#### A04. `leads-api` Duplica Constantes e Helpers da Whapi `[Confirmado]`

- **Localização:** `supabase/functions/leads-api/index.ts:1165-1249`
- **Comportamento atual:** `leads-api/index.ts` redefine `WHAPI_BASE_URL`, `parseWhapiError`, `normalizeWhapiChatId`, `sanitizeWhapiToken`, `getWhapiToken` e `readWhapiPayload` em vez de importar de `_shared/comm-whatsapp.ts`.
- **Por que está incorreto:** A versão duplicada de `normalizeWhapiChatId` (linha 1199) não trata identificadores `@lid`. Qualquer mudança na shared library precisa ser replicada manualmente.
- **Impacto:** Risco de divergência entre as implementações. Identificadores `@lid` podem ser rejeitados no fluxo de auto-contact.
- **Severidade:** Alto
- **Correção:** Importar as funções de `_shared/comm-whatsapp.ts` e remover as duplicações.

#### A05. Envio de Campanhas Não é Idempotente após Aceitação Ambígua `[Confirmado]`

- **Localização:** `supabase/functions/comm-whatsapp-campaign-worker/index.ts:1353-1365,1427-1467`
- **Comportamento atual:** O worker envia a mensagem para Whapi, e só depois persiste localmente. Se a persistência falha, o alvo é liberado para retry, podendo reenviar a mesma mensagem.
- **Impacto:** Cliente recebe mensagens duplicadas.
- **Severidade:** Alto
- **Correção:** Usar outbox transacional com estados `reserved → provider_accepted → persisted`. Só permitir retry quando houver prova de que a Whapi rejeitou o envio.

#### A06. Lock de Campanha e Limites Não Garantidos Atomicamente `[Confirmado]`

- **Localização:** `supabase/functions/comm-whatsapp-campaign-worker/index.ts` (múltiplas seções)
- **Comportamento atual:** Updates posteriores ao claim SQL filtram apenas por `id`, não por `lock_token`. Limite diário consultado antes do claim, não reservado atomicamente. `stop_on_reply` não tem acionamento imediato.
- **Impacto:** Race conditions, ultrapassagem de limites, follow-up após resposta.
- **Severidade:** Alto
- **Correção:** Validar `id + status + lock_token` em toda transição. Reservar limite diário atomicamente. Implementar `stop_on_reply` via trigger de mensagem inbound.

#### A07. Envio de Áudio Usa Data URL Ineficiente para Arquivos Grandes `[Confirmado]`

- **Localização:** `supabase/functions/comm-whatsapp-send/index.ts:371-378,396-398`
- **Comportamento atual:** `fileBytesToDataUrl` percorre byte a byte do arquivo e gera uma Data URL base64 inline no JSON. O payload JSON inteiro é enviado no corpo do POST.
- **Por que está incorreto:** `btoa()` tem limite de 32MB em algumas implementações. O loop char-by-char é extremamente ineficiente para áudios comuns (1-5MB). Data URLs aumentam ~33% o tamanho da requisição.
- **Impacto:** Envio de áudio pode falhar ou ser extremamente lento para arquivos maiores.
- **Severidade:** Alto
- **Correção:** Usar `FormData` como primeira tentativa (já implementado como fallback). Remover a abordagem de Data URL ou torná-la último recurso.

#### A08. `checkWhapiContactExists` e `fetchWhapiContactsPage` Sem Timeout `[Confirmado]`

- **Localização:** `supabase/functions/_shared/comm-whatsapp.ts:2353,2047`
- **Comportamento atual:** Contrariando o padrão estabelecido de usar `fetchWhapiWithTimeout`, estas duas funções usam `fetch` bruto.
- **Impacto:** Podem travar a thread em caso de instabilidade da Whapi.
- **Severidade:** Alto
- **Correção:** Substituir por `fetchWhapiWithTimeout` com timeout adequado.

---

### Médios

#### M01. Retry de Texto com Delay Fixo e Apenas Uma Tentativa `[Confirmado]`

- **Localização:** `supabase/functions/comm-whatsapp-send/index.ts:899-910`
- **Comportamento atual:** Em caso de 500, espera 900ms (hardcoded) e tenta novamente uma única vez. Sem backoff progressivo.
- **Severidade:** Médio
- **Correção:** Usar retry configurável com backoff exponencial e jitter.

#### M02. Webhook Bloqueia em Chamadas Remotas por Mensagem `[Confirmado]`

- **Localização:** `supabase/functions/comm-whatsapp-webhook/index.ts:304-339,402-412`
- **Comportamento atual:** Para cada mensagem, consulta nome do chat na Whapi antes de persistir. Download de mídia também é síncrono.
- **Impacto:** Webhooks lentos, retries do provedor, risco de timeout.
- **Severidade:** Médio
- **Correção:** Persistir primeiro o mínimo. Enriquecimento de nome e download de mídia em job assíncrono deduplicado.

#### M03. Sincronização de Histórico sem Paginação Completa e sem Suporte a `@LID` `[Confirmado]`

- **Localização:** `supabase/functions/_shared/comm-whatsapp.ts:1989-1995,1961`
- **Comportamento atual:** `fetchWhapiChatMessages` faz apenas uma chamada. `isDirectWhapiChatId` rejeita `@lid`. Sync é uma página única, sem cursor.
- **Impacto:** Histórico incompleto, chats `@lid` ignorados.
- **Severidade:** Médio
- **Correção:** Implementar paginação completa. Suportar resolução `@lid → phone`.

#### M04. Edições e Reações sem Ordenação Durável `[Confirmado]`

- **Localização:** `supabase/functions/_shared/comm-whatsapp.ts:1333-1346,1397-1494`
- **Comportamento atual:** Edição que chega antes da mensagem-base não é guardada. Duas reações concorrentes podem sobrescrever. Edição antiga recebida depois pode sobrescrever texto atual.
- **Impacto:** Estado inconsistente entre Whapi e banco.
- **Severidade:** Médio
- **Correção:** Criar `comm_whatsapp_pending_message_mutations` com timestamp e aplicação condicional pós-inserção.

#### M05. Webhook Não Preserva Payload Bruto `[Confirmado]`

- **Localização:** `supabase/functions/comm-whatsapp-webhook/index.ts:549-560`
- **Comportamento atual:** Apenas resumo em `comm_whatsapp_event_receipts`. Payload bruto não é arquivado.
- **Impacto:** Impossível reproduzir eventos históricos para diagnóstico.
- **Severidade:** Médio
- **Correção:** Arquivar payload bruto em Storage privado com retenção curta e acesso restrito.

#### M06. Frontend Não Reage a Atualizações de Reação/Link Preview `[Confirmado]`

- **Localização:** `src/features/communication/whatsapp/messageStatus.ts` (assinatura de metadados)
- **Comportamento atual:** `getMessageMetadataSignature` ignora `reactions`, `link_preview`, `edited_at`, `status_updated_at`. Updates que alteram só esses campos são descartados.
- **Impacto:** Reações e previews podem não aparecer sem recarregar.
- **Severidade:** Médio
- **Correção:** Incluir campos relevantes na assinatura. Usar `updated_at` da mensagem para aceitar updates.

#### M07. Salvar Contato Salva Apenas no Cache Local `[Confirmado]`

- **Localização:** `supabase/functions/comm-whatsapp-contacts/index.ts:288-336`
- **Comportamento atual:** Contato salvo no Inbox não é refletido no WhatsApp/Whapi.
- **Impacto:** Semântica ambígua para o usuário.
- **Severidade:** Médio
- **Decisão:** Definir se é feature interna de CRM ou se deve espelhar no WhatsApp.

#### M08. `notificationService` Assina Tabela Inteira `comm_whatsapp_chats` `[Confirmado]`

- **Localização:** `src/lib/notificationService.ts:131-147`
- **Comportamento atual:** A subscription Realtime escuta INSERT/UPDATE/DELETE na tabela `comm_whatsapp_chats` inteira, sem filtro.
- **Impacto:** Todo update em qualquer chat dispara notificação. Carga desnecessária no Realtime e no frontend.
- **Severidade:** Médio
- **Correção:** Adicionar filtro por `channel_id` ou usar função RPC dedicada com polling seletivo.

#### M09. `sendDocumentWhapi` Define `Content-Type` Explicitamente para Upload de Arquivo `[Confirmado]`

- **Localização:** `supabase/functions/comm-whatsapp-send/index.ts:536-544`
- **Comportamento atual:** O upload de documento define `Content-Type: application/octet-stream` (ou o mime do arquivo) no corpo da requisição. Quando o corpo é um `File`, o `Content-Type` deve ser `multipart/form-data` ou omitido para que o runtime defina o boundary.
- **Por que está incorreto:** Definir `Content-Type: application/octet-stream` com um `File` no corpo faz o servidor interpretar o arquivo como corpo bruto, não como upload multipart. A Whapi pode não reconhecer o `filename`.
- **Impacto:** Upload de documentos pode falhar ou perder o nome original do arquivo.
- **Severidade:** Médio
- **Correção:** Usar `FormData` para upload, similar ao que é feito no fallback de áudio, ou usar `Content-Type: multipart/form-data` com boundary.

---

### Baixos

#### B01. Constante Mágica `900ms` sem Documentação `[Confirmado]`

- **Localização:** `supabase/functions/comm-whatsapp-send/index.ts:900`
- **Severidade:** Baixo
- **Correção:** Extrair para constante nomeada com comentário explicativo.

#### B02. `isTrustedWhapiMediaUrl` Valida Hostname Fixo `gate.whapi.cloud` `[Confirmado]`

- **Localização:** `supabase/functions/_shared/comm-whatsapp.ts:2134-2152`
- **Severidade:** Baixo
- **Observação:** Se a Whapi mudar o CDN para outro subdomínio, o bloqueio quebrará a exibição de mídia. Considerar validação mais flexível (ex: *.whapi.cloud).

#### B03. Frontend Polling Agressivo (5s-8s) `[Confirmado]`

- **Localização:** `src/features/communication/whatsapp/WhatsAppInboxScreen.tsx:87-89`
- **Severidade:** Baixo
- **Observação:** 5s para mensagens + 8s para chats + 30s para estado operacional pode gerar carga significativa no banco com múltiplos usuários simultâneos.

#### B04. `leads-api` Importa `ensurePrimaryChannel` mas usa Token Diferente `[Confirmado]`

- **Localização:** `supabase/functions/leads-api/index.ts:3213` (chama `ensurePrimaryChannel` de shared, mas usa `getWhapiToken()` local)
- **Severidade:** Baixo
- **Observação:** Inconsistência: usa `ensurePrimaryChannel` da shared library, mas token próprio.

#### B05. Role de Serviço Usada em Todas as Funções `[Confirmado]`

- **Localização:** Todas as Edge Functions usam `supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)`
- **Severidade:** Baixo (por design)
- **Observação:** Embora seja prática comum em Edge Functions, o uso de service_role key em todas as operações significa que não há RLS sendo aplicada nas operações de banco das Edge Functions.

#### B06. Documentação de Webhooks Desatualizada `[Confirmado]`

- **Localização:** N/A
- **Severidade:** Baixo
- **Observação:** A configuração de webhook no admin (`comm-whatsapp-admin`) expõe a URL com query parameter `secret` que pode estar desatualizada em relação à prática de segurança atual.

---

## 4. Riscos de Segurança e Confiabilidade

| Risco | Probabilidade | Impacto | Prioridade |
|---|---|---|---|
| Forja de webhook via segredo exposto | Alta | Crítico | Imediata |
| Exposição do token Whapi em logs/crash | Média | Alto | Curto prazo |
| Race condition em campanhas | Média | Alto | Curto prazo |
| Perda de mensagens `PATCH` | Alta | Alto | Imediata |
| Duplicação de envio em falha ambígua | Média | Alto | Curto prazo |
| Timeout em operações sem AbortController | Média | Médio | Curto prazo |
| Vazamento de dados em payloads arquivados | Baixa | Médio | Médio prazo |
| Divergência entre código duplicated (leads-api) | Baixa | Médio | Médio prazo |

---

## 5. Melhorias Recomendadas

### 5.1 Arquitetura e Organização

| Melhoria | Benefício | Prioridade |
|---|---|---|
| Cliente HTTP Whapi centralizado com timeout, retry e métricas | Consistência, resiliência, observabilidade | Alta |
| Unificar `leads-api` para usar shared library | Reduzir duplicação e divergência | Alta |
| Criar abstração de outbox transacional para envios | Idempotência garantida | Alta |
| Separar webhook handler em camadas (parse → validate → process → persist) | Testabilidade, manutenibilidade | Média |

### 5.2 Tipagem e Validação

| Melhoria | Benefício | Prioridade |
|---|---|---|
| Tipos Whapi oficiais (gerados da documentação ou OpenAPI) | Type safety, catch de breaking changes | Alta |
| Validação de payload de webhook com Zod ou similar | Rejeitar payloads malformados cedo | Média |
| Schema registry para eventos de webhook | Versionamento e compatibilidade | Média |

### 5.3 Observabilidade

| Melhoria | Benefício | Prioridade |
|---|---|---|
| Log estruturado com correlation-id por webhook | Rastreamento ponta a ponta | Alta |
| Métricas: latência/erro por endpoint Whapi | Detecção precoce de degradação | Alta |
| Arquivamento de payload bruto de webhook | Auditoria e replay | Média |
| Health check com alerta se não há webhook há N minutos | Detecção de canal inativo | Alta |

### 5.4 Performance

| Melhoria | Benefício | Prioridade |
|---|---|---|
| Job queue para download de mídia e enriquecimento | Webhook responde em ms, não segundos | Alta |
| Pool de conexões HTTP para Whapi | Redução de latência | Média |
| Cache de contatos mais agressivo (TTL 5min em vez de 30min) | Dados mais frescos sem chamadas extras | Média |
| Otimizar polling do frontend com backoff adaptativo | Reduzir carga do banco | Baixa |

### 5.5 Idempotência

| Melhoria | Benefício | Prioridade |
|---|---|---|
| Fila de mutações pendentes (edit/delete/reaction) | Ordenação correta e aplicação retardada | Alta |
| Outbox transacional para campanhas | Zero duplicidade mesmo em falhas | Alta |
| Reserva de limite diário atômica | Limite respeitado sob concorrência | Alta |

### 5.6 Testes

| Melhoria | Benefício | Prioridade |
|---|---|---|
| Testes de integração com fixtures reais da Whapi | Validar parsing de cada tipo de payload | Alta |
| Testes de concorrência para campaign worker | Detectar race conditions | Alta |
| Testes de webhook replay (payload archive → reprocess) | Validar idempotência | Médio |
| Fuzz testing para parsers de webhook | Robustez contra payloads maliciosos | Médio |

### 5.7 Experiência do Usuário

| Melhoria | Benefício | Prioridade |
|---|---|---|
| Indicador visual de "Whapi instável" no Inbox | Reduz frustração do usuário | Média |
| Feedback de progresso em envio de mídia grande | UX mais transparente | Média |
| Sincronização bidirecional de status de leitura | Alinhar recibo azul com política do produto | Média |

---

## 6. Rotas e Funcionalidades Whapi Não Utilizadas

### 6.1 Recomendadas para Implementação

| Recurso | Rota/Mecanismo | Caso de Uso | Benefício | Complexidade | Prioridade |
|---|---|---|---|---|---|
| Header customizado de webhook | Configuração via `/settings` ou painel Whapi | Substituir segredo na query string por header fixo | Segurança do webhook | Baixa | **Crítica** |
| `messages.patch` completo | Webhook `messages_updates[]` | Edições, votos, mutações | Consistência de dados | Média | **Alta** |
| `chats.patch` (labels, mute, archive) | Webhook `chats_updates[]` | Espelhar estado do WhatsApp | Consistência entre dispositivos | Média | Média |
| Resync de mensagem específica | `resync=true` no webhook | Recuperar mensagem perdida sem sync total | Confiabilidade | Média | Média |
| Marcar mensagem como lida | `PUT /messages/{id}/read` | Recibo azul condicional | UX de atendimento | Baixa | Média |
| `@LID` resolution | `GET /contacts/ids/{lid}` | Suportar novos identificadores do WhatsApp | Cobertura de contatos | Média | Média |

### 6.2 Não Recomendadas no Momento

| Recurso | Motivo |
|---|---|
| `GET /chats` (listar conversas) | Já temos nosso próprio catálogo local, manter synced traria complexidade adicional sem ganho claro |
| Presence tracking (`presence.*`) | Sem caso de uso definido no contexto de CRM |
| Group management (`groups.*`) | Fora do escopo de inbox individual |
| Business profile API | Sem aplicação imediata no CRM |
| WhatsApp catalogs/products | Fora do escopo do produto |

---

## 7. Plano de Ação Priorizado

### Correções Imediatas (P0 — dias)

| # | Ação | Critério de Aceite |
|---|---|---|
| 1 | Remover `webhook_secret` da RLS policy de `comm_whatsapp_channels` | Usuário Inbox não consegue SELECT no campo |
| 2 | Configurar Edge Secret `COMM_WHATSAPP_WEBHOOK_SECRET` | Callback com segredo antigo falha |
| 3 | Configurar header customizado na Whapi | Callback sem header correto falha |
| 4 | Rotacionar o segredo atual | URLs antigas com `?secret=` são rejeitadas |
| 5 | Implementar parser para `messages_updates` (PATCH) | Testes com fixtures Whapi `PATCH` persistem corretamente |

### Melhorias de Curto Prazo (P1 — semanas)

| # | Ação | Critério de Aceite |
|---|---|---|
| 6 | Unificar `leads-api` com shared library | Remove código duplicado, adiciona suporte `@lid` |
| 7 | Centralizar cliente HTTP Whapi com `fetchWhapiWithTimeout` | Toda chamada Whapi tem timeout configurado |
| 8 | Refatorar `sendAudioLikeWhapi` para priorizar `FormData` | Data URL removida, upload eficiente |
| 9 | Criar outbox transacional para campanhas | Zero duplicidade em falha pós-aceite |
| 10 | Tornar locks e limites de campanha atômicos | Locks validam `id + status + lock_token` |
| 11 | Remover lookup de nome do hot path do webhook | Webhook persiste em ms, enriquecimento em job |
| 12 | Revisar `sendDocumentWhapi` para usar `FormData` | Upload de documentos preserva nome do arquivo |
| 13 | Adicionar health-check com alerta de webhook silencioso | Alerta se `last_webhook_received_at > N minutos` |

### Evoluções de Médio Prazo (P2 — meses)

| # | Ação | Critério de Aceite |
|---|---|---|
| 14 | Implementar paginação completa e suporte a `@lid` no sync | Histórico completo recuperado |
| 15 | Criar fila de mutações pendentes | Edit/delete/reaction antes da base é aplicado depois |
| 16 | Corrigir assinatura de metadata no frontend | Reação, preview e edição aparecem sem reload |
| 17 | Arquivar payload bruto de webhook em Storage | Evento pode ser reproduzido sem expor dados |
| 18 | Adicionar log estruturado com correlation-id | Rastreamento ponta a ponta de eventos |
| 19 | Implementar teste de integração com fixtures Whapi | Pipeline detecta breaking change na API |
| 20 | Definir política de sincronização de archive/mute/pin | Comportamento documentado e testado |

---

## Tabela Consolidada

| Prioridade | Severidade | Tipo | Problema/Melhoria | Localização | Impacto | Ação Recomendada |
|---|---|---|---|---|---|---|
| P0 | Crítico | Segurança | Segredo do webhook exposto a usuários do Inbox | `20260911407000_allow_comm_whatsapp_channel_read_for_inbox.sql`, `_shared/comm-whatsapp.ts:1860` | Forja de webhooks, inserção indevida | Remover RLS, configurar Edge Secret + header |
| P0 | Alto | Bug | `messages.patch` descartado silenciosamente | `whapi-webhook-parser.ts:57`, webhook `index.ts:523` | Edições/mutações não persistem | Implementar parser de `messages_updates` |
| P1 | Alto | Bug | Timeouts inconsistentes — chamadas sem AbortController | Múltiplas funções (send, manage, react, retry, leads-api) | Edge Functions podem travar | Centralizar cliente HTTP com timeout |
| P1 | Alto | Arquitetura | Token Whapi duplicado e sem criptografia | `_shared/comm-whatsapp.ts:182`, `leads-api/index.ts:1173` | Rotação difícil, risco de exposição | Unificar fonte, adicionar criptografia |
| P1 | Alto | Arquitetura | `leads-api` duplica constantes e helpers | `leads-api/index.ts:1165-1249` | Divergência entre implementações | Importar de `_shared/comm-whatsapp.ts` |
| P1 | Alto | Bug | Campanhas não idempotentes após aceitação ambígua | `campaign-worker/index.ts:1353` | Mensagens duplicadas para cliente | Outbox transacional |
| P1 | Alto | Bug | Lock de campanha sem validação atômica | `campaign-worker/index.ts` (múltiplas seções) | Race conditions, limites ultrapassados | Validar `id + status + lock_token` |
| P1 | Alto | Bug | Envio de áudio usa Data URL ineficiente | `comm-whatsapp-send/index.ts:371-398` | Falha com arquivos grandes | Priorizar FormData |
| P1 | Alto | Bug | `checkWhapiContactExists` sem timeout | `_shared/comm-whatsapp.ts:2353` | Pode travar | Usar `fetchWhapiWithTimeout` |
| P1 | Médio | Segurança | `webhook_secret` em query string nas URLs | `_shared/comm-whatsapp.ts:1866-1868` | Vazamento em logs | Migrar para header secreto |
| P1 | Médio | Bug | `sendDocumentWhapi` com Content-Type incorreto | `comm-whatsapp-send/index.ts:536` | Upload pode falhar | Usar FormData |
| P2 | Médio | Performance | Webhook bloqueia em chamadas remotas | `webhook/index.ts:304-339` | Latência em pico de volume | Job assíncrono para enriquecimento |
| P2 | Médio | Bug | Sync sem paginação e sem suporte `@lid` | `_shared/comm-whatsapp.ts:1989,1961` | Histórico incompleto | Paginar, resolver `@lid` |
| P2 | Médio | Bug | Edições/reactions sem ordenação durável | `_shared/comm-whatsapp.ts:1333-1346` | Estado inconsistente | Fila de mutações pendentes |
| P2 | Médio | Observabilidade | Payload bruto não preservado | `webhook/index.ts:549-560` | Diagnóstico limitado | Arquivar em Storage |
| P2 | Médio | UX | Frontend ignora updates de reaction/preview | `messageStatus.ts` | Tela desatualizada | Corrigir assinatura de metadados |
| P2 | Médio | Performance | Frontend assina tabela inteira `comm_whatsapp_chats` | `notificationService.ts:131` | Carga excessiva no Realtime | Filtrar subscription |
| P2 | Médio | UX | Salvar contato só no cache local | `comm-whatsapp-contacts/index.ts:288` | Semântica ambígua | Decidir comportamento esperado |
| P3 | Baixo | Manutenibilidade | Constante mágica 900ms | `comm-whatsapp-send/index.ts:900` | Dificulta ajuste | Extrair para constante |
| P3 | Baixo | Performance | Polling frontend agressivo (5-8s) | `WhatsAppInboxScreen.tsx:87-89` | Carga no banco | Backoff adaptativo |
| P3 | Baixo | Manutenibilidade | `isTrustedWhapiMediaUrl` com hostname fixo | `_shared/comm-whatsapp.ts:2134` | Pode quebrar com mudança da Whapi | Validar por padrão, não hostname |
| P3 | Baixo | Manutenibilidade | Service role em todas as funções | Todas Edge Functions | RLS não é usada | Revisar necessidade (por design) |

---

*Auditoria realizada sem alterações de código, banco, configurações ou dados.*
