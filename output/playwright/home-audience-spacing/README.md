# Espaçamento e estabilidade dos perfis — 30/10/2026

A seção “Para quem é” tem 16 px entre o seletor e os slides, tanto lado a lado quanto no celular. Os três perfis compartilham o dimensionamento das linhas do painel; a altura acompanha o maior conteúdo em cada largura, evitando deslocar seletor, títulos, textos, cotação e foto ao trocar de perfil. Apenas o perfil selecionado fica visível e disponível à navegação por teclado e às tecnologias assistivas.

Playwright verificou Pessoa física, MEI e Empresa em 320, 390, 639, 640, 768, 1024, 1440 e 1920 px. Comparou posições e dimensões durante as trocas, com tolerância de 0,5 px, e confirmou que a seção cabe na largura disponível.

Também verificou, no desktop e celular, navegação com setas, retorno à primeira opção, Tab até a ação visível e preenchimento do perfil correto ao abrir a cotação. Nenhum formulário foi enviado.

| Perfil | Desktop | Celular |
| --- | --- | --- |
| Pessoa física | [1440 px](after-1440-0.png) | [390 px](after-390-0.png) |
| MEI | [1440 px](after-1440-1.png) | [390 px](after-390-1.png) |
| Empresa | [1440 px](after-1440-2.png) | [390 px](after-390-2.png) |

Medições: [antes](before.json), [depois](after.json), [interações](interactions.json). O cabeçalho foi ocultado apenas durante as capturas para não cobrir a seção.

Validação aprovada: typecheck, ESLint do componente alterado e build, incluindo as auditorias de design system, tokens visuais e verificação do bundle do editor.
