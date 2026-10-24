# Design system do Kifer Saúde

A rota `/design-system` documenta a biblioteca real de `src/design-system`. É uma referência para evolução futura do CRM; as outras telas não foram migradas por este showcase.

## Organização

1. **Fundamentos visuais:** cores semânticas do tema ativo, Playfair Display e Inter, espaçamentos, raios, bordas, sombras e Lucide. Os valores vêm dos tokens existentes, sem uma segunda paleta.
2. **Componentes:** ações, formulários, navegação, dados, feedback e interações. Cada amostra inclui uma referência expansível à implementação. Famílias e aliases de cards compartilham a base existente.
3. **Estados:** hover e foco reais, indisponibilidade, validação, carregamento, conclusão, lista vazia e recuperação de erro.
4. **Padrões de layout:** listagem, detalhes, criação, edição e dashboard com dados locais.
5. **Responsividade:** os mesmos exemplos em um iframe de desktop (mínimo 1024 px), tablet (768 px) e mobile (390 px). A prévia pode ser aberta em outra aba para testar outras larguras e dispositivos.

Links diretos: `/design-system#foundations`, `#components`, `#states`, `#patterns` e `#responsive`. O tema do catálogo é independente do tema do CRM.

## Convenções de UX

| Área | Convenção |
| --- | --- |
| Cabeçalho | Breadcrumb acima do título; título à esquerda, descrição curta logo abaixo. |
| Ações | Uma ação principal por contexto, à direita no desktop e abaixo do título quando faltar espaço. Secundárias antes da principal. |
| Busca e filtros | Abaixo do cabeçalho; busca primeiro, filtros próximos. Exibir contagem e opção explícita de limpar. |
| Formulários | Rótulo acima do campo; instrução curta e exemplo de formato; obrigatoriedade visível. Validar junto ao campo e focar o primeiro erro. |
| Salvar e cancelar | `FormActions` no final do formulário. Cancelar antes de Salvar. Durante o envio, impedir repetição e cancelamento. |
| Detalhes | Página para trabalho contínuo; drawer para consulta rápida; modal para tarefa curta ou confirmação. |
| Feedback | Sucesso só após uma conclusão. Vazio orienta o início; erro explica como recuperar. Cor sempre acompanhada por texto. |
| Mobile | Navegação em menu, formulários em uma coluna e lista de contatos em cards que preservam as informações e ações. |

## Reutilização

Importe a API pública de `src/design-system/index.ts`. Não copie HTML/CSS de uma amostra para criar uma variante desconectada.

```tsx
import { Field, FormActions, Input, PageHeader } from '…/design-system';

<form onSubmit={handleSubmit}>
  <Field label="Nome completo" required error={errors.name}>
    <Input name="name" value={name} onChange={handleNameChange} />
  </Field>
  <FormActions onCancel={handleCancel} loading={saving} />
</form>
```

`FormActions` também aceita `form` para associar o botão a um formulário externo, `submitLabel`, `cancelLabel`, `disabled` e uma mensagem contextual. `NavigationList` usa links reais, `aria-current` e interceptação opcional de navegação, preservando cliques com modificadores.

Composição de listagens: `PageContainer` → `Breadcrumb` → `PageHeader` → `FilterBar`/`Toolbar` → `Table`/`EmptyState` → `Pagination`. Diálogos e drawers reutilizam cabeçalho, título, descrição, corpo e ações da biblioteca.

Os estilos dos exemplos ficam em `src/pages/dev/design-system-showcase.css`, carregados apenas pela rota lazy. Os estilos reutilizáveis dos novos blocos ficam em `src/design-system/components.css`, através de `styles.css`. Nenhum token global foi substituído.

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

Ao adotar os padrões em uma feature, mantenha hooks, regras e repositories no domínio proprietário. Migrar sua apresentação não autoriza alterar regras comerciais ou dados.
