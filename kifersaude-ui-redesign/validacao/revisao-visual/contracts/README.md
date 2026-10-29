# Revisão visual — Contratos

**Status parcial do módulo.** A listagem, o drawer de detalhes, o importador JSON em lote, o cadastro e a edição em página completa foram comparados com as referências e revisados com adaptações. Exclusão, importação individual e outros estados continuam pendentes; o redesign integral do CRM segue em andamento.

## Referências

- [Listagem desktop](../../../references/desktop/page--contratos-listagem.png) · [Listagem mobile](../../../references/mobile/page--contratos-listagem.png)
- [Detalhes desktop](../../../references/desktop/state--contratos-detalhes.png) · [Detalhes mobile](../../../references/mobile/state--contratos-detalhes.png)
- [Importação desktop](../../../references/desktop/state--contratos-importacao.png) · [Importação mobile](../../../references/mobile/state--contratos-importacao.png)
- [Criação desktop](../../../references/desktop/state--contratos-criar.png) · [Criação mobile](../../../references/mobile/state--contratos-criar.png)
- [Edição desktop](../../../references/desktop/state--contratos-editar.png) · [Edição mobile](../../../references/mobile/state--contratos-editar.png)

## Resultado da comparação

- **Drawer de detalhes — revisado com adaptações.** A largura, a hierarquia de resumo, participantes, plano e ações se aproximam da referência. Informações financeiras, documentos e histórico ficam recolhidos, preservando os dados reais e reduzindo ruído. A base atual não armazena status individual para cada participante, então esses status do mockup não são inventados.
- **Importação em lote — revisada com adaptações.** A estrutura compacta de formato, escolha do arquivo e ações segue a referência. O fluxo real exige JSON, oferece modelo e validação prévia e limita o lote; esses requisitos são mantidos em vez de substituir a funcionalidade por campos genéricos do mockup.
- **Listagem — revisada com adaptações.** A grade de indicadores e os filtros compactos seguem a referência; no mobile, o título e a ação principal ficam alinhados à esquerda. O shell inclui marca, menu e perfil no topo. O menu móvel ocupa a tela disponível e mantém todos os itens acessíveis sem sobrepor o rodapé em 320 × 640. A fixture local contém quatro contratos sintéticos, enquanto a referência estática contém oito; as ações reais de importação, criação e filtros foram preservadas.
- **Cadastro — revisado com adaptações.** A referência de criação usa um modal curto com dez campos; o formulário real contém campos operacionais, financeiros, de comissão, vidas, bonificações e responsáveis que não aparecem no mockup. Para não remover dados nem comprimir um fluxo longo num modal, a criação permanece como página completa, com os campos reais agrupados em cinco `FormSection` reutilizáveis e ações fixas no padrão oficial. O mesmo formulário e conjunto de campos seguem disponíveis para consumidores contextuais. A hierarquia, identidade, tipografia, campos, superfícies e ações foram comparadas à referência; nenhuma regra comercial foi alterada.
- **Edição — revisada com adaptações.** Iniciar a edição pelo drawer agora fecha os detalhes e abre o `ContractForm` como página completa. O formulário longo mantém seus campos, validações e salvamento atuais; cancelar retorna à listagem sem persistir mudanças. Essa adaptação evita empilhar um modal extenso sobre o drawer. Os consumidores contextuais de detalhes fora da Gestão de contratos continuam pendentes de revisão própria.

## Segurança e funcionamento

Capturas usam dados sintéticos do ambiente local. Foram abertos o drawer, o formulário de edição e o importador; a importação de arquivo foi validada com fixtures locais, mas o comando final de importação não foi acionado. Cancelar a edição retornou à listagem sem salvar. Nenhum contrato real foi criado, alterado ou excluído, e nenhuma integração externa foi chamada.

O drawer foi rolado até o conteúdo final em 320 px, preservando o rodapé fixo; Escape e cancelar fecham sem gravar. O importador foi conferido nos temas claro/escuro e nas larguras de 1920, 768, 390 e 320 px. O estado de arquivo inválido e a prévia válida foram gerados com dados sintéticos. O menu do shell foi testado por teclado: Escape fecha e devolve foco ao acionador.

## Capturas

Todos os arquivos citados estão em [`screenshots/`](screenshots/). Os caminhos são relativos a esta pasta de documentação.

### Desktop (1920 × 1080)

- Listagem: [claro](screenshots/desktop/listagem.png), [escuro](screenshots/desktop/listagem-dark.png), [filtros expandidos](screenshots/desktop/filtros-expandidos.png), [filtro de status aberto](screenshots/desktop/filtro-status-aberto.png)
- Estados da linha: [status aberto](screenshots/desktop/contrato-status-aberto.png), [calendário aberto](screenshots/desktop/contrato-calendario-aberto.png)
- Drawer: [claro](screenshots/desktop/detalhes-drawer.png), [escuro](screenshots/desktop/detalhes-drawer-dark.png)
- Cadastro: página completa [clara](screenshots/desktop/contrato-criar-pagina.png) e [escura](screenshots/desktop/contrato-criar-pagina-dark.png); viewport [claro](screenshots/desktop/contrato-criar-pagina-viewport.png) e [escuro](screenshots/desktop/contrato-criar-pagina-viewport-dark.png)
- Edição: página completa [clara](screenshots/desktop/editar-contrato-pagina.png) e [escura](screenshots/desktop/editar-contrato-pagina-dark.png); [viewport](screenshots/desktop/editar-contrato-pagina-viewport.png)
- Importação: [vazia](screenshots/desktop/importacao-modal.png), [escura](screenshots/desktop/importacao-modal-dark.png), [carregando](screenshots/desktop/importacao-modal-carregando.png), [arquivo inválido](screenshots/desktop/importacao-modal-erro.png), [prévia válida](screenshots/desktop/importacao-modal-validado.png)

### Tablet (768 × 1024)

- Listagem: [claro](screenshots/tablet/listagem.png), [escuro](screenshots/tablet/listagem-dark.png)
- Drawer: [claro](screenshots/tablet/detalhes-drawer.png), [escuro](screenshots/tablet/detalhes-drawer-dark.png)
- Cadastro: página completa [clara](screenshots/tablet/contrato-criar-pagina.png) e [escura](screenshots/tablet/contrato-criar-pagina-dark.png); viewport [claro](screenshots/tablet/contrato-criar-pagina-viewport.png) e [escuro](screenshots/tablet/contrato-criar-pagina-viewport-dark.png)
- Edição: página completa [clara](screenshots/tablet/editar-contrato-pagina.png)
- Importação: [clara](screenshots/tablet/importacao-modal.png), [escura](screenshots/tablet/importacao-modal-dark.png)

### Mobile (390 × 844)

- Listagem: [página](screenshots/mobile/listagem.png), [viewport](screenshots/mobile/listagem-viewport.png), [página escura](screenshots/mobile/listagem-dark.png), [viewport escuro](screenshots/mobile/listagem-viewport-dark.png)
- Menu completo: [claro](screenshots/mobile/menu-completo-390.png), [escuro](screenshots/mobile/menu-completo-390-dark.png)
- Drawer: [claro](screenshots/mobile/detalhes-drawer.png), [escuro](screenshots/mobile/detalhes-drawer-dark.png)
- Cadastro: página completa [clara](screenshots/mobile/contrato-criar-pagina.png) e [escura](screenshots/mobile/contrato-criar-pagina-dark.png); viewport [claro](screenshots/mobile/contrato-criar-pagina-viewport.png) e [escuro](screenshots/mobile/contrato-criar-pagina-viewport-dark.png); ação final e navegação fixa [sem sobreposição](screenshots/mobile/contrato-criar-pagina-bottom-viewport-dark.png)
- Edição: página completa [clara](screenshots/mobile/editar-contrato-pagina.png)
- Importação: [vazia](screenshots/mobile/importacao-modal.png), [escura](screenshots/mobile/importacao-modal-dark.png), [arquivo inválido](screenshots/mobile/importacao-modal-erro.png), [prévia válida](screenshots/mobile/importacao-modal-validado.png)

### Mobile compacto (320 × 640)

- Listagem: [página](screenshots/mobile-320/listagem.png), [viewport](screenshots/mobile-320/listagem-viewport.png), [viewport após ajuste](screenshots/mobile-320/listagem-viewport-after.png), [escura](screenshots/mobile-320/listagem-dark.png), [viewport escuro](screenshots/mobile-320/listagem-viewport-dark.png)
- Menu completo: [claro](screenshots/mobile-320/menu-completo.png), [escuro](screenshots/mobile-320/menu-completo-dark.png)
- Drawer: [claro](screenshots/mobile-320/detalhes-drawer.png), [escuro](screenshots/mobile-320/detalhes-drawer-dark.png), [conteúdo expandido no topo](screenshots/mobile-320/detalhes-expandido-topo.png), [conteúdo expandido no final](screenshots/mobile-320/detalhes-expandido-final.png), [final no tema escuro](screenshots/mobile-320/detalhes-expandido-final-dark.png), [rodapé](screenshots/mobile-320/detalhes-footer.png)
- Cadastro: página completa [clara](screenshots/mobile-320/contrato-criar-pagina.png) e [escura](screenshots/mobile-320/contrato-criar-pagina-dark.png); viewport [claro](screenshots/mobile-320/contrato-criar-pagina-viewport.png) e [escuro](screenshots/mobile-320/contrato-criar-pagina-viewport-dark.png); ação final e navegação fixa [sem sobreposição](screenshots/mobile-320/contrato-criar-pagina-bottom-viewport-dark.png)
- Edição: página completa [clara](screenshots/mobile-320/editar-contrato-pagina.png)

Nas capturas de página inteira em mobile, a navegação inferior fixa foi ocultada apenas durante a captura para evitar que o browser a repetisse no meio do documento. As capturas de viewport mantêm a navegação real visível; os dois tamanhos mobile também têm uma captura da ação final junto à navegação para verificar a distância entre eles.
- Importação: [vazia](screenshots/mobile-320/importacao-modal.png), [escura](screenshots/mobile-320/importacao-modal-dark.png), [fim do conteúdo rolável](screenshots/mobile-320/importacao-modal-scroll-bottom.png)

Medições, verificações e lista de caminhos também estão em [`coverage.json`](coverage.json).

## Pendências deste módulo

- Comparar edição, confirmação de exclusão, importação individual e os estados adicionais descritos em [`REVISAO_VISUAL.json`](../../../REVISAO_VISUAL.json).
- Não marcar o módulo nem o redesign global como concluídos enquanto esses itens estiverem pendentes.

## Alinhamento com Leads — em andamento

A tabela de contratos passou a alinhar as linhas ao centro e usar o mesmo estado vazio da listagem de Leads. O menu de status agora mostra indicadores de cor por opção como em Leads, mantendo a seleção de responsável pela venda e permissões próprias de contratos. A prévia isolada com dados fictícios verificou seleção e Escape, sem chamadas externas, e não apresentou overflow em [desktop](status-leads/desktop.png), [tablet](status-leads/tablet.png), [mobile](status-leads/mobile.png) e [320 px](status-leads/mobile-320.png); [tema escuro em 320 px](status-leads/mobile-320-dark.png). A comparação visual integrada entre as duas tabelas, outros menus e os demais detalhes solicitados continua pendente; esta prévia não valida a listagem completa.

Os filtros de status, responsável, período e operadora usam agora estado neutro para “Todos”, evitando aparência de filtro ativo sem seleção. Em prévia isolada do componente real, Playwright verificou seleção e limpeza em 1920, 768, 390 e 320 px sem overflow; capturas do padrão neutro em [desktop](status-leads/filtro-neutro-desktop.png) e [320 px](status-leads/filtro-neutro-320.png). A página completa autenticada ainda precisa ser comparada com Leads.

Comparação adicional com a [listagem aprovada de Leads](../../../previous-approved/leads-list-desktop-viewport.png): a tela real de contratos foi montada em prévia isolada com oito contratos sintéticos e dependências simuladas. Identificou-se que o estilo de célula sobrepunha o alinhamento central da linha; a correção no componente de tabela foi conferida nas sete colunas. Plano e modalidade compartilham a linha secundária para aproximar a densidade de Leads, sem remover informações. Playwright verificou busca e menu de ações, sem exclusão nem acesso externo, e ausência de overflow em [desktop](status-leads/listagem-comparacao-desktop.png), [tablet](status-leads/listagem-comparacao-tablet.png), [mobile](status-leads/listagem-comparacao-mobile.png) e [320 px](status-leads/listagem-comparacao-320.png); [tema escuro desktop](status-leads/listagem-comparacao-dark.png). A prévia não inclui o shell nem autenticação; status com responsável de venda, permissões, estados adicionais e revisão integral das diferenças seguem pendentes.

O estado vazio dos cartões foi alinhado ao componente usado na tabela e em Leads. A coluna de datas exibe “Sem destaque” quando não há badge, sem afirmar que não existem datas; mensalidade e comissão zeradas são apresentadas como valores, e não como ausentes. Em prévia da tela real com dados sintéticos, Playwright verificou valor zero e busca sem resultado em [desktop](status-leads/vazio-desktop.png), [tablet](status-leads/vazio-tablet.png), [mobile](status-leads/vazio-mobile.png) e [320 px](status-leads/vazio-320.png), além do [tema escuro em 320 px](status-leads/vazio-dark-320.png); sem overflow do documento. Validação autenticada permanece pendente.

O menu de mudança de status com responsável pela venda foi conferido em prévia isolada com operador fictício. O seletor usa Field para associar o rótulo, recebeu mais espaço e texto inicial curto; a escolha do responsável acompanha a mudança de status. Playwright verificou seleção e fechamento com Escape sem gravações, sem overflow em [desktop](status-leads/status-responsavel-desktop.png), [tablet](status-leads/status-responsavel-tablet.png), [mobile](status-leads/status-responsavel-mobile.png) e [320 px](status-leads/status-responsavel-320.png), além de [tema escuro em 320 px](status-leads/status-responsavel-dark-320.png). A referência de menu de status representa filtro múltiplo, enquanto este menu altera um contrato individual; sua função real foi preservada. Validação no shell autenticado permanece pendente.

A barra de filtros foi aproximada à de Leads: o acionador “Filtros avançados” ocupa apenas o espaço necessário no desktop; em larguras de até 480 px os controles ficam em uma coluna para manter os rótulos legíveis. O filtro real de operadora continua expandido na página e aplica imediatamente a seleção. Em prévia da tela real com dados sintéticos, Playwright conferiu abertura, seleção e limpeza, sem overflow em [desktop](status-leads/filtros-desktop.png), [tablet](status-leads/filtros-tablet.png), [mobile](status-leads/filtros-mobile.png) e [320 px](status-leads/filtros-320.png), além de [escuro em 320 px](status-leads/filtros-dark-320.png). A comparação autenticada e outros estados permanecem pendentes.

A identificação dos contratos foi aproximada à de Leads: titular em destaque, código na linha secundária e avatar operacional no desktop; quando não há titular, o ícone de contrato acompanha a indicação “Sem titular”. Nos cartões, o nome também precede o código. A prévia da tela real com titulares sintéticos verificou presença e ausência de titular e busca por código em [desktop](status-leads/identidade-desktop.png), [tablet](status-leads/identidade-tablet.png), [mobile](status-leads/identidade-mobile.png) e [320 px](status-leads/identidade-320.png), além do [tema escuro em 320 px](status-leads/identidade-dark-320.png); sem overflow do documento. A validação no shell autenticado permanece pendente.

Em 29/10, a tabela de contratos passou a compartilhar o tratamento de listas operacionais já usado por Leads: mesma escala compacta, alinhamento vertical, cabeçalho, borda e tipografia. A grade dá mais espaço ao responsável e reduz a coluna de ações. A prévia da tela real com dados sintéticos foi conferida por Playwright em [desktop](status-leads/tabela-alinhada-desktop.png), [tablet](status-leads/tabela-alinhada-tablet.png), [mobile](status-leads/tabela-alinhada-mobile.png) e [320 px](status-leads/tabela-alinhada-320.png), sem overflow horizontal; a linha desktop ficou uniforme em todas as células. Os mesmos estados foram vistos no [tema escuro desktop](status-leads/tabela-alinhada-dark-desktop.png) e [320 px](status-leads/tabela-alinhada-dark-320.png). O [menu de status](status-leads/tabela-menu-status.png) e o [menu de ações](status-leads/tabela-menu-acoes.png) abriram e responderam ao teclado em desktop; nenhum status foi alterado e nenhuma exclusão foi executada. A montagem usa dependências simuladas, então não comprova a apresentação no shell autenticado nem permissões reais.

A falha inicial de carregamento agora mostra orientação e nova tentativa sem apresentar indicadores zerados ou uma carteira vazia como se fossem dados válidos. Após uma carga bem-sucedida, uma falha posterior mantém a última fotografia da carteira e informa que ela pode estar desatualizada. Playwright simulou falha inicial e nova tentativa em [desktop](status-leads/erro-desktop.png), [tablet](status-leads/erro-tablet.png), [mobile](status-leads/erro-mobile.png) e [320 px](status-leads/erro-320.png), sem overflow. A falha posterior à carga também foi simulada, incluindo a repetição bem-sucedida em [desktop](status-leads/atualizacao-erro-desktop.png), [tablet](status-leads/atualizacao-erro-tablet.png), [mobile](status-leads/atualizacao-erro-mobile.png) e [320 px](status-leads/atualizacao-erro-320.png). Também conferiu o perfil fictício sem edição: não aparecem criação ou alteração de status ([320 px](status-leads/somente-leitura-320.png), [escuro](status-leads/somente-leitura-dark-320.png)). Permissões e falhas reais no shell autenticado seguem pendentes.
