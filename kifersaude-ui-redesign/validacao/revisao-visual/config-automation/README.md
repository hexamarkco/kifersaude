# Automações — fluxos e configuração

Comparação da rota `/painel/automacoes?tab=automation` com [`references/desktop/page--config-automation.png`](../../../references/desktop/page--config-automation.png) e [`references/mobile/page--config-automation.png`](../../../references/mobile/page--config-automation.png).

## Componentes e padrões conferidos

- Shell real `Layout` + `ConfigPageScreen` + `AutoContactFlowSettingsScreen`, com `PageHeader`, breadcrumbs e o ícone de informações.
- Abas principais e segmentos internos `Fluxos`, `Templates` e `Operação`.
- Indicadores em `Card`, com duas colunas abaixo de desktop e quatro no desktop amplo.
- Busca por nome, condição ou tag, filtro por tag, contagem e paginação.
- Tabela real do Design System no desktop; cartões reais com `Badge`, `Button` e `Card` abaixo de `lg`.
- Informação contextual sobre variáveis acessível pelo “i” de **Fluxos de automação**; a lista de variáveis usa a fonte canônica `AUTO_CONTACT_TEMPLATE_VARIABLE_SUGGESTIONS`.
- Tema claro e escuro no desktop.

## Interações verificadas

- Abertura do filtro de tags, seleção de `follow-up` e resultado filtrado.
- Busca por `sem resposta`, confirmando o resultado único.
- Conteúdo do tooltip informativo, inclusive as variáveis usadas nas mensagens.
- Abas `Templates` e `Operação`; a captura de Operação registra os switches e campos sem alterná-los.
- Editor de fluxo aberto em página própria com as abas `Jornada`, `Regras e agenda` e `Simular e testar`; nenhuma mensagem ou execução de teste foi enviada.
- Confirmações reais de remoção de fluxo e template; a fixture sintética rejeitou as gravações e os itens permaneceram na tela.
- Modais reais de criação e edição de templates abertos sem persistir alterações. O título e o “i” ficam na mesma linha, a primeira entrada recebe foco sem abrir o tooltip automaticamente e a orientação sobre salvar a automação fica no tooltip.
- Modal com cinco mensagens e campo de mídia rolado até o final para conferir a rolagem interna e o rodapé fixo. Em 320 e 390 px, as ações ocupam a largura disponível e o conteúdo não tem overflow horizontal.

Nenhum fluxo ou template foi removido: a fixture bloqueou as gravações e os itens permaneceram na tela. Nenhuma automação foi publicada ou executada e nenhuma mensagem foi enviada. A criação e a edição foram avaliadas somente como rascunhos locais.

## Responsividade e arquivos

Playwright CLI capturou página completa e viewport da listagem em 1920×1080, 768×1024, 390×844 e 320×844. O editor também foi capturado nas quatro larguras; as ações e abas permanecem visíveis em mobile, os nós ficam dentro da área local do canvas e não houve overflow horizontal. O viewport conserva a navegação inferior; durante `fullPage` em mobile, a navegação fixa foi ocultada temporariamente para evitar que cobrisse o conteúdo.

Os registros detalhados, métricas verificadas e limitações estão em [`coverage.json`](coverage.json). As imagens estão em [`current-shell/`](current-shell/):

- `full-desktop-1920-light.png`, `viewport-desktop-1920-light.png`
- `full-desktop-1920-dark.png`, `viewport-desktop-1920-dark.png`
- `full-tablet-768-light.png`, `viewport-tablet-768-light.png`
- `full-mobile-390-light.png`, `viewport-mobile-390-light.png`
- `full-mobile-320-light.png`, `viewport-mobile-320-light.png`
- `state-info-tooltip-desktop.png`
- `state-tag-filter-open-desktop.png`, `state-filtered-tag-desktop.png`
- `state-search-single-result-desktop.png`
- `state-templates-desktop.png`, `state-operation-desktop.png`
- `state-info-title-inline-desktop-1920.png`, `state-info-title-inline-mobile-320.png`, `state-info-title-inline-mobile-320-dark.png` — ícone de informação integrado ao título **Envio automático**, também conferido em viewport compacto e tema escuro.

O editor de fluxo está em [`flow-detail/`](flow-detail/), com capturas desktop, tablet, mobile, abas e alinhamento do ícone:

- `desktop-1920-full.png`, `desktop-1920-viewport.png`
- `tablet-768-full.png`, `tablet-768-viewport.png`
- `mobile-390-full.png`, `mobile-390-viewport.png`, `mobile-320-full.png`, `mobile-320-viewport.png`
- `state-rules-agenda-desktop.png`, `state-test-desktop.png`
- `state-info-title-inline-desktop-1920.png`, `state-info-title-inline-mobile-390.png`
- `state-delete-flow-confirmation-desktop.png` — confirmação de remoção; a fixture bloqueia a gravação.

Os modais de templates estão em [`template-dialog/`](template-dialog/):

- `desktop-multimessage.png`, `desktop-multimessage-bottom.png` — criação com mensagens de texto e imagem, incluindo rolagem até o fim.
- `desktop-edit-dark.png`, `desktop-edit-info-tooltip.png` — edição no tema escuro, respectivamente com o tooltip fechado e aberto ao focar o “i”.
- `tablet-768.png`, `mobile-390.png`, `mobile-320.png` — modal em tablet e nas larguras mobile.
- `state-delete-template-confirmation-desktop.png` — confirmação com impacto de remoção informado; a gravação sintética foi rejeitada e o template permaneceu.

## Adaptações e limites

- O shell foi executado com dados sintéticos locais porque não havia sessão autenticada disponível. Os valores demonstram os componentes reais e não devem ser lidos como indicadores de produção.
- A referência apresenta métricas de leads impactados e execução; esses dados não estão disponíveis nesta listagem real e não foram inventados.
- O editor usa uma página própria com URL preservando o fluxo selecionado; no canvas, controles quebram de forma legível em telas pequenas, o mapa em miniatura não cobre as etapas e o inspetor vazio não reserva uma coluna alta no mobile. A persistência autenticada dos fluxos e templates, permissões e respostas reais da API continuam pendentes.
- A busca e filtro são estado local da fixture. As tentativas de remoção foram rejeitadas pelo serviço sintético; nenhum fluxo ou template foi alterado. Nenhuma automação ou comunicação real foi executada.
- Nesta continuidade, os testes focados passaram (**10/10**), o typecheck e o build passaram, e o lint do arquivo alterado não encontrou erros. O build mantém o aviso conhecido do chunk vendor acima de 500 kB. A suíte completa não foi repetida.
