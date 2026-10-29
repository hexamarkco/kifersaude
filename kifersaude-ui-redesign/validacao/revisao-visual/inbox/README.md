# WhatsApp Inbox — revisão visual

**Estado: página principal e diálogo “Novo chat” revisados com adaptações funcionais.** A comparação usa as referências [desktop](../../../references/desktop/page--inbox.png), [mobile](../../../references/mobile/page--inbox.png), [diálogo desktop](../../../references/desktop/state--inbox-nova-conversa.png) e [diálogo mobile](../../../references/mobile/state--inbox-nova-conversa.png). Os demais contextos de overlays e ferramentas da Inbox continuam separados no manifesto.

## Adaptações ao CRM real

- O cabeçalho da página usa `PageHeader` e concentra a ação real **Nova conversa**. A listagem conserva os filtros e ações que o operador já utiliza.
- Em telas largas, a conversa ocupa a área de trabalho entre a lista e um painel contextual com o contato, status, responsável, atividade e lembretes. O painel reutiliza os dados e os fluxos já existentes; não cria campos nem operações de negócio.
- A partir de 1600 px, as três áreas ficam abertas lado a lado. Entre 1024 e 1599 px, a lista e a conversa ficam lado a lado, e o contexto continua acessível pelo drawer atual. Em telas menores, a Inbox mostra a lista ou a conversa, conforme a navegação existente.
- Até 430 px, o campo de mensagem usa uma linha própria e as ações de composição ficam abaixo. Assim o placeholder e o texto digitado não são comprimidos pelos botões, inclusive em 320 px.
- O texto das mensagens fica alinhado à esquerda; o justificado anterior abria espaços irregulares entre palavras em telas estreitas.
- Ajuste de 29/10 após correção de interpretação: o histórico conserva 20 px de margem externa à esquerda e à direita (`px-5`); o padding interno de mensagens textuais e da prévia do follow-up foi reduzido para 8 px (`p-2`).
- A indisponibilidade da integração aparece como aviso persistente. A fixture local não conecta ao WhatsApp; o aviso foi mantido para não esconder uma condição operacional relevante.

## Diálogo “Novo chat”

- Reutiliza `DialogShell`, `SegmentedControl`, `InfoTooltip`, `Input`, `Button`, `Surface`, `Avatar`, `Badge`, `EmptyState` e `LoadingState` do design system.
- A orientação secundária fica no `InfoTooltip` junto ao título. O foco inicial vai para as abas do conteúdo, sem abrir o tooltip automaticamente.
- As abas reais são **Contatos**, **CRM** e **Número**. O rótulo compacto mantém as três opções em uma linha até 320 px; o grupo tem nome acessível para leitores de tela.
- Capturas registram a lista de contatos com dado sintético, leads do CRM, número vazio e preenchido, estado vazio, carregamento, falha com opção de tentar novamente, tooltip em hover e foco, tema escuro, além das larguras desktop, tablet, 390 px e 320 px.
- A referência mostra campos de canal, mensagem inicial e salvamento. O CRM atual não oferece essas operações neste fluxo; mantive apenas a abertura por contato salvo, lead do CRM ou número manual, sem criar controles decorativos ou alterar regras.

## Verificações e capturas

- Capturas Playwright em 1920 × 1080, 768 × 1024, 390 × 844 e 320 × 640; tema escuro registrado para o diálogo e para a conversa selecionada.
- As fontes foram aguardadas antes das capturas e animações/transições foram desativadas no preview sintético.
- `document.documentElement.scrollWidth` e `document.body.scrollWidth` ficaram iguais à viewport: 1920, 768, 390 e 320 px. No diálogo de 320 px, as três abas mantêm a mesma posição vertical e a primeira opção não é truncada.
- Depois do ajuste das bubbles, Playwright conferiu o CSS compilado com uma fixture DOM: 20 px entre a área da conversa e cada borda externa, e 8 px entre a borda da bubble e seu conteúdo. A rota autenticada redirecionou para o login, então a métrica não substitui uma nova captura da Inbox integrada.
- A lista sem conversa selecionada foi capturada em 390 × 844. O drawer de informações do lead foi capturado no início e após rolagem interna em desktop e mobile.
- As 29 imagens desta revisão de Inbox e as medidas por viewport estão em [coverage.json](coverage.json).

## Segurança e limitações da fixture

- Contatos, leads, conversas, mensagens, imagens, contratos e lembretes usados nas capturas são dados sintéticos. O preview usa callbacks sem efeito; nenhuma mensagem foi enviada, nenhum contato ou lembrete foi criado ou alterado e nenhuma ação comercial foi confirmada.
- A fixture da Inbox bloqueou a tentativa de presença com HTTP 403 e não disponibilizou Realtime (handshake local expirado). O polling de leitura continuou ativo; esses avisos são do ambiente de demonstração.
- Esta revisão encerra apenas `page--inbox` e `state--inbox-nova-conversa`. Filtros, agenda, mensagens agendadas, painel WhatsApp, pesquisa, anexos, mídia, formatação, respostas rápidas e outros estados da conversa permanecem como contextos independentes pendentes no manifesto.
