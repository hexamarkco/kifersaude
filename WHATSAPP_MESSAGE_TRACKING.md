# WhatsApp Message Tracking

## Estado atual

Este repositorio mantem rastreamento de edicao e delecao de mensagens do WhatsApp,
mas a implementacao ativa mudou em relacao ao desenho original.

Hoje o historico visivel da inbox usa o componente:

- `src/features/whatsapp/inbox/components/MessageHistoryModal.tsx`

E os indicadores visuais de mensagem vivem em:

- `src/features/whatsapp/inbox/components/MessageBubble.tsx`

## O que existe no codigo ativo

- Marcacao de mensagens editadas e deletadas em `whatsapp_messages`
- Abertura de contexto/historico por mensagem na inbox
- Persistencia e exibicao de `edit_count`, `edited_at`, `is_deleted`, `deleted_at`
- Atualizacao visual em tempo real via subscriptions da inbox

## O que nao faz mais parte da arquitetura ativa

Os itens abaixo faziam parte de uma abordagem anterior e nao devem mais ser usados
como referencia operacional:

- `src/components/communication/MessageHistoryModal.tsx`
- `src/components/communication/MessageHistoryPanel.tsx`
- `src/components/communication/WhatsAppTab.tsx`
- `src/lib/messageHistoryService.ts`

Esses artefatos legados foram removidos do fluxo principal para reduzir duplicacao e
manter ownership do modulo dentro de `src/features/whatsapp`.

## Arquivos principais

### Frontend

- `src/features/whatsapp/inbox/WhatsAppInboxScreen.tsx`
- `src/features/whatsapp/inbox/components/MessageBubble.tsx`
- `src/features/whatsapp/inbox/components/MessageHistoryModal.tsx`

### Backend e banco

- `supabase/functions/whatsapp-webhook/index.ts`
- tabelas `whatsapp_messages` e `whatsapp_message_history`
- triggers/migrations que alimentam os campos de auditoria de mensagem

## Fluxo atual resumido

### Edicao

1. O webhook recebe a atualizacao da mensagem.
2. O backend atualiza os metadados de edicao na mensagem persistida.
3. A inbox recebe a mudanca por realtime/sync.
4. `MessageBubble` mostra o estado editado.
5. `MessageHistoryModal` abre o contexto quando acionado.

### Delecao

1. O webhook recebe a delecao ou revogacao.
2. A mensagem e marcada como deletada no banco.
3. A inbox reflete o estado via realtime/sync.
4. O usuario ve a mensagem como apagada e pode abrir o historico/contexto.

## Limites conhecidos

- Este documento nao lista migrations antigas nominalmente porque elas podem variar
  por ambiente.
- O modulo nao possui mais painel separado de estatisticas de historico.
- Qualquer nova evolucao de tracking deve acontecer dentro de `src/features/whatsapp`
  e nao em wrappers dentro de `src/components/communication`.

## Validacao recomendada

Para validar o tracking atual:

1. editar uma mensagem no WhatsApp e confirmar badge/estado editado na inbox
2. deletar uma mensagem e confirmar estado apagado na inbox
3. abrir `MessageHistoryModal` e confirmar carregamento sem race condition
4. rodar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`

## Observacao operacional

Se houver divergencia entre este documento e a UI, considerar o codigo em
`src/features/whatsapp` como fonte de verdade.
