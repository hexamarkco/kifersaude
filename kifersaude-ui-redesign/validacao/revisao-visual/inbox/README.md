# WhatsApp Inbox — revisão visual

**Estado: página principal revisada com adaptações funcionais.** Comparação com as referências [desktop](../../../references/desktop/page--inbox.png) e [mobile](../../../references/mobile/page--inbox.png). Os contextos de overlays e ferramentas da Inbox continuam separados no manifesto e ainda precisam de revisão própria.

## Adaptações ao CRM real

- O cabeçalho da página usa `PageHeader` e concentra a ação real **Nova conversa**. A listagem conserva os filtros e ações que o operador já utiliza.
- Em telas largas, a conversa ocupa a área de trabalho entre a lista e um painel contextual com o contato, status, responsável, atividade e lembretes. O painel reutiliza os dados e os fluxos já existentes; não cria campos nem operações de negócio.
- A partir de 1600 px, as três áreas ficam abertas lado a lado. Entre 1024 e 1599 px, a lista e a conversa ficam lado a lado, e o contexto continua acessível pelo drawer atual. Em telas menores, a Inbox mostra a lista ou a conversa, conforme a navegação existente.
- Até 430 px, o campo de mensagem usa uma linha própria e as ações de composição ficam abaixo. Assim o placeholder e o texto digitado não são comprimidos pelos botões, inclusive em 320 px.
- O texto das mensagens fica alinhado à esquerda; o justificado anterior abria espaços irregulares entre palavras em telas estreitas.
- A indisponibilidade da integração aparece como aviso persistente. A fixture local não conecta ao WhatsApp; o aviso foi mantido para não esconder uma condição operacional relevante.

## Verificações e capturas

- Capturas Playwright em 1920 × 1080, 768 × 1024, 390 × 844 e 320 × 640, com temas claro e escuro para a conversa selecionada.
- A lista sem conversa selecionada foi capturada em 390 × 844. Também foram abertas, sem confirmar ações, as três abas do diálogo **Novo chat**.
- O drawer de informações do lead foi capturado no início e após rolagem interna em desktop e mobile.
- `document.documentElement.scrollWidth` e `document.body.scrollWidth` ficaram iguais à viewport: 1920, 768, 390 e 320 px. Não houve overflow horizontal.
- As 16 imagens e as medidas por viewport estão em [coverage.json](coverage.json).

## Segurança e limitações da fixture

- Todas as conversas, mensagens, imagens, leads, contratos e lembretes exibidos são dados sintéticos de demonstração. Nenhuma mensagem foi enviada, nenhum contato ou lembrete foi criado ou alterado e nenhuma ação comercial foi confirmada.
- A fixture bloqueou a tentativa de presença com HTTP 403 e não disponibilizou Realtime (handshake local expirado). O polling de leitura continuou ativo; esses avisos são do ambiente de demonstração.
- Esta revisão encerra apenas `page--inbox`. Filtros, agenda, mensagens agendadas, painel WhatsApp, pesquisa, anexos, mídia, formatação, respostas rápidas e outros estados da conversa permanecem como contextos independentes pendentes no manifesto.
