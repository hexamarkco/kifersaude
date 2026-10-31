# Animações da página pública — 31/10/2026

A página ganhou entradas e microinterações nas dez seções. A comparação com a versão aprovada (`fea3c130`) confirmou o mesmo texto e **zero diferença na altura das dez seções**, em 320, 390, 768, 1440 e 1920 px. As fotos, proporções, espaçamentos e regras comerciais foram preservados.

## Comportamento por seção

| Seção | Movimento implementado |
| --- | --- |
| 1. Abertura | Entrada curta das linhas do título, descrição e ações em sequência; fotografia com escala uniforme de 1,03 para 1; benefícios e onda discretos. Título e botões permanecem opacos e utilizáveis desde o início. |
| 2. Confiança e operadoras | Texto lateral, benefícios escalonados, conectores e ícones; logos entram com deslocamento de 5 px e opacidade suave. |
| 3. Para quem é | Indicador único desliza entre os perfis. Painéis fazem transição de opacidade, com texto e foto coordenados no desktop. A grade conserva sua altura; somente a ação do perfil ativo entra na navegação por Tab. |
| 4. Como funciona | Revelação da linha pontilhada, seguida dos quatro passos e ícones. No celular, os conectores verticais acompanham a sequência. |
| 5. Depoimentos | Entrada editorial do espaço principal e dos espaços secundários. O estado vazio aprovado continua visível, sem nomes ou histórias inventados. |
| 6. Sobre a Luíza | Recorte discreto da foto no desktop, opacidade no celular, seguida do texto, diferenciais e assinatura. |
| 7. Dúvidas | Entrada escalonada das perguntas. Abertura e fechamento com CSS Grid e opacidade; foco, expansão exclusiva e relações ARIA preservados. O padding superior de 16 px da resposta permanece. |
| 8. Cotação | Texto lateral e formulário entram separadamente. Foco recebe realce; erros, feedback e carregamento têm tratamento curto. A entrada é cancelada ao focar um campo, mantendo a digitação estável. |
| 9. WhatsApp | Texto e fotografia entram discretamente; as três últimas bolhas da conversa ilustrativa aparecem uma única vez, quando chegam à área visível. As duas primeiras dão contexto. |
| 10. Rodapé | Grupos entram em sequência curta; os pequenos traços dos títulos acompanham a entrada. Links e ícones recebem microinterações; a linha legal permanece estática. |

As entradas não se repetem ao voltar pela rolagem. Não há autoplay, parallax contínuo, scroll hijacking ou alterações na rolagem nativa.

## Implementação e arquivos

- [useHomeMotion.ts](../src/features/public-content/hooks/useHomeMotion.ts): controlador com Web Animations API, um `IntersectionObserver`, transição de perfis, cancelamento por foco, aba oculta, movimento reduzido e desmontagem. Observer ausente, sem eventos ou com falha não esconde conteúdo. Efeitos nativos indisponíveis ou rejeitados também deixam a página utilizável.
- [home.css](../src/design-system/home.css): tokens e efeitos locais em `.kifer-home`; indicador dos perfis, FAQ, estados do formulário e microinterações. A referência visual foi conferida em `/design-system`.
- [HomeScreen.tsx](../src/features/public-content/HomeScreen.tsx): conexão do controlador ao conteúdo público.
- [HomeIntro.tsx](../src/features/public-content/components/home/HomeIntro.tsx), [HomeAudience.tsx](../src/features/public-content/components/home/HomeAudience.tsx) e [HomeContact.tsx](../src/features/public-content/components/home/HomeContact.tsx): alvos semânticos de animação, perfil ativo e estrutura animável do FAQ.
- [PublicHomeHeader.tsx](../src/features/public-content/components/PublicHomeHeader.tsx): navegação aguarda o fechamento do menu. Isso restaura foco e scrollbar antes de medir a âncora, evitando o desalinhamento encontrado em telas pequenas.
- Testes: [controlador de movimento](../src/features/public-content/hooks/__tests__/useHomeMotion.test.tsx), [cabeçalho](../src/features/public-content/components/__tests__/PublicHomeHeader.test.tsx) e [página pública](../src/pages/public/HomePage.test.tsx). O teste antigo passou a localizar o painel pela relação `aria-controls` do rádio e a verificar o estado acessível do FAQ.

Não foram adicionadas dependências. A implementação usa CSS para transições simples e a API nativa para sequências e cancelamento. APIs, banco, analytics, conteúdo e processamento da cotação não foram alterados.

| Token | Desktop | Abaixo de 640 px |
| --- | --- | --- |
| `--home-motion-entry` | 560 ms | 420 ms |
| `--home-motion-profile` | 280 ms | 180 ms |
| `--home-motion-micro` | 220 ms | 220 ms |
| `--home-motion-stagger` | 60 ms | 35 ms |
| `--home-motion-distance` | 18 px | 8 px |
| `--home-motion-ease` | `cubic-bezier(.22, 1, .36, 1)` | igual |

Com `prefers-reduced-motion: reduce`, entradas e transições são desativadas, mantendo conteúdo, foco e ações disponíveis. A preferência também pode mudar durante uma animação.

## Validação

- `npm run typecheck`: aprovado.
- `npm run architecture:check`: aprovado.
- `npm run lint`: sem erros; oito avisos já existentes, também encontrados antes da mudança.
- `npm test -- --maxWorkers=4 --minWorkers=1`: **358 arquivos e 1.877 testes aprovados**.
- Reexecução dos três arquivos da página após os ajustes: **15 testes aprovados**.
- `npm run build`: aprovado, incluindo auditorias do projeto e verificação do bundle do editor. Permanecem os avisos existentes de tamanho de chunks.
- Playwright no build de produção: cinco larguras × duas preferências de movimento, dez casos aprovados. Sem overflow horizontal, erros de console/execução ou conteúdo preso invisível. Um observer por página; nenhuma nova entrada ao revisitar uma seção.
- Perfis: seis trocas consecutivas, setas, Tab, Enter e seleção refletida no formulário; altura e posição estáveis.
- FAQ: cinco perguntas abertas e fechadas pelo teclado, foco preservado, respostas sem corte e padding mantido.
- Menu móvel: contenção e restauração de foco, Escape e navegação para a âncora correta; navegação desktop também conferida.
- Formulário: validação e foco no campo inválido, estado ocupado, campos desabilitados e sucesso. **Dez envios foram simulados**, com cidades de teste e respostas locais. Links e abertura de WhatsApp foram interceptados.
- Fallbacks: observer ausente, com falha e sem disparar; animação ausente e com falha; troca dinâmica de preferência e limpeza ao ocultar a aba. Todos aprovados.
- Deslocamento incremental de layout durante as entradas, após carregar fontes: **0** nos dez casos. Essa medição local não substitui dados de Web Vitals em produção.

O script de Speed Insights é servido pelo provedor em produção e foi substituído por uma resposta vazia apenas no teste local. As integrações reais não foram acionadas. A validação automatizada foi feita no Chromium; Firefox e Safari não fizeram parte desta execução.

Métricas: [navegação e interações](../output/playwright/home-motion/browser-metrics.json), [comparação de layout](../output/playwright/home-motion/layout-comparison.json) e [fallbacks](../output/playwright/home-motion/fallback-metrics.json).

## Evidências

Capturas completas de builds de produção. A versão anterior foi reconstruída a partir de `fea3c130`, incluindo as fotos já aprovadas.

| Largura | Antes | Depois |
| --- | --- | --- |
| 320 px | [Página inteira](../output/playwright/home-motion/320-full-before.png) | [Página inteira](../output/playwright/home-motion/320-full-after.png) |
| 390 px | [Página inteira](../output/playwright/home-motion/390-full-before.png) | [Página inteira](../output/playwright/home-motion/390-full-after.png) |
| 768 px | [Página inteira](../output/playwright/home-motion/768-full-before.png) | [Página inteira](../output/playwright/home-motion/768-full-after.png) |
| 1440 px | [Página inteira](../output/playwright/home-motion/1440-full-before.png) | [Página inteira](../output/playwright/home-motion/1440-full-after.png) |
| 1920 px | [Página inteira](../output/playwright/home-motion/1920-full-before.png) | [Página inteira](../output/playwright/home-motion/1920-full-after.png) |

Vídeos: [desktop](../output/playwright/home-motion/desktop.webm) e [celular](../output/playwright/home-motion/mobile.webm). Mostram as dez seções, troca de perfis, FAQ e foco do formulário; a conversa permanece ilustrativa.

Roteiros utilizados: [interações](../output/playwright/home-motion/verify.js), [fallbacks](../output/playwright/home-motion/verify-fallbacks.js), [capturas](../output/playwright/home-motion/capture-full.js) e [gravação](../output/playwright/home-motion/record.js). Esperam o preview atual na porta 5191; a comparação também usa a versão anterior na porta 5192.
