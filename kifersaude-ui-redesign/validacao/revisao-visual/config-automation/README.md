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

Não foram acionados criação, edição, remoção, publicação ou envio de mensagens. Os estados dessas ações permanecem em contextos próprios do manifesto.

## Responsividade e arquivos

Playwright CLI capturou página completa e viewport em 1920×1080, 768×1024, 390×844 e 320×844. As quatro larguras foram verificadas sem overflow horizontal. O viewport conserva a navegação inferior; durante a captura `fullPage` em mobile, a navegação fixa foi ocultada temporariamente para evitar que cobrisse o conteúdo já capturado.

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

## Adaptações e limites

- O shell foi executado com dados sintéticos locais porque não havia sessão autenticada disponível. Os valores demonstram os componentes reais e não devem ser lidos como indicadores de produção.
- A referência apresenta métricas de leads impactados e execução; esses dados não estão disponíveis nesta listagem real e não foram inventados.
- O painel de lista e as abas foram revisados; editor de fluxo, criação/edição de template, persistência, permissões e respostas reais da API continuam pendentes em seus contextos do manifesto.
- A busca e filtro são estado local da fixture. Nenhuma gravação, automação ou comunicação real foi executada.
