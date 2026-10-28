# Revisão visual — Dashboard

**Página principal revisada com adaptações.** A referência canônica é [`page--dashboard` para desktop](../../../references/desktop/page--dashboard.png) e [`page--dashboard` para mobile](../../../references/mobile/page--dashboard.png). A meta geral continua em andamento.

## Resultado da comparação

- Em desktop, indicadores, gráfico e prioridades agora seguem a hierarquia da referência: quatro indicadores principais no primeiro nível; gráfico e prioridades lado a lado a partir de 1280 px. Abaixo dessa largura, os painéis empilham sem criar rolagem horizontal.
- Permanecem disponíveis os seis indicadores reais. Comissão recebida e ticket médio ficam em “Ver indicadores complementares”, usando o `DisclosureTrigger` do design system. Não foram alterados valores, cálculos, permissões ou regras comerciais.
- Os cards KPI usam `KpiCard` sem ícones decorativos, com títulos, números e textos de apoio alinhados. No mobile compacto, o período e filtros ficam na mesma linha; a ação de filtros conserva nome acessível e fica apenas com ícone abaixo de 360 px.
- A agenda mantém ações para abrir agenda e leads; atrasados, pendentes e oportunidades sem próximo passo continuam acionáveis na composição compacta.
- Em 390 px e 320 px, a primeira dobra dos indicadores e do disclosure não é coberta pela navegação fixa. Não foi encontrado overflow horizontal em 1920, 768, 390 ou 320 px.

## Diferenças e limitações

- A referência estática mostra quatro indicadores e uma série mensal mais populada. O dashboard real oferece seis métricas; as duas complementares ficam recolhidas para preservar a hierarquia sem remover informação. A fixture Playwright é sintética e contém somente um mês, então o gráfico tem um ponto; isso não representa a série histórica de produção.
- A sessão local usa dados de demonstração. Nenhum registro foi criado, alterado ou excluído e nenhuma comunicação foi enviada. O console do ambiente reportou o aviso de ciclo de vida `UNSAFE_componentWillMount` de uma dependência e timeout da conexão Realtime de teste; nenhuma ação do dashboard dependeu dessa conexão durante a captura.
- Os estados avançados de filtros, seletor de período e análises/modais ainda exigem comparação própria com `state--dashboard-filtros`, `state--dashboard-periodo` e `state--dashboard-analises`.

## Capturas

As páginas foram capturadas com Playwright após esperar fontes e imagens e desativar animações. As dimensões de cada PNG estão registradas em [`coverage.json`](coverage.json).

### Desktop — 1920 × 1080

- Tema claro: [viewport](screenshots/desktop/dashboard-viewport.png), [página completa](screenshots/desktop/dashboard-full.png)
- Tema escuro: [viewport](screenshots/desktop/dashboard-dark-viewport.png), [página completa](screenshots/desktop/dashboard-dark-full.png)
- Complementares expandidos: [página completa](screenshots/desktop/dashboard-indicadores-complementares.png)

### Tablet — 768 × 1024

- Tema claro: [viewport](screenshots/tablet/dashboard-viewport.png), [página completa](screenshots/tablet/dashboard-full.png)

### Mobile — 390 × 844

- Tema claro: [viewport](screenshots/mobile/dashboard-viewport.png), [página completa](screenshots/mobile/dashboard-full.png)
- Tema escuro: [viewport](screenshots/mobile/dashboard-dark-viewport.png), [página completa](screenshots/mobile/dashboard-dark-full.png)
- Complementares expandidos: [viewport](screenshots/mobile/dashboard-indicadores-complementares-viewport.png), [página completa](screenshots/mobile/dashboard-indicadores-complementares.png)

### Mobile compacto — 320 × 844

- Tema claro: [viewport](screenshots/mobile-320/dashboard-viewport.png), [página completa](screenshots/mobile-320/dashboard-full.png)

## Verificações

- Playwright: viewport e página completa em desktop, tablet, mobile e mobile compacto; claro em todas as larguras; escuro em desktop e mobile; disclosure interativo.
- Sem overflow horizontal medido; em 390 px e 320 px o disclosure termina acima da navegação inferior fixa.
- Testes do `DashboardDailyOverview` passaram; também passaram typecheck, lint, auditorias arquitetural, visual e do design system, build/verificação do bundle e suíte completa (**1.727 testes em 328 arquivos**). O build mantém o aviso conhecido de chunk vendor acima de 500 kB.

## Pendências do dashboard

- Comparar e validar separadamente os estados de filtros avançados, seletor de período e análises/modais indicados em [`REVISAO_VISUAL.json`](../../../REVISAO_VISUAL.json). A página principal não encerra esses contextos nem o redesign integral.
