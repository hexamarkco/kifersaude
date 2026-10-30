# Configurações — formulários de captação

## Listagem

O contexto `page--config-forms` foi comparado às referências de [desktop](../../../references/desktop/page--config-forms.png) e [mobile](../../../references/mobile/page--config-forms.png), usando a implementação real de `Layout`, `ConfigPageScreen` e `FormsScreen`. A rota protegida não disponibilizou uma sessão autenticada nesta revisão; a composição foi executada em uma prévia local com serviços sintéticos e gravações bloqueadas.

A página mantém os dados e as ações realmente disponíveis: nome/endereço público, envios, publicação, edição, cópia de link, abertura e exclusão. A referência pede campos e filtros por ordem, responsável e período que não fazem parte do modelo desta listagem. Eles não foram simulados nem acrescentados.

Playwright confirmou busca, filtro de publicação, menu de ações e diálogo de exclusão. O diálogo foi fechado por **Cancelar**; nada foi removido ou publicado. A revisão também confirmou que as abas de configuração agora acompanham a aba selecionada em uma faixa horizontal, inclusive após redimensionar a janela.

## Responsividade e temas

A listagem usa tabela no desktop e cartões em tablet/mobile. A página não apresentou rolagem horizontal no documento ou no conteúdo nas larguras 1920, 768, 390 e 320 px. A aba ativa **Formulários** permanece inteiramente visível no tablet e no mobile. O tema claro foi capturado nas quatro larguras e o tema escuro no desktop. As fontes estavam carregadas durante as capturas.

O menu inferior móvel é compartilhado pelo shell do CRM e permanece sobre a área rolável durante a navegação. Ele não causa overflow horizontal; o comportamento global será acompanhado na revisão do shell.

## Interações capturadas

- [Busca com resultado](current-shell/state-search-result-desktop.png)
- [Seletor de publicação aberto](current-shell/state-status-dropdown-desktop.png)
- [Listagem filtrada por rascunho](current-shell/state-filtered-draft-desktop.png)
- [Menu de ações da linha](current-shell/state-row-actions-menu-desktop.png)
- [Confirmação de exclusão, sem confirmar](current-shell/state-delete-confirmation-desktop.png)

## Capturas da listagem

As imagens abaixo mostram o estado inicial com dados fictícios. `full-*` usa captura de página inteira; `viewport-*` registra apenas a primeira área visível. As dimensões exatas estão em [coverage.json](coverage.json).

- **Desktop 1920 × 1080:** [viewport claro](current-shell/viewport-desktop-1920-light.png), [página completa clara](current-shell/full-desktop-1920-light.png), [viewport escuro](current-shell/viewport-desktop-1920-dark.png), [página completa escura](current-shell/full-desktop-1920-dark.png).
- **Tablet 768 × 1024:** [viewport](current-shell/viewport-tablet-768-light.png), [página completa](current-shell/full-tablet-768-light.png).
- **Mobile 390 × 844:** [viewport](current-shell/viewport-mobile-390-light.png), [página completa](current-shell/full-mobile-390-light.png).
- **Mobile 320 × 640:** [viewport](current-shell/viewport-mobile-320-light.png), [página completa](current-shell/full-mobile-320-light.png).

## Contextos relacionados que continuam separados

O status acima cobre somente `page--config-forms`. Estes contextos têm evidências parciais próprias e ainda precisam de revisão individual antes de fechar o módulo:

- `state--formularios-criar`: criação e seus estados de salvamento.
- `state--formularios-editar` e `extra--config-formularios-editor`: edição integrada, perguntas, publicação, respostas e falhas.
- `state--formularios-pergunta`: criação/edição de perguntas e validações.
- `state--formulario-publico-contato`: formulário público em `/forms/demonstracao`.

Estados de carregamento/erro e permissões da listagem também dependem de uma sessão e respostas controladas; não foram inferidos da fixture de sucesso. O detalhamento desta execução e suas limitações está em [coverage.json](coverage.json).
