# Landing page mobile — 31/10/2026

As dez seções foram reorganizadas para celular, seguindo as referências fornecidas e usando as fotos, dados e funcionalidades já aprovados no projeto.

## Como o desktop foi preservado

Os estilos novos ficam em `@media (width < 640px)` dentro de [home.css](../src/design-system/home.css). Existem ajustes adicionais de grade abaixo de 430 px e 375 px. A estrutura React, os textos e os fluxos comerciais continuam compartilhados com a versão aprovada.

[useHomeMotion.ts](../src/features/public-content/hooks/useHomeMotion.ts) recebeu somente dois ajustes: no celular, a entrada do FAQ e da cotação anima o título, pois os contêineres passam a usar `display: contents` para permitir a nova ordem visual. O comportamento acima de 640 px permanece o mesmo.

A comparação de produção abrange 768, 1024, 1440 e 1920 px, além de 1536 × 760 px para uma janela semelhante ao cenário com escala de Windows informado. São comparados a geometria e os estilos calculados de todos os elementos da página, além das capturas completas. A comparação de imagens admite até 0,1% de diferença de renderização; geometria e estilos precisam ser idênticos.

## Mudanças e capturas por seção

| Seção | Composição mobile | Captura final |
| --- | --- | --- |
| 1. Abertura | Cabeçalho com logo e menu; ações amplas, foto abaixo do texto e três diferenciais após a foto. O link de suporte foi preservado. | [Abertura](../output/playwright/home-mobile/390-topo.png) |
| 2. Confiança | Texto e imagem editorial com frase lateral, três explicações verticais e operadoras em cartões de tamanhos equilibrados. | [Confiança e operadoras](../output/playwright/home-mobile/390-prova-social.png) |
| 3. Para quem é | Seletor horizontal de três perfis e painel editorial único visível. A grade compartilhada mantém a posição e a altura ao alternar; a foto tem novo recorte. | [Perfis](../output/playwright/home-mobile/390-para-quem.png) |
| 4. Como funciona | Quatro passos verticais com números, ícones e conexão pontilhada curva. | [Etapas](../output/playwright/home-mobile/390-como-funciona.png) |
| 5. Depoimentos | Espaço principal amplo e dois cartões secundários. O estado vazio real foi mantido. | [Depoimentos](../output/playwright/home-mobile/390-depoimentos.png) |
| 6. Sobre a Luíza | Foto aprovada em destaque, texto abaixo, diferenciais em duas ou três colunas e assinatura ao final. | [Sobre](../output/playwright/home-mobile/390-quem-somos.png) |
| 7. Dúvidas | Introdução acima do acordeão e ilustração abaixo. Perguntas continuam com expansão acessível, foco e animação discreta. | [FAQ](../output/playwright/home-mobile/390-faq.png) |
| 8. Cotação | Título e imagem em colunas dimensionadas pelo conteúdo; explicação abaixo, formulário claro e benefícios ao final. A grade impede a imagem de cobrir o texto. Inputs usam fonte de 16 px. | [Cotação](../output/playwright/home-mobile/390-cotacao.png) |
| 9. WhatsApp | Título forte, benefícios e ação principal, seguidos por telefone ilustrativo e retrato integrados. O destino real do link foi preservado. | [WhatsApp](../output/playwright/home-mobile/390-fale-agora.png) |
| 10. Rodapé | Marca e apresentação no topo, grupos de links verticais, contatos, rede social e informações legais. | [Rodapé](../output/playwright/home-mobile/390-home-footer.png) |

As imagens usam recorte com `object-fit: cover`, mantendo suas proporções. Os logotipos continuam proporcionais. O site usa Playfair Display nos destaques editoriais e Poppins na interface pública; a tipografia do CRM não foi alterada.

## Validação

- Playwright nas larguras **320, 360, 375, 390, 414 e 430 px**, com movimento normal e reduzido: **12 cenários funcionais aprovados**, sem overflow, conteúdo preso invisível ou erros de console/execução.
- Verificação adicional de ordem dos blocos, texto separado da imagem da cotação, navegação vertical do rodapé, área de toque da ação principal, inputs de 16 px e palavras inteiras nos títulos dos diferenciais.
- Trocas repetidas de perfil, navegação por setas/Tab/Enter, transferência da seleção ao formulário, FAQ, menu móvel, Escape, restauração do foco e âncoras.
- Validação, carregamento e sucesso do formulário com respostas simuladas. Cidades foram fornecidas por fixture e os links de WhatsApp interceptados; nenhum lead ou mensagem real foi enviado.
- Capturas completas antes e depois; conferência individual das dez seções em 390 px e conferência adicional do retrato em 320 px.
- Desktop em 1440, 1536 e 1920 px: capturas idênticas. Tablet em 768 e 1024 px: geometria e estilos calculados idênticos, com variação de renderização dentro da tolerância de 0,1%.
- `npm run typecheck`, `npm run architecture:check`, `npm run audit:visual` e `npm run build`: aprovados. Foi gerado também um build isolado para que as capturas não dependessem de outros builds em andamento no workspace.
- Quatro arquivos de testes focados na página e no design system: **16 testes aprovados**.
- `npm run lint`: sem erros; nove avisos em arquivos externos a esta alteração.

Métricas e roteiros: [interações](../output/playwright/home-mobile/browser-metrics.json), [layout e preservação do desktop](../output/playwright/home-mobile/capture-metrics.json), [ordem e legibilidade](../output/playwright/home-mobile/layout-metrics.json), [roteiro funcional](../output/playwright/home-mobile/verify.js), [capturas](../output/playwright/home-mobile/capture.js) e [conferência estrutural](../output/playwright/home-mobile/layout-check.js).

Os roteiros esperam a prévia anterior na porta 5193 e a versão final na porta 5194.

As verificações foram feitas no Chromium com viewports configurados. O script de Speed Insights foi substituído por uma resposta vazia somente na prévia local. Aparelhos físicos e outros motores de navegador não fizeram parte desta execução.

## Páginas completas

| Largura | Resultado |
| --- | --- |
| 320 px | [Página inteira](../output/playwright/home-mobile/320-full-after.png) |
| 360 px | [Página inteira](../output/playwright/home-mobile/360-full-after.png) |
| 375 px | [Página inteira](../output/playwright/home-mobile/375-full-after.png) |
| 390 px | [Página inteira](../output/playwright/home-mobile/390-full-after.png) |
| 414 px | [Página inteira](../output/playwright/home-mobile/414-full-after.png) |
| 430 px | [Página inteira](../output/playwright/home-mobile/430-full-after.png) |

## Conteúdo real e refinamentos possíveis

O projeto possui cinco operadoras e somente os canais de contato já publicados. Esses dados continuam sendo a fonte da página. Os depoimentos conceituais e nomes das referências não foram apresentados como relatos reais; o espaço fica pronto para receber material validado.

O formulário mantém o canal WhatsApp e os campos reais, incluindo a idade ou as faixas etárias conforme o número de pessoas. A opção conceitual de atendimento por telefone da referência depende de uma evolução própria do fluxo comercial. Regras de negócio, captação de leads, integração, analytics e telas administrativas não foram modificados.
