# Revisão visual — edição de Lead em página

**Status: comparado com `extra--leads-edicao-pagina`, com adaptações para os campos e o fluxo reais.** O formulário longo permanece em página completa; o fluxo contextual em modal segue separado e ainda precisa de revisão.

## Referências

- [Edição — desktop](../../../references/desktop/extra--leads-edicao-pagina.png)
- [Edição — mobile](../../../references/mobile/extra--leads-edicao-pagina.png)

## Resultado e padrões aplicados

- O `FormPage` reúne título, descrição, retorno à listagem, ação principal e área opcional de orientação. O botão “Salvar alterações” no cabeçalho está associado ao mesmo formulário; o rodapé preserva Cancelar e Salvar.
- Os campos reais permanecem divididos em quatro grupos: dados de contato, localização, qualificação e origem, responsável e acompanhamento. A lateral resume campos obrigatórios e explica que informar o próximo acompanhamento cria um lembrete vinculado ao lead.
- Em desktop, formulário e orientação ficam lado a lado. Em larguras de tablet, a orientação passa abaixo do formulário e os campos ficam em uma coluna. Em mobile, o formulário precede as orientações, preservando a leitura integral sem cortar o aside da referência.
- A ação móvel fica acima da navegação inferior. A página reserva espaço de rolagem no fim e mantém áreas de toque confortáveis.
- Playwright confirmou a associação do botão superior ao formulário, quatro grupos renderizados e ausência de conteúdo além da largura disponível em todos os viewports. A captura usa apenas o contato sintético `Contato Demonstração 01`; nenhuma alteração foi salva.

## Capturas

Há **7 screenshots** nesta pasta, com captura full-page em desktop, tablet, mobile e 320 px, dois viewports iniciais para mobile e tema escuro em desktop. Veja caminhos e medições em [`coverage.json`](coverage.json).

## Verificação

Os testes direcionados de `FormPage`, do showcase e da apresentação de `LeadForm` passaram (**19/19**); a suíte completa passou **1.733 testes em 328 arquivos**. Typecheck, lint, auditorias, arquitetura, migrations, build e validação Playwright passaram. A falha de build causada pelo `setup.js` gerado em `output/playwright/ui-audit-run/` foi corrigida ao removê-lo do controle de versão e adicioná-lo ao `.gitignore`; a cópia local foi preservada. `npm run build` passou após a correção.
