# Fidelidade do hero desktop — 1 de novembro de 2026

Escopo: hero a partir de 1024 px e dimensões da navegação superior necessárias à composição. Mobile, tablet, conteúdo textual, outras seções, formulário e integrações preservados.

## Implementação

- Fotografia mantida: `public/images/home/luiza-opening.webp`, proveniente de `Imagem do ChatGPT 31 de out. de 2026, 12_50_48-1.png`. Nenhuma edição nos pixels.
- Enquadramento com largura de 78% do hero e foco vertical de 30%, sem a ampliação anterior de 1,22. A cabeça, a mão, o braço, os livros e o notebook voltam a participar da composição.
- Máscara SVG exclusiva do desktop: união da curva superior com a curva diagonal inferior. A transparência atua apenas na borda esquerda; rosto, mão e lado direito permanecem opacos.
- Três planos de fundo e filete inferior desenhados em coordenadas da referência de 1672 × 856 px. Cores derivadas dos tokens existentes.
- Título em três linhas, itálico com peso 600, hierarquia do parágrafo, CTAs e ícones ajustados à arte. A placa sobre a foto deixa de ser exibida no desktop; seu texto permanece no DOM, assim como o link de suporte.
- CSS isolado em `home-hero-desktop.css`, importado pelo único entrypoint `styles.css`.

## Comparação e limites

O HTML apresenta referência, captura anterior e captura final, com seletor de largura e sobreposição ajustável. As capturas são do código real em Chromium, com fontes e imagens carregadas. O hero final em 1672 px mede 942 px com o cabeçalho, contra 941 px na referência.

A composição aprovada e o arquivo fotográfico individual fornecido não são idênticos: há diferenças de pose, cenário e objetos em primeiro plano. O ajuste preserva a fotografia correta fornecida e aproxima enquadramento e geometria; não afirma identidade de pixels nem reconstrói partes da foto por geração de imagem.

## Validação

- Capturas em 1024, 1280, 1440, 1536, 1672 e 1920 px, sem overflow horizontal.
- Hero mobile em 390 px e tablet em 768 px: imagens antes/depois com SHA-256 idêntico.
- Texto integral do hero e textos/alturas das outras nove seções idênticos nas oito larguras. O deslocamento vertical das seções seguintes resulta apenas da nova altura do hero desktop.
- `npm run typecheck`, `npm run lint`, `npm run audit:visual` e `npm run build`: aprovados.
- Testes de HomePage, PublicHomeHeader, useHomeMotion e contrato do design system: **20 testes aprovados**.
- Navegação para cotação, links de WhatsApp e animação de entrada conferidos no preview local. Nenhum lead ou mensagem real foi enviado.
- Build final servido localmente em preview: máscara carregada, composição conferida em 1672 px e nenhum erro JavaScript. Captura em `production-1672.png`.

`capture.js` aceita uma página local já aberta com `?phase=before` ou `?phase=final`, simula chamadas auxiliares e bloqueia Edge Functions. `validation.json` registra as medidas e a comparação dos estados. O aviso preexistente de ciclo de vida do React Helmet aparece somente no servidor de desenvolvimento; a compilação também mantém seu aviso preexistente de tamanho de chunks.
