# Revisão visual — filtros do dashboard

**Estado revisado com adaptações.** As referências canônicas são [`state--dashboard-filtros` para desktop](../../../references/desktop/state--dashboard-filtros.png) e [`state--dashboard-filtros` para mobile](../../../references/mobile/state--dashboard-filtros.png). A meta de redesign integral continua ativa.

## Comparação e comportamento

- No desktop, os filtros usam o `Dialog` do design system, com fundo modal e painel compacto no canto superior direito. Em 1920 × 1080, o painel mede 352 × 372 px e começa em x=1472, y=140; a referência mede aproximadamente 350 × 374 px e começa em x=1475, y=140.
- A referência apresenta opções de estágio como caixas de seleção. O dashboard real oferece cinco filtros independentes — origem, responsável, operadora, tipo de contrato e estágio — por `FilterSelect`. Essa estrutura preserva os critérios e os dados reais do CRM.
- As seleções continuam sendo aplicadas imediatamente, como antes. “Limpar filtros” remove os cinco critérios; “Concluído”, o botão de fechar, o fundo modal e Escape fecham o painel sem descartar as seleções atuais.
- Em larguras até 767 px, os mesmos filtros são apresentados no `Drawer` lateral do design system. O cabeçalho e as ações permanecem disponíveis enquanto a área dos campos rola. O Drawer ocupa a largura útil do viewport; a barra vertical do navegador reserva 10 px em 390 e 320 px.
- Os campos usam os componentes reais da aplicação: `Dialog`, `Drawer`, `FilterSelect`, `Button` e `Badge`, com tokens do design system. Não foram adicionadas opções demonstrativas desconectadas do CRM.

## Interações verificadas

- Abrir e fechar pelo acionador, com `aria-expanded` e nome acessível.
- Abrir as opções do filtro de origem; selecionar “Site” atualiza a rota, os dados e o contador de filtros ativos.
- Limpar os filtros restaura a rota e o contador ao estado inicial.
- Escape fecha primeiro o seletor aberto e depois o Drawer; o foco retorna ao acionador.
- Sem rolagem horizontal em 1920 × 1080, 768 × 1024, 390 × 844 e 320 × 640, nos temas claro e escuro.

## Capturas Playwright

As capturas de viewport usam as quatro larguras e alturas definidas no manifesto; as capturas `full` incluem a página inteira. `coverage.json` registra dimensões e metadados de cada imagem.

| Resolução | Tema | Capturas |
|---|---|---|
| Desktop 1920 × 1080 | Claro | [viewport](desktop/filters-viewport.png) · [página completa](desktop/filters-full.png) · [opções de origem](desktop/filter-origin-options.png) |
| Desktop 1920 × 1080 | Escuro | [viewport](desktop/filters-dark-viewport.png) · [página completa](desktop/filters-dark-full.png) |
| Tablet 768 × 1024 | Claro | [viewport](tablet/filters-viewport.png) · [página completa](tablet/filters-full.png) |
| Tablet 768 × 1024 | Escuro | [viewport](tablet/filters-dark-viewport.png) · [página completa](tablet/filters-dark-full.png) |
| Mobile 390 × 844 | Claro | [viewport](mobile/filters-viewport.png) · [página completa](mobile/filters-full.png) |
| Mobile 390 × 844 | Escuro | [viewport](mobile/filters-dark-viewport.png) · [página completa](mobile/filters-dark-full.png) |
| Mobile compacto 320 × 640 | Claro | [viewport](mobile-320/filters-viewport.png) · [página completa](mobile-320/filters-full.png) · [opções de origem](mobile-320/filter-origin-options.png) |
| Mobile compacto 320 × 640 | Escuro | [viewport](mobile-320/filters-dark-viewport.png) · [página completa](mobile-320/filters-dark-full.png) |

## Dados e limites

As telas foram exercitadas com fixture sintética no ambiente local. Nenhum registro real foi alterado e nenhuma comunicação foi enviada. O console também reporta o aviso de ciclo de vida de uma dependência e timeouts da conexão Realtime da fixture; não são erros do painel de filtros.

O período personalizado e o estado de análises/modais são contextos separados e continuam pendentes. Esta revisão não encerra o redesign integral nem a descoberta de interfaces adicionais.
