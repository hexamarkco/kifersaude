# Revisão visual — Links públicos

O componente real de Links públicos foi organizado para aproximar a hierarquia e a densidade das referências [desktop](../../../references/desktop/page--config-links.png) e [mobile](../../../references/mobile/page--config-links.png), usando os componentes do design system. A implementação mantém os dados e as ações existentes. Nesta rodada, a tela foi capturada dentro do `Layout` e do `ConfigPageScreen` reais com serviços e registros sintéticos; a sessão autenticada de produção não foi usada.

## Resultado

- Quando usada isoladamente, a tela apresenta seu `PageHeader`; na aba de configurações, o cabeçalho compartilhado posiciona título, descrição, navegação entre áreas e a ação principal “Novo link”.
- O perfil público permanece editável em uma seção recolhível, indicando se a página está publicada.
- A lista mantém ordem, data de atualização, status e ações. Cada link também exibe sua quantidade de cliques.
- A busca filtra nome e endereço localmente. No desktop, a lista usa tabela; abaixo do breakpoint do contêiner, usa cards com reordenação, status e ações acessíveis.
- Edição continua inline; criação e confirmação de exclusão mantêm os fluxos já existentes. Dados, permissões, upload e gravações continuam usando `linksService` e os serviços atuais.
- Ações por registro usam `RecordActions`; campos, diálogo, busca, tabela, cards e disclosure são do design system.

## Integração ao cabeçalho das configurações — 30/10/2026

- `ConfigPageScreen` agora é a única responsável pelo cabeçalho na rota `/painel/config?tab=links`. O `PageHeader` interno de `LinksScreen` é ocultado somente quando a tela está embutida, evitando repetir título e descrição.
- A ação **Novo link** fica alinhada no cabeçalho compartilhado e controla o diálogo de criação já existente. Ao sair da aba, o diálogo fecha; o modo isolado da tela mantém seu comportamento anterior.
- Os testes de `ConfigPageScreen`, `LinksScreen` e `SettingsCatalogLink` passaram (**13/13**). A integração visual também foi registrada dentro do shell, sem depender de uma sessão autenticada.

## Capturas Playwright

As capturas usam `LinksScreen` real, estilos reais e registros fictícios isolados em uma fixture local. Não houve alterações em registros ou chamadas de escrita ao CRM.

| Resolução / estado | Capturas |
| --- | --- |
| Desktop claro — 1920 × 1080 | [viewport](desktop-light-viewport-1920x1080.png) · [página completa](desktop-light-1920x1080.png) |
| Desktop escuro — 1920 × 1080 | [página completa](desktop-dark-1920x1080.png) |
| Tablet — 768 × 1024 | [viewport](tablet-light-viewport-768x1024.png) · [página completa](tablet-light-768x1024.png) |
| Mobile — 390 × 844 | [viewport](mobile-light-viewport-390x844.png) · [página completa](mobile-light-390x844.png) |
| Mobile compacto — 320 × 640 | [viewport](mobile-light-viewport-320x640.png) · [página completa](mobile-light-320x640.png) |
| Criar link | [diálogo aberto](desktop-create-modal-1920x1080.png) |
| Ações de registro | [menu aberto](desktop-record-menu-1920x1080.png) |
| Edição | [edição inline](desktop-inline-edit-1920x1080.png) |
| Perfil público | [formulário expandido](desktop-profile-expanded-1920x1080.png) |
| Busca sem correspondências | [estado vazio da busca](desktop-search-empty-1920x1080.png) |
| Lista sem registros | [estado vazio](desktop-list-empty-1920x1080.png) |
| Carregamento / falha de leitura | [carregamento](desktop-loading-1920x1080.png) · [erro com ação de tentar novamente](desktop-error-1920x1080.png) |

### Composição dentro do shell

As imagens abaixo usam `Layout`, `ConfigPageScreen` e `LinksScreen` reais, com serviço substituído por fixture sintética. A prévia bloqueia qualquer requisição externa e gravação.

| Resolução / estado | Capturas |
| --- | --- |
| Desktop claro — 1920 × 1080 | [viewport](shell-desktop-light-viewport-1920x1080.png) · [página completa](shell-desktop-light-1920x1080.png) |
| Desktop escuro — 1920 × 1080 | [página completa](shell-desktop-dark-1920x1080.png) |
| Tablet claro — 768 × 1024 | [viewport](shell-tablet-light-viewport-768x1024.png) · [página completa](shell-tablet-light-768x1024.png) |
| Mobile claro — 390 × 844 | [viewport](shell-mobile-light-viewport-390x844.png) · [página completa](shell-mobile-light-390x844.png) |
| Mobile compacto — 320 × 640 | [viewport](shell-compact-light-viewport-320x640.png) · [página completa](shell-compact-light-320x640.png) |
| Diálogo de criação no shell | [página completa com diálogo](shell-desktop-create-dialog-1920x1080.png) |

## Verificações e limitações

- Playwright confirmou um único título principal, cabeçalho compartilhado e ausência de overflow horizontal em 320, 390, 768 e 1920 px. O tema escuro e o diálogo de criação foram conferidos em 1920 px.
- Testes focalizados: 3/3 da tela de links e 9/9 da composição de configurações passaram. Typecheck passou. O lint direcionado passou sem erros.
- A página e o shell usam componentes reais com dados sintéticos. A fixture bloqueia gravações e o navegador bloqueia tráfego externo. A sessão autenticada não foi usada; dados, permissões e serviços reais não fazem parte desta captura.
