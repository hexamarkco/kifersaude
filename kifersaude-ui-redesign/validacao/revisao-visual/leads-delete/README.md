# Revisão visual — confirmação de exclusão de lead

O diálogo reutiliza `ConfirmDialog` e `ConfirmationSummary` da aplicação. A tela de fundo é uma referência estática da listagem de Leads; a confirmação foi renderizada com os componentes React reais e um nome fictício (`Contato de demonstração`). Esta fixture permite revisar o diálogo sem acesso à sessão autenticada local.

## Capturas Playwright

Todas as imagens abaixo são capturas `fullPage` feitas após estabilizar o conteúdo, em tema claro e escuro.

| Viewport | Tema claro | Tema escuro |
| --- | --- | --- |
| Desktop — 1920×1080 | [exclusao-lead-1920x1080-claro.png](screenshots/desktop/exclusao-lead-1920x1080-claro.png) | [exclusao-lead-1920x1080-escuro.png](screenshots/desktop/exclusao-lead-1920x1080-escuro.png) |
| Tablet — 768×1024 | [exclusao-lead-768x1024-claro.png](screenshots/tablet/exclusao-lead-768x1024-claro.png) | [exclusao-lead-768x1024-escuro.png](screenshots/tablet/exclusao-lead-768x1024-escuro.png) |
| Mobile — 390×844 | [exclusao-lead-390x844-claro.png](screenshots/mobile/exclusao-lead-390x844-claro.png) | [exclusao-lead-390x844-escuro.png](screenshots/mobile/exclusao-lead-390x844-escuro.png) |
| Mobile — 320×640 | [exclusao-lead-320x640-claro.png](screenshots/mobile-320/exclusao-lead-320x640-claro.png) | [exclusao-lead-320x640-escuro.png](screenshots/mobile-320/exclusao-lead-320x640-escuro.png) |

## Resultado e limites

- A largura desktop segue a referência (37rem / 592px); o conteúdo e as ações permanecem dentro do viewport até 320px.
- O tema do diálogo acompanha o tema do sistema.
- `Escape` fecha a confirmação. O botão destrutivo não foi acionado e nenhum registro foi removido.
- A rota real `/painel/leads` redireciona para login na sessão local disponível; a integração do diálogo dentro do shell autenticado continua pendente.

`preview.html` e `preview.tsx` são apenas a fixture reproduzível desta revisão visual; não fazem parte do fluxo do CRM.
