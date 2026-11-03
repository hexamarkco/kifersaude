# Para quem é — composição das fotografias

Comparação visual: [index.html](index.html).

## Alterações

- A máscara desktop agora tem o arco lateral e o contorno inferior arredondado da referência. A faixa clara fica atrás da foto, sem apagar sua parte inferior.
- Os filetes superior e inferior ficam fora do recorte fotográfico, com desenho específico no mobile.
- Em desktop a partir de 1200 px, a seção ganha a largura e a proporção fotográfica da referência. O painel mede aproximadamente 658 px em uma tela de 1672 px; sua coluna de foto começa em x=989 px.
- Pessoa física, MEI e Empresa têm pontos focais ajustados individualmente. No mobile, o enquadramento prioriza o topo das pessoas, especialmente na imagem de Empresa.
- A grade compartilhada mantém a altura do painel e a posição do CTA durante a troca de perfil.

## Escopo e fotografias

Somente a seção Para quem é foi alterada. Hero, demais seções, textos, seleção de perfil e integração da cotação permanecem iguais.

Os arquivos `family-profile.webp`, `mei-office.webp` e `business.png` foram preservados, sem geração, edição de pixels ou substituição. As referências de layout fornecidas mostram o perfil Pessoa física; não há referências independentes de composição para MEI e Empresa. A fotografia de Empresa continua sendo o arquivo contextual já existente, conforme o mapa anterior de assets.

## Validação

- Medições antes/depois em 360, 390, 430, 768, 1024, 1440, 1672 e 1920 px: sem rolagem horizontal; altura e CTA iguais entre os três perfis; textos e fontes das imagens preservados.
- As alturas e os textos das outras seções são idênticos ao estado anterior em todas as larguras.
- Capturas em Chromium: 390, 1440 e 1672 px, para cada perfil. Os 390 px correspondem à largura CSS do iPhone 12 Pro; não são capturas de um aparelho físico.
- Typecheck passou; lint sem erros (15 avisos preexistentes); 12 testes de HomePage e useHomeMotion passaram; build e verificações de design, segredos, valores visuais e bundle do editor passaram.

Scripts de reprodução: `capture.js` e `interactions.js`, via Playwright CLI contra `http://127.0.0.1:5220/`. A captura bloqueia Edge Functions e simula respostas externas, sem envio de leads ou mensagens. `validation.json` contém as medições e o resultado dos testes de interação.
