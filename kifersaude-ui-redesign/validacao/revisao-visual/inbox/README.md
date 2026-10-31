# WhatsApp Inbox — revisão visual

**Estado: página principal e diálogo “Novo chat” revisados; filtros avançados revisados em fixture local.** A comparação usa as referências [desktop](../../../references/desktop/page--inbox.png), [mobile](../../../references/mobile/page--inbox.png), [diálogo desktop](../../../references/desktop/state--inbox-nova-conversa.png) e [diálogo mobile](../../../references/mobile/state--inbox-nova-conversa.png). Os demais contextos de overlays e ferramentas da Inbox continuam separados no manifesto.

## Adaptações ao CRM real

- O cabeçalho da página usa `PageHeader` e concentra a ação real **Nova conversa**. A listagem conserva os filtros e ações que o operador já utiliza.
- Em telas largas, a conversa ocupa a área de trabalho entre a lista e um painel contextual com o contato, status, responsável, atividade e lembretes. O painel reutiliza os dados e os fluxos já existentes; não cria campos nem operações de negócio.
- A disposição usa a largura útil do Inbox, não a largura externa da janela. Com pelo menos 72rem (1152 px CSS), lista, conversa e painel de contato ficam lado a lado; o painel não cobre nem esmaece o histórico. Abaixo desse espaço, o painel de contato ocupa a área de trabalho enquanto está aberto, sem deixar mensagens parcialmente visíveis; ao fechá-lo, a conversa e a lista voltam. Sem seleção de conversa, permanece a navegação atual entre lista e conversa.
- Até 430 px, o campo de mensagem usa uma linha própria e as ações de composição ficam abaixo. Assim o placeholder e o texto digitado não são comprimidos pelos botões, inclusive em 320 px.
- O texto das mensagens fica alinhado à esquerda; o justificado anterior abria espaços irregulares entre palavras em telas estreitas.
- Ajuste de 29/10: o histórico conserva 20 px de margem externa à esquerda e à direita (`px-5`); mensagens textuais e a prévia de follow-up mantêm 12 px nas laterais e 8 px na vertical (`px-3 py-2`) para o texto respirar sem alargar demais a bubble. O padding externo do histórico é independente e permanece nos dois lados. Legendas de mídia mantêm o espaçamento próprio do componente.
- Horários de mídias individuais e agrupadas recebem 12 px laterais e 4 px verticais por uma regra explícita do design system para `.whatsapp-inbox-media-meta`. Isso mantém a data e o horário afastados da borda em mensagens recebidas mesmo quando as utilidades de espaçamento não prevalecem na cascata. Mensagens textuais continuam usando o padding do balão.
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
- A sessão autenticada confirmou o recuo externo atual de 20 px à esquerda e ao menos 20 px à direita, além da barra de rolagem. O código local aplica 12 px horizontais e 8 px verticais dentro das bubbles textuais e da prévia de follow-up. A rota local ainda redireciona para login, então a medição autenticada não substitui uma captura da implementação local integrada.
- Playwright também conferiu a geometria do cartão de agenda com o CSS compilado em uma fixture isolada: o painel permaneceu com 352 px em 768 e 390 px, adaptou para 320 px no viewport estreito e manteve título e botões legíveis, sem overflow horizontal. O teste do componente valida a hierarquia e as duas ações; uma captura autenticada deste estado ainda depende de uma sessão de Inbox disponível.
- Testes dos componentes confirmam que o cabeçalho contém somente nome e lembrete, e que renomear continua acionando o fluxo existente dentro da barra de informações. O teste integrado visual autenticado segue pendente porque a rota local `/painel/inbox` redireciona para login.
- A lista sem conversa selecionada foi capturada em 390 × 844. O drawer de informações do lead foi capturado no início e após rolagem interna em desktop e mobile.
- As 46 imagens desta revisão de Inbox e as medidas por viewport estão em [coverage.json](coverage.json).

## Segurança e limitações da fixture

- Contatos, leads, conversas, mensagens, imagens, contratos e lembretes usados nas capturas são dados sintéticos. O preview usa callbacks sem efeito; nenhuma mensagem foi enviada, nenhum contato ou lembrete foi criado ou alterado e nenhuma ação comercial foi confirmada.
- A revisão do painel de contato usa o `WhatsAppLeadDrawer` real e os estilos de produção; a moldura da lista, conversa e compositor é estática, os callbacks não executam ações e todas as requisições Supabase foram interceptadas com dados vazios.
- A fixture da Inbox bloqueou a tentativa de presença com HTTP 403 e não disponibilizou Realtime (handshake local expirado). O polling de leitura continuou ativo; esses avisos são do ambiente de demonstração.
- A revisão integrada encerra apenas `page--inbox` e `state--inbox-nova-conversa`. Filtros avançados tiveram componentes, interação e posicionamento revisados em fixture local, mas ainda aguardam validação integrada na rota autenticada. Agenda, mensagens agendadas, painel WhatsApp, pesquisa, anexos, mídia, formatação, respostas rápidas e outros estados da conversa permanecem como contextos independentes pendentes no manifesto.

## Transição responsiva do painel de contato — 30/10/2026

O breakpoint agora mede a largura útil de `.whatsapp-inbox-shell` com container queries. A partir de 72rem, o painel integra a grade em três colunas; abaixo disso, ele substitui a conversa/lista enquanto estiver aberto. Isso evita o backdrop claro sobre as mensagens e elimina o corte causado pela sobreposição do painel.

Playwright CLI verificou a grade em 1920 × 1080 (shell 1856 px), 1272 × 800 (shell 1208 px, caso de zoom), 1024 × 1024 (shell 960 px), 768 × 1024 (shell 704 px), 390 × 844 e 320 × 640. As duas larguras acima do limite mantiveram as três colunas; nas quatro menores, o painel ocupou a área de trabalho sem backdrop. Nenhuma apresentou overflow horizontal. A medição usou uma fixture local com conteúdo sintético e os estilos reais do design system; ela verifica a regra de posicionamento, mas não substitui uma captura integrada da rota autenticada, que segue pendente.

## Painel de contato real — validação visual responsiva (31/10/2026)

O `WhatsAppLeadDrawer` de produção foi renderizado no shell local da Inbox e verificado com Playwright em 1920 × 1080, 1272 × 800, 768 × 1024, 390 × 844 e 320 × 640, nos temas claro e escuro. No desktop, a ficha manteve 352 px e o compositor continuou alinhado ao rodapé da conversa; em tablet e mobile, a ficha ocupou toda a área de trabalho enquanto a conversa e a lista ficaram ocultas. A largura do documento permaneceu igual à viewport em todos os casos.

Em 320 px, encurtei o placeholder visual da busca para **Nome ou telefone**, preservando o nome acessível completo **Buscar lead por nome ou telefone**. Playwright confirmou que o texto cabe no campo e que a ficha rola internamente. Duas capturas adicionais registram a parte inferior e os controles intermediários do painel. As 12 imagens estão em [contact-panel](contact-panel/) e as medidas em [coverage.json](coverage.json).

Esta evidência cobre o componente real e sua composição responsiva, mas não substitui a revisão integrada da rota autenticada `/painel/inbox`: a moldura da conversa/lista/compositor é estática e não foram exercitadas ações reais. A rota autenticada e os demais contextos da Inbox permanecem pendentes.

## Filtros avançados e metadados de mídia — 30/10/2026

O filtro avançado usa o `Dialog` do design system e os grupos reais de atividade, status do lead e agente responsável. No desktop e tablet o painel acompanha o botão; em 390 px e 320 px ocupa a tela inteira. A posição usa `position: fixed`, alinhada à viewport, para não herdar o centramento do contêiner de diálogos. O botão **Limpar filtros** remove atividade, status e responsável em conjunto. As alterações ficam em rascunho até aplicar; fechar com Escape mantém os filtros aplicados anteriores.

Playwright CLI verificou 1920 × 1080, 768 × 1024, 390 × 844 e 320 × 640, sem overflow horizontal; o tema escuro também foi capturado em desktop. Aplicar atividade não lida, status Atendimento e agente Luiza refletiu três filtros no acionador. Escape descartou o rascunho e limpar/aplicar removeu os três critérios. As capturas estão em [filters](filters/) e os resultados detalhados em [coverage.json](coverage.json). A fixture usa conversas sintéticas e callbacks locais; a rota autenticada permanece pendente.

A metadata de mídias inbound recebeu padding explícito do design system (12 px horizontal e 4 px vertical). Playwright confirmou os valores computados com a folha de estilos de produção, para evitar que data e horário encostem na borda do conteúdo.

## Recuperação de anexos indisponíveis — 29/10/2026

Anexos recebidos passam a ser arquivados no bucket privado `comm-whatsapp-media` em uma tarefa de fundo, após salvar a mensagem. Falhas transitórias de armazenamento são repetidas até três vezes, sem atrasar a resposta do webhook. O resolvedor compartilhado é usado pela conversa, pelo drawer de arquivos e pelo visualizador.

Se a Whapi entregar um arquivo durante a abertura da conversa, mas a gravação temporária no Storage falhar, a função ainda devolve a mídia para a sessão atual e registra a falha do cache. O arquivamento em segundo plano mantém as tentativas. Uma mídia que a Whapi já não encontra e que não foi arquivada antes disso precisa ser reenviada pelo contato.

A correção do endpoint está publicada na função `comm-whatsapp-media`, versão 177, mantendo `verify_jwt = true`. `npm run typecheck` e `npm run build` passaram; nenhuma migration foi necessária.

Falhas transitórias de imagem/figurinha, vídeo, áudio/áudio de voz e documento oferecem **Tentar novamente** como ação primária compacta. Quando a Whapi identifica que o arquivo de origem expirou, a interface informa que o contato precisa reenviá-lo e não oferece uma repetição sem efeito. O botão mantém contraste próprio mesmo no placeholder de mídia.

Testes focados: 25/25 aprovados; `npm run typecheck` e `npm run build` passaram. `npm run lint` terminou sem erros e com cinco avisos de Fast Refresh em previews preexistentes de `output/playwright`. Na suíte geral, 1.830 testes passaram e quatro falharam em testes de contratos/configurações/usuários fora dos arquivos desta entrega. A Edge Function `comm-whatsapp-webhook` foi publicada no Supabase após o commit `981576cd` e está ativa na versão 214, sem mudança no requisito de JWT. A validação visual integrada permanece pendente: `/painel/inbox` redirecionou ao login no Playwright local, então não foi aberta uma conversa autenticada. Os contextos de mídia continuam pendentes no manifesto; nenhuma conversa real foi lida ou alterada.
