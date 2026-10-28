# Formulários de captação — revisão parcial

A listagem real foi comparada à [referência desktop](../../../references/desktop/page--config-forms.png). Agora usa busca, ação principal no cabeçalho, tabela e cartões responsivos do design system. Mantém endereço, envios, publicação e ações de edição, cópia, abertura e exclusão. A referência contém ordem, responsável e filtros que não constam da listagem existente; não foram inventados dados.

O Playwright montou a tela real isoladamente com duas respostas fictícias para a consulta de formulários e bloqueou chamadas externas. Capturas: [1920 px](lista-1920.png), [768 px](lista-768.png), [390 px](lista-390.png), [320 px](lista-320.png), [criação em 320 px](criar-320.png) e [tema escuro em 320 px](lista-dark-320.png). O documento não apresentou overflow nessas larguras. A busca por “contato” mostrou apenas o formulário correspondente; o menu apresentou as quatro ações. A criação foi aberta e fechada por Escape; não houve escrita.

Permanecem pendentes a comparação integrada na rota autenticada, paginação e filtros adicionais, estados de erro e carregamento, publicação e permissões, criação completa, editor e seus diálogos, teclado e temas nas demais combinações. O contexto permanece pendente no manifesto.
