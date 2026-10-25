# Adoção do design system — 25/10/2026

## Contrato compartilhado

O painel, o conteúdo público, os portais e o showcase usam o mesmo `DesignSystemProvider`. A aparência operacional deixou de depender da classe opcional `kds-operational`. Os tokens semânticos de cores, fontes, espaçamento e raios pertencem a `src/design-system`; o preset do Tailwind consome esses tokens.

`src/index.css` importa somente `src/design-system/styles.css`. Esse entrypoint reúne fundamentos, componentes, temas, utilitários, estilos de integração e showcase. Estilos herdados foram preservados dentro dessa fronteira; sua centralização não significa que todos os layouts históricos já foram redesenhados.

Componentes nativos visuais nas telas foram substituídos pelas APIs compartilhadas, preservando handlers, refs, atributos e formatos de dados. Foram incorporados ao catálogo os controles de arquivo, slider, opções de menu, mídia, gráficos, editor rico, autocomplete de variáveis, canvas de automação e carregamentos utilizados pelos módulos reais.

## Ajustes de interação

- Abas com indicador inferior: hover transparente, sem cápsula de fundo.
- Ação terciária: sem sublinhado; ação de texto: sublinhada e sem fundo.
- Inputs, selects e textareas: foco pela própria borda fina, sem anel adicional. Os demais elementos mantêm indicação de foco pelo teclado.
- Filtros no mobile: linha inteira abaixo da busca, alinhamento à esquerda.
- Dropdowns: espaçamento entre opções, raios consistentes e navegação por teclado entre opções habilitadas.
- Cabeçalhos de ordenação dos cadastros: ação sem a caixa e o padding de um botão convencional, evitando quebra de palavras em colunas estreitas.
- Editor rico: toolbar responsiva e altura de conteúdo automática.

## Data e horário em etapas

`DateTimePicker` mantém as propriedades `date`, `time` e `datetime-local`, os formatos de valor e o evento com `target.value` / `target.name`.

Data simples é aplicada ao escolher o dia. Data com horário usa **Data → Hora → Minutos**; horário simples usa **Hora → Minutos**. Somente uma etapa aparece por vez. As horas são uma grade de 24 opções; minutos têm atalhos de cinco em cinco e um campo numérico que preserva a precisão de um minuto.

A escolha com horário fica em rascunho até **Confirmar horário**. Voltar ou mudar de etapa preserva o rascunho; fechar sem confirmar preserva o valor anterior. Limpar é explícito. Hoje respeita limites de data; Agora prepara o horário atual para confirmação. Limites de hora/minuto são aplicados também no modo de horário simples.

O exemplo interativo está em `/design-system#components`, aba **Formulários**, seção **Data e horário**.

## Proteção contra divergências

`npm run audit:design-system` verifica o código de produção fora do design system e bloqueia primitivas visuais nativas, stylesheets locais e importações diretas de UI de fornecedores. Verifica também se as APIs de componentes consumidas pela aplicação aparecem no showcase. O gate faz parte do build.

Resultado nesta revisão: **433 arquivos, 5.676 usos de componentes, 106 APIs utilizadas pela aplicação cobertas pelo showcase**. O gate fiscaliza fronteiras de código; não substitui a avaliação visual de todos os fluxos e estados possíveis. HTML estrutural e utilitários de layout continuam permitidos.

## Validação e limites

- Playwright: seletores em 320, 390, 768 e 1920 px, nos dois temas; seleção de data/hora, minuto exato, atalhos, confirmação e ausência de overflow/cortes.
- Playwright: hover de abas e variantes terciária/texto; foco sem sombra ou outline adicional nos campos.
- Playwright: componentes da aba Aplicação nas oito combinações de largura/tema, incluindo editor, arquivo local, slider, variáveis, menu e diálogo.
- Playwright: 24 verificações dos cadastros reais de configurações, com dependências de dados substituídas por fixtures locais. Nenhuma escrita de produção é necessária.
- Testes focados: 11 aprovações, incluindo rascunho, confirmação e limites dos seletores.
- Última suíte completa anterior ao ajuste dos seletores: 1.708 aprovações e quatro falhas preexistentes (contratos de lembretes/campanhas e placeholder do editor de configurações).
- Typecheck possui duas incompatibilidades preexistentes de `Uint8Array<ArrayBufferLike>` em gravação de voz e exportação XLSX. Não foram ocultadas nem corrigidas fora do escopo visual.
- Lint: nenhum erro; quatro avisos preexistentes.
- Build, auditorias visual/de componentes e checagem de arquitetura: aprovados.
- Alinhamento: busca e filtros com a mesma posição e largura em 320 e 390 px; cabeçalhos de ordenação sem overflow.

As capturas desta etapa ficam em [screenshots/adoption-20261025](design-system/screenshots/adoption-20261025/README.md). Os exemplos e fixtures não comprovam todos os estados autenticados do CRM. A revisão de fluxos completos de cada módulo continua necessária quando seus layouts forem evoluídos.
