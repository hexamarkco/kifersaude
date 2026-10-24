# Registro visual do design system — Kifer Saúde

Capturas da **versão revisada publicada**, em [www.kifersaude.com.br/design-system](https://www.kifersaude.com.br/design-system), feitas em **24/10/2026** (America/Sao_Paulo).

- Commit de referência: [`bbda9a0d`](https://github.com/hexamarkco/kifersaude/commit/bbda9a0dc1c2c09da0452e796e2b77e85755ef2f).
- Publicação confirmada: [Vercel](https://vercel.com/hexabuilds/kifersaude/32gaivWLPLUGbwaMrr8sC5DJr6yd).
- A versão antiga, observada antes da conclusão da publicação, **não integra este conjunto de imagens**.
- 502 PNGs: 299 capturas `fullPage: true` e 203 capturas complementares de viewport. Aproximadamente 85.0 MiB.
- Autenticação não foi necessária. Os contatos e documentos mostrados são os dados fictícios do showcase.

## Resoluções

| Pasta | Viewport configurado | Temas |
| --- | --- | --- |
| `desktop/` | 1920 × 1080 | Claro e escuro |
| `tablet/` | 768 × 1024 | Claro e escuro |
| `mobile/` | 390 × 844 | Claro e escuro |

## Como usar

Cada imagem sem o sufixo `-viewport` captura **toda a página do estado correspondente**, sem recorte manual. O sufixo `-viewport` oferece uma segunda imagem na resolução exata do dispositivo, para ler o componente aberto e sua posição real na janela. Não substitui a imagem completa.

O showcase troca as seções e categorias por navegação. Por isso, o registro completo é formado pelas capturas de todas as seções e das seis abas de componentes; uma única imagem da visão geral não contém a biblioteca inteira.

As prévias de listagem, detalhes, criação, edição e dashboard também foram abertas como páginas independentes. Isso registra seu conteúdo completo, além da área visível dos iframes presentes no catálogo.

Os estados interativos estão integralmente documentados no tema claro. O tema escuro inclui todas as seções, categorias e páginas, além de exemplos abertos de select, modal e popover.

## Método e observações

- Playwright, com espera por carregamento de navegação, `document.fonts.ready`, imagens e documentos dos iframes. Animações desativadas apenas pela opção de screenshot; movimento reduzido emulado; cursor de texto ocultado na captura.
- Nenhum CSS foi injetado e nenhum arquivo de código, componente ou estilo da aplicação foi alterado. Foram conferidos hashes de 697 arquivos de `src`, sem diferenças.
- Um redesenho do viewport, voltando imediatamente à resolução solicitada antes da captura, evitou camadas visuais residuais do Chromium. Não há redimensionamento ou edição posterior dos PNGs.
- `fullPage` mantém a extensão natural do documento. A largura do PNG pode diferir da largura configurada por causa da barra de rolagem nativa ou de conteúdo que ultrapassa o viewport. Os arquivos `-viewport` têm exatamente as dimensões solicitadas.
- O conteúdo publicado ultrapassa a largura disponível em algumas capturas mobile/tablet. A área excedente foi preservada nas imagens completas para futura análise, sem corrigir os estilos.
- Barras laterais, elementos fixos e popups conservam sua relação com a rolagem ativa nas capturas completas. Use a imagem de viewport para avaliar sua composição em contexto.
- Modais ou drawers com rolagem interna possuem imagens de continuação quando essa rolagem foi detectada. As páginas de formulário independentes complementam a leitura integral dos campos.
- Os exemplos de skeleton, loading, erro e vazio são estados intencionais da biblioteca. Os carregamentos transitórios foram acionados localmente para documentação; não representam falhas de carregamento do site.
- Somente demonstrações locais foram preenchidas ou acionadas. Nenhuma comunicação comercial foi enviada e nenhum registro real do CRM foi alterado.
- PNGs verificados por assinatura, estrutura, CRC de todos os blocos, dimensões e hash SHA-256. Metadados individuais: [manifest.json](manifest.json).

## Índice de capturas

Em cada célula, **Completa** abre a captura fullPage e **Viewport** abre a composição complementar, quando existente. “—” indica um estado não aplicável àquela resolução, como a navegação recolhida no desktop.

### Tema claro

#### Seções

| Seção, componente ou estado | Desktop | Tablet | Mobile |
| --- | --- | --- | --- |
| Visão geral completa | [Completa](desktop/light/01-visao-geral.png) | [Completa](tablet/light/01-visao-geral.png) | [Completa](mobile/light/01-visao-geral.png) |
| Fundamentos: cores, fontes, espaços, raios, sombras e ícones | [Completa](desktop/light/02-fundamentos-visuais.png) | [Completa](tablet/light/02-fundamentos-visuais.png) | [Completa](mobile/light/02-fundamentos-visuais.png) |
| Estados disponíveis, foco, disabled, validação, loading, vazio e erros | [Completa](desktop/light/09-estados-validacao.png) | [Completa](tablet/light/09-estados-validacao.png) | [Completa](mobile/light/09-estados-validacao.png) |
| Estruturas de página e convenções de UX | [Completa](desktop/light/10-padroes-layout.png) | [Completa](tablet/light/10-padroes-layout.png) | [Completa](mobile/light/10-padroes-layout.png) |
| Demonstração e orientações para desktop, tablet e mobile | [Completa](desktop/light/11-responsividade.png) | [Completa](tablet/light/11-responsividade.png) | [Completa](mobile/light/11-responsividade.png) |

#### Componentes

| Seção, componente ou estado | Desktop | Tablet | Mobile |
| --- | --- | --- | --- |
| Botões: variantes, tamanhos, ícones, grupos, links e ações de formulário | [Completa](desktop/light/03-componentes-acoes.png) | [Completa](tablet/light/03-componentes-acoes.png) | [Completa](mobile/light/03-componentes-acoes.png) |
| Inputs, máscaras, seleção, escolhas, datas e formulário | [Completa](desktop/light/04-componentes-formularios.png) | [Completa](tablet/light/04-componentes-formularios.png) | [Completa](mobile/light/04-componentes-formularios.png) |
| Sidebar, header, breadcrumbs, abas, paginação e etapas | [Completa](desktop/light/05-componentes-navegacao.png) | [Completa](tablet/light/05-componentes-navegacao.png) | [Completa](mobile/light/05-componentes-navegacao.png) |
| Tabela, filtros, cards, indicadores, badges e avatares | [Completa](desktop/light/06-componentes-dados.png) | [Completa](tablet/light/06-componentes-dados.png) | [Completa](mobile/light/06-componentes-dados.png) |
| Alertas, toasts, skeletons, loading e progresso | [Completa](desktop/light/07-componentes-feedback.png) | [Completa](tablet/light/07-componentes-feedback.png) | [Completa](mobile/light/07-componentes-feedback.png) |
| Acionadores de modal, confirmação, drawer, popover, menu e tooltip | [Completa](desktop/light/08-componentes-interacoes.png) | [Completa](tablet/light/08-componentes-interacoes.png) | [Completa](mobile/light/08-componentes-interacoes.png) |

#### Páginas completas

| Seção, componente ou estado | Desktop | Tablet | Mobile |
| --- | --- | --- | --- |
| Formulário de criação — prévia independente com todo o conteúdo | [Completa](desktop/light/12-pagina-create.png) | [Completa](tablet/light/12-pagina-create.png) | [Completa](mobile/light/12-pagina-create.png) |
| Dashboard comercial — prévia independente com todo o conteúdo | [Completa](desktop/light/12-pagina-dashboard.png) | [Completa](tablet/light/12-pagina-dashboard.png) | [Completa](mobile/light/12-pagina-dashboard.png) |
| Detalhes de um contato — prévia independente com todo o conteúdo | [Completa](desktop/light/12-pagina-detail.png) | [Completa](tablet/light/12-pagina-detail.png) | [Completa](mobile/light/12-pagina-detail.png) |
| Formulário de edição — prévia independente com todo o conteúdo | [Completa](desktop/light/12-pagina-edit.png) | [Completa](tablet/light/12-pagina-edit.png) | [Completa](mobile/light/12-pagina-edit.png) |
| Listagem de contatos — prévia independente com todo o conteúdo | [Completa](desktop/light/12-pagina-list.png) | [Completa](tablet/light/12-pagina-list.png) | [Completa](mobile/light/12-pagina-list.png) |

#### Formulários interativos

| Seção, componente ou estado | Desktop | Tablet | Mobile |
| --- | --- | --- | --- |
| Select lg com opções abertas | [Completa](desktop/light/20-select-lg-aberto.png) · [Viewport](desktop/light/20-select-lg-aberto-viewport.png) | [Completa](tablet/light/20-select-lg-aberto.png) · [Viewport](tablet/light/20-select-lg-aberto-viewport.png) | [Completa](mobile/light/20-select-lg-aberto.png) · [Viewport](mobile/light/20-select-lg-aberto-viewport.png) |
| Select md com opções abertas | [Completa](desktop/light/20-select-md-aberto.png) · [Viewport](desktop/light/20-select-md-aberto-viewport.png) | [Completa](tablet/light/20-select-md-aberto.png) · [Viewport](tablet/light/20-select-md-aberto-viewport.png) | [Completa](mobile/light/20-select-md-aberto.png) · [Viewport](mobile/light/20-select-md-aberto-viewport.png) |
| Select sm com opções abertas | [Completa](desktop/light/20-select-sm-aberto.png) · [Viewport](desktop/light/20-select-sm-aberto-viewport.png) | [Completa](tablet/light/20-select-sm-aberto.png) · [Viewport](tablet/light/20-select-sm-aberto-viewport.png) | [Completa](mobile/light/20-select-sm-aberto.png) · [Viewport](mobile/light/20-select-sm-aberto-viewport.png) |
| Combobox: opções abertas | [Completa](desktop/light/21-combobox-aberto.png) · [Viewport](desktop/light/21-combobox-aberto-viewport.png) | [Completa](tablet/light/21-combobox-aberto.png) · [Viewport](tablet/light/21-combobox-aberto-viewport.png) | [Completa](mobile/light/21-combobox-aberto.png) · [Viewport](mobile/light/21-combobox-aberto-viewport.png) |
| Combobox: busca sem resultados | [Completa](desktop/light/21-combobox-sem-resultados.png) · [Viewport](desktop/light/21-combobox-sem-resultados-viewport.png) | [Completa](tablet/light/21-combobox-sem-resultados.png) · [Viewport](tablet/light/21-combobox-sem-resultados-viewport.png) | [Completa](mobile/light/21-combobox-sem-resultados.png) · [Viewport](mobile/light/21-combobox-sem-resultados-viewport.png) |
| Seleção múltipla com opções e checkboxes | [Completa](desktop/light/22-multiselect-aberto.png) · [Viewport](desktop/light/22-multiselect-aberto-viewport.png) | [Completa](tablet/light/22-multiselect-aberto.png) · [Viewport](tablet/light/22-multiselect-aberto-viewport.png) | [Completa](mobile/light/22-multiselect-aberto.png) · [Viewport](mobile/light/22-multiselect-aberto-viewport.png) |
| Data: seletor aberto | [Completa](desktop/light/23-calendario-data.png) · [Viewport](desktop/light/23-calendario-data-viewport.png) | [Completa](tablet/light/23-calendario-data.png) · [Viewport](tablet/light/23-calendario-data-viewport.png) | [Completa](mobile/light/23-calendario-data.png) · [Viewport](mobile/light/23-calendario-data-viewport.png) |
| Horário: seletor aberto | [Completa](desktop/light/24-seletor-horario.png) · [Viewport](desktop/light/24-seletor-horario-viewport.png) | [Completa](tablet/light/24-seletor-horario.png) · [Viewport](tablet/light/24-seletor-horario-viewport.png) | [Completa](mobile/light/24-seletor-horario.png) · [Viewport](mobile/light/24-seletor-horario-viewport.png) |
| Atendimento: seletor aberto | [Completa](desktop/light/25-calendario-data-horario.png) · [Viewport](desktop/light/25-calendario-data-horario-viewport.png) | [Completa](tablet/light/25-calendario-data-horario.png) · [Viewport](tablet/light/25-calendario-data-horario-viewport.png) | [Completa](mobile/light/25-calendario-data-horario.png) · [Viewport](mobile/light/25-calendario-data-horario-viewport.png) |
| Checkbox marcado, radio Empresa e switch desligado | [Completa](desktop/light/26-preferencias-alternativas.png) · [Viewport](desktop/light/26-preferencias-alternativas-viewport.png) | [Completa](tablet/light/26-preferencias-alternativas.png) · [Viewport](tablet/light/26-preferencias-alternativas-viewport.png) | [Completa](mobile/light/26-preferencias-alternativas.png) · [Viewport](mobile/light/26-preferencias-alternativas-viewport.png) |
| Máscaras de telefone, CPF, CNPJ, CEP e CNS preenchidas com dados fictícios | [Completa](desktop/light/27-mascaras-preenchidas.png) · [Viewport](desktop/light/27-mascaras-preenchidas-viewport.png) | [Completa](tablet/light/27-mascaras-preenchidas.png) · [Viewport](tablet/light/27-mascaras-preenchidas-viewport.png) | [Completa](mobile/light/27-mascaras-preenchidas.png) · [Viewport](mobile/light/27-mascaras-preenchidas-viewport.png) |
| Formulário enviado vazio: mensagens de erro e foco no primeiro campo | [Completa](desktop/light/28-formulario-validacao-erros.png) · [Viewport](desktop/light/28-formulario-validacao-erros-viewport.png) | [Completa](tablet/light/28-formulario-validacao-erros.png) · [Viewport](tablet/light/28-formulario-validacao-erros-viewport.png) | [Completa](mobile/light/28-formulario-validacao-erros.png) · [Viewport](mobile/light/28-formulario-validacao-erros-viewport.png) |
| Combobox filtrado: apenas SulAmérica | [Completa](desktop/light/80-combobox-filtrado.png) · [Viewport](desktop/light/80-combobox-filtrado-viewport.png) | [Completa](tablet/light/80-combobox-filtrado.png) · [Viewport](tablet/light/80-combobox-filtrado-viewport.png) | [Completa](mobile/light/80-combobox-filtrado.png) · [Viewport](mobile/light/80-combobox-filtrado-viewport.png) |
| Seleção múltipla com três operadoras marcadas | [Completa](desktop/light/81-multiselect-tres-opcoes.png) · [Viewport](desktop/light/81-multiselect-tres-opcoes-viewport.png) | [Completa](tablet/light/81-multiselect-tres-opcoes.png) · [Viewport](tablet/light/81-multiselect-tres-opcoes-viewport.png) | [Completa](mobile/light/81-multiselect-tres-opcoes.png) · [Viewport](mobile/light/81-multiselect-tres-opcoes-viewport.png) |

#### Navegação interativa

| Seção, componente ou estado | Desktop | Tablet | Mobile |
| --- | --- | --- | --- |
| Abas em Configurações, paginação avançada e etapa seguinte | [Completa](desktop/light/29-navegacao-selecoes.png) · [Viewport](desktop/light/29-navegacao-selecoes-viewport.png) | [Completa](tablet/light/29-navegacao-selecoes.png) · [Viewport](tablet/light/29-navegacao-selecoes-viewport.png) | [Completa](mobile/light/29-navegacao-selecoes.png) · [Viewport](mobile/light/29-navegacao-selecoes-viewport.png) |
| Drawer de navegação do showcase | — | [Completa](tablet/light/51-menu-navegacao-mobile.png) · [Viewport](tablet/light/51-menu-navegacao-mobile-viewport.png) | [Completa](mobile/light/51-menu-navegacao-mobile.png) · [Viewport](mobile/light/51-menu-navegacao-mobile-viewport.png) |
| Menu recolhido do CRM demonstrativo expandido | — | [Completa](tablet/light/52-menu-navegacao-previa.png) · [Viewport](tablet/light/52-menu-navegacao-previa-viewport.png) | [Completa](mobile/light/52-menu-navegacao-previa.png) · [Viewport](mobile/light/52-menu-navegacao-previa-viewport.png) |

#### Dados e filtros

| Seção, componente ou estado | Desktop | Tablet | Mobile |
| --- | --- | --- | --- |
| Filtro de status aberto na tabela | [Completa](desktop/light/30-filtro-status-aberto.png) · [Viewport](desktop/light/30-filtro-status-aberto-viewport.png) | [Completa](tablet/light/30-filtro-status-aberto.png) · [Viewport](tablet/light/30-filtro-status-aberto-viewport.png) | [Completa](mobile/light/30-filtro-status-aberto.png) · [Viewport](mobile/light/30-filtro-status-aberto-viewport.png) |
| Tabela ou cards filtrados por Contratado | [Completa](desktop/light/31-tabela-filtrada.png) · [Viewport](desktop/light/31-tabela-filtrada-viewport.png) | [Completa](tablet/light/31-tabela-filtrada.png) · [Viewport](tablet/light/31-tabela-filtrada-viewport.png) | [Completa](mobile/light/31-tabela-filtrada.png) · [Viewport](mobile/light/31-tabela-filtrada-viewport.png) |
| Busca na tabela sem resultados e ação para limpar | [Completa](desktop/light/32-tabela-sem-resultados.png) · [Viewport](desktop/light/32-tabela-sem-resultados-viewport.png) | [Completa](tablet/light/32-tabela-sem-resultados.png) · [Viewport](tablet/light/32-tabela-sem-resultados-viewport.png) | [Completa](mobile/light/32-tabela-sem-resultados.png) · [Viewport](mobile/light/32-tabela-sem-resultados-viewport.png) |
| Ordenação descendente, segunda página e seleção de contato | [Completa](desktop/light/33-tabela-ordenada-paginada-selecionada.png) · [Viewport](desktop/light/33-tabela-ordenada-paginada-selecionada-viewport.png) | [Completa](tablet/light/33-tabela-ordenada-paginada-selecionada.png) · [Viewport](tablet/light/33-tabela-ordenada-paginada-selecionada-viewport.png) | [Completa](mobile/light/33-tabela-ordenada-paginada-selecionada.png) · [Viewport](mobile/light/33-tabela-ordenada-paginada-selecionada-viewport.png) |
| Filtro múltiplo de operadoras aberto | [Completa](desktop/light/34-filtro-multiplo-aberto.png) · [Viewport](desktop/light/34-filtro-multiplo-aberto-viewport.png) | [Completa](tablet/light/34-filtro-multiplo-aberto.png) · [Viewport](tablet/light/34-filtro-multiplo-aberto-viewport.png) | [Completa](mobile/light/34-filtro-multiplo-aberto.png) · [Viewport](mobile/light/34-filtro-multiplo-aberto-viewport.png) |
| Filtro de intervalo de datas aberto | [Completa](desktop/light/35-filtro-periodo-aberto.png) · [Viewport](desktop/light/35-filtro-periodo-aberto-viewport.png) | [Completa](tablet/light/35-filtro-periodo-aberto.png) · [Viewport](tablet/light/35-filtro-periodo-aberto-viewport.png) | [Completa](mobile/light/35-filtro-periodo-aberto.png) · [Viewport](mobile/light/35-filtro-periodo-aberto-viewport.png) |
| Superfície semântica de erro | [Completa](desktop/light/36-superficie-erro.png) · [Viewport](desktop/light/36-superficie-erro-viewport.png) | [Completa](tablet/light/36-superficie-erro.png) · [Viewport](tablet/light/36-superficie-erro-viewport.png) | [Completa](mobile/light/36-superficie-erro.png) · [Viewport](mobile/light/36-superficie-erro-viewport.png) |
| Composição pública expandida com PublicShell, PublicCard e estado vazio | [Completa](desktop/light/37-composicao-publica-expandida.png) · [Viewport](desktop/light/37-composicao-publica-expandida-viewport.png) | [Completa](tablet/light/37-composicao-publica-expandida.png) · [Viewport](tablet/light/37-composicao-publica-expandida-viewport.png) | [Completa](mobile/light/37-composicao-publica-expandida.png) · [Viewport](mobile/light/37-composicao-publica-expandida-viewport.png) |
| Calendário aberto dentro do popover de período | [Completa](desktop/light/83-calendario-em-filtro-periodo.png) · [Viewport](desktop/light/83-calendario-em-filtro-periodo-viewport.png) | [Completa](tablet/light/83-calendario-em-filtro-periodo.png) · [Viewport](tablet/light/83-calendario-em-filtro-periodo-viewport.png) | [Completa](mobile/light/83-calendario-em-filtro-periodo.png) · [Viewport](mobile/light/83-calendario-em-filtro-periodo-viewport.png) |
| Superfície semântica: hero | [Completa](desktop/light/84-superficie-hero.png) · [Viewport](desktop/light/84-superficie-hero-viewport.png) | [Completa](tablet/light/84-superficie-hero.png) · [Viewport](tablet/light/84-superficie-hero-viewport.png) | [Completa](mobile/light/84-superficie-hero.png) · [Viewport](mobile/light/84-superficie-hero-viewport.png) |
| Superfície semântica: info | [Completa](desktop/light/84-superficie-info.png) · [Viewport](desktop/light/84-superficie-info-viewport.png) | [Completa](tablet/light/84-superficie-info.png) · [Viewport](tablet/light/84-superficie-info-viewport.png) | [Completa](mobile/light/84-superficie-info.png) · [Viewport](mobile/light/84-superficie-info-viewport.png) |
| Superfície semântica: muted | [Completa](desktop/light/84-superficie-muted.png) · [Viewport](desktop/light/84-superficie-muted-viewport.png) | [Completa](tablet/light/84-superficie-muted.png) · [Viewport](tablet/light/84-superficie-muted-viewport.png) | [Completa](mobile/light/84-superficie-muted.png) · [Viewport](mobile/light/84-superficie-muted-viewport.png) |
| Superfície semântica: strong | [Completa](desktop/light/84-superficie-strong.png) · [Viewport](desktop/light/84-superficie-strong-viewport.png) | [Completa](tablet/light/84-superficie-strong.png) · [Viewport](tablet/light/84-superficie-strong-viewport.png) | [Completa](mobile/light/84-superficie-strong.png) · [Viewport](mobile/light/84-superficie-strong-viewport.png) |
| Superfície semântica: success | [Completa](desktop/light/84-superficie-success.png) · [Viewport](desktop/light/84-superficie-success-viewport.png) | [Completa](tablet/light/84-superficie-success.png) · [Viewport](tablet/light/84-superficie-success-viewport.png) | [Completa](mobile/light/84-superficie-success.png) · [Viewport](mobile/light/84-superficie-success-viewport.png) |
| Superfície semântica: warning | [Completa](desktop/light/84-superficie-warning.png) · [Viewport](desktop/light/84-superficie-warning-viewport.png) | [Completa](tablet/light/84-superficie-warning.png) · [Viewport](tablet/light/84-superficie-warning-viewport.png) | [Completa](mobile/light/84-superficie-warning.png) · [Viewport](mobile/light/84-superficie-warning-viewport.png) |

#### Feedback interativo

| Seção, componente ou estado | Desktop | Tablet | Mobile |
| --- | --- | --- | --- |
| Toast temporário: Atenção | [Completa](desktop/light/38-toast-atencao.png) · [Viewport](desktop/light/38-toast-atencao-viewport.png) | [Completa](tablet/light/38-toast-atencao.png) · [Viewport](tablet/light/38-toast-atencao-viewport.png) | [Completa](mobile/light/38-toast-atencao.png) · [Viewport](mobile/light/38-toast-atencao-viewport.png) |
| Toast temporário: Erro | [Completa](desktop/light/38-toast-erro.png) · [Viewport](desktop/light/38-toast-erro-viewport.png) | [Completa](tablet/light/38-toast-erro.png) · [Viewport](tablet/light/38-toast-erro-viewport.png) | [Completa](mobile/light/38-toast-erro.png) · [Viewport](mobile/light/38-toast-erro-viewport.png) |
| Toast temporário: Informação | [Completa](desktop/light/38-toast-informacao.png) · [Viewport](desktop/light/38-toast-informacao-viewport.png) | [Completa](tablet/light/38-toast-informacao.png) · [Viewport](tablet/light/38-toast-informacao-viewport.png) | [Completa](mobile/light/38-toast-informacao.png) · [Viewport](mobile/light/38-toast-informacao-viewport.png) |
| Toast temporário: Neutro | [Completa](desktop/light/38-toast-neutro.png) · [Viewport](desktop/light/38-toast-neutro-viewport.png) | [Completa](tablet/light/38-toast-neutro.png) · [Viewport](tablet/light/38-toast-neutro-viewport.png) | [Completa](mobile/light/38-toast-neutro.png) · [Viewport](mobile/light/38-toast-neutro-viewport.png) |
| Toast temporário: Sucesso | [Completa](desktop/light/38-toast-sucesso.png) · [Viewport](desktop/light/38-toast-sucesso-viewport.png) | [Completa](tablet/light/38-toast-sucesso.png) · [Viewport](tablet/light/38-toast-sucesso-viewport.png) | [Completa](mobile/light/38-toast-sucesso.png) · [Viewport](mobile/light/38-toast-sucesso-viewport.png) |

#### Sobreposições

| Seção, componente ou estado | Desktop | Tablet | Mobile |
| --- | --- | --- | --- |
| Modal de criação de contato aberto | [Completa](desktop/light/40-modal-formulario.png) · [Viewport](desktop/light/40-modal-formulario-viewport.png) | [Completa](tablet/light/40-modal-formulario.png) · [Viewport](tablet/light/40-modal-formulario-viewport.png) | [Completa](mobile/light/40-modal-formulario.png) · [Viewport](mobile/light/40-modal-formulario-viewport.png) |
| Modal com validação — continuação da área rolável | — | — | [Completa](mobile/light/41-modal-erros-validacao-continuacao.png) · [Viewport](mobile/light/41-modal-erros-validacao-continuacao-viewport.png) |
| Modal após envio vazio: erros de validação | [Completa](desktop/light/41-modal-erros-validacao.png) · [Viewport](desktop/light/41-modal-erros-validacao-viewport.png) | [Completa](tablet/light/41-modal-erros-validacao.png) · [Viewport](tablet/light/41-modal-erros-validacao-viewport.png) | [Completa](mobile/light/41-modal-erros-validacao.png) · [Viewport](mobile/light/41-modal-erros-validacao-viewport.png) |
| Modal preenchido com dados fictícios, sem enviar | [Completa](desktop/light/42-modal-formulario-preenchido.png) · [Viewport](desktop/light/42-modal-formulario-preenchido-viewport.png) | [Completa](tablet/light/42-modal-formulario-preenchido.png) · [Viewport](tablet/light/42-modal-formulario-preenchido-viewport.png) | [Completa](mobile/light/42-modal-formulario-preenchido.png) · [Viewport](mobile/light/42-modal-formulario-preenchido-viewport.png) |
| Confirmação de arquivamento de exemplo: impacto, cancelar e confirmar | [Completa](desktop/light/43-modal-confirmacao.png) · [Viewport](desktop/light/43-modal-confirmacao-viewport.png) | [Completa](tablet/light/43-modal-confirmacao.png) · [Viewport](tablet/light/43-modal-confirmacao-viewport.png) | [Completa](mobile/light/43-modal-confirmacao.png) · [Viewport](mobile/light/43-modal-confirmacao-viewport.png) |
| Drawer de consulta aberto: Direita | [Completa](desktop/light/44-drawer-direita.png) · [Viewport](desktop/light/44-drawer-direita-viewport.png) | [Completa](tablet/light/44-drawer-direita.png) · [Viewport](tablet/light/44-drawer-direita-viewport.png) | [Completa](mobile/light/44-drawer-direita.png) · [Viewport](mobile/light/44-drawer-direita-viewport.png) |
| Drawer de consulta aberto: Esquerda | [Completa](desktop/light/45-drawer-esquerda.png) · [Viewport](desktop/light/45-drawer-esquerda-viewport.png) | [Completa](tablet/light/45-drawer-esquerda.png) · [Viewport](tablet/light/45-drawer-esquerda-viewport.png) | [Completa](mobile/light/45-drawer-esquerda.png) · [Viewport](mobile/light/45-drawer-esquerda-viewport.png) |
| Drawer de consulta aberto: Abaixo | [Completa](desktop/light/46-drawer-inferior.png) · [Viewport](desktop/light/46-drawer-inferior-viewport.png) | [Completa](tablet/light/46-drawer-inferior.png) · [Viewport](tablet/light/46-drawer-inferior-viewport.png) | [Completa](mobile/light/46-drawer-inferior.png) · [Viewport](mobile/light/46-drawer-inferior-viewport.png) |
| Popover explicativo do status Em atendimento | [Completa](desktop/light/47-popover-status.png) · [Viewport](desktop/light/47-popover-status-viewport.png) | [Completa](tablet/light/47-popover-status.png) · [Viewport](tablet/light/47-popover-status-viewport.png) | [Completa](mobile/light/47-popover-status.png) · [Viewport](mobile/light/47-popover-status-viewport.png) |
| Menu de ações: editar, consultar e arquivar | [Completa](desktop/light/48-menu-contextual.png) · [Viewport](desktop/light/48-menu-contextual-viewport.png) | [Completa](tablet/light/48-menu-contextual.png) · [Viewport](tablet/light/48-menu-contextual-viewport.png) | [Completa](mobile/light/48-menu-contextual.png) · [Viewport](mobile/light/48-menu-contextual-viewport.png) |
| Tooltip aberto na posição bottom | [Completa](desktop/light/49-tooltip-bottom.png) · [Viewport](desktop/light/49-tooltip-bottom-viewport.png) | [Completa](tablet/light/49-tooltip-bottom.png) · [Viewport](tablet/light/49-tooltip-bottom-viewport.png) | [Completa](mobile/light/49-tooltip-bottom.png) · [Viewport](mobile/light/49-tooltip-bottom-viewport.png) |
| Tooltip aberto na posição left | [Completa](desktop/light/49-tooltip-left.png) · [Viewport](desktop/light/49-tooltip-left-viewport.png) | [Completa](tablet/light/49-tooltip-left.png) · [Viewport](tablet/light/49-tooltip-left-viewport.png) | [Completa](mobile/light/49-tooltip-left.png) · [Viewport](mobile/light/49-tooltip-left-viewport.png) |
| Tooltip aberto na posição right | [Completa](desktop/light/49-tooltip-right.png) · [Viewport](desktop/light/49-tooltip-right-viewport.png) | [Completa](tablet/light/49-tooltip-right.png) · [Viewport](tablet/light/49-tooltip-right-viewport.png) | [Completa](mobile/light/49-tooltip-right.png) · [Viewport](mobile/light/49-tooltip-right-viewport.png) |
| Tooltip aberto na posição top | [Completa](desktop/light/49-tooltip-top.png) · [Viewport](desktop/light/49-tooltip-top-viewport.png) | [Completa](tablet/light/49-tooltip-top.png) · [Viewport](tablet/light/49-tooltip-top-viewport.png) | [Completa](mobile/light/49-tooltip-top.png) · [Viewport](mobile/light/49-tooltip-top-viewport.png) |
| Modal amplo de revisão de informações | [Completa](desktop/light/50-modal-workspace.png) · [Viewport](desktop/light/50-modal-workspace-viewport.png) | [Completa](tablet/light/50-modal-workspace.png) · [Viewport](tablet/light/50-modal-workspace-viewport.png) | [Completa](mobile/light/50-modal-workspace.png) · [Viewport](mobile/light/50-modal-workspace-viewport.png) |
| Modal de consulta acionado a partir da tabela | [Completa](desktop/light/82-modal-consulta-tabela.png) · [Viewport](desktop/light/82-modal-consulta-tabela-viewport.png) | [Completa](tablet/light/82-modal-consulta-tabela.png) · [Viewport](tablet/light/82-modal-consulta-tabela-viewport.png) | [Completa](mobile/light/82-modal-consulta-tabela.png) · [Viewport](mobile/light/82-modal-consulta-tabela-viewport.png) |

#### Estados

| Seção, componente ou estado | Desktop | Tablet | Mobile |
| --- | --- | --- | --- |
| Campo focado: contorno real de foco e estados indisponíveis | [Completa](desktop/light/60-foco-teclado.png) · [Viewport](desktop/light/60-foco-teclado-viewport.png) | [Completa](tablet/light/60-foco-teclado.png) · [Viewport](tablet/light/60-foco-teclado-viewport.png) | [Completa](mobile/light/60-foco-teclado.png) · [Viewport](mobile/light/60-foco-teclado-viewport.png) |
| Estado hover do botão primário | [Completa](desktop/light/61-hover-botao.png) · [Viewport](desktop/light/61-hover-botao-viewport.png) | [Completa](tablet/light/61-hover-botao.png) · [Viewport](tablet/light/61-hover-botao-viewport.png) | [Completa](mobile/light/61-hover-botao.png) · [Viewport](mobile/light/61-hover-botao-viewport.png) |
| Cenário de dados: Lista vazia | [Completa](desktop/light/62-lista-vazia.png) · [Viewport](desktop/light/62-lista-vazia-viewport.png) | [Completa](tablet/light/62-lista-vazia.png) · [Viewport](tablet/light/62-lista-vazia-viewport.png) | [Completa](mobile/light/62-lista-vazia.png) · [Viewport](mobile/light/62-lista-vazia-viewport.png) |
| Cenário de dados: Falha ao carregar | [Completa](desktop/light/63-falha-carregamento.png) · [Viewport](desktop/light/63-falha-carregamento-viewport.png) | [Completa](tablet/light/63-falha-carregamento.png) · [Viewport](tablet/light/63-falha-carregamento-viewport.png) | [Completa](mobile/light/63-falha-carregamento.png) · [Viewport](mobile/light/63-falha-carregamento-viewport.png) |
| Recuperação de erro: carregamento transitório real | [Completa](desktop/light/64-recuperacao-carregando.png) · [Viewport](desktop/light/64-recuperacao-carregando-viewport.png) | [Completa](tablet/light/64-recuperacao-carregando.png) · [Viewport](tablet/light/64-recuperacao-carregando-viewport.png) | [Completa](mobile/light/64-recuperacao-carregando.png) · [Viewport](mobile/light/64-recuperacao-carregando-viewport.png) |
| Recuperação concluída: dados disponíveis | [Completa](desktop/light/65-recuperacao-concluida.png) · [Viewport](desktop/light/65-recuperacao-concluida-viewport.png) | [Completa](tablet/light/65-recuperacao-concluida.png) · [Viewport](tablet/light/65-recuperacao-concluida-viewport.png) | [Completa](mobile/light/65-recuperacao-concluida.png) · [Viewport](mobile/light/65-recuperacao-concluida-viewport.png) |
| Ação de salvar em andamento: loading e cancelamento bloqueado | [Completa](desktop/light/66-salvamento-loading.png) · [Viewport](desktop/light/66-salvamento-loading-viewport.png) | [Completa](tablet/light/66-salvamento-loading.png) · [Viewport](tablet/light/66-salvamento-loading-viewport.png) | [Completa](mobile/light/66-salvamento-loading.png) · [Viewport](mobile/light/66-salvamento-loading-viewport.png) |
| Simulação concluída: confirmação de salvamento local | [Completa](desktop/light/67-salvamento-sucesso.png) · [Viewport](desktop/light/67-salvamento-sucesso-viewport.png) | [Completa](tablet/light/67-salvamento-sucesso.png) · [Viewport](tablet/light/67-salvamento-sucesso-viewport.png) | [Completa](mobile/light/67-salvamento-sucesso.png) · [Viewport](mobile/light/67-salvamento-sucesso-viewport.png) |
| Lista após limpar uma busca sem resultados | [Completa](desktop/light/68-busca-recuperada.png) · [Viewport](desktop/light/68-busca-recuperada-viewport.png) | [Completa](tablet/light/68-busca-recuperada.png) · [Viewport](tablet/light/68-busca-recuperada-viewport.png) | [Completa](mobile/light/68-busca-recuperada.png) · [Viewport](mobile/light/68-busca-recuperada-viewport.png) |
| Erros de campos obrigatórios após envio vazio | [Completa](desktop/light/69-validacao-formulario.png) · [Viewport](desktop/light/69-validacao-formulario-viewport.png) | [Completa](tablet/light/69-validacao-formulario.png) · [Viewport](tablet/light/69-validacao-formulario-viewport.png) | [Completa](mobile/light/69-validacao-formulario.png) · [Viewport](mobile/light/69-validacao-formulario-viewport.png) |

#### Responsividade

| Seção, componente ou estado | Desktop | Tablet | Mobile |
| --- | --- | --- | --- |
| Controles da prévia selecionados em desktop | [Completa](desktop/light/70-previa-desktop.png) · [Viewport](desktop/light/70-previa-desktop-viewport.png) | [Completa](tablet/light/70-previa-desktop.png) · [Viewport](tablet/light/70-previa-desktop-viewport.png) | [Completa](mobile/light/70-previa-desktop.png) · [Viewport](mobile/light/70-previa-desktop-viewport.png) |
| Controles da prévia selecionados em mobile | [Completa](desktop/light/70-previa-mobile.png) · [Viewport](desktop/light/70-previa-mobile-viewport.png) | [Completa](tablet/light/70-previa-mobile.png) · [Viewport](tablet/light/70-previa-mobile-viewport.png) | [Completa](mobile/light/70-previa-mobile.png) · [Viewport](mobile/light/70-previa-mobile-viewport.png) |
| Controles da prévia selecionados em tablet | [Completa](desktop/light/70-previa-tablet.png) · [Viewport](desktop/light/70-previa-tablet-viewport.png) | [Completa](tablet/light/70-previa-tablet.png) · [Viewport](tablet/light/70-previa-tablet-viewport.png) | [Completa](mobile/light/70-previa-tablet.png) · [Viewport](mobile/light/70-previa-tablet-viewport.png) |

### Tema escuro

#### Seções

| Seção, componente ou estado | Desktop | Tablet | Mobile |
| --- | --- | --- | --- |
| Visão geral completa | [Completa](desktop/dark/01-visao-geral.png) | [Completa](tablet/dark/01-visao-geral.png) | [Completa](mobile/dark/01-visao-geral.png) |
| Fundamentos: cores, fontes, espaços, raios, sombras e ícones | [Completa](desktop/dark/02-fundamentos-visuais.png) | [Completa](tablet/dark/02-fundamentos-visuais.png) | [Completa](mobile/dark/02-fundamentos-visuais.png) |
| Estados disponíveis, foco, disabled, validação, loading, vazio e erros | [Completa](desktop/dark/09-estados-validacao.png) | [Completa](tablet/dark/09-estados-validacao.png) | [Completa](mobile/dark/09-estados-validacao.png) |
| Estruturas de página e convenções de UX | [Completa](desktop/dark/10-padroes-layout.png) | [Completa](tablet/dark/10-padroes-layout.png) | [Completa](mobile/dark/10-padroes-layout.png) |
| Demonstração e orientações para desktop, tablet e mobile | [Completa](desktop/dark/11-responsividade.png) | [Completa](tablet/dark/11-responsividade.png) | [Completa](mobile/dark/11-responsividade.png) |

#### Componentes

| Seção, componente ou estado | Desktop | Tablet | Mobile |
| --- | --- | --- | --- |
| Botões: variantes, tamanhos, ícones, grupos, links e ações de formulário | [Completa](desktop/dark/03-componentes-acoes.png) | [Completa](tablet/dark/03-componentes-acoes.png) | [Completa](mobile/dark/03-componentes-acoes.png) |
| Inputs, máscaras, seleção, escolhas, datas e formulário | [Completa](desktop/dark/04-componentes-formularios.png) | [Completa](tablet/dark/04-componentes-formularios.png) | [Completa](mobile/dark/04-componentes-formularios.png) |
| Sidebar, header, breadcrumbs, abas, paginação e etapas | [Completa](desktop/dark/05-componentes-navegacao.png) | [Completa](tablet/dark/05-componentes-navegacao.png) | [Completa](mobile/dark/05-componentes-navegacao.png) |
| Tabela, filtros, cards, indicadores, badges e avatares | [Completa](desktop/dark/06-componentes-dados.png) | [Completa](tablet/dark/06-componentes-dados.png) | [Completa](mobile/dark/06-componentes-dados.png) |
| Alertas, toasts, skeletons, loading e progresso | [Completa](desktop/dark/07-componentes-feedback.png) | [Completa](tablet/dark/07-componentes-feedback.png) | [Completa](mobile/dark/07-componentes-feedback.png) |
| Acionadores de modal, confirmação, drawer, popover, menu e tooltip | [Completa](desktop/dark/08-componentes-interacoes.png) | [Completa](tablet/dark/08-componentes-interacoes.png) | [Completa](mobile/dark/08-componentes-interacoes.png) |

#### Páginas completas

| Seção, componente ou estado | Desktop | Tablet | Mobile |
| --- | --- | --- | --- |
| Formulário de criação — prévia independente com todo o conteúdo | [Completa](desktop/dark/12-pagina-create.png) | [Completa](tablet/dark/12-pagina-create.png) | [Completa](mobile/dark/12-pagina-create.png) |
| Dashboard comercial — prévia independente com todo o conteúdo | [Completa](desktop/dark/12-pagina-dashboard.png) | [Completa](tablet/dark/12-pagina-dashboard.png) | [Completa](mobile/dark/12-pagina-dashboard.png) |
| Detalhes de um contato — prévia independente com todo o conteúdo | [Completa](desktop/dark/12-pagina-detail.png) | [Completa](tablet/dark/12-pagina-detail.png) | [Completa](mobile/dark/12-pagina-detail.png) |
| Formulário de edição — prévia independente com todo o conteúdo | [Completa](desktop/dark/12-pagina-edit.png) | [Completa](tablet/dark/12-pagina-edit.png) | [Completa](mobile/dark/12-pagina-edit.png) |
| Listagem de contatos — prévia independente com todo o conteúdo | [Completa](desktop/dark/12-pagina-list.png) | [Completa](tablet/dark/12-pagina-list.png) | [Completa](mobile/dark/12-pagina-list.png) |

#### Formulários interativos

| Seção, componente ou estado | Desktop | Tablet | Mobile |
| --- | --- | --- | --- |
| Select aberto no tema escuro | [Completa](desktop/dark/85-select-aberto.png) · [Viewport](desktop/dark/85-select-aberto-viewport.png) | [Completa](tablet/dark/85-select-aberto.png) · [Viewport](tablet/dark/85-select-aberto-viewport.png) | [Completa](mobile/dark/85-select-aberto.png) · [Viewport](mobile/dark/85-select-aberto-viewport.png) |

#### Sobreposições

| Seção, componente ou estado | Desktop | Tablet | Mobile |
| --- | --- | --- | --- |
| Modal de criação no tema escuro | [Completa](desktop/dark/86-modal-formulario.png) · [Viewport](desktop/dark/86-modal-formulario-viewport.png) | [Completa](tablet/dark/86-modal-formulario.png) · [Viewport](tablet/dark/86-modal-formulario-viewport.png) | [Completa](mobile/dark/86-modal-formulario.png) · [Viewport](mobile/dark/86-modal-formulario-viewport.png) |
| Popover de status no tema escuro | [Completa](desktop/dark/87-popover-status.png) · [Viewport](desktop/dark/87-popover-status-viewport.png) | [Completa](tablet/dark/87-popover-status.png) · [Viewport](tablet/dark/87-popover-status-viewport.png) | [Completa](mobile/dark/87-popover-status.png) · [Viewport](mobile/dark/87-popover-status-viewport.png) |

## Verificação final

- 502 imagens indexadas; nenhum PNG sem referência.
- 0 erros de execução registrados nos lotes finais.
- Nenhum arquivo em `src` alterado durante a documentação.
