# Fotografias e composições — revisão de 31/10/2026

[Abrir comparação das dez seções](index.html) · [Mapa dos assets](MAPA.md) · [Originais e hashes](assets.json)

## Resultado

Sete fotografias fornecidas foram incorporadas à página pública. A abertura, Confiança, Pessoa Física, MEI, Sobre a Luíza, Cotação e WhatsApp receberam enquadramentos próprios. As máscaras SVG, formas de fundo, curvas e etiquetas ficam em camadas independentes das imagens. Os originais não foram recortados ou esticados.

O comparativo contém **referência, antes e depois** nas larguras de **390, 768, 1440 e 1920 px**, além dos estados MEI e Empresa. Cada coluna exibe a imagem inteira com a mesma largura visual e altura proporcional. Há 52 capturas por etapa: dez seções, dois estados adicionais e uma página completa em cada largura. O antes corresponde ao estado de `2d53ce1b`, registrado antes da alteração das composições. O depois vem de uma cópia isolada do build final.

## O que mudou em cada composição

| Seção | Resultado |
|---|---|
| 01 Abertura | Foto 1, escala e ponto focal por breakpoint, curva lateral própria, máscara mobile e onda inferior. A animação atua no invólucro, sem sobrescrever o zoom da imagem. |
| 02 Confiança | Foto 2 da mulher com caneca e notebook, base reta, arcos superiores assimétricos e shapes atrás da imagem. Ponto focal superior conserva a cabeça inteira. |
| 03 Pessoa física | Foto 3, área orgânica ampla, faixa inferior e linha decorativa fora dos rostos. Imagem abaixo do CTA no mobile. |
| 03 MEI | Foto 4 da profissional escrevendo, mesmo painel estável e foco próprio. |
| 03 Empresa | Fotografia existente de equipe preservada. Nova fotografia específica não foi fornecida. |
| 04 Como funciona | Sem alteração de composição; etapas e linha de percurso preservadas. |
| 05 Depoimentos | Estado vazio preservado. Fotos 5–7 arquivadas, sem atribuir relatos fictícios. |
| 06 Sobre a Luíza | Foto 8 com caneca, mesa e notebook. Máscara lateral no desktop e término orgânico inferior no mobile; arco separado da fotografia. |
| 07 FAQ | Desenho e interação preservados. |
| 08 Cotação | Foto 9 distinta da família de Pessoa Física, parcialmente atrás do formulário no desktop. No mobile/tablet, a fotografia acompanha a apresentação sem cobrir os campos. |
| 09 WhatsApp | Foto 10 vertical integrada ao mockup, com fundo terracota e etiqueta em camadas. Proporção do telefone preservada no celular. |
| 10 Rodapé | Conteúdo, links e geometria preservados. |

## Arquivos de implementação

Todos os caminhos abaixo são relativos à raiz do repositório.

| Arquivo | Responsabilidade |
|---|---|
| `src/features/public-content/domain/homeContent.ts` | Associação das fotos e dimensões intrínsecas dos três perfis. |
| `src/features/public-content/components/home/HomePhotoMasks.tsx` | Silhuetas específicas de cada seção, com versões mobile onde necessário. |
| `src/features/public-content/components/home/HomeIntro.tsx` | Fotografia e ondas da abertura; fotografia de Confiança. |
| `src/features/public-content/components/home/HomeAudience.tsx` | Imagens, dimensões e curvas do painel de perfis. |
| `src/features/public-content/components/home/HomeJourney.tsx` | Foto e transição de Sobre a Luíza; documentação da reserva de retratos. |
| `src/features/public-content/components/home/HomeQuoteForm.tsx` | Foto específica da família na cotação; lógica do formulário preservada. |
| `src/features/public-content/components/home/HomeContact.tsx` | Retrato vertical e texto alternativo da seção WhatsApp. |
| `src/features/public-content/HomeScreen.tsx` | Instância única das definições SVG. |
| `src/features/public-content/hooks/useHomeMotion.ts` | Alvo da animação da abertura separado do zoom de enquadramento. |
| `src/design-system/home-photography.css` | Geometria, enquadramentos e camadas por seção e breakpoint. |
| `src/design-system/home.css` | Remoção das regras antigas de composição fotográfica substituídas. |
| `src/design-system/styles.css` | Importação da folha de composições pelo entrypoint existente. |
| `public/images/home/ASSETS.md` | Seleção atual, histórico e origem das fotografias. |

## Validação

Capturas após carregamento de fontes e imagens, com animações em repouso. A simulação de iPhone usa **WebKit**, não um aparelho físico. Os formulários foram testados com resposta interceptada e `window.open` simulado; nenhum lead ou WhatsApp real foi enviado.

| Verificação | Resultado |
|---|---|
| `npm run build` | Passou, incluindo verificação de segredos, design system, auditoria visual e bundle do editor. Aviso existente de chunks acima de 500 kB. |
| `npm run typecheck` | Passou. |
| `npm run lint` | Zero erros; 15 avisos preexistentes em previews e `PainelWrapper.tsx`. |
| `npm run architecture:check` | Passou. |
| `HomePage.test.tsx` | 3 testes passaram. |
| `PublicHomeHeader.test.tsx` | 3 testes passaram. |
| `useHomeMotion.test.tsx` | 9 testes passaram. |
| `designSystemContract.test.ts` | 1 teste passou. |
| Chromium, 1024/1440/1920 px | Perfis, FAQ, dimensões das fotos, texto sem corte e ausência de overflow; com animações normais e movimento reduzido. |
| WebKit, 320/360/375/390/414/430/768/844 px | Mesmas verificações, mais menu por teclado/Escape, foco restaurado e proporção do telefone em celular/retrato e paisagem. |
| Formulário | Validação de quantidade/idade, exibição de faixas etárias e envio simulado com confirmação. |

Dados completos: [capturas mobile](capture-after-mobile.json), [capturas desktop](capture-after-desktop.json), [checagem WebKit](validation-mobile.json), [checagem Chromium](validation-desktop.json) e [checagem do HTML](validation-report.json).

## Diferenças residuais e pendências

- **Depoimentos:** os três retratos estão identificados e arquivados, mas faltam relatos reais aprovados. A seção deliberadamente não reproduz as pessoas, nomes e falas fictícias da referência.
- **Empresa:** não veio uma nova foto de equipe. `business.png` continua como imagem contextual; não foi substituída por uma foto de pessoa física. Não há referências específicas para os estados MEI e Empresa; a máscara segue o painel de Pessoa Física.
- **Fotografias individuais e telas de referência:** são imagens diferentes, com pequenas diferenças de pose, cenário e posição de objetos. Os novos originais foram preservados; não houve reconstrução de partes da fotografia. As máscaras e focos aproximam a composição, sem alegação de igualdade pixel a pixel.
- **Tamanhos de tela:** 768 px é uma composição intermediária, pois não foi fornecida referência específica de tablet. No desktop amplo o conteúdo mantém a largura máxima existente; a fotografia se estende até a borda da tela.
- **Conteúdo real:** cinco operadoras cadastradas, texto comercial atual, formulário com idade/faixas etárias e privacidade, conversa ilustrativa e contatos reais continuam no site. Isso mantém diferenças de altura e quebra de linhas em relação às referências. A tipografia e o conteúdo não foram redesenhados para forçar alturas iguais.
- **Elementos existentes:** o link de suporte e a identificação da Luíza na abertura desktop foram mantidos. O mockup WhatsApp continua em HTML, com sua conversa ilustrativa e proporção móvel de aproximadamente 2,1; não é uma imagem esticada da referência.

## Reprodução

`build-report.mjs` recria o HTML a partir do inventário. `capture.js` é uma função para `playwright-cli run-code`: exige uma página em `localhost`/`127.0.0.1`, usa `?phase=after&mobile=1` para 390 px no WebKit e `?phase=after` para 768/1440/1920 px no Chromium. Para outra rodada sem sobrescrever a evidência atual, use uma fase nova, como `?phase=review-2`. `verify.js` executa as verificações de geometria e interação no preview local e intercepta o envio de cotação.

O HTML abre diretamente no navegador. Mantenha os diretórios irmãos `home-redesign/references` e `home-mobile-comparison/references`, pois são as referências originais utilizadas no comparativo.
