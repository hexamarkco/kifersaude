# Ajustes da homepage para iPhone — 31/10/2026

O mockup ilustrativo crescia conforme a altura das mensagens. Na reprodução com WebKit e o perfil iPhone 12 Pro, a moldura tinha 205,52 × 600,17 pixels CSS: proporção altura/largura de 2,92. Agora, a moldura mantém a proporção 2,10 e a conversa ocupa o espaço interno disponível.

| Cenário | Largura da moldura | Altura da moldura | Proporção |
| --- | ---: | ---: | ---: |
| Antes, viewport de 390 px | 205,52 px | 600,17 px | 2,92 |
| Depois, viewport de 390 px | 206,69 px | 434,06 px | 2,10 |
| Depois, horizontal de 844 px com toque | 240 px | 504 px | 2,10 |

[Antes](../output/playwright/home-iphone/390-webkit-phone-before.png) · [Depois](../output/playwright/home-iphone/390-webkit-phone.png) · [Horizontal](../output/playwright/home-iphone/844-webkit-phone.png)

## Implementação

- A largura responsiva determina uma altura explícita da moldura. O visor usa flex e limita a conversa, sem comprimir balões nem deixar o histórico aumentar o aparelho.
- O exemplo mostra quatro mensagens no mobile e três abaixo de 375 px. Todas as mensagens exibidas cabem integralmente no visor; os textos comerciais da página continuam disponíveis.
- A apresentação compacta do aparelho também atende telas horizontais com toque. As regras de desktop continuam independentes dessa condição.
- Os perfis no mobile usam painéis sobrepostos na mesma célula, com texto em flex e foto em uma segunda linha. O tamanho continua considerando os três perfis, mantendo foto e botão na mesma posição sem depender de `subgrid` nesse tamanho de tela.
- A homepage define `text-size-adjust: 100%` com o prefixo WebKit para controlar a ampliação automática de texto. A configuração de zoom do viewport permanece igual. Referência: [documentação da Apple sobre tamanho do texto no Safari](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/AdjustingtheTextSize/AdjustingtheTextSize.html).
- Os breakpoints usam `min-width`/`max-width`, incluindo o teste de modo compacto das animações. A sintaxe de intervalos chegou ao Safari na versão 16.4; a versão do iOS do usuário não foi informada. Referência: [WebKit — Safari 16.4](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/).
- Os limites usam `.98px` para manter separadas as faixas. A comparação detectou que `max-width: 1023.99px` também correspondia a 1024 px no Chromium utilizado; a versão final preserva a geometria anterior nessa borda.
- Hero e apresentação da Luíza têm altura alternativa quando `aspect-ratio` não está disponível.

## Validação

Foi usado WebKit com o perfil completo iPhone 12 Pro: tela de 390 × 844, viewport inicial de 390 × 664, DPR 3 e suporte a toque. Os testes executam `tap()`, além da navegação por teclado. Isso é emulação em Windows, sem validação em um aparelho físico e sem simular uma versão antiga específica do Safari. Referência: [emulação no Playwright](https://playwright.dev/docs/emulation).

O [verificador mobile](../output/playwright/home-iphone/verify.js) passou em 16 casos: larguras de 320, 360, 375, 390, 414 e 430 px, horizontal de 844 × 390 e retorno ao retrato, com movimento normal e reduzido. Foram conferidos:

- Proporção do aparelho nas duas orientações, posição de todas as mensagens visíveis e limites do visor/campo ilustrativo.
- Altura invariável da moldura ao acrescentar temporariamente um balão longo durante o teste.
- Ausência de overflow horizontal ou texto cortado nos títulos e parágrafos.
- Ordem dos blocos de abertura e cotação; campos de cotação com fonte de 16 px no retrato.
- Seis trocas de perfil por caso, sem mover o painel, CTA ou foto, e apenas o perfil ativo exposto à acessibilidade.
- Menu e FAQ por toque, fechamento do menu e restauração de foco com entrada por teclado.
- Dez seções acessíveis após as animações e nenhum erro de execução.

[Métricas mobile](../output/playwright/home-iphone/browser-metrics.json) · [Abertura](../output/playwright/home-iphone/390-webkit-topo.png) · [Confiança](../output/playwright/home-iphone/390-webkit-prova-social.png) · [Perfis](../output/playwright/home-iphone/390-webkit-para-quem.png) · [Cotação](../output/playwright/home-iphone/390-webkit-cotacao.png)

A [comparação de desktop e tablet](../output/playwright/home-iphone/compare-desktop.js) usa Chromium nas larguras 640, 768, 1024, 1200, 1440, 1536 e 1920 px, incluindo 1536 × 760 para notebook/escala do Windows. Compara limites de todos os elementos e propriedades visuais, além de pixels de capturas completas. Margens automáticas são avaliadas pela geometria, pois sua serialização no CSSOM variou entre caixas idênticas. A tolerância de rasterização é de 0,1%; os resultados estão nas [métricas de comparação](../output/playwright/home-iphone/desktop-metrics.json).

Também passaram os 16 testes focados de HomePage, PublicHomeHeader, useHomeMotion e contrato do design system, o typecheck, a arquitetura, a auditoria visual e o build de produção. O lint passou sem erros, com 15 avisos em outros arquivos já presentes no workspace.

Os testes de navegador usam previews locais com builds isolados. A busca de cidades é simulada, o verificador mobile bloqueia o envio de leads e nenhum formulário ou contato real foi enviado. A visita à versão publicada foi somente para leitura e reprodução inicial do problema.
