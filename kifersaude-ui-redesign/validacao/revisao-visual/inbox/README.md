# WhatsApp Inbox — revisão visual

**Estado: página principal e diálogo “Novo chat” revisados; filtros e respostas rápidas comparados com adaptações em fixtures de componentes.** A comparação usa as referências [desktop](../../../references/desktop/page--inbox.png), [mobile](../../../references/mobile/page--inbox.png), [diálogo desktop](../../../references/desktop/state--inbox-nova-conversa.png), [diálogo mobile](../../../references/mobile/state--inbox-nova-conversa.png) e [filtros desktop e mobile](../../../references/desktop/state--inbox-filtros.png). A revisão integrada da rota autenticada e os demais contextos de overlays e ferramentas continuam pendentes no manifesto.

## Adaptações ao CRM real

- O cabeçalho da página usa `PageHeader` e concentra a ação real **Nova conversa**. A listagem conserva os filtros e ações que o operador já utiliza.
- Em telas largas, a conversa ocupa a área de trabalho entre a lista e um painel contextual com o contato, status, responsável, atividade e lembretes. O painel reutiliza os dados e os fluxos já existentes; não cria campos nem operações de negócio.
- A disposição usa a largura útil do Inbox, não a largura externa da janela. Com pelo menos 72rem (1152 px CSS), lista, conversa e painel de contato ficam lado a lado; o painel não cobre nem esmaece o histórico. Abaixo desse espaço, o painel de contato ocupa a área de trabalho enquanto está aberto, sem deixar mensagens parcialmente visíveis; ao fechá-lo, a conversa e a lista voltam. Sem seleção de conversa, permanece a navegação atual entre lista e conversa.
- Até 430 px, o campo de mensagem usa uma linha própria e as ações de composição ficam abaixo. Assim o placeholder e o texto digitado não são comprimidos pelos botões, inclusive em 320 px.
- O texto das mensagens fica alinhado à esquerda; o justificado anterior abria espaços irregulares entre palavras em telas estreitas.
- Ajuste de 29/10: o histórico conserva 20 px de margem externa à esquerda e à direita (`px-5`); mensagens textuais e a prévia de follow-up mantêm 12 px nas laterais e 8 px na vertical (`px-3 py-2`) para o texto respirar sem alargar demais a bubble. O padding externo do histórico é independente e permanece nos dois lados. Legendas de mídia mantêm o espaçamento próprio do componente.
- Em mensagens de mídia, o contêiner mantém 4 px verticais e o próprio trecho de data/hora recebe 12 px laterais (`.whatsapp-inbox-media-meta-time`). Mídias sem bolha também ganham 8 px verticais; mensagens textuais continuam usando o padding do balão. O recuo não depende do ancestral `.whatsapp-inbox-thread` e cobre imagens, legendas, áudio, stickers e grupos. Playwright confirmou os 12 px em 1920, 768, 390 e 320 px, sem overflow; a suíte do componente cobre as variações inbound.
- O cartão de agenda do painel contextual mantém o título “Agenda do chat” em uma linha, com a explicação no `InfoTooltip`. As ações **Agendar** e **Atualizar** ocupam uma grade alinhada e fluida; a composição empilha título e ações em qualquer largura porque o painel tem largura própria, independente do breakpoint da janela.
- O cabeçalho da conversa agora mantém apenas o nome e o próximo lembrete. Telefone, região do número, presença, opção para salvar/renomear o contato e estado da IA ficam na barra **Informações do contato**; status, responsável e favorito continuam na ficha do lead dentro dela. A barra reaproveita os componentes e handlers já existentes, sem duplicar regras comerciais.
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
- Capturas históricas de uma sessão autenticada registram o recuo externo do histórico. A validação atual usa uma sessão sintética local: ela confirma a composição do agendamento e o recuo das mídias, sem substituir a revisão completa do shell do Inbox com uma sessão de produção.
- Playwright também conferiu a geometria do cartão de agenda com o CSS compilado em uma fixture isolada: o painel permaneceu com 352 px em 768 e 390 px, adaptou para 320 px no viewport estreito e manteve título e botões legíveis, sem overflow horizontal. O teste do componente valida a hierarquia e as duas ações; uma captura autenticada deste estado ainda depende de uma sessão de Inbox disponível.
- Testes dos componentes confirmam que o cabeçalho contém somente nome e lembrete, e que renomear continua acionando o fluxo existente dentro da barra de informações. A sessão sintética também abriu o agendamento dentro de `/painel/inbox`; a listagem e os demais estados seguem separados no manifesto.
- A lista sem conversa selecionada foi capturada em 390 × 844. O drawer de informações do lead foi capturado no início e após rolagem interna em desktop e mobile.
- As 89 capturas listadas desta revisão de Inbox e as medidas por viewport estão em [coverage.json](coverage.json).

## Segurança e limitações da fixture

- Contatos, leads, conversas, mensagens, imagens, contratos e lembretes usados nas capturas são dados sintéticos. O preview usa callbacks sem efeito; nenhuma mensagem foi enviada, nenhum contato ou lembrete foi criado ou alterado e nenhuma ação comercial foi confirmada.
- A revisão do painel de contato usa o `WhatsAppLeadDrawer` real e os estilos de produção; a moldura da lista, conversa e compositor é estática, os callbacks não executam ações e todas as requisições Supabase foram interceptadas com dados vazios. O modal de mensagens rápidas também foi conferido em fixture isolada com o componente real, dados sintéticos e callback local sem efeito.
- A fixture da Inbox bloqueou a tentativa de presença com HTTP 403 e não disponibilizou Realtime (handshake local expirado). O polling de leitura continuou ativo; esses avisos são do ambiente de demonstração.
- A revisão integrada cobre `page--inbox`, `state--inbox-nova-conversa` e o formulário `state--inbox-agenda`. `state--inbox-filtros`, painel de contato e o modal de mensagens rápidas foram verificados em fixtures de componentes; a validação integrada autenticada ainda está pendente. A lista de mensagens agendadas foi revisada em fixture local, mas segue pendente de aderência à referência: o CRM atual abre um diálogo com cartões e abas; a referência descreve uma página com tabela, filtro de responsável e exportação. Painel WhatsApp, pesquisa, anexos, mídia, formatação, integração das respostas rápidas com o compositor e outros estados permanecem como contextos independentes no manifesto.

## Transição responsiva do painel de contato — 30/10/2026

O breakpoint agora mede a largura útil de `.whatsapp-inbox-shell` com container queries. A partir de 72rem, o painel integra a grade em três colunas; abaixo disso, ele substitui a conversa/lista enquanto estiver aberto. Isso evita o backdrop claro sobre as mensagens e elimina o corte causado pela sobreposição do painel.

Playwright CLI verificou a grade em 1920 × 1080 (shell 1856 px), 1272 × 800 (shell 1208 px, caso de zoom), 1024 × 1024 (shell 960 px), 768 × 1024 (shell 704 px), 390 × 844 e 320 × 640. As duas larguras acima do limite mantiveram as três colunas; nas quatro menores, o painel ocupou a área de trabalho sem backdrop. Nenhuma apresentou overflow horizontal. A medição usou uma fixture local com conteúdo sintético e os estilos reais do design system; ela verifica a regra de posicionamento, mas não substitui uma captura integrada da rota autenticada, que segue pendente.

## Painel de contato real — validação visual responsiva (31/10/2026)

O `WhatsAppLeadDrawer` de produção foi renderizado no shell sintético da Inbox com Playwright. Após reorganizar o cabeçalho, recapturei 1920 × 1080 nos temas claro e escuro; 1272 × 800, 768 × 1024 e 320 × 640 no tema claro; 390 × 844 nos dois temas; e 320 × 640 no tema escuro, inclusive após rolagem interna. O painel usa 508,8 px a 1920 px e 352 px a 1272 px; em tablet e mobile ocupa toda a área de trabalho enquanto a conversa e a lista ficam ocultas. A largura do documento permaneceu igual à viewport em todas as medidas.

Em 320 px, o placeholder visual da busca é **Nome ou telefone**, preservando o nome acessível completo **Buscar lead por nome ou telefone**. Playwright confirmou que o texto cabe no campo e que a ficha rola internamente. O cabeçalho atualizado segue a referência: título e descrição próprios, Avatar reutilizável, nome e status real do lead. As capturas atuais cobrem claro/escuro em desktop e mobile; tablet e 320 px também foram recapturados no tema claro, com a rolagem interna renovada no tema escuro. As 12 imagens estão em [contact-panel](contact-panel/) e as medidas em [coverage.json](coverage.json). A prévia usa build de produção isolado, dados sintéticos, callbacks sem efeito e URL Supabase local de placeholder; nenhuma credencial real ou operação foi usada.

Esta evidência cobre o componente real e sua composição responsiva, mas não substitui a revisão integrada da rota autenticada `/painel/inbox`: a moldura da conversa/lista/compositor é estática e não foram exercitadas ações reais. A rota autenticada e os demais contextos da Inbox permanecem pendentes.

## Filtros avançados e metadados de mídia — 31/10/2026

O filtro avançado usa o `Dialog` do design system e os grupos reais de atividade, status do lead e agente responsável. No desktop e tablet o painel acompanha o botão; em 390 px e 320 px ocupa a tela inteira. A posição usa `position: fixed`, alinhada à viewport, para não herdar o centramento do contêiner de diálogos. O botão **Limpar filtros** remove atividade, status e responsável em conjunto. As alterações ficam em rascunho até aplicar; fechar com Escape mantém os filtros aplicados anteriores.

Playwright CLI verificou 1920 × 1080, 768 × 1024, 390 × 844 e 320 × 640, sem overflow horizontal; o tema escuro também foi capturado em desktop. Aplicar atividade não lida, status Atendimento e agente Luiza refletiu três filtros no acionador. Escape descartou o rascunho e limpar/aplicar removeu os três critérios. As capturas estão em [filters](filters/) e os resultados detalhados em [coverage.json](coverage.json). A fixture usa conversas sintéticas e callbacks locais; a rota autenticada permanece pendente.

A referência dessa seção mostra cinco origens (Site, Indicação, Meta Ads, WhatsApp e Outros). O tipo real `CommWhatsAppChat` não expõe origem, então o filtro continua cobrindo somente atividade não lida, status do lead e agente responsável. Não inventei categorias nem uma regra de associação. No desktop/tablet o diálogo permanece junto ao acionador real; em 390 e 320 px ele ocupa a viewport. Essa diferença funcional foi comparada e registrada em `state--inbox-filtros` como adaptação; a rota integrada autenticada continua pendente.

O recuo lateral agora pertence diretamente ao trecho de data/hora; o contêiner de metadados cuida apenas do espaço vertical. Playwright confirmou `padding-inline: 12px` nas larguras 1920, 768, 390 e 320 px, inclusive removendo `.whatsapp-inbox-thread` do wrapper, sem overflow. Os testes cobrem imagem com reação, mídia com legenda, áudio, sticker e agrupamento. A fixture usa conversa sintética e callbacks sem efeito; a rota autenticada continua pendente.

## Agendamento de mensagens — revisão integrada — 31/10/2026

O fluxo **Agendamentos do Contato → Agendar nova mensagem** foi aberto dentro da rota local `/painel/inbox` usando conversa sintética. A modal, a validação de mensagem obrigatória, o datepicker nas etapas Data/Hora/Minutos, as opções adicionais e a sequência foram conferidos sem salvar ou enviar. As capturas integradas e a diferença em relação à referência estão em [schedule-message](schedule-message/README.md); a lista de mensagens agendadas é tratada na seção própria abaixo.

## Lista de mensagens agendadas — revisão do componente — 31/10/2026

O `WhatsAppScheduledMessagesPanel` e os fluxos reais de criação e edição foram conferidos em fixture local com dados sintéticos. O diálogo reutiliza `Card`, `Badge`, `EmptyState` e `LoadingState`; corrigi a altura do workspace no mobile, o rótulo do botão de adicionar etapa e a ação de agendar quando não há conversa selecionada. Foram capturados conteúdo, abas, busca, datas, edição, criação, sequência, tema escuro e estados vazio, carregando e erro. As evidências e as limitações estão em [scheduled-list](scheduled-list/README.md); a página/tabela da referência e a revisão autenticada permanecem pendentes.

## Mensagens rápidas — gerenciamento — 31/10/2026

- O modal usa o `DialogShell` de formulário e componentes existentes do Design System. Permite escolher uma resposta, criar e remover rascunhos, editar Atalho/Título/Mensagem, conferir erros de validação e salvar pelo fluxo já existente. Não houve alteração no tipo persistido nem nas regras de negócio.
- A referência mostra uma categoria, mas `WhatsAppQuickReply` não possui esse campo; não foi inventado dado nem persistência. A adaptação mantém Atalho, Título e Mensagem, que existem no modelo real.
- Playwright conferiu a prévia com os componentes reais em 1920×1080 (claro/escuro), 768×1024, 390×844 e 320×640. O seletor aceita navegação por setas/Enter, os tooltips de contexto e de campo abrem sob demanda, o estado vazio e a validação são legíveis e o rodapé continua acessível durante rolagem interna. Não houve overflow horizontal.
- O foco inicial agora vai ao botão visível do `Select`; o `<select>` nativo oculto foi removido do conjunto de focáveis do `Dialog`, preservando a navegação por teclado e o ciclo de foco. Teste de regressão cobre essa combinação. O teste de saving confirma campos e ações bloqueados e o Escape sem fechar enquanto a gravação está em andamento.
- O botão Salvar foi exercitado apenas na fixture sintética, onde fecha o diálogo sem escrita no CRM. As 12 capturas deste componente estão registradas no `coverage.json`, incluindo dropdown aberto, tooltips, vazio, erro, tema escuro e estados mobile de 320 px.
- O gerenciador foi aberto também pelo botão **Gerenciar** do compositor em fixture local, confirmando a integração entre os dois componentes. A rota autenticada e a persistência real continuam pendentes.

## Mensagens rápidas — sugestões no compositor — 31/10/2026

- Playwright renderizou `WhatsAppComposer`, `useInboxQuickReplyComposer`, `useInboxComposerSubmission` e `WhatsAppQuickRepliesModal` reais com respostas sintéticas. Digitar `/` abre sugestões; as setas mudam a opção ativa, Enter e clique inserem o texto no rascunho, e Escape fecha a lista ou o modal. A seleção não envia a mensagem. **Gerenciar** abre o modal real, sem gravar dados.
- A lista expõe `combobox`, `listbox` e `option`, com `aria-controls`, `aria-activedescendant` e seleção anunciada. O botão **Gerenciar** permanece em uma linha em 320 px; a lista não cria rolagem horizontal.
- Foram capturados sugestão normal, modal aberto, resposta inserida sem envio, nenhum resultado, estado vazio e erro de carregamento em desktop, tablet e mobile. A cobertura inclui desktop escuro, larguras 1920, 768, 390 e 320 px, sem overflow.
- **Limitação da referência:** `state--inbox-mensagens-rapidas.png` repete o painel de filtros de origem de `state--inbox-filtros.png` e só muda o título; não há imagem de referência válida para as sugestões do compositor. A comparação visual específica fica registrada como adaptação, sem inventar um mockup. A revisão na rota autenticada permanece pendente.
- Capturas e medições: [quick-replies-composer](quick-replies-composer/README.md) e [coverage.json](coverage.json).

## Recuperação de anexos indisponíveis — 29/10/2026

Anexos recebidos passam a ser arquivados no bucket privado `comm-whatsapp-media` em uma tarefa de fundo, após salvar a mensagem. Falhas transitórias de armazenamento são repetidas até três vezes, sem atrasar a resposta do webhook. O resolvedor compartilhado é usado pela conversa, pelo drawer de arquivos e pelo visualizador.

Se a Whapi entregar um arquivo durante a abertura da conversa, mas a gravação temporária no Storage falhar, a função ainda devolve a mídia para a sessão atual e registra a falha do cache. O arquivamento em segundo plano mantém as tentativas. Uma mídia que a Whapi já não encontra e que não foi arquivada antes disso precisa ser reenviada pelo contato.

A correção do endpoint está publicada na função `comm-whatsapp-media`, versão 177, mantendo `verify_jwt = true`. `npm run typecheck` e `npm run build` passaram; nenhuma migration foi necessária.

Falhas transitórias de imagem/figurinha, vídeo, áudio/áudio de voz e documento oferecem **Tentar novamente** como ação primária compacta. Quando a Whapi identifica que o arquivo de origem expirou, a interface informa que o contato precisa reenviá-lo e não oferece uma repetição sem efeito. O botão mantém contraste próprio mesmo no placeholder de mídia.

Testes focados: 25/25 aprovados; `npm run typecheck` e `npm run build` passaram. `npm run lint` terminou sem erros e com cinco avisos de Fast Refresh em previews preexistentes de `output/playwright`. Na suíte geral, 1.830 testes passaram e quatro falharam em testes de contratos/configurações/usuários fora dos arquivos desta entrega. A Edge Function `comm-whatsapp-webhook` foi publicada no Supabase após o commit `981576cd` e está ativa na versão 214, sem mudança no requisito de JWT. A validação visual integrada permanece pendente: `/painel/inbox` redirecionou ao login no Playwright local, então não foi aberta uma conversa autenticada. Os contextos de mídia continuam pendentes no manifesto; nenhuma conversa real foi lida ou alterada.
