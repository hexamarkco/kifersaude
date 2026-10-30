# Tamanho das logos — 30/10/2026

A faixa passa a usar uma largura comum de 152 px no desktop, com altura automática. Isso aumenta Bradesco e SulAmérica e reduz Porto em relação à faixa anterior, preservando a proporção de cada marca. Os arquivos oficiais permanecem intactos.

Em telas menores, a largura se adapta ao espaço disponível em cada coluna. Playwright verificou 320, 390, 768, 1024, 1440 e 1920 px: faixa dentro da largura disponível, diferença inferior a 1 px entre as larguras das marcas nas colunas responsivas e proporções originais preservadas.

- [Antes no desktop](before-1920.png)
- [Depois no desktop](after-1920.png)
- [Depois no celular](after-390.png)
- [Medições das seis larguras](results.json)

Mudança de produção restrita a `src/design-system/home.css`. Auditorias de design system e tokens visuais aprovadas. Verificação feita apenas na apresentação da faixa, sem submissão de formulários.
