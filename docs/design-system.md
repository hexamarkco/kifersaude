# Design system do Kifer Saúde

A rota `/design-system` documenta a biblioteca real de `src/design-system`. É uma referência para evolução futura do CRM; as outras telas não foram migradas por este showcase.

## Organização

1. **Fundamentos visuais:** cores semânticas do tema ativo, Inter para operação e Playfair Display para usos editoriais, espaçamentos, raios, bordas, sombras e Lucide. Os valores vêm dos tokens existentes, sem uma segunda paleta.
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

Importe a API pública de `src/design-system/index.ts`. Não copie HTML/CSS de uma amostra para criar uma variante desconectada. `DesignSystemProvider` é a fronteira explícita da aparência operacional refinada: fornece tema aos componentes e portais. A rota já o utiliza; migrar as demais telas será uma etapa própria.

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

- **Tipografia:** Inter em títulos operacionais, campos, tabelas e ações. Tokens `--type-ui-title`, `--type-ui-section`, `--type-ui-heading` definem a hierarquia compacta. `Heading family="display"` reserva Playfair para apresentações editoriais.
- **Escala:** `--layout-gap`, `--section-gap`, `--page-gutter` usam a escala existente de espaços. Raios `6/8/12/16px`; aliases semânticos `--radius-control`, `--radius-panel`, `--radius-dialog`. Superfícies planas; sombras para elementos sobrepostos.
- **Controles compostos:** opções de dropdown, paginação, calendário e ações usam raio de 8px em todos os estados. Opções consecutivas de dropdown têm separação de 4px, preservando a distinção entre seleção, hover e foco. Segmentação tem contêiner de 12px, itens de 8px e recuo de 4px. Grupos de botões conectados usam contorno de 8px, extremidades internas de 7px (descontando a borda) e junções retas. Checkboxes usam 6px. Formas circulares ficam nos indicadores, avatares, radios e switches; estados não alteram a geometria do controle.
- **Temas:** `--action-primary-bg`, `--action-primary-hover`, `--action-primary-text` e `--action-accent-text` mantêm legibilidade sobre terracota e dourado em claro/escuro. O tema acompanha toasts, tooltips, calendários e diálogos via contexto, inclusive com múltiplas raízes na página.
- **Campos:** `Field` conecta label, descrição, erro, obrigatoriedade e `aria-invalid` também nos controles compostos. Descrições operacionais ficam visíveis. A validação do exemplo foca o primeiro erro.
- **Toque:** controles operacionais têm mínimo de 44px no mobile; dias do calendário têm 36px para caber em sete colunas a 320px. `Checkbox touchTarget` amplia a área clicável sem aumentar o desenho do checkbox.
- **Sobreposições:** popovers e tooltips compartilham posicionamento que inverte o lado quando necessário e respeita a área visível, inclusive ao mudar o viewport. Escape fecha a camada interna antes da externa; foco volta ao acionador. Diálogos têm corpo rolável e ações separadas. Use modais para confirmações/tarefas rápidas; criação e edição completas ficam em páginas.

O entrypoint continua `src/design-system/styles.css`: `foundation.css` contém tokens; `components.css` os primitivos; `operational.css` os padrões; `themes.css` as variantes de tema. CSS particular do catálogo fica em `src/pages/dev/design-system-showcase.css`, carregado apenas na rota lazy. As mudanças de aparência ficam opt-in para não redesenhar as telas atuais.

## Limites dos exemplos

`src/pages/dev/showcase/demoData.ts` contém apenas dados ilustrativos. Busca, ordenação, filtros, seleção e paginação operam nessa base. Criar e editar atualiza o estado React da prévia; recarregar ou trocar de padrão restaura os exemplos. Observações são preservadas nos detalhes. A seleção de data não agenda um atendimento real.

Os exemplos não importam repositories, cliente Supabase ou integrações. Não enviam comunicações e não alteram registros do CRM. O carregamento e a recuperação de erro na seção Estados são simulações locais, explicitamente identificadas.

## Validação

```bash
npm test -- src/design-system/components/__tests__ src/pages/dev/showcase/WorkspacePreview.test.tsx
npm run typecheck
npm run lint
npm run architecture:check
npm run build
```

O formulário curto da prévia mantém as ações no fluxo normal. A opção `sticky` é destinada a formulários longos e deve ser verificada junto ao contêiner de rolagem da feature.

Evidências desta revisão: [relatório de validação](design-system-refinement.md). As capturas anteriores na raiz de `docs/design-system/screenshots/` são históricas; as atuais ficam na subpasta `refinement-20261024/`.

Ao adotar os padrões em uma feature, mantenha hooks, regras e repositories no domínio proprietário. Migrar sua apresentação não autoriza alterar regras comerciais ou dados.
