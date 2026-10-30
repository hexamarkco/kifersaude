# API — revisão visual

Revisão de `/painel/api` contra `references/desktop/page--api.png` e `references/mobile/page--api.png`, em 30/10/2026.

## O que foi revisado

A tela continua sendo o explorador real de API do CRM, composto por `ApiDocsScreen`, catálogo de operações, formulários de parâmetros e área de resposta. A referência apresenta uma documentação mais enxuta; mantivemos as 13 operações e seus controles reais, sem inventar uma seção de webhooks ou retirar a proteção que pede confirmação para chamadas com impacto.

O cabeçalho agora identifica a página como **Documentação da API** e mostra a descrição junto ao título. No explorador, método e nível de acesso ficam acima do nome e caminho da operação. Essa hierarquia evita que o caminho comprima o título em larguras menores.

## Evidências Playwright

Foram capturados 23 screenshots: 16 combinações de página (viewport e página inteira, quatro larguras e dois temas) e sete interações adicionais. Os arquivos `page-*` incluem 1920×1080, 768×1024, 390×844 e 320×640 nos temas claro e escuro. A navegação inferior foi ocultada somente nas imagens fullPage para registrar a página completa sem sobreposição; as imagens de viewport preservam o shell.

Interações capturadas:

- `search-lead-desktop-light.png`: busca por operações de lead.
- `method-get-desktop-light.png`: filtro GET, mostrando 2 das 13 operações.
- `validation-placeholder-desktop-light.png`: validação do exemplo sem preencher campos obrigatórios.
- `confirmation-create-*.png`: confirmação de criação com dados sintéticos; o diálogo foi cancelado em todos os tamanhos.
- `advanced-auth-open-desktop-light.png`: detalhes de autenticação e exemplo cURL expandidos.

O harness montou `Layout`, `WorkspaceHeader`, `DesignSystemProvider` e a tela real, com autenticação/configuração simuladas. Fontes foram aguardadas antes das capturas e animações desativadas. Requests externos foram bloqueados; nenhum endpoint foi chamado, nenhuma credencial foi usada e nenhuma escrita foi enviada. A validação não encontrou overflow horizontal em 1920, 768, 390 ou 320 px.

## Limitações e pendências

- A rota autenticada não foi aberta com uma sessão real. As permissões foram apresentadas em fixture de desenvolvimento.
- O diálogo de confirmação foi visualizado e cancelado; nenhum fluxo que criaria ou alteraria dados foi confirmado. Respostas HTTP reais e erros devolvidos pelos serviços não foram capturados.
- A cobertura visual desta tela foi concluída. A verificação autenticada e a execução segura de uma operação somente leitura continuam fora desta captura.

O inventário de arquivos, estados e medidas está em [`coverage.json`](coverage.json); a revisão geral está em [`../../../REVISAO_VISUAL.json`](../../../REVISAO_VISUAL.json).
