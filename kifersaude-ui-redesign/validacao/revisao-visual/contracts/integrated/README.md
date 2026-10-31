# Gestão de contratos — evidências integradas

Capturas do `ContractsManagerScreen` e de `ContractDetails` reais, montados no `Layout` real com repositories, configuração e operador sintéticos. Não foi usada sessão autenticada nem dado de cliente. O menu, status, filtros e importador foram abertos sem confirmar alterações; não houve importação ou exclusão.

## Listagem e navegação

- Desktop 1920×1080: [viewport claro](desktop/listagem-1920-light-viewport.png) e [viewport escuro](desktop/listagem-1920-dark-viewport.png).
- Desktop, documento completo: [claro 1920×1200](desktop/listagem-1920-light-document.png) e [escuro 1920×1200](desktop/listagem-1920-dark-document.png). O `fullPage` do Playwright distorce a sidebar fixa nesta aplicação; a janela foi aumentada para 1200 px para incluir as oito linhas e a paginação sem esticar a navegação.
- Tablet 768×1024: [listagem clara](tablet/listagem-768-light.png).
- Mobile 390×844: [listagem clara](mobile/listagem-390-light.png).
- Mobile compacto 320×640: [listagem clara](mobile-320/listagem-320-light.png). `window.innerWidth` foi 320 px; a largura útil do documento foi 310 px por causa da barra de rolagem, sem conteúdo ultrapassando a viewport.

## Detalhes do contrato

- Desktop 1920×1080: [drawer claro](desktop/detalhes-drawer-1920-light.png) e [escuro](desktop/detalhes-drawer-1920-dark.png).
- Tablet 768×1024: [drawer claro](tablet/detalhes-drawer-768-light.png).
- Mobile 390×844: [drawer claro](mobile/detalhes-drawer-390-light.png).
- Mobile compacto 320×640: [drawer claro](mobile-320/detalhes-drawer-320-light.png).
- Seção **Mais informações do contrato** expandida, conteúdo interno capturado em três posições: [início](desktop/detalhes-drawer-informacoes-1920-light.png), [meio](desktop/detalhes-drawer-informacoes-1920-light-meio.png) e [fim](desktop/detalhes-drawer-informacoes-1920-light-fim.png).
- Menu contextual no drawer: [ações disponíveis, tema escuro](desktop/detalhes-menu-acoes-1920-dark.png). A ação destrutiva apenas foi exibida.

## Filtros e status

- [Filtros avançados expandidos](desktop/filtros-avancados-1920-light.png) e [seletor de operadora aberto](desktop/filtro-operadora-menu-1920-light.png), em 1920×1080, tema claro.
- [Status da linha aberto](desktop/status-dropdown-1920-light.png), em 1920×1080. A seleção atual foi preservada e o menu foi fechado com `Escape`.

## Importação em massa

- Tema claro: [desktop 1920×1080](desktop/importacao-em-massa-1920-light.png), [tablet 768×1024](tablet/importacao-em-massa-768-light.png), [mobile 390×844](mobile/importacao-em-massa-390-light.png) e [mobile compacto 320×640](mobile-320/importacao-em-massa-320-light.png).
- Tema escuro: [desktop 1920×1080](desktop/importacao-em-massa-1920-dark.png).
- Em 320 px, o corpo rola internamente e o rodapé permanece fixo. O conteúdo inferior foi capturado em [uma segunda posição](mobile-320/importacao-em-massa-320-light-conteudo-inferior.png).
- A visualização revelou a quebra de palavras no texto padrão do seletor de arquivo. A correção mantém a quebra natural do texto e reserva `break-all` para nomes de arquivos longos; a captura mobile confirma “contratos” sem divisão no meio.

## Limites

A fixture exerce os componentes reais, mas simula autenticação, configuração e repositórios. Portanto, comprova hierarquia, composição, resposta visual e abertura dos contextos; não comprova permissões ou persistência na sessão autenticada. Os detalhes recolhidos do contrato exibem dados sintéticos.
