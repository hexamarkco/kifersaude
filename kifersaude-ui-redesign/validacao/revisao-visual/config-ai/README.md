# Configurações — IA

Revisão desktop-first da página real de IA em [`/painel/automacoes?tab=ai`](../../../../src/features/config/ai/AiConfigScreen.tsx), comparada com as referências [`desktop`](../../../references/desktop/page--config-ai.png) e [`mobile`](../../../references/mobile/page--config-ai.png). O escopo desta entrega é somente esta página e seus overlays; as outras páginas do CRM não foram redesenhadas.

## Página e componentes revisados

- Cabeçalho, navegação entre Automações/Integrações/IA, resumo de disponibilidade, abas de funcionalidades/configurações globais, busca, categorias e estado sem resultados.
- Cartões reais de funcionalidades com estados ativo, parcial, inativo/rascunho e indisponível, além das ações contextuais.
- Configurações globais em campos separados, com instruções de ajuda dentro do ícone, estado alterado, salvar, feedback de sucesso e erro contextual junto ao campo.
- Drawer real de edição da funcionalidade, grupos de campos, roteamento/modelo personalizado, seletor de modelo, seletor de raciocínio, tooltips, histórico, restauração padrão e ações fixas.
- Confirmações de ativação/desativação e prévia de importação. Todos foram abertos e capturados; a confirmação foi cancelada, sem alterar dados.
- Skeleton de carregamento, falhas de carregamento e retry, validação de prompt vazio, busca sem resultado e falha de gravação. Erros persistentes de salvamento aparecem junto ao respectivo campo e limpam quando o conteúdo é alterado.

## Evidências

Playwright foi executado em shell local com `Layout`, `ConfigPageScreen`, `AiConfigScreen` e componentes de produção. A fixture contém apenas dados sintéticos, bloqueia tráfego externo e faz operações de gravação falharem intencionalmente. A captura aguardou fontes, conteúdo e componentes; full-page foi usado para a página e configurações completas. Modais e drawer foram registrados em capturas de viewport/rolagem para preservar o estado interativo.

| Grupo | Capturas |
| --- | --- |
| Página completa e viewport | [Desktop claro completo](full-desktop-1920-light.png) · [desktop claro viewport](viewport-desktop-1920-light.png) · [desktop escuro completo](full-desktop-1920-dark.png) · [desktop escuro viewport](viewport-desktop-1920-dark.png) · [tablet completo](full-tablet-768-light.png) · [tablet viewport](viewport-tablet-768-light.png) · [mobile 390 completo](full-mobile-390-light.png) · [mobile 390 viewport](viewport-mobile-390-light.png) · [mobile 320 completo](full-mobile-320-light.png) · [mobile 320 viewport](viewport-mobile-320-light.png) |
| Configurações globais | [Desktop claro](global-config-desktop-1920-light.png) · [desktop claro completo](global-config-desktop-1920-light-full.png) · [desktop escuro](global-config-desktop-1920-dark.png) · [desktop escuro completo](global-config-desktop-1920-dark-full.png) · [mobile](global-config-mobile-390-light.png) · [mobile completo](global-config-mobile-390-light-full.png) · [alteração local pendente](global-config-dirty-desktop.png) · [erro de salvamento](global-config-save-error-desktop.png) |
| Drawer de edição | [Desktop](editor-mensagem-viewport-desktop.png) · [fim do drawer desktop](editor-mensagem-bottom-desktop.png) · [tema escuro](editor-mensagem-desktop-dark.png) · [mobile 390](editor-mensagem-mobile-390.png) · [mobile 390 no fim](editor-mensagem-mobile-390-bottom.png) · [mobile compacto 320](editor-mensagem-mobile-320.png) · [restauração de padrões e toast](editor-reset-defaults-desktop.png) |
| Confirmações e importação | [Confirmar ativação desktop](confirm-activate-desktop.png) · [confirmar ativação mobile](confirm-activate-mobile-390.png) · [confirmar desativação](confirm-deactivate-desktop.png) · [prévia de importação desktop](import-preview-desktop.png) · [prévia de importação mobile](import-preview-mobile-390.png) |
| Estados e seletores | [tooltip de instruções](help-prompt-tooltip-desktop.png) · [modelo aberto](model-selector-desktop.png) · [raciocínio aberto](reasoning-selector-desktop.png) · [busca sem resultado](search-empty-desktop.png) · [erro de carregamento das funcionalidades](load-error-features-desktop.png) · [erro de configurações globais](load-error-global-desktop.png) · [skeleton](loading-skeleton-desktop.png) · [validação desktop](validation-missing-prompt-desktop.png) · [validação mobile](validation-missing-prompt-mobile-390.png) · [exportação sintética concluída](export-complete-desktop.png) |

## Responsividade e segurança

- Viewports: **1920×1080**, **768×1024**, **390×844** e **320×640**. Tema claro em todas; tema escuro no desktop e no drawer. A medição do documento ficou 10 px abaixo do viewport por causa da calha de rolagem do Chromium (1920/1910, 768/758, 390/380, 320/310); nenhum elemento ultrapassou a largura útil.
- Em 320 px, os controles do resumo não comprimem rótulos e o rodapé do drawer empilha os botões; em 390 px, os três botões permanecem em áreas de toque independentes.
- Toasts do drawer ficam acima do rodapé fixo. Nas capturas desktop, a borda ficou 14 px acima do footer. Erros de salvamento e validação foram movidos para alertas junto aos campos, sem cobrir ações.
- Não havia sessão autenticada disponível para esta validação visual. Não foram usados dados de clientes, credenciais ou serviços externos; ativação, desativação e importação permaneceram sem confirmação.

## Interações exercitadas

- Navegação de abas e busca vazia.
- Abertura e rolagem do drawer, tooltips e seletores de modelo/raciocínio.
- Confirmações de ativação e desativação, ambas canceladas.
- Prévia de importação sintética, cancelada sem aplicar dados.
- Campos globais alterados localmente; salvamento de falha verificou o feedback sem gravar. Prompt vazio exibiu mensagem de validação.
- Restauração de padrões e exportação de configuração sintética; nenhum dado real foi exportado.
- Estados de carregamento, falha e retry testados com respostas sintéticas.

## Gates

- Testes focados de `src/features/config/ai`: **24/24 passaram em 6 arquivos**.
- `npm run typecheck`: passou.
- ESLint nos arquivos TS/TSX alterados: passou. O ESLint não configura CSS; por isso `operational.css` foi validado no build e auditorias CSS existentes.
- `npm run build`: passou, incluindo `secrets:check`, auditorias visual/Design System e verificação do bundle do editor. Permanece o aviso existente de chunk vendor acima de 500 kB.

## Limitações

- A montagem visual usou a página e componentes reais em shell local; não confirma carregamento autenticado nem gravação de produção.
- Exportação permanece uma ação de download e não é um modal; o download exercitado continha somente a fixture sintética local.
- Este status cobre apenas Configurações de IA. As demais páginas e respectivos overlays continuam a ser revisados um módulo por vez.
