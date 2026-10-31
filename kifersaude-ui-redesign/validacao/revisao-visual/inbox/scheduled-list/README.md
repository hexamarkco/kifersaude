# Inbox — mensagens agendadas

Revisão do `WhatsAppScheduledMessagesPanel` e dos fluxos de criação/edição a partir da própria lista. A prévia usa os componentes reais, dados sintéticos e serviços sem escrita; não cancela, grava ou envia mensagens.

## Capturas

### Desktop — 1920 × 1080

- `desktop/upcoming-top.png` e `desktop/upcoming-bottom.png` — lista de próximas mensagens e sequências, no início e após rolagem interna.
- `desktop/attention.png` — sequência pausada e mensagem com falha.
- `desktop/history.png` — itens concluídos/cancelados no histórico.
- `desktop/empty.png`, `desktop/loading.png` e `desktop/load-error.png` — estados vazio, carregamento e erro.
- `desktop/date-filter-open.png` — calendário do filtro de período aberto.
- `desktop/edit-message.png` — edição com recorrência e etiqueta expandidas; sem salvar.
- `desktop/create-message.png` e `desktop/create-sequence.png` — modos de criação real; sem agendar.
- `desktop/upcoming-dark.png` — lista no tema escuro.

### Tablet — 768 × 1024

- `tablet/upcoming.png` — lista com largura útil reduzida e rolagem interna.

### Mobile

- `mobile/upcoming.png` — lista em 390 × 844.
- `mobile/create-sequence-top.png` e `mobile/create-sequence-bottom.png` — sequência longa nos limites da rolagem; o rodapé com as ações continua acessível.
- `mobile-320/upcoming.png` — lista em 320 × 640.

## Resultado e limites

O diálogo usa o `Dialog` de workspace e os elementos reais do design system: `Card`, `Badge`, `EmptyState`, `LoadingState`, `Tabs`, `Input`, `DateTimePicker`, `Button` e `IconButton`. Ajustei a altura responsiva para que o workspace preencha a tela até 640 px; em telas menores que desktop, o conteúdo extenso rola dentro do corpo e preserva o rodapé. A ação **Agendar nova** só aparece na lista quando existe uma conversa selecionada que possa fornecer o contato.

Playwright conferiu 1920 × 1080, 768 × 1024, 390 × 844 e 320 × 640, sem overflow horizontal. No mobile, o botão de adicionar etapa usa um rótulo compacto sem quebrar a palavra; seu nome acessível continua “Adicionar etapa”. Foram exploradas as abas, busca, filtro de data, recolhimento e paginação de seções, edição e os dois modos de criação. Nenhuma ação de cancelamento, exclusão, salvamento ou envio foi executada.

A comparação completa com a referência ainda está pendente: `extra--inbox-agendamentos.png` descreve uma página de gestão com tabela, filtros de responsável e exportação, enquanto o CRM atual apresenta este componente como diálogo e não oferece todos esses controles. As capturas desta revisão documentam o comportamento real do componente, mas não representam aprovação de aderência à página de referência nem substituem a revisão integrada em uma sessão autenticada do Inbox.
