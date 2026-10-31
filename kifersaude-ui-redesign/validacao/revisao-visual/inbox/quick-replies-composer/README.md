# Sugestões de mensagens rápidas no compositor

Capturas `fullPage` do compositor real do Inbox e do modal real de gerenciamento, usando somente respostas sintéticas e callbacks locais. Fontes aguardadas, animações desativadas e nenhuma mensagem enviada ou configuração persistida.

| Captura | Resolução | Seção/estado |
| --- | --- | --- |
| [desktop-dark-1920.png](desktop-dark-1920.png) | 1920×1080 | Sugestões abertas, tema escuro |
| [desktop-light-1920.png](desktop-light-1920.png) | 1920×1080 | Sugestões abertas, tema claro |
| [tablet-light-768.png](tablet-light-768.png) | 768×1024 | Sugestões abertas, tema claro |
| [mobile-light-390.png](mobile-light-390.png) | 390×844 | Sugestões abertas, tema claro |
| [mobile-light-320.png](mobile-light-320.png) | 320×640 | Sugestões abertas na largura mínima |
| [desktop-light-sem-resultado.png](desktop-light-sem-resultado.png) | 1920×1080 | Busca sem correspondências |
| [desktop-light-vazio.png](desktop-light-vazio.png) | 1920×1080 | Nenhuma resposta cadastrada |
| [desktop-light-erro-carregamento.png](desktop-light-erro-carregamento.png) | 1920×1080 | Falha ao carregar, com opção de tentar novamente |
| [desktop-light-resposta-inserida-nao-enviada.png](desktop-light-resposta-inserida-nao-enviada.png) | 1920×1080 | Texto inserido no rascunho, ainda não enviado |
| [desktop-light-gerenciar-modal.png](desktop-light-gerenciar-modal.png) | 1920×1080 | Modal de gerenciamento aberto pelo compositor |
| [mobile-light-gerenciar-modal.png](mobile-light-gerenciar-modal.png) | 390×844 | Modal ocupando a viewport, com ações fixas |

## Interações verificadas

- `/` abre a lista; digitar um termo filtra sugestões.
- Setas alteram a opção ativa; Enter e clique inserem o texto no campo sem enviar.
- Escape fecha a lista e fecha o modal de gerenciamento.
- **Gerenciar** abre `WhatsAppQuickRepliesModal`; salvar na prévia altera apenas o estado local.
- A lista acessível mantém o compositor relacionado ao `listbox` e à opção ativa.

## Medições responsivas

| Viewport | Largura do documento | Largura da lista |
| --- | ---: | ---: |
| 1920×1080 | 1920 px | 745 px |
| 768×1024 | 768 px | 489 px |
| 390×844 | 390 px | 314 px |
| 320×640 | 320 px | 244 px |

Não houve overflow horizontal. A captura de referência atribuída a `state--inbox-mensagens-rapidas` é duplicada de `state--inbox-filtros`; por isso, estas evidências documentam o componente real, mas não afirmam paridade com uma referência visual válida.
