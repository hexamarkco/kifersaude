# Revisão visual — detalhe de lead

**Status: ficha completa e drawer comparados com as referências.** Esta entrega cobre o contexto `extra--leads-detalhe-pagina` e o estado `state--leads-detalhes`; outros estados do módulo, como edição, lembrete, exclusão e conversão, continuam pendentes.

## Referências

- [Ficha completa — desktop](../../../references/desktop/extra--leads-detalhe-pagina.png)
- [Ficha completa — mobile](../../../references/mobile/extra--leads-detalhe-pagina.png)
- [Drawer sobre a listagem — desktop](../../../references/desktop/state--leads-detalhes.png)
- [Drawer sobre a listagem — mobile](../../../references/mobile/state--leads-detalhes.png)

## Resultado e adaptações

- A ficha completa oferece cabeçalho, abas de visão geral, histórico, follow-ups e dados, com edição e ações contextuais preservadas.
- Ao abrir detalhes na listagem, o lead aparece em drawer à direita e a tabela permanece visível ao fundo. O menu do drawer oferece “Abrir ficha completa”; a mudança para a ficha em página fecha o drawer e oculta a listagem.
- No drawer, cancelar fecha sem alterar o registro, editar chama o fluxo existente e excluir continua sujeito à permissão existente e disponível no menu contextual.
- Em 320 px, três abas permanecem inteiras e a quarta pode ser alcançada por rolagem horizontal localizada. A grade de campos passa a uma coluna estreita; o conteúdo do drawer rola internamente e o rodapé continua acessível.
- Os exemplos usam o contato sintético `Contato Demonstração 01`; nenhuma alteração foi persistida e nenhuma ação destrutiva foi acionada.

## Cobertura de capturas

Há **53 screenshots** na pasta:

- `desktop/`, `tablet/`, `mobile/` e `mobile-320/`: ficha em página completa e viewport, além do drawer sobre a lista, nos temas claro e escuro.
- `states/`: quatro abas da ficha nos temas claro e escuro em desktop, 390 px e 320 px; menu de ações do drawer em desktop claro/escuro e mobile 320; final da rolagem interna do drawer em 320 px nos dois temas.
- Viewports: 1920×1080, 768×1024, 390×844 e 320×640.
- Medidas do drawer: 544 px em desktop/tablet, 380 px em 390 px e 310 px em 320 px. O documento não ultrapassou a largura do layout em nenhum dos oito pares de tema e viewport. Em 390 e 320 px, a área do drawer rola internamente para que o rodapé não encubra o conteúdo.

O inventário máquina-legível, com os caminhos das imagens e medições responsivas, está em [`coverage.json`](coverage.json).

## Verificação funcional

Playwright confirmou que a lista continua visível com o drawer aberto, que o menu “Abrir ficha completa” alterna para a página e que a listagem é ocultada nessa apresentação. As verificações não salvaram, excluiram, converteram nem enviaram dados. A suíte completa passou **1.732/1.732 testes em 328 arquivos**; typecheck, lint, build, arquitetura e migrations também passaram.
