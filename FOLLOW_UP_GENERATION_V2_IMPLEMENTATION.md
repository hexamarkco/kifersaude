# Implementação V2 — gerador de follow-up

Data: 01/09/2026

## Causa raiz do erro reportado

A Edge Function passou a consultar as colunas V2 de `comm_follow_up_audit_log`
e `reminders` antes de a migration correspondente existir no banco remoto. O
PostgREST rejeita essas colunas e o erro era propagado como HTTP 500.

O carregamento de contexto agora tenta primeiro o contrato V2 e, se as colunas
ainda não existirem durante o rollout, faz uma segunda leitura com o contrato
legado. A geração permanece disponível; a contextualização rica passa a valer
automaticamente assim que a migration for aplicada.

## Arquitetura

Anteriormente, o contrato `nextAction` misturava decisão de envio, agenda e
recomendação comercial. O novo contrato separa:

- `currentAction`: `send` ou `wait`;
- `opportunityRecommendation`: continuar, pausar ou recomendar perda;
- `scheduleRecommendation`: agendar ou não, com motivo, data e confiança;
- memória comercial: função, responsável, microdecisão, compromisso e decisor.

A compatibilidade com `nextAction` foi mantida temporariamente no retorno da
função para não quebrar o modal individual enquanto a UI adota os campos V2.

## Persistência

A migration aditiva amplia `comm_follow_up_audit_log` para registrar decisão,
proveniência, texto gerado, texto enviado, data de envio e aprovação de agenda.
Ela também amplia `reminders` com o vínculo da geração, lote, origem, usuário,
data sugerida e data aprovada. Dados antigos permanecem nulos.

`schedule_follow_up_reminder_v2` reaproveita a deduplicação já existente e
completa a proveniência depois de criar o reminder.

## Interface

- O modal individual explica claramente `wait`, não permite disparar texto
  vazio e exige uma ação explícita da corretora para pedir uma mensagem mesmo
  assim.
- No lote, itens `wait` não entram no envio; eles podem ainda ter a agenda
  aprovada sem disparar mensagem.
- A recomendação de agenda fica visível, a data é editável e só é persistida
  se a corretora marcar explicitamente a opção de criar o reminder. A mesma
  ação permite reagendar uma recomendação `no_schedule`.
- Recomendações de perda continuam apenas como recomendação; nenhum status é
  alterado automaticamente.

## Regras determinísticas e IA

- Outbound útil sem inbound posterior em menos de 12 horas força `wait`, salvo
  instrução explícita da corretora.
- Saudações temporais são normalizadas pelos fatos temporais calculados no
  backend.
- O contexto inclui audits e reminders compactos; transcript continua sendo a
  fonte de verdade.
- A mesma função comercial sem resposta é bloqueada por um retry semântico.
- Exemplos literais do histórico outbound não são enviados ao modelo; só o
  perfil estatístico de estilo permanece.

## Casos reais cobertos na leitura de regras

| Caso | Regra V2 aplicável |
| --- | --- |
| Ana Maria / Tiago | função já tentada sem inbound: retry/pausa, sem perda automática |
| Marco Antônio / Maria José | outbound recente: `wait`, sem texto no lote |
| Joana / Margarida / Sildenir | `third_party`, não cobrar o intermediário imediatamente |
| Isabela | progressão de documentação por função comercial |
| Michele | controle positivo: envio e remoção de atrito |
| Valeria | recuperar trade-off em vez de check-in genérico |

A validação end-to-end desses chats requer a migration e o deploy da Edge
Function, pois o ambiente local não possui Docker/Deno para executar a função
contra um snapshot do banco remoto. Nenhuma chamada de IA foi feita contra os
leads reais durante esta implementação.

## Verificações executadas

- `npm run typecheck`
- `npm run lint`
- `npm run test` — 40 arquivos, 204 testes aprovados
- `npm run build`
- `npm run migrations:check`
- `supabase db push --dry-run --skip-vault`

O dry-run encontrou somente `20261001002000_add_follow_up_v2_audit_and_reminder_provenance.sql`.

## Rollout recomendado

1. Aplicar a migration com `supabase db push`.
2. Implantar `comm-whatsapp-generate-follow-up`.
3. Gerar um follow-up em um chat com histórico e confirmar resposta 200.
4. Testar um item `wait` e um item `send` no lote antes do uso amplo.

O deploy não foi executado nesta tarefa, pois altera a produção.
