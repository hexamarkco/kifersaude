# Configurações — Perfis e acessos

## Escopo

- Rota: `/painel/config?tab=system&section=access`
- Implementação: [`AccessControlManagerScreen.tsx`](../../../../src/features/config/general/AccessControlManagerScreen.tsx)
- Shell de configurações: `SystemSettingsScreen`

## Fluxos e componentes revisados

- Busca e seleção de perfil, busca de áreas e níveis de acesso por módulo.
- Diálogos reais de criação e edição de perfil, com nome, descrição e indicação de acesso administrativo.
- Validação de nome, erro de gravação e feedback de atualização de permissão junto ao controle relacionado.
- Menu de opções de acesso, foco inicial do formulário e confirmação de exclusão.
- Layout desktop, tablet e mobile, incluindo modal compacto e conteúdo com rolagem interna.

As permissões por área são gravadas ao alterar o seletor. Não há modal separado para editar permissões. A referência de permissões mostra um diálogo com status e campos que não pertencem ao modelo persistido. O showcase registra essa diferença; nenhum campo ou regra foi inventado para imitar o mockup.

## Capturas

As capturas usam uma fixture local sintética, sem sessão autenticada, gravação de dados, exclusão confirmada ou chamadas externas.

| Ambiente / estado | Evidência |
| --- | --- |
| Desktop 1920, página completa, claro | [full-desktop-1920-light.png](full-desktop-1920-light.png) |
| Desktop 1920, viewport, claro | [viewport-desktop-1920-light.png](viewport-desktop-1920-light.png) |
| Desktop 1920, página completa, escuro | [full-desktop-1920-dark.png](full-desktop-1920-dark.png) |
| Desktop 1920, viewport, escuro | [viewport-desktop-1920-dark.png](viewport-desktop-1920-dark.png) |
| Desktop 1440, página completa | [full-desktop-1440-light.png](full-desktop-1440-light.png) |
| Tablet 768, página completa | [full-tablet-768-light.png](full-tablet-768-light.png) |
| Mobile 390 e 320, páginas completas, viewports e modal de criação | [390 claro](full-mobile-390-light.png), [390 viewport](viewport-mobile-390-light.png), [320 claro](full-mobile-320-light.png), [320 viewport](viewport-mobile-320-light.png), [modal 390](create-dialog-mobile-390.png), [modal 320](create-dialog-mobile-320.png) |
| Menu de nível de acesso, desktop e mobile | [desktop](permission-menu-desktop.png), [mobile](permission-menu-mobile.png) |
| Criação de perfil, desktop e mobile | [desktop](create-dialog-desktop.png), [mobile 390](create-dialog-mobile-390.png) |
| Validação, edição e confirmação de exclusão | [validação](create-validation-desktop.png), [edição](edit-dialog-desktop.png), [exclusão](delete-confirmation-desktop.png) |

São **18 capturas** listadas. Os arquivos `create-modal-desktop-full.png`, `full-desktop-before.png`, `full-desktop.png`, `full-mobile-390.png`, `full-tablet-768.png` e `full-tablet.png` são duplicatas ou versões históricas e não contam como evidência atual.

## Verificação responsiva

- No modal de criação a 390 × 844, a caixa mede 358 × 526 px, fica centralizada, preserva o raio de 16 px e mantém o campo de nome em foco.
- No modal de criação a 320 × 640, a caixa mede 288 × 546 px, preserva o raio de 16 px e cabe no viewport sem rolagem horizontal.
- Os controles de permissão podem empilhar em larguras menores sem empurrar a descrição para fora da área visível.
- Nenhum conteúdo ultrapassou horizontalmente o viewport nas larguras capturadas. O scrollbar do navegador reduz a largura reportada pelo `documentElement` em 10 px, sem gerar rolagem horizontal.

## Limitações

- O formulário, o serviço de configuração e a listagem foram exercitados com fixture sintética; persistência e permissões no ambiente autenticado não foram verificadas.
- Não houve confirmação de exclusão nem alteração persistida de permissões.
- O modal de criação foi capturado no mobile após a última correção de raio. Edição e confirmação de exclusão foram capturadas em desktop; seus diálogos compartilham os mesmos padrões de largura e o mesmo estilo responsivo.
