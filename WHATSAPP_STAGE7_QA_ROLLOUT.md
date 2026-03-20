# WhatsApp Stage 7 QA and Rollout

Este checklist fecha a etapa final do hardening de `/painel/whatsapp`.

## 1. Banco e migrations

Aplicar, nesta ordem:

1. `supabase/migrations/20260908180000_add_whatsapp_campaign_target_progress_and_scheduler_refresh.sql`
2. `supabase/migrations/20260908190000_add_whatsapp_campaign_admin_rpcs.sql`

Validar depois:

- `whatsapp_campaign_targets` com colunas de lease/progresso criadas
- RPCs `create_whatsapp_campaign_atomic` e `cancel_whatsapp_campaign_atomic`
- job `process-whatsapp-broadcast-campaigns` presente em `cron.job`

## 2. Edge functions para publicar

Publicar novamente:

- `whatsapp-sync`
- `whatsapp-broadcast`
- `whatsapp-sync-contact-photos`
- `whatsapp-media`
- `transcribe-whatsapp-audio`
- `link-preview-metadata`
- `giphy-search`
- `generate-follow-up`
- `rewrite-message`

## 3. Backfill e reconciliacao recomendados

Rodar apos publicar e antes de abrir para todos os usuarios:

1. `npm run backfill:whatsapp:global`
2. `npm run backfill:whatsapp:direct-metadata`
3. `npm run reconcile:whatsapp:direct`
4. `npm run reconcile:whatsapp:chat-previews`
5. `npm run reconcile:whatsapp:group-names`
6. `npm run reconcile:whatsapp:web-outbound`
7. `npm run reconcile:whatsapp:provider-gaps`

Observacao: esses comandos alteram dados. Executar somente no ambiente alvo correto.

## 4. Smoke test manual da inbox

- Abrir `/painel/whatsapp` e confirmar carregamento da lista de chats
- Abrir um chat direto existente e sincronizar manualmente
- Rolar mensagens antigas, sincronizar de novo e confirmar que a paginacao continua correta
- Abrir conversa por telefone salvo e por numero manual; confirmar que nao duplica `@c.us` x `@s.whatsapp.net`
- Reagir com um emoji, trocar para outro e remover a reacao
- Abrir contexto de mensagem e fechar/reabrir rapidamente para validar ausencia de race visual
- Validar notificacao desktop + som com permissao `granted`
- Validar que permissao negada nao dispara som nem desktop notification
- Copiar telefone e copiar chat completo

## 5. Smoke test manual de campanhas

- Criar campanha por filtros com volume acima de 400 leads
- Criar campanha por CSV com parte dos leads ja existentes e parte novos
- Iniciar campanha multi-step e interromper no meio para validar retomada sem reenvio das etapas concluidas
- Forcar um alvo para `processing` expirado e validar recuperacao no proximo ciclo
- Cancelar campanha com alvos `pending` e `processing`; conferir counters e status finais
- Reenfileirar um alvo `failed` pela UI
- Validar campanha agendada iniciando pelo job automatico

## 6. Gates tecnicos finais

Executar:

1. `npm run lint`
2. `npm run typecheck`
3. `npm test`
4. `npm run build`

Se houver alerta residual de hooks no inbox, tratar como debito tecnico conhecido antes de expandir novas features no modulo.

## 7. Rollout assistido

- Publicar primeiro para ambiente interno
- Monitorar `npm run monitor:whatsapp:realtime` ou equivalente operacional
- Observar logs de `whatsapp-broadcast` para leases expirados, retries e falhas de provider
- Validar contadores de campanhas e fila de unread nas primeiras 24h
- So depois liberar uso amplo da operacao
