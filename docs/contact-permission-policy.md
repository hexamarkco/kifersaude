# Política global de permissão de contato

## Modelo e precedência

`contact_permission_policies` guarda o estado atual pela chave única `(channel, endpoint_normalized, purpose_scope)`. Telefones são normalizados para dígitos; e-mails são aparados e convertidos para minúsculas. O escopo identifica a finalidade, não a pessoa no CRM: o vínculo opcional `lead_id` só é gravado para o lead informado e validado ou para uma correspondência única com lead não arquivado. Nenhuma preferência é copiada para parentes, titulares, dependentes ou outros membros de uma família.

Os estados são `blocked`, `allowed` e `unknown`. Apenas um bloqueio explícito interrompe o envio; `unknown` não é consentimento nem bloqueio. Um bloqueio `global` prevalece sobre qualquer finalidade. Um bloqueio `commercial` interrompe marketing, campanhas e follow-ups, mas não interrompe respostas de serviço ou mensagens transacionais. `service_reply` e `transactional` podem ter bloqueios próprios.

`contact_permission_events` registra cada decisão com canal, endpoint, escopo, estado, origem, motivo, ator, evidência, lead e instante. O runtime não pode atualizar ou apagar eventos; as chaves estrangeiras de lead/ator podem ser desvinculadas pelo próprio Postgres quando o registro relacionado é removido. `contact_permission_mutation_requests` mantém a resposta e a impressão digital de cada `client_request_id`, por ator e ferramenta.

## Migração da tabela legada

`20261008030000_contact_permission_policies.sql` importa cada linha existente de `comm_whatsapp_opt_outs` para WhatsApp/commercial e adiciona um evento `legacy_backfill`, preservando origem, motivo, ator, timestamp e IDs de campanha/chat/mensagem/sugestão. A tabela antiga permanece como compatibilidade para a tela de revisão; um trigger sincroniza mudanças futuras para o modelo central.

Uma sugestão de IA só vira bloqueio se o intent gravado for explicitamente `opt_out`. `wrong_number`, sugestão ausente ou qualquer outro intent vira `unknown` no modelo central. A tela também não oferece aceitar como bloqueio sugestões de número/destinatário incorreto; elas exigem revisão de identidade.

Para ligar um endpoint a lead, a rotina valida que o lead esteja ativo (`arquivado = false`) e que telefone ou e-mail normalizado corresponda exatamente. Sem `lead_id`, uma única correspondência ativa é associada; zero correspondências mantém `lead_id = NULL`; vários matches mantêm `lead_id = NULL` e definem `lead_match_ambiguous = true`. Essa informação também volta na resposta MCP.

## Contratos RPC MCP

Todos os RPCs são `SECURITY DEFINER`, executáveis somente por `service_role` e conferem no banco que `p_actor_user_id` ainda pertence a um perfil com `role = 'admin'` e e-mail não vazio. A identidade OAuth não é aceita como autorização apenas por ter sido validada pela Edge Function.

| RPC | Assinatura | Comportamento |
| --- | --- | --- |
| `mcp_get_contact_permission` | `(p_actor_user_id uuid, p_channel text, p_endpoint text)` | Retorna `{success, channel, endpoint_normalized, policies}`. Cada política inclui `id`, escopo, estado, origem, motivo, ator, evidência, `lead_id`, `lead_match_ambiguous`, `decision_at` e `updated_at`. |
| `mcp_set_contact_permission` | `(p_actor_user_id uuid, p_client_request_id text, p_channel text, p_endpoint text, p_purpose_scope text, p_state text, p_reason text, p_evidence jsonb, p_lead_id uuid, p_expected_updated_at timestamptz)` | Atualiza um escopo, grava evento e retorna `{success, duplicate, client_request_id, policy, lead_match_ambiguous}`. A origem é sempre `mcp`. |
| `mcp_bulk_set_contact_permission` | `(p_actor_user_id uuid, p_client_request_id text, p_changes jsonb)` | Aplica atomicamente de 1 a 50 endpoints/escopos únicos. Cada item aceita `channel`, `endpoint`, `purpose_scope`, `state`, `reason`, `evidence`, `lead_id` e `expected_updated_at`. Retorna `{success, duplicate, count, ambiguous_lead_matches, policies}`. |

Para criar uma política, `expected_updated_at` pode ser omitido. Para alterar uma política existente, ele é obrigatório e precisa ser igual ao valor mais recente lido; qualquer divergência retorna `error_code: STALE_WRITE` e não sobrescreve a política. Em lote, todas as versões são validadas antes de gravar qualquer item. Um retry com o mesmo `client_request_id` e os mesmos parâmetros retorna a resposta anterior; reutilizar a chave com parâmetros diferentes resulta em `CONTACT_PERMISSION_IDEMPOTENCY_CONFLICT`. Lotes recusam alvos repetidos após normalização e têm limite de 50.

RPCs de validação retornam erros SQL identificáveis: `MCP_ADMIN_REQUIRED`, `CONTACT_PERMISSION_INVALID_CHANNEL`, `CONTACT_PERMISSION_INVALID_ENDPOINT`, `CONTACT_PERMISSION_INVALID_SCOPE`, `CONTACT_PERMISSION_INVALID_STATE`, `CONTACT_PERMISSION_LEAD_ENDPOINT_MISMATCH`, `CONTACT_PERMISSION_BULK_LIMIT`, `CONTACT_PERMISSION_DUPLICATE_BULK_TARGET` e `CONTACT_PERMISSION_IDEMPOTENCY_CONFLICT`. Evidência deve ser objeto JSON de até 8 KiB; motivo aceita até 1.000 caracteres.

## Guard de envio e respostas

`supabase/functions/_shared/contact-permissions.ts` expõe `assertContactPermissionForSend(client, endpoint, scope)`. Ele chama `check_contact_permission_for_send(channel, endpoint_normalized, purpose_scope)` imediatamente antes do provedor. O RPC permite o envio quando não há bloqueio `global` ou no escopo solicitado. Erro, resultado inválido, endpoint inválido ou resposta ambígua gera `ContactPermissionCheckError` e bloqueia o envio. Bloqueios retornam `ContactPermissionBlockedError`, com código `CONTACT_PERMISSION_BLOCKED`; endpoints não são incluídos na mensagem de erro. As rotas HTTP devolvem 409 para bloqueio e 503 para falha de consulta, sem retry silencioso.

| Caminho de envio protegido | Escopo e ponto do guard |
| --- | --- |
| `comm-whatsapp-campaign-worker/index.ts` — teste, campanha normal e cada etapa do burst | `commercial`; consulta também filtra o público por política central e falha fechada se a consulta em lote falhar. A decisão individual é repetida imediatamente antes de cada envio. Bloqueios param o contato e cancelam etapas pendentes do burst. |
| `process-scheduled-messages/index.ts` — texto, partes de texto e mídia | `commercial`, antes do provedor. Um bloqueio após a reivindicação cancela explicitamente o agendamento; `advance_scheduled_message` permite essa transição de `sending` para `cancelled`. |
| `leads-api/index.ts` — `sendAutoContactMessage` usado por fluxos/follow-ups e teste de fluxo | `commercial`, após resolver o endpoint canônico e antes do provedor. |
| `leads-api/index.ts` — ação `manual-automation`/`sendWhatsappMessages` | `commercial` para cada mensagem enviada; bloqueio retorna 409 e falha de consulta retorna 503. |
| `comm-whatsapp-send/index.ts` — envio manual da caixa de entrada e envio MCP de texto/mídia/áudio/documento | Todos usam `commercial`; ainda não há classificação explícita no produto para tratar um envio manual como resposta de serviço. A verificação está dentro dos caminhos de provedor, incluindo fallback/retry de texto. O escopo é guardado no metadata da mensagem. |
| `comm-whatsapp-retry-message/index.ts` — reenvio de mensagem outbound | Herda o escopo guardado em metadata; resposta autônoma explicitamente identificada permanece `service_reply`, enquanto mensagens manuais/históricas sem escopo caem em `commercial`. Verifica novamente antes do provedor. |
| `ai-autonomous-reply-worker/index.ts` — resposta inbound automática | `service_reply`; bloqueio global é respeitado, opt-out comercial sozinho não suprime a resposta de serviço. |

MCP agenda mensagens pelo worker de agendamento e envia mensagens imediatas pelo `comm-whatsapp-send`; esses caminhos herdam as verificações acima. Nenhum caminho protegido converte uma falha no RPC em permissão. A API MCP isolada desta feature está em `supabase/functions/chatgpt-mcp/contact-permission-actions.ts`; `index.ts` e `write-actions.ts` continuam fora deste módulo para integração pelo proprietário.
