# Configurações — revisão visual

Comparação com as referências da pasta `references/` e conferência dos fluxos reais em `http://127.0.0.1:5177`. As capturas são full-page, com fontes carregadas e movimento reduzido. Nenhuma preferência ou cadastro foi salvo.

## Preferências do sistema

Referências: `references/desktop/page--config-system.png` e `references/mobile/page--config-system.png`.

| Resolução / tema | Captura |
| --- | --- |
| 1920×1080 claro | [preferencias-desktop-1920.png](preferencias-desktop-1920.png) |
| 1920×1080 escuro | [preferencias-desktop-1920-dark.png](preferencias-desktop-1920-dark.png) |
| 768×1024 claro | [preferencias-tablet-768.png](preferencias-tablet-768.png) |
| 390×844 claro | [preferencias-mobile-390.png](preferencias-mobile-390.png) |
| 320×640 claro | [preferencias-mobile-320.png](preferencias-mobile-320.png) |

O conteúdo preserva as preferências reais de formato de data, fuso horário, sessão e notificações. O painel “Estrutura e parametrização” leva a acessos e cadastros já existentes. A faixa secundária e a busca ficam fora da visão inicial quando a pessoa está nas preferências; os atalhos do painel mantêm acesso aos demais grupos e reduzem uma camada de navegação nessa página.

Os cinco atalhos do painel compartilham o componente `SettingsCatalogLink`. O texto e o ícone mantêm 12 px de respiro vertical e 16 px horizontal por tokens do design system; isso evita que rótulos encostem na borda. Os destinos, rótulos, contagens e regras de visibilidade por permissão foram preservados. Playwright conferiu o padding calculado e capturou uma prévia isolada do componente real em 1920 × 1080 e 390 × 844, nos temas claro e escuro, sem overflow. A captura integrada da página de configurações ainda depende de sessão autenticada.

| Componente / viewport | Captura |
| --- | --- |
| Atalhos, desktop 1920 × 1080, claro | [settings-catalog-links-desktop-light.png](settings-catalog-links-desktop-light.png) |
| Atalhos, desktop 1920 × 1080, escuro | [settings-catalog-links-desktop-dark.png](settings-catalog-links-desktop-dark.png) |
| Atalhos, mobile 390 × 844, claro | [settings-catalog-links-mobile-light.png](settings-catalog-links-mobile-light.png) |
| Atalhos, mobile 390 × 844, escuro | [settings-catalog-links-mobile-dark.png](settings-catalog-links-mobile-dark.png) |

## Origens dos leads

Referências: `references/desktop/page--config-leads-origins.png` e `references/mobile/page--config-leads-origins.png`.

| Resolução / tema | Captura |
| --- | --- |
| 1920×1080 claro | [origens-desktop-1920.png](origens-desktop-1920.png) |
| 768×1024 claro | [origens-tablet-768.png](origens-tablet-768.png) |
| 390×844 claro | [origens-mobile-390.png](origens-mobile-390.png) |
| 390×844 escuro | [origens-mobile-dark.png](origens-mobile-dark.png) |
| 320×640 claro | [origens-mobile-320.png](origens-mobile-320.png) |

A tela usa busca local, ordenação, disponibilidade, visibilidade para observadores e ações de edição/exclusão existentes. O mockup também mostra exportação e filtros por responsável/período; esses controles não existem nesse cadastro real e não foram simulados. A navegação real ainda tem três níveis (área, grupo de configuração e categoria do cadastro), mais densa que a referência. Essa diferença fica registrada para uma rodada de simplificação da navegação.

## Criar origem

Referências: `references/desktop/state--config-origem-criar.png` e `references/mobile/state--config-origem-criar.png`.

| Resolução / tema | Captura |
| --- | --- |
| 1920×1080 claro | [origem-criar-desktop-1920.png](origem-criar-desktop-1920.png) |
| 390×844 claro | [origem-criar-mobile-390.png](origem-criar-mobile-390.png) |

O formulário real pede somente o nome. A criação inicial define a origem como ativa e visível para observadores; descrição e status editável do mockup não existem nessa operação. O diálogo abriu nos dois tamanhos e fechou com Escape. Não foi enviada a ação “Adicionar”. Em mobile, o diálogo ocupa a altura da tela apesar de ter apenas um campo; precisa ser revisto junto ao padrão de diálogos compactos.

## Verificações e pendências

- Em 1920, 768, 390 e 320 px, a largura do documento ficou 10 px abaixo da viewport disponível por causa da barra de rolagem reservada; não houve overflow horizontal.
- A barra vertical de 1 px que aparecia ao lado das abas foi eliminada mantendo a rolagem horizontal.
- Os atalhos para “Origens dos leads” atualizam juntos os parâmetros `section` e `leadTab`; a abertura foi confirmada em desktop e 320 px.
- A navegação fixa inferior pode cruzar o cabeçalho do cartão seguinte na posição inicial de rolagem mobile. O conteúdo segue acessível ao rolar, mas o alinhamento inicial ainda merece uma revisão.
- O ambiente local registrou erros de WebSocket do Realtime e um aviso de ciclo de vida do React em Strict Mode; não bloquearam as capturas nem a navegação verificada.
- Cobertura e metadados por captura: [coverage.json](coverage.json).
