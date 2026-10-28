# Configurações — usuários e permissões

Comparação da tela real de usuários com `references/desktop/page--config-users.png`, `references/mobile/page--config-users.png` e os estados de criação/edição. O código preserva os campos, permissões e ações disponíveis no CRM; controles que aparecem no mockup, mas não existem nesta feature, não foram inventados.

## O que foi verificado

- O `PageHeader` do módulo mantém título e descrição; a ação “Novo usuário” aparece somente quando o perfil pode editar usuários. A aba interna não repete o cabeçalho.
- A busca e a contagem ficam agrupadas acima da lista. A listagem real apresenta usuário, e-mail, perfil, data de criação e ações disponíveis; ordenação e ações permanecem ligadas aos componentes reais.
- Em telas estreitas, os registros viram cartões com identidade e perfil agrupados e ações em uma linha separada. Busca sem correspondências agora explica que nenhum usuário foi encontrado.
- Os formulários reais mantêm nome, e-mail, perfil e senha temporária exigida na criação. Na edição, senha em branco continua significando “manter a senha atual”. O perfil vem das permissões dinâmicas disponíveis.
- O seletor de perfil foi verificado aberto em 1920, 390 e 320 px. A confirmação curta de exclusão foi mantida como modal compacto em 320, 390 e 768 px; cancelar/Escape fecham sem executar a exclusão.
- As capturas de página e os formulários cobrem 1920, 768, 390 e 320 px. A página também foi capturada no tema escuro em desktop e mobile.

## Diferenças registradas em relação à referência

- A referência inclui filtros por status, responsável e período, exportação e paginação. A implementação atual não possui essas capacidades nesta tela; elas não foram simuladas.
- A referência não apresenta senha na criação; o CRM exige uma senha temporária para criar a conta. A edição preserva a regra atual de senha opcional.
- A navegação existente usa as abas reais Geral, Usuários, Links e Formulários. A estrutura não foi redesenhada fora do contexto desta entrega.

## Evidência

As capturas foram feitas com Playwright usando `ConfigPageScreen`, `UsersScreen` e os componentes/tokens reais do Design System. A prévia isolada usa registros sintéticos (`example.invalid`) e repositórios/contextos simulados; não inclui o shell global autenticado do CRM. Nenhuma criação, edição ou exclusão foi confirmada e nenhuma chamada de escrita foi realizada.

| Arquivo | Conteúdo | Resolução |
| --- | --- | --- |
| `desktop/page--config-users.png` | Listagem | 1920×1080, fullPage |
| `desktop/page--config-users-busca-vazia.png` | Busca sem resultados | 1920×1080, fullPage |
| `desktop/state--usuarios-criar.png` | Formulário de criação | 1920×1080 |
| `desktop/state--usuarios-criar-perfil.png` | Perfil aberto na criação | 1920×1080 |
| `desktop/state--usuarios-editar.png` | Formulário de edição | 1920×1080 |
| `desktop/state--usuarios-excluir-confirmacao.png` | Confirmação de exclusão | 1920×1080 |
| `tablet/page--config-users.png` | Listagem | 768×1024, fullPage |
| `tablet/state--usuarios-criar.png` | Formulário de criação | 768×1024 |
| `tablet/state--usuarios-editar.png` | Formulário de edição | 768×1024 |
| `tablet/state--usuarios-excluir-confirmacao.png` | Confirmação de exclusão | 768×1024 |
| `mobile/page--config-users.png` | Listagem | 390×948, fullPage |
| `mobile/page--config-users-busca-vazia.png` | Busca sem resultados | 390×844 |
| `mobile/state--usuarios-criar.png` | Formulário de criação | 390×844 |
| `mobile/state--usuarios-criar-perfil.png` | Perfil aberto na criação | 390×844 |
| `mobile/state--usuarios-editar.png` | Formulário de edição | 390×844 |
| `mobile/state--usuarios-excluir-confirmacao.png` | Confirmação de exclusão | 390×844 |
| `mobile-320/page--config-users.png` | Listagem | 320×1010, fullPage |
| `mobile-320/page--config-users-busca-vazia.png` | Busca sem resultados | 320×640 |
| `mobile-320/state--usuarios-criar.png` | Formulário de criação | 320×640 |
| `mobile-320/state--usuarios-criar-perfil.png` | Perfil aberto na criação | 320×640 |
| `mobile-320/state--usuarios-editar.png` | Formulário de edição | 320×640 |
| `mobile-320/state--usuarios-excluir-confirmacao.png` | Confirmação de exclusão | 320×640 |
| `dark/desktop/page--config-users.png` | Listagem no tema escuro | 1920×1080, fullPage |
| `dark/mobile/page--config-users.png` | Listagem no tema escuro | 390×948, fullPage |

Cobertura por screenshot e medidas responsivas: [`coverage.json`](coverage.json).
