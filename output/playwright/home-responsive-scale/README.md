# Escala responsiva da página pública — 30/10/2026

Referência informada: tela de 1920 × 1080, escala do Windows em 125% e navegador em 100%. Essa configuração corresponde a aproximadamente 1536 × 864 pixels CSS antes das barras do navegador; a conferência principal usa uma área útil de 1536 × 760.

A página limita o conteúdo a 1344 px, reduz títulos e espaçamentos e usa a altura disponível para dimensionar a abertura. As seções de confiança, perfis, etapas, apresentação, FAQ, cotação e WhatsApp acompanham essa escala. No celular, os títulos e a marca também se adaptam à largura.

As faixas responsivas usam limites contínuos para atender larguras fracionárias produzidas pela escala do sistema. O cabeçalho e os textos das etapas cabem em 320 px. O telefone ilustrativo participa da altura da seção para que a conversa não seja cortada.

| Abertura em 1366 × 768 | Antes | Depois |
| --- | --- | --- |
| Título | 77,2 px | 64,2 px |
| Altura da seção | 785,8 px | 640 px |

- [Antes em notebook](before-1366.png) e [depois](after-1366x768.png).
- [Configuração de referência, área útil de 1536 × 760](after-1536x760.png).
- [Celular de 390 px](after-390x844.png).
- Seções: [confiança](after-trust-1536.png), [perfis](after-audience-1536.png), [apresentação](after-about-1536.png), [FAQ](after-faq-1536.png), [cotação](after-quote-1536.png), [WhatsApp](after-whatsapp-1536.png) e [rodapé](after-footer-1536.png).

Playwright verifica 14 tamanhos entre 320 e 2560 px, incluindo os limites de 639/640 e 1023/1024 px. Confere ausência de rolagem horizontal e controles fora da tela, botões da abertura visíveis nos desktops, telefone ilustrativo inteiro, estabilidade dos três perfis e abertura/fechamento das perguntas com padding superior de 16 px.

Dados completos: [antes](before.json) e [depois](after.json). Também foram conferidos o menu móvel e a escolha correta do perfil ao abrir a cotação em 1536, 390 e 320 px: [interações](interactions.json). O cabeçalho é ocultado somente nas capturas individuais das seções para não encobri-las. Nenhum formulário é enviado.

Build aprovado, incluindo auditorias de design system, tokens visuais, segredos e verificação do bundle do editor. A alteração de produção fica restrita a `src/design-system/home.css`.
