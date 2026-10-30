# Chat e testes de IA

Rota revisada: `/chat`. Referências comparadas: [`page--chat-ia` desktop](../../../references/desktop/page--chat-ia.png) e [`page--chat-ia` mobile](../../../references/mobile/page--chat-ia.png).

O chat agora usa o shell compartilhado do CRM, o breadcrumb do próprio contexto e componentes existentes do design system para cabeçalho, cartões, composer, alertas, drawers e confirmação. A tela continua sendo uma simulação: os exemplos desta revisão usam somente dados sintéticos do ambiente local. Nenhuma mensagem foi enviada, nenhum cenário foi executado e a exclusão exibida foi cancelada.

## Capturas

| Estado | Captura |
| --- | --- |
| Estado inicial, desktop 1920 × 1080, claro | [route-shell-desktop-viewport.png](route-shell-desktop-viewport.png) |
| Estado inicial, desktop 1920 × 1080, escuro | [route-shell-desktop-dark-1920.png](route-shell-desktop-dark-1920.png) |
| Conversa simulada e resultado, desktop 1920 × 1080, claro | [route-active-conversation-desktop-1920.png](route-active-conversation-desktop-1920.png) |
| Conversa simulada e resultado, desktop 1920 × 1080, escuro | [route-active-conversation-desktop-dark-1920.png](route-active-conversation-desktop-dark-1920.png) |
| Conversa, tablet 768 × 1024 | [route-active-conversation-tablet-768.png](route-active-conversation-tablet-768.png) |
| Conversa, mobile 390 × 844 | [route-active-conversation-mobile-390.png](route-active-conversation-mobile-390.png) |
| Composer ao rolar, mobile 390 × 844 | [route-active-conversation-mobile-390-composer.png](route-active-conversation-mobile-390-composer.png) |
| Conversa, mobile 320 × 640 | [route-active-conversation-mobile-320.png](route-active-conversation-mobile-320.png) |
| Composer empilhado, mobile 320 × 640 | [route-active-conversation-mobile-320-composer.png](route-active-conversation-mobile-320-composer.png) |
| Histórico aberto, desktop 1920 × 1080 | [history-drawer-desktop-1920.png](history-drawer-desktop-1920.png) |
| Histórico aberto, mobile 390 × 844 | [history-drawer-mobile-390.png](history-drawer-mobile-390.png) |
| Cenários disponíveis, desktop 1920 × 1080 | [scenario-drawer-desktop-1920.png](scenario-drawer-desktop-1920.png) |
| Cenários disponíveis, mobile 390 × 844 | [scenario-drawer-mobile-390.png](scenario-drawer-mobile-390.png) |
| Confirmação de exclusão, desktop 1920 × 1080 | [confirmation-delete-desktop-1920.png](confirmation-delete-desktop-1920.png) |
| Confirmação de exclusão, mobile 390 × 844 | [confirmation-delete-mobile-390.png](confirmation-delete-mobile-390.png) |
| Confirmação de exclusão, mobile 320 × 640 | [confirmation-delete-mobile-320.png](confirmation-delete-mobile-320.png) |
| Shell responsivo, tablet 768 × 1024 | [route-shell-tablet-768.png](route-shell-tablet-768.png) |
| Shell responsivo, mobile 390 × 844 | [route-shell-mobile-390.png](route-shell-mobile-390.png) |
| Shell responsivo, mobile 320 × 640 | [route-shell-mobile-320.png](route-shell-mobile-320.png) |

## Validação e adaptações

- Playwright verificou a rota em 1920 × 1080, 768 × 1024, 390 × 844 e 320 × 640. A largura do documento nunca ultrapassou a viewport; fontes carregadas antes das capturas.
- O composer fica em linha em 390 px; abaixo de 380 px, o botão de envio passa para uma linha própria para preservar largura útil do campo.
- O drawer de cenários apresenta busca e grupos. A captura não seleciona cenário porque essa ação executaria a simulação.
- O histórico abre e mantém a conversa sintética. O diálogo de exclusão foi aberto e fechado por “Manter simulação”.
- As imagens são capturas de viewport. A captura fullPage não é usada como evidência porque elementos fixos do shell aparecem no meio do documento e distorcem a leitura; os trechos roláveis foram registrados em capturas próprias.
- Uma mensagem de console preexistente do React Strict Mode aponta `UNSAFE_componentWillMount` em `SideEffect(NullComponent2)`. Não impediu a navegação nem a renderização.
- A referência mostra uma simulação vazia; o estado ativo desta revisão documenta conversa e resultado sintéticos para cobrir mais componentes. A navegação e o cabeçalho continuam vindo do shell real do CRM, que é mais denso que o shell isolado da referência.

Medições, interações e limitações: [coverage.json](coverage.json).
