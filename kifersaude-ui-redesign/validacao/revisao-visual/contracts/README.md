# Revisão visual — Contratos

**Status parcial do módulo.** O drawer de detalhes e o importador JSON em lote foram comparados com as referências. A listagem e o cadastro continuam pendentes; o redesign integral do CRM segue em andamento.

## Referências

- [Listagem desktop](../../../references/desktop/page--contratos-listagem.png) · [Listagem mobile](../../../references/mobile/page--contratos-listagem.png)
- [Detalhes desktop](../../../references/desktop/state--contratos-detalhes.png) · [Detalhes mobile](../../../references/mobile/state--contratos-detalhes.png)
- [Importação desktop](../../../references/desktop/state--contratos-importacao.png) · [Importação mobile](../../../references/mobile/state--contratos-importacao.png)

## Resultado da comparação

- **Drawer de detalhes — revisado com adaptações.** A largura, a hierarquia de resumo, participantes, plano e ações se aproximam da referência. Informações financeiras, documentos e histórico ficam recolhidos, preservando os dados reais e reduzindo ruído. A base atual não armazena status individual para cada participante, então esses status do mockup não são inventados.
- **Importação em lote — revisada com adaptações.** A estrutura compacta de formato, escolha do arquivo e ações segue a referência. O fluxo real exige JSON, oferece modelo e validação prévia e limita o lote; esses requisitos são mantidos em vez de substituir a funcionalidade por campos genéricos do mockup.
- **Listagem — pendente.** A densidade, a grade 2×2 de indicadores e os filtros compactos foram aproximados. O cabeçalho mobile global ainda difere da referência: faltam a marca, o acionador do menu e o perfil no topo. Resolver essa diferença no shell compartilhado e então repetir a comparação antes de aprovar a listagem.
- **Cadastro — pendente de comparação.** As páginas foram capturadas, mas esta rodada ainda não comparou seus grupos de campos e estados com a referência correspondente.

## Segurança e funcionamento

Capturas usam dados sintéticos do ambiente local. Foram abertos o drawer e o importador; a importação de arquivo foi validada com fixtures locais, mas o comando final de importação não foi acionado. Nenhum contrato foi criado, alterado ou excluído, e nenhuma integração externa foi chamada.

O drawer foi rolado até o conteúdo final em 320 px, preservando o rodapé fixo; Escape e cancelar fecham sem gravar. O importador foi conferido nos temas claro/escuro e nas larguras de 1920, 768, 390 e 320 px. O estado de arquivo inválido e a prévia válida foram gerados com dados sintéticos.

## Capturas

Todos os arquivos citados estão em [`screenshots/`](screenshots/). Os caminhos são relativos a esta pasta de documentação.

### Desktop (1920 × 1080)

- Listagem: [claro](screenshots/desktop/listagem.png), [escuro](screenshots/desktop/listagem-dark.png), [filtros expandidos](screenshots/desktop/filtros-expandidos.png), [filtro de status aberto](screenshots/desktop/filtro-status-aberto.png)
- Estados da linha: [status aberto](screenshots/desktop/contrato-status-aberto.png), [calendário aberto](screenshots/desktop/contrato-calendario-aberto.png)
- Drawer: [claro](screenshots/desktop/detalhes-drawer.png), [escuro](screenshots/desktop/detalhes-drawer-dark.png)
- Cadastro: [claro](screenshots/desktop/contrato-criar-pagina.png), [escuro](screenshots/desktop/contrato-criar-pagina-dark.png)
- Importação: [vazia](screenshots/desktop/importacao-modal.png), [escura](screenshots/desktop/importacao-modal-dark.png), [carregando](screenshots/desktop/importacao-modal-carregando.png), [arquivo inválido](screenshots/desktop/importacao-modal-erro.png), [prévia válida](screenshots/desktop/importacao-modal-validado.png)

### Tablet (768 × 1024)

- Listagem: [claro](screenshots/tablet/listagem.png), [escuro](screenshots/tablet/listagem-dark.png)
- Drawer: [claro](screenshots/tablet/detalhes-drawer.png), [escuro](screenshots/tablet/detalhes-drawer-dark.png)
- Cadastro: [página](screenshots/tablet/contrato-criar-pagina.png)
- Importação: [clara](screenshots/tablet/importacao-modal.png), [escura](screenshots/tablet/importacao-modal-dark.png)

### Mobile (390 × 844)

- Listagem: [página](screenshots/mobile/listagem.png), [viewport](screenshots/mobile/listagem-viewport.png), [página escura](screenshots/mobile/listagem-dark.png), [viewport escuro](screenshots/mobile/listagem-viewport-dark.png)
- Drawer: [claro](screenshots/mobile/detalhes-drawer.png), [escuro](screenshots/mobile/detalhes-drawer-dark.png)
- Cadastro: [página](screenshots/mobile/contrato-criar-pagina.png), [viewport](screenshots/mobile/contrato-criar-pagina-viewport.png)
- Importação: [vazia](screenshots/mobile/importacao-modal.png), [escura](screenshots/mobile/importacao-modal-dark.png), [arquivo inválido](screenshots/mobile/importacao-modal-erro.png), [prévia válida](screenshots/mobile/importacao-modal-validado.png)

### Mobile compacto (320 × 640)

- Listagem: [página](screenshots/mobile-320/listagem.png), [viewport](screenshots/mobile-320/listagem-viewport.png), [viewport após ajuste](screenshots/mobile-320/listagem-viewport-after.png), [escura](screenshots/mobile-320/listagem-dark.png), [viewport escuro](screenshots/mobile-320/listagem-viewport-dark.png)
- Drawer: [claro](screenshots/mobile-320/detalhes-drawer.png), [escuro](screenshots/mobile-320/detalhes-drawer-dark.png), [conteúdo expandido no topo](screenshots/mobile-320/detalhes-expandido-topo.png), [conteúdo expandido no final](screenshots/mobile-320/detalhes-expandido-final.png), [final no tema escuro](screenshots/mobile-320/detalhes-expandido-final-dark.png), [rodapé](screenshots/mobile-320/detalhes-footer.png)
- Cadastro: [página](screenshots/mobile-320/contrato-criar-pagina.png), [viewport](screenshots/mobile-320/contrato-criar-pagina-viewport.png)
- Importação: [vazia](screenshots/mobile-320/importacao-modal.png), [escura](screenshots/mobile-320/importacao-modal-dark.png), [fim do conteúdo rolável](screenshots/mobile-320/importacao-modal-scroll-bottom.png)

Medições, verificações e lista de caminhos também estão em [`coverage.json`](coverage.json).

## Pendências deste módulo

- Ajustar o shell mobile compartilhado ao cabeçalho das referências e refazer a revisão da listagem.
- Comparar cadastro, edição, confirmação de exclusão, importação individual e os estados adicionais descritos em [`REVISAO_VISUAL.json`](../../../REVISAO_VISUAL.json).
- Não marcar o módulo nem o redesign global como concluídos enquanto esses itens estiverem pendentes.
