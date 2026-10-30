# Blog — revisão da listagem e estados pendentes

## Listagem — revisão visual de 30/10/2026

A [referência desktop](../../../references/desktop/page--blog.png) e a [referência mobile](../../../references/mobile/page--blog.png) foram comparadas novamente com `BlogPostsList`, montado com os componentes reais do design system. O cabeçalho agora segue “Kifer Saúde / Conteúdo” e “Gestão de conteúdo”; a busca e o filtro de status usam o `FilterBar` oficial, com o campo ocupando o espaço disponível e o filtro alinhado ao lado. A tabela destaca a última atualização e preserva os dados reais de resumo, leitura, visualizações, categoria, status e ações.

O módulo não oferece filtro por responsável ou período, exportação nem variação percentual histórica. O modelo guarda apenas `author_id`, sem nome do autor na leitura dessa tela. Esses controles e métricas não foram inventados para imitar dados ilustrativos da referência. A descrição da página permanece no ícone de informações, conforme o padrão atual do CRM.

### Capturas Playwright

O preview usou `BlogTabScreen` real e 12 registros sintéticos; a leitura foi interceptada e as outras requisições externas foram bloqueadas. Fontes carregadas, animações desativadas e nenhuma escrita detectada. A largura do documento correspondeu a 1920, 768, 390 e 320 px.

- [Desktop claro, full page](listagem-2026-10-30/lista-desktop-1920-light-full.png) · [tablet claro](listagem-2026-10-30/lista-tablet-768-light-full.png) · [mobile 390 px claro](listagem-2026-10-30/lista-mobile-390-light-full.png) · [mobile 320 px claro](listagem-2026-10-30/lista-mobile-320-light-full.png)
- [Desktop escuro](listagem-2026-10-30/lista-desktop-1920-dark-full.png) · [mobile escuro](listagem-2026-10-30/lista-mobile-390-dark-full.png)
- [Filtro de status aberto](listagem-2026-10-30/filtro-status-desktop-aberto-full.png) · [menu de ações no mobile](listagem-2026-10-30/menu-acoes-mobile-390-full.png)

Playwright confirmou busca com um resultado, filtro de rascunhos com oito resultados, duas linhas na segunda página e as ações Visualizar/Publicar/Editar/Excluir. Não houve overflow horizontal nem escrita. Métricas e dimensões ficam em [`coverage.json`](coverage.json).

**A listagem continua pendente no manifesto** até capturar a rota autenticada com o shell real do CRM. As referências também exibem filtros de responsável/período e exportação; a interface atual não possui essas funções. Os contextos de criação, edição, visualização e exclusão continuam separados e pendentes de revisão visual contra suas respectivas referências.

## Registros de revisões anteriores

Capturas da prévia isolada: [1920 px](lista-preview-1920.png), [768 px](lista-preview-768.png), [390 px](lista-preview-390.png), [320 px](lista-preview-320.png) e [tema escuro em 1920 px](lista-preview-dark.png). Não representam o shell autenticado nem dados reais.

Na primeira prévia, o Playwright registrou largura do documento igual à viewport em todas as quatro dimensões. A tabela usava rolagem local em larguras menores; a busca reduziu a fixture para um resultado e o menu exibiu despublicar, editar e excluir. Não foram executadas ações de escrita.

Após inclusão dos indicadores e filtro, novas capturas: [1920 px](indicadores-1920.png), [768 px](indicadores-768.png), [390 px](indicadores-390.png), [320 px](indicadores-320.png) e [tema escuro](indicadores-dark.png). A largura do documento permaneceu igual à viewport; selecionar publicados retornou um artigo e os totais permaneceram 1, 1, 124 e 2 na fixture.

A coleção foi posteriormente adaptada para cartões nas áreas estreitas, usando `ResponsiveCollection`. A tabela permanece no desktop; os cartões mantêm dados e ações sem rolagem lateral. Evidências: [desktop](responsivo-1920.png), [tablet](responsivo-768.png), [390 px](responsivo-390.png), [320 px](responsivo-320.png), [menu em 320 px](responsivo-menu-320.png) e [tema escuro em 320 px](responsivo-dark-320.png). O menu exibiu visualização, publicação, edição e exclusão; não foram executadas escritas. As quatro larguras ficaram sem overflow do documento.

Com 12 artigos fictícios, a paginação local mostrou os dois últimos na segunda página e voltou à primeira após limpar uma busca sem resultado. Evidências: [desktop](paginacao-1920.png), [tablet](paginacao-768.png), [390 px](paginacao-390.png), [320 px](paginacao-320.png) e [busca sem resultado](busca-vazia-320.png). Não houve overflow do documento nessas larguras.

Em montagem isolada da tela real com `AuthProvider`, as chamadas externas foram interceptadas: a leitura de artigos recebeu respostas fictícias e demais chamadas externas foram bloqueadas. Foram observados [carregamento desktop](carregamento-1920.png), [carregamento em 320 px](carregamento-320.png), [biblioteca vazia desktop](vazio-1920.png), [vazia em 320 px](vazio-320.png) e [falha de leitura](erro-1920.png), seguida de nova tentativa bem-sucedida. O esqueleto acompanha a tabela ou os cartões e a falha fica na biblioteca. A prévia abriu com conteúdo fictício em [1920 px](previa-1920.png), [768 px](previa-768.png), [390 px](previa-390.png), [320 px](previa-320.png) e [tema escuro em 320 px](previa-dark-320.png). Escape devolveu o foco ao menu no mobile. A simulação registrou três leituras interceptadas e nenhuma tentativa de escrita; não equivale à rota autenticada real.

A confirmação de exclusão identifica o artigo e informa a consequência. Em montagem com leitura fictícia, foi capturada em [1920 px](excluir-1920.png), [768 px](excluir-768.png), [390 px](excluir-390.png), [320 px](excluir-320.png) e [tema escuro em 320 px](excluir-dark-320.png). Cancelar fechou o diálogo sem escrita; Escape também fechou e devolveu o foco ao menu. A edição carregou título, slug e conteúdo fictícios em [desktop](edicao-integrada-1920.png) e [320 px](edicao-integrada-320.png); cancelar retornou à listagem. O documento não apresentou overflow nas quatro larguras da confirmação. A simulação registrou uma leitura e nenhuma tentativa de escrita.

Permanecem pendentes a conferência da rota autenticada dentro do shell, os estados de carregamento/vazio/erro em outras combinações de tamanho e tema, teclado completo e permissões. A criação, edição, visualização e exclusão continuam pendentes como contextos independentes. A listagem já foi comparada visualmente em preview isolado, mas segue pendente no manifesto até a revisão integrada.

## Editor — revisão parcial

As referências de [criação desktop](../../../references/desktop/state--blog-criar.png) e [mobile](../../../references/mobile/state--blog-criar.png) apresentam um modal simplificado. O editor real possui campos adicionais, imagens e conteúdo rico; foi mantido em página completa e organizado em seções, com ações de formulário do design system. A dica da URL fica no ícone de informação e uma altura antiga que deixava espaço vazio no editor rico foi removida.

Capturas isoladas: [1920 px](editor-1920.png), [768 px](editor-768.png), [390 px](editor-390.png), [320 px](editor-320.png) e [tema escuro](editor-dark.png). O documento não apresentou overflow nessas larguras. Em prévia sem persistência, a digitação do título gerou o slug esperado, o editor rico recebeu texto e o ícone de ajuda recebeu foco visível por teclado. Os controles de seleção de arquivo agora podem receber foco; a prévia confirmou foco no primeiro controle e no respectivo rótulo. Não houve upload ou salvamento.

Na prévia isolada, salvar vazio apresentou os quatro erros existentes junto aos campos e levou o foco ao título; ao preenchê-lo, os erros de título e slug desapareceram. Capturas: [1920 px](validacao-1920.png), [768 px](validacao-768.png), [390 px](validacao-390.png) e [320 px](validacao-320.png). O documento não apresentou overflow; não houve persistência.

Em montagem isolada da tela real, a gravação foi interceptada e simulada. Durante a resposta pendente, os campos, o editor e as ações ficaram bloqueados; a falha manteve os dados e permitiu nova tentativa, que retornou sucesso simulado. Evidências: [salvando em 1920 px](salvando-1920.png), [768 px](salvando-768.png), [390 px](salvando-390.png), [320 px](salvando-320.png) e [erro em 320 px](salvar-erro-320.png). Nenhuma gravação chegou ao serviço real.

Durante o envio de imagem, salvar e sair ficam desabilitados com uma orientação para aguardar. O estado foi simulado no componente real em [1920 px](upload-1920.png), [768 px](upload-768.png), [390 px](upload-390.png) e [320 px](upload-320.png), sem overflow do documento ou envio de arquivo real. Na montagem da tela com armazenamento interceptado, falha e nova seleção do mesmo arquivo foram exercitadas para [capa](upload-falha-capa-320.png) e [conteúdo](upload-falha-conteudo-320.png): cada caso teve duas tentativas simuladas, a segunda retornou sucesso e os controles voltaram a ficar disponíveis. Nenhuma gravação chegou ao serviço real.

Ainda faltam revisão integrada autenticada, validação completa, upload, permissões e outros estados de erro e carregamento. Os contextos de criação e edição permanecem pendentes no manifesto.
