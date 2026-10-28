# Revisão visual — Leads

**Status: revisão parcial do módulo.** A listagem, o Kanban e a página de criação foram comparados com as referências aprovadas. O restante de Leads e os outros módulos seguem pendentes. Capturas e smoke tests não contam como redesign concluído.

## Referências comparadas

- Listagem desktop: [referência](../../../previous-approved/leads-list-desktop-viewport.png)
- Listagem mobile: [referência](../../../previous-approved/leads-list-mobile-viewport.png)
- Kanban desktop: [referência](../../../previous-approved/leads-kanban-desktop-viewport.png)
- Kanban mobile: [referência](../../../previous-approved/leads-kanban-mobile-viewport.png)
- Criação desktop: [referência](../../../previous-approved/leads-create-desktop-viewport.png)
- Criação mobile: [referência](../../../previous-approved/leads-create-mobile-completa.png)

## Resultado da comparação

- **Listagem:** hierarquia compacta de título, busca, filtros e resultado; filtros avançados junto aos filtros principais; resumo e ordenação abaixo; cartões mobile com identidade, status, origem, próximo follow-up e ações. O menu móvel mantém acessível a documentação de integração e a exportação sem ampliar a barra.
- **Kanban:** colunas com leitura horizontal em telas estreitas, contagem e limite WIP por etapa, cartão compacto e ações próprias. Os controles mantêm nomes acessíveis e os botões foram separados para evitar controles aninhados.
- **Criação:** quatro grupos de campos preservados; grade de duas colunas em telas largas e uma coluna em mobile. Informações auxiliares permanecem junto ao campo. A barra de salvar/cancelar fica no fim do formulário e se fixa durante a aproximação ao final, sem cobrir campos nem a navegação inferior.
- **Padrões compartilhados:** `RecordActions` agrupa a ação imediata e o menu de opções, e está exposto no showcase. `PageActions` deixa ações primárias e secundárias visualmente separadas. Loading inicial usa o skeleton real da listagem.
- **Temas e responsividade:** sem overflow horizontal nas 62 combinações revisadas (quatro larguras e dois temas). Dados e status demonstrativos vêm de fixtures sintéticas locais; não foram persistidos.

## Capturas e verificações

A pasta [`screenshots/`](screenshots/) contém **151 screenshots** de viewport e página inteira para listagem, ações, dados de contato, filtros, Kanban, criação, validação e datepicker; além de diálogos, confirmações, loading, vazio, erro, permissão de observador, showcase e rodapé do formulário. A relação completa, as medidas e os resultados das verificações estão em [`coverage.json`](coverage.json).

O Playwright também abriu lembrete, exclusão, conversão, detalhe e edição em desktop e 320 px. A exclusão e a conversão foram canceladas; esses estados foram **apenas smoke-tested**, ainda não comparados visualmente com suas referências. Nenhuma escrita comercial ou mensagem externa ocorreu. A validação de campo obrigatório não enviou o formulário.

A suíte completa passou **1.724/1.724 testes em 327 arquivos** com `--testTimeout=10000`; os **32/32 testes focados** também passaram em 9 arquivos. O contrato do design system excedeu o limite padrão de 5 s durante a suíte concorrente, mas passou isolado em 2,9 s. Typecheck, lint, arquitetura e build passaram após a correção do rodapé. O build inclui as auditorias de secrets, design system e valores visuais. Permanece o aviso do chunk vendor (883,79 kB acima do limite de 500 kB); o build completou com sucesso.

## Adaptações funcionais e pendências

- Os status, permissões, telefone, e-mail, responsável, origem e follow-up são mantidos como existem na aplicação; nenhuma regra comercial foi ajustada para imitar o texto das referências.
- O Kanban mantém preferências de WIP, arrastar cartões e callbacks existentes de status, detalhe e conversão.
- O formulário conserva campos, validação, automações, data e persistência existentes. A barra sticky só se apresenta perto do final do conteúdo, evitando o recorte observado na primeira revisão mobile.
- Dados para screenshots usam nomes e e-mails fictícios de `exemplo.invalid`.
- **Pendente:** comparação visual do detalhe de lead, dos modais de lembrete/exclusão/conversão e dos estados dessas telas; varredura de rotas e interfaces de Leads que não constem do manifesto. Portanto, estes itens permanecem abertos em [`REVISAO_VISUAL.json`](../../../REVISAO_VISUAL.json).
