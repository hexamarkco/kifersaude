# Configurações — integrações

Revisão desktop-first da tela real `Integrações` em `/painel/automacoes?tab=integrations`, comparada com [`page--config-integrations.png`](../../../references/desktop/page--config-integrations.png) e sua referência mobile. A página agora abre na visão geral prevista no mockup e mantém os painéis existentes para WhatsApp, Meta Ads, inteligência artificial e rastreamento.

## O que foi revisado

- A visão geral mostra o estado de WhatsApp, Meta Ads e rastreamento; proteção de credenciais; sincronização, webhook e fila. Cada linha leva à configuração correspondente.
- Os painéis reais de WhatsApp, Meta Ads, IA e rastreamento continuam responsáveis por seus campos e operações. Dados de Meta usados no resumo são projetados para os indicadores, sem manter o snapshot completo no estado da página.
- Dados de IA e rastreamento são consultados somente quando a seção relevante é aberta; os indicadores de rastreamento também são carregados na visão geral.
- Controles reais verificados: abas da página, botão de atualizar conexão, switch local do WhatsApp, disclosures de suporte, seletores de lead/oportunidade/contrato, busca, seletor de modelo e tooltips.
- Nenhum modal ou drawer pertence a este fluxo; não há diálogo oculto a documentar. A configuração é feita dentro dos painéis da página.

## Evidências

As capturas foram feitas com Playwright em shell local usando `Layout`, `ConfigPageScreen`, `IntegrationsScreen` e componentes de produção. Os serviços são fixtures sintéticas: chamadas de gravação lançam erro e o tráfego externo é bloqueado. Nenhum segredo, credencial real, dado de cliente ou chamada comercial foi usado.

| Estado | Capturas |
| --- | --- |
| Visão geral, desktop claro | [viewport](current-shell/viewport-desktop-1920-light.png) · [página completa](current-shell/full-desktop-1920-light.png) |
| Visão geral, desktop escuro | [viewport](current-shell/viewport-desktop-1920-dark.png) · [página completa](current-shell/full-desktop-1920-dark.png) |
| Visão geral, tablet 768×1024 | [viewport](current-shell/viewport-tablet-768-light.png) · [página completa](current-shell/full-tablet-768-light.png) |
| Visão geral, mobile 390×844 | [viewport](current-shell/viewport-mobile-390-light.png) · [página completa](current-shell/full-mobile-390-light.png) |
| Visão geral, mobile 320×640 | [viewport](current-shell/viewport-mobile-320-light.png) · [página completa](current-shell/full-mobile-320-light.png) |
| Visão geral, mobile escuro | [viewport](current-shell/viewport-mobile-390-dark.png) · [página completa](current-shell/full-mobile-390-dark.png) |
| Visão geral com falha da API Meta | [estado de erro](current-shell/overview-meta-failure-desktop.png) |
| WhatsApp | [desktop viewport](current-shell/whatsapp-settings-desktop-1920.png) · [desktop completo](current-shell/whatsapp-settings-desktop-1920-full.png) · [mobile viewport](current-shell/whatsapp-settings-mobile-390.png) · [mobile completo](current-shell/whatsapp-settings-mobile-390-full.png) |
| WhatsApp, interações | [suporte avançado](current-shell/whatsapp-advanced-desktop.png) · [ajuda de configuração aberta](current-shell/whatsapp-setup-help-open-desktop.png) · [switch ativado localmente, sem salvar](current-shell/whatsapp-toggle-on-local-desktop.png) · [atualização de conexão em fixture](current-shell/whatsapp-health-refresh-complete-desktop.png) |
| Meta Ads | [desktop viewport](current-shell/meta-ads-settings-desktop-1920.png) · [desktop completo](current-shell/meta-ads-settings-desktop-1920-full.png) · [tooltip da seção](current-shell/meta-ads-section-tooltip-desktop.png) · [tooltip do painel](current-shell/meta-ads-panel-tooltip-desktop.png) |
| Meta Ads, seletores e formulário | [lead](current-shell/meta-ads-lead-dropdown-open-desktop.png) · [atribuição](current-shell/meta-ads-attribution-form-desktop-1920.png) · [atribuição completa](current-shell/meta-ads-attribution-form-desktop-1920-full.png) · [oportunidade](current-shell/meta-ads-opportunity-dropdown-open-desktop.png) · [contrato](current-shell/meta-ads-contract-dropdown-open-desktop.png) |
| Meta Ads, estados | [avaliação pronta localmente, sem registrar](current-shell/meta-ads-evaluation-ready-desktop.png) · [página completa](current-shell/meta-ads-evaluation-ready-desktop-full.png) · [detalhes de suporte](current-shell/meta-ads-support-details-open-desktop.png) · [busca sem resultados](current-shell/meta-ads-search-empty-desktop.png) · [ações de retry na falha sintética](current-shell/meta-ads-retry-actions-desktop.png) · [página completa](current-shell/meta-ads-retry-actions-desktop-full.png) |
| Inteligência artificial | [desktop viewport](current-shell/ai-provider-settings-desktop-1920.png) · [desktop completo](current-shell/ai-provider-settings-desktop-1920-full.png) · [tooltip](current-shell/ai-provider-section-tooltip-desktop.png) · [seletor de modelo aberto](current-shell/ai-model-dropdown-open-desktop.png) · [modelo trocado localmente, sem salvar](current-shell/ai-model-selection-local-desktop.png) |
| Rastreamento | [desktop viewport](current-shell/tracking-settings-desktop-1920.png) · [desktop completo](current-shell/tracking-settings-desktop-1920-full.png) |

## Responsividade e diferenças

Playwright aguardou `document.fonts.ready`, desabilitou animações e mediu o documento nas larguras 1920, 768, 390 e 320 px. O `scrollWidth` ficou 10 px abaixo do `innerWidth` por causa da calha da barra de rolagem; não foi identificado overflow horizontal. Temas claro e escuro foram conferidos no desktop; também houve captura escura em 390 px. Capturas full-page mobile foram feitas sem a navegação inferior fixa somente durante a captura para expor todo o conteúdo; a captura de viewport preserva a navegação real.

A comparação desktop mostra a mesma composição da referência: resumo em largura total, credenciais ocupando dois terços e diagnóstico ocupando um terço. O shell e a identidade do projeto continuam os reais. A referência mobile é usada para conferir adaptação, sem priorizar alterações mobile à frente do desktop.

## Limitações

- Não havia sessão autenticada disponível para carregar credenciais e dados reais; todas as informações visíveis são fixtures demonstrativas.
- Estados de validação da API e seletores foram inspecionados localmente. As ações de salvar, registrar avaliação ou alterar configuração não foram executadas.
- O botão de atualização de conexão e o switch foram verificados apenas contra a fixture local; isso não confirma comportamento de integração em produção.
- A tela não possui modal ou drawer próprio. Fluxos de páginas vizinhas serão revisados no contexto de cada tela.

Testes focados: **6/6**; typecheck e lint dos arquivos alterados passaram. `npm run build` passou, incluindo verificações de segredos, design system, hardcodes visuais e bundle do editor. O build ainda avisa que o chunk vendor ultrapassa 500 kB.
