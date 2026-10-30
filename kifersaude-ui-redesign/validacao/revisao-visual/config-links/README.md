# Revisão visual — Links públicos

O componente real de Links públicos foi organizado para aproximar a hierarquia e a densidade das referências [desktop](../../../references/desktop/page--config-links.png) e [mobile](../../../references/mobile/page--config-links.png), usando os componentes do design system. A implementação mantém os dados e as ações existentes. A revisão integrada no shell autenticado continua pendente: `/painel/config?tab=links` redirecionou para a tela de login nesta sessão.

## Resultado

- `PageHeader` posiciona título, descrição e a ação principal “Novo link”.
- O perfil público permanece editável em uma seção recolhível, indicando se a página está publicada.
- A lista mantém ordem, data de atualização, status e ações. Cada link também exibe sua quantidade de cliques.
- A busca filtra nome e endereço localmente. No desktop, a lista usa tabela; abaixo do breakpoint do contêiner, usa cards com reordenação, status e ações acessíveis.
- Edição continua inline; criação e confirmação de exclusão mantêm os fluxos já existentes. Dados, permissões, upload e gravações continuam usando `linksService` e os serviços atuais.
- Ações por registro usam `RecordActions`; campos, diálogo, busca, tabela, cards e disclosure são do design system.

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

## Verificações e limitações

- Playwright mediu `document.documentElement.scrollWidth` igual à largura do viewport em 320, 390 e 768 px. As capturas também cobrem 1920 px.
- Testes focalizados: 2/2 passaram. Typecheck passou. `npm run lint` passou sem erros e apresentou cinco avisos preexistentes de Fast Refresh em fixtures de `output/playwright`.
- As capturas são da página e dos componentes reais, mas usam dados sintéticos e omitem o shell principal do CRM. A rota autenticada não pôde ser aberta nesta sessão; confirmar a página integrada no shell permanece pendente no manifesto.
