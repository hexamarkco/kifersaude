# Auditoria de conclusão de lembretes — 24/10/2026

## Diagnóstico

O diagnóstico fornecido identifica 176 registros com `lido=true`, `concluido_em=null`, `cancelled_at=null` e `ultima_modificacao=2026-09-14 07:23:41 UTC`. Eles estão encerrados. A data da última modificação não comprova quando cada conclusão ocorreu e não deve ser usada para preencher `concluido_em`.

`markInboxRemindersRead`, chamado por `useInboxBatchFollowUpSender` após resolver os lembretes do lote, gravava somente `lido=true`. Esse caminho explica como novos encerramentos poderiam ficar sem data; o código atual e o timestamp comum, isoladamente, não comprovam a origem dos 176 históricos. Uma auditoria que usa apenas `concluido_em IS NULL` conta indevidamente esses registros como pendências.

A regra operacional, compartilhada com a RPC `get_lead_pending_reminder_date`, é:

```sql
WHERE lido = false AND cancelled_at IS NULL
```

Vencimento é um filtro adicional sobre `data_lembrete`; não muda o estado de encerramento. `concluido_em` informa quando houve conclusão, não substitui `lido` como estado do histórico. A regressão com 176 encerrados sem data e 17 vencidos não lidos mantém exatamente 17 vencidos.

## Caminhos auditados

| Caminho | Comportamento e correção |
| --- | --- |
| Agenda: conclusão individual, agendamento rápido e conclusão dos filtros em lote | Já enviava leitura e data juntas. O repository agora normaliza o par e impede que uma repetição dê data nova a um encerrado histórico. |
| Agenda WhatsApp: conclusão individual e agendamento rápido | Usa o mesmo repository; mantém o fluxo de oferta do próximo lembrete. |
| Painel do lead no Inbox (`WhatsAppLeadDrawer`) | Já enviava leitura e data juntas pelo repository comum. |
| Envio em lote no Inbox (`markInboxRemindersRead`) | Corrigido para gravar leitura e data na mesma atualização, apenas nos IDs solicitados ainda pendentes e não cancelados. |
| Worker `process-scheduled-messages` | Já gravava os dois campos. Recebeu filtros de estado na atualização para proteger encerramentos/cancelamentos ocorridos desde a leitura. |
| MCP (`write-actions.ts`) | Conclusão já grava ambos; a guarda de `lido=true` preserva encerrados históricos. Cancelamento é excluído das pendências e da produção. |
| Reabertura na UI | Limpa `concluido_em` junto com `lido=false`; o repository normaliza esse par. |
| Reabertura/reagendamento com reabertura via MCP | A RPC existente limpa leitura, conclusão e cancelamento na mesma transação; coberta por teste PostgreSQL existente. |

Não há outro caminho de conclusão em scripts suportados. Migrations históricas foram apenas lidas.

## Consultas e indicadores

Foram adicionadas exclusões de cancelados onde faltavam: lista da Agenda, seleção de pendências do lead, resumo de notificações, serviço de notificações, consulta de próximo lembrete, gerador de follow-up, organizador da Agenda e workers. Consultas que já combinavam `lido=false` e ausência de cancelamento foram preservadas. A listagem MCP já usa essa combinação para `status=pending` e considera `lido=true` concluído sem exigir data.

O Dashboard passou a carregar `cancelled_at` e compartilhar o predicado de pendência, inclusive na cobertura de próximo passo. O estado de conclusão exibido não depende mais de `Boolean(concluido_em)`. Os totais de vendas, receita, comissão e conversão vêm de leads/contratos; a regressão confirma que incluir os 176 históricos não altera esses indicadores. O resumo diário da Agenda continua agrupado pela data agendada, preservando sua semântica de calendário.

Produção da equipe tem outra dimensão: o trigger da migration `20261014203527_team_production_attribution.sql` cria `reminder_completed` quando `concluido_em` muda para uma data conhecida, sem cancelamento. Gravar apenas leitura não cria esse evento. Assim, o caminho antigo do Inbox podia subcontar retornos realizados durante a medição ativa. A correção registra a conclusão nova atomicamente, permitindo ao trigger existente capturar o evento; reabertura/cancelamento revoga sua vigência.

O relatório também depende de ativação da medição e atribuição válida ao operador. Não se pode afirmar que todos os 176 históricos deveriam integrar produção: eles não têm datas de conclusão conhecidas e a medição exclui o histórico compartilhado anterior à ativação. Nenhuma data, autoria ou crédito foi reconstruído.

## Validação e limites

Testes importam a implementação de produção e cobrem normalização, conclusão individual e em lote, filtros de cancelamento, histórico sem data, contagem de vencidos, reabertura e o modal real de próximo lembrete. Os testes PostgreSQL locais via PGlite verificam criação do evento de produção e sua revogação por reabertura/cancelamento.

As quantidades e o timestamp de produção acima são o diagnóstico fornecido pelo solicitante; não foi feita nova consulta remota. Nenhum lembrete existente foi alterado, apagado, reaberto ou reagendado. Não há nova migration, aplicação de migrations, envio real de mensagens ou deploy nesta correção.

### Resultados dos checks

- Regressões direcionadas: 73 testes em 14 arquivos aprovados, incluindo Agenda, Inbox, domínio, Dashboard, notificações, PostgreSQL de produção e reabertura MCP. Os dois testes de lotes parciais de leads também passaram após adequação do mock ao filtro de cancelamento: 75 testes aprovados no conjunto relevante.
- O teste PostgreSQL de produção executa adicionalmente as regressões do script `scripts/test-production-database.mjs` em banco isolado. O modal real foi novamente verificado após o ajuste final do mock da API pública: três testes de interface aprovados.
- `npm run lint`: aprovado, com quatro avisos fora dos arquivos desta correção. Lint direcionado: aprovado sem saída. `npm run architecture:check`: aprovado. `git diff --check` nos arquivos desta correção: aprovado.
- `npm run typecheck`: bloqueado por erros fora desta alteração em `useVoiceRecording.ts`, `xlsxExport.ts` e, durante alterações simultâneas no workspace, `ContractForm.tsx`. Nenhum erro remanescente apontou os arquivos desta correção.
- `npm run build`: interrompido pelo gate `audit:visual`, com nove ocorrências em componentes de mídia/compositor/cabeçalho WhatsApp fora desta alteração; `secrets:check` passou. O empacotamento não chegou a executar.
- `npm run migrations:check`: bloqueado pelo grupo de slug duplicado `comm_whatsapp_status_refresh_index_trigger`. Nenhuma migration foi modificada por esta tarefa.
- A suíte completa (`npm test -- --maxWorkers=2 --minWorkers=1`) terminou com 1.699 testes aprovados e sete falhas em 316 arquivos. Essa execução começou antes dos ajustes dos mocks de notificações e lotes de leads: os dois foram corrigidos e reexecutados com sucesso no conjunto direcionado; a rejeição não tratada originada pelo mock antigo de lotes também desapareceu na reexecução.
- As outras cinco falhas observadas foram criação de lembrete em `write-actions.test.ts`, contrato de campanhas em `campaign-admission-safety-contract.test.ts`, assinatura de autenticação de simulação em `comm-whatsapp-follow-up-v2-contract.test.ts`, `WhatsAppQuickRepliesModal.test.tsx` e `FeatureEditorDrawer.test.tsx`. A falha do contrato de follow-up foi reproduzida isoladamente: exige `isServiceRoleRequest(req, serviceRoleKey)`, trecho não alterado pela inclusão do filtro de cancelamento. As telas de respostas rápidas e editor de IA sofreram alterações simultâneas fora desta tarefa. A suíte completa não foi repetida após esses ajustes; não se declara o conjunto global aprovado.
