# Design system do Kifer Saúde

A rota `/design-system` documenta a biblioteca real de `src/design-system`. É o contrato visual da aplicação: páginas públicas, CRM, modais, menus e conteúdo compartilhado consomem a mesma API e os mesmos tokens.

## Organização

1. **Fundamentos visuais:** cores semânticas do tema ativo, Poppins para operação e Sora para usos editoriais, espaçamentos, raios, bordas, sombras e Lucide. Os valores vêm dos tokens existentes, sem uma segunda paleta.
2. **Componentes:** ações, formulários, navegação, dados, feedback e interações. Cada amostra inclui uma referência expansível à implementação. Famílias e aliases de cards compartilham a base existente.
3. **Estados:** hover e foco reais, indisponibilidade, validação, carregamento, conclusão, lista vazia e recuperação de erro.
4. **Padrões de layout:** listagem, detalhes, criação, edição e dashboard com dados locais.
5. **Responsividade:** os mesmos exemplos em um iframe de desktop (mínimo 1024 px), tablet (768 px) e mobile (390 px) e compacto (320 px). A prévia pode ser aberta em outra aba para testar outras larguras e dispositivos.

Links diretos: `/design-system#foundations`, `#components`, `#states`, `#patterns` e `#responsive`. O tema do catálogo é independente do tema do CRM.

## Convenções de UX

| Área | Convenção |
| --- | --- |
| Cabeçalho | Breadcrumb acima do título; título à esquerda, descrição curta logo abaixo. |
| Ações | Uma ação principal por contexto, à direita no desktop e abaixo do título quando faltar espaço. `PageActions` posiciona secundárias antes da principal e mantém a destrutiva separada. |
| Busca e filtros | Abaixo do cabeçalho; busca primeiro, filtros próximos. Exibir contagem e opção explícita de limpar. |
| Formulários | Rótulo acima do campo; instrução curta e exemplo de formato; obrigatoriedade visível. Validar junto ao campo e focar o primeiro erro. |
| Salvar e cancelar | `FormActions` no final do formulário. Cancelar antes de Salvar. `sticky` mantém a barra visível em páginas longas, preservando seu espaço no documento e a área segura do dispositivo. Durante o envio, impedir repetição e cancelamento. |
| Detalhes | Página para trabalho contínuo; drawer para consulta rápida; modal para tarefa curta ou confirmação. |
| Feedback | Sucesso só após uma conclusão. Vazio orienta o início; erro explica como recuperar. Cor sempre acompanhada por texto. |
| Mobile | Navegação em menu, formulários em uma coluna e lista de contatos em cards que preservam as informações e ações. |

## Reutilização e adoção

Importe a API pública de `src/design-system/index.ts`. Não copie HTML/CSS de uma amostra para criar uma variante desconectada. `DesignSystemProvider` fornece o tema aos componentes e portais. A aparência oficial é o padrão global de `.painel-theme.kifer-ds`; não há ativação visual exclusiva do showcase. O shell do CRM e as páginas públicas compartilham essa biblioteca.

```tsx
import {
  DesignSystemProvider, Field, FormActions, FormPage, FormSection, Input,
} from '…/design-system';

<DesignSystemProvider theme="light">
  <FormPage
    header={{ title: 'Novo contato', breadcrumbs: <BreadcrumbDoModulo /> }}
    onSubmit={handleSubmit}
    actions={<FormActions onCancel={handleCancel} loading={saving} sticky />}
  >
    <FormSection title="Identificação" description="Informe como podemos falar com o contato.">
      <Field label="Nome completo" required error={errors.name}>
        <Input name="name" value={name} onChange={handleNameChange} />
      </Field>
    </FormSection>
  </FormPage>
</DesignSystemProvider>
```

O código acima ilustra composição; handlers, estado, validação e breadcrumb pertencem ao módulo consumidor.

| Componente | Responsabilidade e slots |
| --- | --- |
| `PageHeader` | Breadcrumbs acima; título, identificação e status; descrição; ações. `appearance="operational"` aplica tipografia operacional. |
| `PageActions` | Objetos `primary`, `secondary[]`, `destructive`, com label, ícone, handler, form e estados. `placement="form"`, `sticky` e mensagem contextual. Qualquer ação em loading bloqueia o conjunto. |
| `ListPage` | `header`, `search`, `filters`, `summary`, resultados em `children`, `pagination` nesta ordem. |
| `DetailPage` | `header` com identificação/status, seções em `children` e `aside` opcional. |
| `FormPage` | Criação/edição em um formulário real com `id`, `onSubmit`, `noValidate`, campos agrupados e `actions`. |
| `FormSection` | Fieldset e legend, descrição e grade de campos; duas colunas com espaço, uma em mobile. |
| `DashboardPage` | `header`, `filters`, `indicators` e conteúdo. Indicadores distribuem-se conforme o espaço disponível. |
| `ResponsiveCollection` | `table` e `cards` com os mesmos dados e ações. Container query troca a apresentação quando o espaço do conteúdo é de até 44rem. |

`FormActions` delega ao `PageActions`, preservando sua API existente: `form`, `submitLabel`, `cancelLabel`, `disabled`, `loading`, mensagem e `onCancel`. Cancelar é `type="button"`; salvar é `type="submit"`. Voltar retorna ao contexto anterior, cancelar abandona a edição e excluir abre confirmação. Hooks e navegação do módulo controlam essas ações; os componentes não persistem dados.

`NavigationList` usa links reais, `aria-current` e interceptação opcional, preservando cliques com modificadores. Tabelas que precisem manter colunas usam rolagem localizada acessível pelo teclado. A prévia de responsividade também tem rolagem localizada ao simular uma tela maior que o dispositivo.

## Tokens e acessibilidade

- **Tipografia do workspace.** Sora compõe os títulos e indicadores. Poppins usa 14 px em abas, rótulos, controles e tabelas, 13 px em legendas e 15 px na descrição das páginas. Use os tokens semânticos para manter essa escala nas telas e nos diálogos.
- **Escala:** `--layout-gap`, `--section-gap`, `--page-gutter` usam a escala existente de espaços. Raios `6/8/12/16px`; aliases semânticos `--radius-control`, `--radius-panel`, `--radius-dialog`. Superfícies planas; sombras para elementos sobrepostos.
- **Controles compostos:** opções de dropdown, paginação, calendário e ações usam raio de 8px em todos os estados. Opções consecutivas de dropdown têm separação de 4px, preservando a distinção entre seleção, hover e foco. Segmentação tem contêiner de 12px, itens de 8px e recuo de 4px. Grupos de botões conectados usam contorno de 8px, extremidades internas de 7px (descontando a borda) e junções retas. Checkboxes usam 6px. Formas circulares ficam nos indicadores, avatares, radios e switches; estados não alteram a geometria do controle.
- **Temas:** `--action-primary-bg`, `--action-primary-hover`, `--action-primary-text` e `--action-accent-text` mantêm legibilidade sobre terracota e dourado em claro/escuro. O tema acompanha toasts, tooltips, calendários e diálogos via contexto, inclusive com múltiplas raízes na página.
- **Campos:** `Field` conecta label, descrição, erro, obrigatoriedade e `aria-invalid` também nos controles compostos. Descrições operacionais ficam visíveis. A validação do exemplo foca o primeiro erro.
- **Toque:** controles operacionais têm mínimo de 44px no mobile; dias do calendário têm 36px para caber em sete colunas a 320px. `Checkbox touchTarget` amplia a área clicável sem aumentar o desenho do checkbox.
- **Sobreposições:** popovers e tooltips compartilham posicionamento que inverte o lado quando necessário e respeita a área visível, inclusive ao mudar o viewport. Escape fecha a camada interna antes da externa; foco volta ao acionador. Diálogos têm corpo rolável e ações separadas. Use modais para confirmações/tarefas rápidas; criação e edição completas ficam em páginas.

No workspace, o cabeçalho da página usa Sora de 27px no desktop e alinha as ações ao centro do bloco de título e descrição. Campos de formulário usam 44px de altura e rótulos acima do controle. Barras de filtros e ações de página usam a escala compacta de 38px no desktop. As tabelas usam cabeçalhos de 43px com texto de 10px e células de 11px. As abas sublinhadas mantêm o indicador dentro da área rolável.

Os diálogos comuns do workspace têm 620px de largura máxima, raio de 14px no desktop, título de 18px e rodapé separado do corpo rolável. No celular eles ganham margens laterais de 12px, enquanto os painéis laterais usam a altura da tela. Leads e contratos exibem a tabela com rolagem horizontal em telas estreitas e oferecem a opção **Cartões**.

Filtros rápidos de múltipla escolha podem usar `FilterMultiSelect presentation="popover"` para abrir junto ao acionador. A lista mantém as escolhas pendentes até a confirmação e devolve o foco ao fechar com Escape. O botão **Filtros** da carteira de Leads abre um diálogo central com os critérios avançados. Na tabela, a caixa do cabeçalho indica seleção parcial e atua sobre a página atual.

O único entrypoint visual é `src/design-system/styles.css`: tokens em `foundation.css`, primitivos em `components.css`, padrões em `operational.css`, temas em `themes.css`, composição da aplicação em `application.css` e comunicação em `communication.css`. `showcase.css` documenta a composição do catálogo. Os estilos de fornecedores também entram por esse entrypoint. `tailwind.preset.js` conecta as utilidades de layout aos tokens da mesma biblioteca.

Agenda e Comissões usam as classes `kds-month-*` para a grade mensal. Os eventos usam a cor semântica da categoria e a célula informa a data e a quantidade de itens ao leitor de tela. Use `MonthlyTrendChart` com `embedded` quando o cartão já fornece título e descrição, e com `ariaLabel` para identificar a série.

A central reúne Automações, Integrações e IA em abas acessíveis conforme as permissões. A aba de Automações organiza Fluxos, Modelos de mensagem e Operação. O editor usa uma paleta lateral, um canvas vertical e um painel de edição por etapa.

## Carregamento

Use `LoadingState placeholder` quando os dados ainda estão chegando e a estrutura do conteúdo é conhecida. O skeleton ocupa o lugar das linhas, campos, indicadores ou mensagens e tem um único anúncio de carregamento. Navegações internas mantêm o menu e o cabeçalho do workspace enquanto a seção abre.

`PanelAdaptiveLoadingFrame` usa o skeleton na primeira carga. Durante uma atualização, o conteúdo que já chegou permanece visível e recebe um indicador compacto de progresso.

`LoadingMonogram` usa a logo KS em toda espera com spinner. Use `inline` para indicadores em linha, `control` para botões e controles, `section` para operações em uma área e `screen` para a abertura do aplicativo. A escala de referência é de 16, 20 e 28 px, com 44 a 56 px na abertura. A animação respeita a preferência por movimento reduzido e a cor acompanha o fundo.

## Limites dos exemplos

`src/pages/dev/showcase/demoData.ts` contém apenas dados ilustrativos. Busca, ordenação, filtros, seleção e paginação operam nessa base. Criar e editar atualiza o estado React da prévia; recarregar ou trocar de padrão restaura os exemplos. Observações são preservadas nos detalhes. A seleção de data não agenda um atendimento real.

Os exemplos não importam repositories, cliente Supabase ou integrações. Não enviam comunicações e não alteram registros do CRM. O carregamento e a recuperação de erro na seção Estados são simulações locais, explicitamente identificadas.

## Validação

```bash
npm test -- src/design-system/components/__tests__ src/pages/dev/showcase/WorkspacePreview.test.tsx
npm run audit:design-system
npm run typecheck
npm run lint
npm run architecture:check
npm run build
```

O formulário curto da prévia mantém as ações no fluxo normal. A opção `sticky` é destinada a formulários longos e deve ser verificada junto ao contêiner de rolagem da feature.

Evidências desta revisão: [relatório de validação](design-system-refinement.md). As capturas anteriores na raiz de `docs/design-system/screenshots/` são históricas; as atuais ficam na subpasta `refinement-20261024/`.

Ao adotar os padrões em uma feature, mantenha hooks, regras e repositories no domínio proprietário. Migrar sua apresentação não autoriza alterar regras comerciais ou dados.

## Contrato obrigatório da aplicação

Componentes visuais devem ser importados pela API pública de `src/design-system`. Não criar controles HTML, componentes básicos paralelos, CSS local, editor ou canvas de fornecedor diretamente nas features. Tags estruturais como `main`, `section`, `div` e listas continuam servindo à composição sem recriar controles. Medidas de dados (posição de menu, progresso, zoom e valores de gráficos) permanecem dinâmicas.

Um novo componente precisa primeiro existir na biblioteca e ter exemplo funcional no showcase. `npm run audit:design-system` verifica esse contrato e a cobertura da API consumida pelas telas; o build executa o gate. Isso complementa a auditoria visual de tokens e os testes, sem substituir a revisão visual dos estados.

A migração e suas evidências estão em [design-system-adoption.md](design-system-adoption.md).

## Referência de layout obrigatória

O protótipo `PAINEL-KS-PROTOTIPO` (23/11/2026), especialmente `PROTOTIPO-KS.html` e as capturas de desktop, dark, mobile, detalhes e modais, é a fonte de verdade visual do CRM. Em caso de divergência visual, adapte os componentes e tokens da biblioteca ao protótipo; não crie uma linguagem paralela por feature. Preserve funcionalidades, dados reais, validação, permissões e contratos de API. Elementos ilustrativos sem implementação real devem ser explicitamente registrados como divergências, não simulados como funcionalidades operacionais.

Contratos usa os tokens `--type-record-*`, `--record-*` e os componentes compartilhados para lista, indicadores, abas, drawer de 660px, modal de 620px e modal amplo de 960px. As etapas de criação/edição e titular reutilizam Stepper; filtros usam o padrão de diálogo com rascunho. Referências: `imagens/desktop/contratos.png`, `imagens/escuro/contratos.png`, `imagens/mobile/contratos.png`, `imagens/detalhes/contrato-*.png`, `imagens/modais/contract-*.png`, `holder-*.png`, `dependent-create.png` e `value-adjustment.png`.

As diferenças funcionais deliberadas na revisão de Contratos: o contrato PF não exige dados empresariais; o cadastro de titular só inclui a etapa empresarial quando aplicável. Campos de produção, parcelamento, bônus e auditoria continuam disponíveis mesmo quando não representados no protótipo. As categorias de documentos usam os nomes de arquivos já disponíveis; não foi criado um fluxo novo de upload, nem novas regras para interação, agendamento ou reajuste percentual. A geometria visual segue a referência, mas a comparação renderizada precisa ser verificada em todos os estados antes de declarar paridade visual completa.

### Leads — revisão de referência

Lista, Funil e overlays devem usar as capturas `imagens/{desktop,escuro,mobile}/leads*.png`, `imagens/detalhes/lead-*.png`, `mobile-lead-*.png` e `imagens/modais/lead-*.png`. Lista e funil reutilizam a escala `--type-record-*`, tabela, filtros e menu do Design System. Drawer de detalhes e vínculo usa a geometria de 660 px, com abas Resumo, Histórico, Vínculos e Anotações; cadastro, edição, interação, lembrete e atualização em lote usam o diálogo de 620 px. Conversão usa o formulário real de contratos sobre a lista de Leads, mantendo todas as validações.

Divergências funcionais deliberadas: quantidade de pessoas e valor estimado não existem como campos no modelo de Lead; não simular os valores do protótipo. A importação de Leads via interface ainda não existe no módulo (há integração/API); não criar importação fictícia. A anotação é o campo real de observações e edição pelo cadastro, não uma entidade de notas inventada. Manter datas de interação, lembretes e atualização em lote conforme operações existentes. Não declarar fidelidade pixel a pixel antes de executar os gates e validar capturas renderizadas do CRM nos dois temas e em mobile.

### Regra de identidade visual operacional

Por decisão explícita do usuário, avatares decorativos (fotos, iniciais ou círculos representando pessoas) não devem ser usados no CRM: listas, tabelas, cards, Kanban, drawers, responsáveis, cabeçalhos e respectivos skeletons. Exibir nomes e informações de contato em texto, sem espaços reservados a avatares. Esta regra prevalece sobre as capturas do protótipo. Ícones funcionais, marcas e fotos de perfil configuradas para páginas públicas não são avatares decorativos da interface operacional.
