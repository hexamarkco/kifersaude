# Configurações — revisão visual

Comparação com as referências da pasta `references/` e conferência dos fluxos reais em `http://127.0.0.1:5177`. Nesta rodada, a tela foi capturada no shell real da aplicação usando configuração sintética: as requisições externas foram bloqueadas e nenhuma preferência ou cadastro foi salvo. As capturas são full-page, com fontes carregadas e movimento reduzido.

## Preferências do sistema

Referências: `references/desktop/page--config-system.png` e `references/mobile/page--config-system.png`.

| Resolução / tema | Captura |
| --- | --- |
| 1920×1080 claro | [preferencias-desktop-1920.png](preferencias-desktop-1920.png) |
| 1920×1080 escuro | [preferencias-desktop-1920-dark.png](preferencias-desktop-1920-dark.png) |
| 768×1024 claro | [preferencias-tablet-768.png](preferencias-tablet-768.png) |
| 390×844 claro | [preferencias-mobile-390.png](preferencias-mobile-390.png) |
| 320×640 claro | [preferencias-mobile-320.png](preferencias-mobile-320.png) |

### Capturas integradas no shell — 30/10/2026

| Resolução / tema | Capturas |
| --- | --- |
| Desktop claro — 1920×1080 | [página completa](shell-general-desktop-light-1920x1080.png) · [viewport](shell-general-desktop-light-viewport-1920x1080.png) |
| Desktop escuro — 1920×1080 | [página completa](shell-general-desktop-dark-1920x1080.png) |
| Tablet claro — 768×1024 | [página completa](shell-general-tablet-light-768x1024.png) · [viewport](shell-general-tablet-light-viewport-768x1024.png) |
| Mobile claro — 390×844 | [página completa](shell-general-mobile-light-390x844.png) · [viewport](shell-general-mobile-light-viewport-390x844.png) |
| Compacto claro — 320×640 | [página completa](shell-general-compact-light-320x640.png) · [viewport](shell-general-compact-light-viewport-320x640.png) |
| Atalho em hover, tema claro | [padding e contorno](settings-catalog-link-padding-hover.png) |

As capturas integradas usam `Layout` e `ConfigPageScreen` reais com serviços de configuração substituídos por dados sintéticos. Uma regra do Playwright bloqueia requisições externas e a fixture bloqueia gravações. A rota autenticada não foi usada nesta validação.

O conteúdo preserva as preferências reais de formato de data, fuso horário, sessão e notificações. O painel “Estrutura e parametrização” leva a acessos e cadastros já existentes. A faixa secundária e a busca ficam fora da visão inicial quando a pessoa está nas preferências; os atalhos do painel mantêm acesso aos demais grupos e reduzem uma camada de navegação nessa página.

Os cinco atalhos do painel compartilham o componente `SettingsCatalogLink`. O botão clicável fica com padding zero; o conteúdo interno usa o token `kds-card-padding-md` para manter título, descrição e seta afastados 20 px do contorno. Texto, ícone, rótulos, contagens, destinos e regras de visibilidade por permissão foram preservados. Playwright confirmou 20 px de recuo nos dois lados e capturou o estado de hover:

| Componente / viewport | Captura |
| --- | --- |
| Atalhos, desktop 1920 × 1080, claro | [settings-catalog-links-desktop-light.png](settings-catalog-links-desktop-light.png) |
| Atalhos, desktop 1920 × 1080, escuro | [settings-catalog-links-desktop-dark.png](settings-catalog-links-desktop-dark.png) |
| Atalhos, mobile 390 × 844, claro | [settings-catalog-links-mobile-light.png](settings-catalog-links-mobile-light.png) |
| Atalhos, mobile 390 × 844, escuro | [settings-catalog-links-mobile-dark.png](settings-catalog-links-mobile-dark.png) |
| Atalho em hover, desktop 1920 × 1080, escuro | [settings-catalog-link-hover-desktop-dark.png](settings-catalog-link-hover-desktop-dark.png) |
| Atalho em hover, mobile 390 × 844, claro | [settings-catalog-link-hover-mobile-light.png](settings-catalog-link-hover-mobile-light.png) |

A faixa de volume agora usa `kds-slider`, com trilho e indicador terracota e sem a borda de campo de texto. O comportamento do controle e as preferências não foram alterados.

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
- O shell local registrou erros de WebSocket do Realtime e um aviso de ciclo de vida do React em Strict Mode; não bloquearam as capturas nem a navegação verificada. As requisições externas foram bloqueadas durante a prévia sintética.
- Cobertura e metadados por captura: [coverage.json](coverage.json).
