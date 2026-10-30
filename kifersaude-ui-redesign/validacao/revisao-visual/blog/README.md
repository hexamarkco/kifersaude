# Blog — revisão visual integrada (30/10/2026)

A referência [desktop](../../../references/desktop/page--blog.png) e a referência [mobile](../../../references/mobile/page--blog.png) foram comparadas com `BlogTabScreen` montado no `Layout` real, incluindo `WorkspaceHeader`, `DesignSystemProvider`, navegação e tema. O showcase usa os componentes compartilhados de página, filtros, campos, tabela/cartões responsivos, badges, paginação, ações, diálogos e feedback.

## Ambiente e segurança

O preview local usa o shell e a página reais, com contextos de autenticação/configuração simulados e 12 artigos sintéticos. A leitura de `blog_posts` é respondida por fixture; as outras chamadas externas são bloqueadas. Fontes foram aguardadas, animações/transições desativadas e nenhuma escrita foi feita. Nenhum dado pessoal ou credencial foi incluído nas capturas.

A tabela abaixo mostra o que cada captura documenta. Nas capturas full page de tablet e mobile, a navegação inferior fixa fica temporariamente oculta apenas durante a imagem para não cobrir artigos; as capturas de viewport mostram a navegação real.

## Página de listagem

| Tela | Claro | Escuro |
|---|---|---|
| Desktop 1920×1080 | [Viewport](shell-desktop-claro-viewport.png) · [Full page](shell-desktop-claro-full.png) | [Viewport](shell-desktop-escuro-viewport.png) · [Full page](shell-desktop-escuro-full.png) |
| Tablet 768×1024 | [Viewport](shell-tablet-claro-viewport.png) · [Full page](shell-tablet-claro-full.png) | [Viewport](shell-tablet-escuro-viewport.png) · [Full page](shell-tablet-escuro-full.png) |
| Mobile 390×844 | [Viewport](shell-mobile-claro-viewport.png) · [Full page](shell-mobile-claro-full.png) | [Viewport](shell-mobile-escuro-viewport.png) · [Full page](shell-mobile-escuro-full.png) |
| Mobile compacto 320×640 | [Viewport](shell-mobile-compacto-claro-viewport.png) · [Full page](shell-mobile-compacto-claro-full.png) | [Viewport](shell-mobile-compacto-escuro-viewport.png) · [Full page](shell-mobile-compacto-escuro-full.png) |

Busca e filtro de status foram exercitados com dados sintéticos: a busca encontrou um único artigo e “Publicado” retornou quatro linhas. O filtro aberto e aplicado, o menu de ações, a paginação e as variações claras/escuras também estão nas capturas acima ou nos estados abaixo. Não há overflow horizontal nas quatro larguras.

A referência mostra filtro por responsável e período, exportação, autor e variação percentual histórica. O módulo atual não possui esses recursos/modelos, então não foram adicionados controles decorativos nem dados inventados. A busca, o filtro de status, os indicadores reais, a última atualização, o tempo de leitura e as ações existentes foram preservados.

## Criação e edição

O mockup de criação/edição é um modal genérico; o editor real reúne capa, upload, resumo, editor rico e SEO. Por ser um fluxo longo, permanece como página completa para evitar formulário extenso dentro de modal.

- Criação: [desktop full page](create-form-desktop-light-full.png), [mobile 390 viewport](create-form-mobile-light-viewport.png), [mobile 390 full page](create-form-mobile-light-full.png), [tablet 768 viewport](create-form-tablet-light-viewport.png), [mobile compacto 320 viewport](create-form-mobile-compacto-light-viewport.png).
- Edição com artigo existente: [desktop full page](edit-form-desktop-light-full.png), [mobile 390 viewport](edit-form-mobile-light-viewport.png), [mobile 390 full page](edit-form-mobile-light-full.png), [tablet 768 viewport](edit-form-tablet-light-viewport.png), [mobile compacto 320 viewport](edit-form-mobile-compacto-light-viewport.png).
- Validação vazia: [desktop full page](create-validation-desktop-light-full.png) e [320 viewport com feedback](create-validation-mobile-compacto-toast.png). Os quatro erros aparecem junto aos respectivos campos; não foi acionado salvamento.

## Visualização e exclusão

A visualização usa o diálogo real de leitura, preserva categoria/status/tempo e conteúdo e fecha por Escape com retorno do foco ao acionador em desktop e mobile. A exclusão apresenta confirmação destrutiva com identificação do artigo; foi cancelada em todos os viewports.

- [Prévia desktop](view-dialog-desktop-light.png) · [mobile 390](view-dialog-mobile-light.png) · [mobile compacto 320](view-dialog-mobile-compacto-light.png) · [desktop escuro](view-dialog-desktop-dark.png) · [mobile escuro](view-dialog-mobile-dark.png).
- [Confirmação de exclusão desktop](delete-confirmation-desktop-light.png) · [mobile 390](delete-confirmation-mobile-light.png) · [mobile compacto 320](delete-confirmation-mobile-compacto-light.png) · [desktop escuro](delete-confirmation-desktop-dark.png) · [320 escuro](delete-confirmation-mobile-compacto-dark.png).
- [Menu de ações aberto no desktop](actions-menu-open-desktop-light.png); [filtro de status aberto](filter-status-open-desktop-light.png) e [aplicado](filter-status-applied-desktop-light.png).

A referência de visualização se parece com um formulário estático, mas a interface real é uma prévia somente leitura; a confirmação de exclusão mantém a consequência destrutiva explícita.

## Resultado da validação

O pacote desta revisão contém 42 screenshots: 19 da listagem e de suas interações, mais 23 dos formulários, validação, prévia e confirmação. Playwright verificou o shell e os formulários em 1920×1080, 768×1024, 390×844 e 320×640, tema claro e escuro. Tabela/cartões responderam ao tamanho disponível, sem overflow; busca e filtro funcionaram; validação exibiu quatro mensagens; Escape fechou a prévia e devolveu foco; confirmação de exclusão foi cancelada. Não houve escrita ou chamada externa liberada.

A tela de validação mostrou ainda que o toast ficava abaixo da navegação fixa no mobile. O `ToastViewport` agora posiciona os avisos acima dela: em 320×640, o Playwright mediu 12 px entre o toast e a navegação, sem overflow e sem escrita. [Captura do estado corrigido](create-validation-mobile-compacto-toast.png).

Os resultados medidos e as adaptações também estão em [`coverage.json`](coverage.json). A revisão visual do Blog está concluída com adaptações; a autenticação/permissões com sessão operacional e os contextos fora destes quatro estados continuam sendo acompanhados separadamente.
## Registros de revisões anteriores

Capturas da prévia isolada: [1920 px](lista-preview-1920.png), [768 px](lista-preview-768.png), [390 px](lista-preview-390.png), [320 px](lista-preview-320.png) e [tema escuro em 1920 px](lista-preview-dark.png). Não representam o shell autenticado nem dados reais.

Na primeira prévia, o Playwright registrou largura do documento igual à viewport em todas as quatro dimensões. A tabela usava rolagem local em larguras menores; a busca reduziu a fixture para um resultado e o menu exibiu despublicar, editar e excluir. Não foram executadas ações de escrita.

Após inclusão dos indicadores e filtro, novas capturas: [1920 px](indicadores-1920.png), [768 px](indicadores-768.png), [390 px](indicadores-390.png), [320 px](indicadores-320.png) e [tema escuro](indicadores-dark.png). A largura do documento permaneceu igual à viewport; selecionar publicados retornou um artigo e os totais permaneceram 1, 1, 124 e 2 na fixture.

A coleção foi posteriormente adaptada para cartões nas áreas estreitas, usando `ResponsiveCollection`. A tabela permanece no desktop; os cartões mantêm dados e ações sem rolagem lateral. Evidências: [desktop](responsivo-1920.png), [tablet](responsivo-768.png), [390 px](responsivo-390.png), [320 px](responsivo-320.png), [menu em 320 px](responsivo-menu-320.png) e [tema escuro em 320 px](responsivo-dark-320.png). O menu exibiu visualização, publicação, edição e exclusão; não foram executadas escritas. As quatro larguras ficaram sem overflow do documento.

Com 12 artigos fictícios, a paginação local mostrou os dois últimos na segunda página e voltou à primeira após limpar uma busca sem resultado. Evidências: [desktop](paginacao-1920.png), [tablet](paginacao-768.png), [390 px](paginacao-390.png), [320 px](paginacao-320.png) e [busca sem resultado](busca-vazia-320.png). Não houve overflow do documento nessas larguras.

Em montagem isolada da tela real com `AuthProvider`, as chamadas externas foram interceptadas: a leitura de artigos recebeu respostas fictícias e demais chamadas externas foram bloqueadas. Foram observados [carregamento desktop](carregamento-1920.png), [carregamento em 320 px](carregamento-320.png), [biblioteca vazia desktop](vazio-1920.png), [vazia em 320 px](vazio-320.png) e [falha de leitura](erro-1920.png), seguida de nova tentativa bem-sucedida. O esqueleto acompanha a tabela ou os cartões e a falha fica na biblioteca. A prévia abriu com conteúdo fictício em [1920 px](previa-1920.png), [768 px](previa-768.png), [390 px](previa-390.png), [320 px](previa-320.png) e [tema escuro em 320 px](previa-dark-320.png). Escape devolveu o foco ao menu no mobile. A simulação registrou três leituras interceptadas e nenhuma tentativa de escrita; não equivale à rota autenticada real.

A confirmação de exclusão identifica o artigo e informa a consequência. Em montagem com leitura fictícia, foi capturada em [1920 px](excluir-1920.png), [768 px](excluir-768.png), [390 px](excluir-390.png), [320 px](excluir-320.png) e [tema escuro em 320 px](excluir-dark-320.png). Cancelar fechou o diálogo sem escrita; Escape também fechou e devolveu o foco ao menu. A edição carregou título, slug e conteúdo fictícios em [desktop](edicao-integrada-1920.png) e [320 px](edicao-integrada-320.png); cancelar retornou à listagem. O documento não apresentou overflow nas quatro larguras da confirmação. A simulação registrou uma leitura e nenhuma tentativa de escrita.

As capturas até aqui eram isoladas. A revisão integrada com `Layout` real e os quatro estados já está documentada na seção atual; estas capturas antigas continuam apenas como histórico. Ainda não foram conferidas com sessão operacional real as permissões do usuário, nem combinações adicionais de carregamento, vazio e erro dentro do shell.

## Editor — revisão parcial

As referências de [criação desktop](../../../references/desktop/state--blog-criar.png) e [mobile](../../../references/mobile/state--blog-criar.png) apresentam um modal simplificado. O editor real possui campos adicionais, imagens e conteúdo rico; foi mantido em página completa e organizado em seções, com ações de formulário do design system. A dica da URL fica no ícone de informação e uma altura antiga que deixava espaço vazio no editor rico foi removida.

Capturas isoladas: [1920 px](editor-1920.png), [768 px](editor-768.png), [390 px](editor-390.png), [320 px](editor-320.png) e [tema escuro](editor-dark.png). O documento não apresentou overflow nessas larguras. Em prévia sem persistência, a digitação do título gerou o slug esperado, o editor rico recebeu texto e o ícone de ajuda recebeu foco visível por teclado. Os controles de seleção de arquivo agora podem receber foco; a prévia confirmou foco no primeiro controle e no respectivo rótulo. Não houve upload ou salvamento.

Na prévia isolada, salvar vazio apresentou os quatro erros existentes junto aos campos e levou o foco ao título; ao preenchê-lo, os erros de título e slug desapareceram. Capturas: [1920 px](validacao-1920.png), [768 px](validacao-768.png), [390 px](validacao-390.png) e [320 px](validacao-320.png). O documento não apresentou overflow; não houve persistência.

Em montagem isolada da tela real, a gravação foi interceptada e simulada. Durante a resposta pendente, os campos, o editor e as ações ficaram bloqueados; a falha manteve os dados e permitiu nova tentativa, que retornou sucesso simulado. Evidências: [salvando em 1920 px](salvando-1920.png), [768 px](salvando-768.png), [390 px](salvando-390.png), [320 px](salvando-320.png) e [erro em 320 px](salvar-erro-320.png). Nenhuma gravação chegou ao serviço real.

Durante o envio de imagem, salvar e sair ficam desabilitados com uma orientação para aguardar. O estado foi simulado no componente real em [1920 px](upload-1920.png), [768 px](upload-768.png), [390 px](upload-390.png) e [320 px](upload-320.png), sem overflow do documento ou envio de arquivo real. Na montagem da tela com armazenamento interceptado, falha e nova seleção do mesmo arquivo foram exercitadas para [capa](upload-falha-capa-320.png) e [conteúdo](upload-falha-conteudo-320.png): cada caso teve duas tentativas simuladas, a segunda retornou sucesso e os controles voltaram a ficar disponíveis. Nenhuma gravação chegou ao serviço real.

Os fluxos de salvamento e upload foram exercitados apenas por simulação interceptada em prévia isolada; não houve upload, persistência ou serviço externo. Revisão de permissões com sessão real e outros estados de carregamento/vazio/erro ainda está pendente. A criação e a edição já foram comparadas como páginas completas na revisão integrada acima.
