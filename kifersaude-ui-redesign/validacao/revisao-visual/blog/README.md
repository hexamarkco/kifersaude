# Blog — revisão parcial da listagem

A [referência desktop](../../../references/desktop/page--blog.png) foi comparada à listagem real renderizada isoladamente com dois artigos fictícios. A tabela aproxima a composição da biblioteca, mantém resumo, tempo de leitura, visualizações, data, categoria, status e as quatro ações existentes. A referência também apresenta indicadores, filtros e autor que ainda não estão presentes nesta implementação; esses pontos precisam de análise antes de concluir a revisão.

Capturas da prévia isolada: [1920 px](lista-preview-1920.png), [768 px](lista-preview-768.png), [390 px](lista-preview-390.png), [320 px](lista-preview-320.png) e [tema escuro em 1920 px](lista-preview-dark.png). Não representam o shell autenticado nem dados reais.

O Playwright registrou largura do documento igual à viewport em todas as quatro dimensões. A tabela possui rolagem local em larguras menores; a busca reduziu a fixture para um resultado e o menu exibiu despublicar, editar e excluir. Não foram executadas ações de escrita.

Permanecem pendentes a conferência da rota autenticada, comparação integral com as referências desktop e mobile, indicadores e filtros, estados de carregamento, vazio e erro em navegador, teclado e foco, criação, edição, prévia, exclusão e permissões. A listagem permanece pendente no manifesto.
