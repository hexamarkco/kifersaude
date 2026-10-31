# Inventário anterior à implementação — 31/10/2026

As dez fotografias foram abertas/identificadas e arquivadas sem alteração em `originals/`; dimensões e SHA-256 constam em [assets.json](assets.json). A sequência numérica do nome fornecido é preservada nesse arquivo. WebP usa a resolução integral, qualidade 92, sem crop; somente CSS controla o enquadramento.

Referências desktop: `output/playwright/home-redesign/references/`.
Referências mobile: `output/playwright/home-mobile-comparison/references/`.
Fotografias de produção: `public/images/home/`.

| Seção/estado | Referência desktop | Referência mobile | Foto final e proporção | Destino | Auditoria inicial |
|---|---|---|---|---|---|
| 01 Abertura desktop/tablet | `01_HERO_ABERTURA.png` | — | `luiza-opening.webp`, 1448×1086, 4:3, arquivo 1 | HomeIntro / `.home-hero-portrait` | Substituir foto anterior e máscara oval |
| 01 Abertura mobile | — | `01_HERO_ABERTURA_MOBILE.png` | `luiza-opening.webp`, 4:3 | HomeIntro / `.home-hero-portrait` | Mesmo contexto, recorte e máscara próprios; preservar mesa/mão |
| 02 Confiança | `02_CONFIANCA_OPERADORAS.png` | `02_CONFIANCA_OPERADORAS_MOBILE.png` | `trust-coffee.webp`, 1448×1086, 4:3, arquivo 2 | HomeIntro / `.home-trust-photo` | Separar de MEI; caneca e notebook corretos |
| 03 Pessoa física | `03_PARA_QUEM_E.png` | `03_PARA_QUEM_E_MOBILE.png` | `family-profile.webp`, 1448×1086, 4:3, arquivo 3 | HomeAudience / `#audience-panel-PF` | Família correta e máscara orgânica |
| 03 MEI | Não fornecida para este estado | Não fornecida para este estado | `mei-office.webp`, 1448×1086, 4:3, arquivo 4 | HomeAudience / `#audience-panel-MEI` | Profissional escrevendo; aplicar geometria do painel aprovado |
| 03 Empresa | Não fornecida para este estado | Não fornecida para este estado | `business.png`, 1122×1402, retrato existente | HomeAudience / `#audience-panel-CNPJ` | **Pendente:** nova foto de equipe não incluída; manter existente, sem substituição arbitrária |
| 04 Como funciona | `04_COMO_FUNCIONA.png` | `04_COMO_FUNCIONA_MOBILE.png` | Sem foto | HomeJourney | Preservar |
| 05 Principal | `05_DEPOIMENTOS.png` | `05_DEPOIMENTOS_MOBILE.png` | `originals/testimonial-main-reserved.png`, 1122×1402, arquivo 5 | HomeJourney / estado vazio | **Reservada:** não há relato real aprovado |
| 05 Secundário MEI | Mesma referência 05 | Mesma referência 05 mobile | `originals/testimonial-mei-reserved.png`, 1254×1254, arquivo 6 | HomeJourney / estado vazio | **Reservada:** não atribuir relato a este retrato |
| 05 Secundário Empresa | Mesma referência 05 | Mesma referência 05 mobile | `originals/testimonial-company-reserved.png`, 1254×1254, arquivo 7 | HomeJourney / estado vazio | **Reservada:** não atribuir relato a este retrato |
| 06 Sobre a Luíza | `06_SOBRE_LUIZA.png` | `06_SOBRE_LUIZA_MOBILE.png` | `luiza-about-editorial.webp`, 1448×1086, 4:3, arquivo 8 | HomeJourney / `.home-about-photo` | Foto com mesa, caneca e notebook; nova transição orgânica |
| 07 FAQ | `07_DUVIDAS_FREQUENTES.png` | `07_DUVIDAS_FREQUENTES_MOBILE.png` | Sem foto | HomeContact | Preservar |
| 08 Cotação | `08_COTACAO.png` | `08_COTACAO_MOBILE.png` | `family-quote.webp`, 1448×1086, 4:3, arquivo 9 | HomeQuoteForm / `.home-quote-background` | Separar família da cotação de Pessoa Física |
| 09 WhatsApp | `09_WHATSAPP.png` | `09_WHATSAPP_MOBILE.png` | `luiza-portrait.webp`, 1122×1402, arquivo 10 | HomeContact / `.home-whatsapp-photo` | Retrato vertical ao lado/sob o telefone; manter proporção 2,1 do mockup no celular |
| 10 Rodapé | `10_RODAPE.png` | `10_RODAPE_MOBILE.png` | Sem foto | HomeFooter | Preservar |

O novo pedido substitui a seleção anterior das fotos de blazer bege. O arquivo 10 corresponde ao contexto retrato/WhatsApp; o arquivo 1 mantém o notebook à direita da abertura. Não foram usados recortes das telas de referência como fotografias.

Antes da alteração de componentes/estilos: capturas das dez seções e estados MEI/Empresa em `before/390` (WebKit/iPhone 12 Pro), `before/768`, `before/1440` e `before/1920` (Chromium). Nenhum formulário foi enviado.
