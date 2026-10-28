# Blog — revisão parcial da listagem

A [referência desktop](../../../references/desktop/page--blog.png) foi comparada à listagem real renderizada isoladamente com dois artigos fictícios. A tabela mantém resumo, tempo de leitura, visualizações, data, categoria, status e as quatro ações existentes. Os quatro indicadores usam os artigos carregados e o filtro de status atua junto à busca; não são calculadas as variações percentuais fictícias da referência. Autor e filtros por responsável e período ainda precisam de análise antes de concluir a revisão.

Capturas da prévia isolada: [1920 px](lista-preview-1920.png), [768 px](lista-preview-768.png), [390 px](lista-preview-390.png), [320 px](lista-preview-320.png) e [tema escuro em 1920 px](lista-preview-dark.png). Não representam o shell autenticado nem dados reais.

O Playwright registrou largura do documento igual à viewport em todas as quatro dimensões. A tabela possui rolagem local em larguras menores; a busca reduziu a fixture para um resultado e o menu exibiu despublicar, editar e excluir. Não foram executadas ações de escrita.

Após inclusão dos indicadores e filtro, novas capturas: [1920 px](indicadores-1920.png), [768 px](indicadores-768.png), [390 px](indicadores-390.png), [320 px](indicadores-320.png) e [tema escuro](indicadores-dark.png). A largura do documento permaneceu igual à viewport; selecionar publicados retornou um artigo e os totais permaneceram 1, 1, 124 e 2 na fixture.

Permanecem pendentes a conferência da rota autenticada, comparação integral com as referências desktop e mobile, filtros adicionais e paginação, estados de carregamento, vazio e erro em navegador, teclado e foco, criação, edição, prévia, exclusão e permissões. A listagem permanece pendente no manifesto.

## Editor — revisão parcial

As referências de [criação desktop](../../../references/desktop/state--blog-criar.png) e [mobile](../../../references/mobile/state--blog-criar.png) apresentam um modal simplificado. O editor real possui campos adicionais, imagens e conteúdo rico; foi mantido em página completa e organizado em seções, com ações de formulário do design system. A dica da URL fica no ícone de informação e uma altura antiga que deixava espaço vazio no editor rico foi removida.

Capturas isoladas: [1920 px](editor-1920.png), [768 px](editor-768.png), [390 px](editor-390.png), [320 px](editor-320.png) e [tema escuro](editor-dark.png). O documento não apresentou overflow nessas larguras. Em prévia sem persistência, a digitação do título gerou o slug esperado, o editor rico recebeu texto e o ícone de ajuda recebeu foco visível por teclado. Os controles de seleção de arquivo agora podem receber foco; a prévia confirmou foco no primeiro controle e no respectivo rótulo. Não houve upload ou salvamento.

Ainda faltam revisão integrada autenticada, preenchimento e validação completos, upload, edição de artigo existente, cancelamento e confirmação de salvamento, permissões e estados de erro e carregamento. Os contextos de criação e edição permanecem pendentes no manifesto.
