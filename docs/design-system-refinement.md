# Revisão do design system — 24/10/2026

## Escopo

Revisão da biblioteca em `src/design-system` e do showcase `/design-system`, com dados locais. Nenhuma tela comercial foi migrada e nenhuma regra, integração, automação, migration ou contrato HTTP foi alterado.

Antes da implementação foram inspecionados o catálogo existente, tokens, folhas de estilo, controles, sobreposições, exemplos e testes. O projeto usa React 18, TypeScript, Vite, Tailwind, Lucide e CSS com tokens; a biblioteca existente foi preservada como base.

## Resultado

- Aparência operacional opt-in com `DesignSystemProvider`: Inter na operação; Playfair em contextos editoriais; terracota, superfícies claras e tema escuro preservados. Tokens semânticos de ações, tipografia, espaçamento, raio e dimensões de diálogos.
- `PageHeader`, `PageActions`, `ListPage`, `DetailPage`, `FormPage`, `FormSection` e `DashboardPage` definem composição e ordem de ações. `FormActions` reutiliza a mesma implementação de ações.
- Exemplos reais de listagem com busca/filtro/ordenação/paginação, detalhes, criação/edição e dashboard utilizam esses componentes. `ResponsiveCollection` alterna tabela e cards conforme o espaço do contêiner.
- Labels, descrições, erros e obrigatoriedade conectados aos controles compostos; switch acionável pelo texto; rolagem de tabelas acessível pelo teclado; áreas de toque ampliadas.
- Popovers e tooltips reposicionam-se nos limites da área visível. Calendários aninhados preservam o filtro externo; Escape fecha uma camada; portais recebem o tema correto. Diálogos mantêm suas variantes de largura e corpo rolável.
- Formulários completos em páginas; modal curto para anotação e validação; drawers para consulta contextual. Ações destrutivas separadas e confirmadas. O formulário curto mantém ações no fluxo normal; sticky é opção para formulários longos.
- Corrigidos overflow do skip link e da escala de espaços, colunas rígidas e títulos sem quebra; reduzidos espaços e tamanhos exagerados. A regra legada que aplicava serifada aos cabeçalhos operacionais foi sobreposta apenas na nova aparência.

Convenções e API: [design-system.md](design-system.md). Capturas: [índice visual atualizado](design-system/screenshots/refinement-20261024/README.md).

## Validação

Ambiente local: `http://127.0.0.1:5174/design-system`. As evidências desta revisão correspondem ao código local; não representam uma publicação em produção.

| Verificação | Resultado |
| --- | --- |
| Playwright — layout | 128 combinações de seções, abas e cinco páginas, em 320/390/768/1920px e temas claro/escuro. Sem overflow horizontal do documento ou elementos excedentes fora das áreas de rolagem localizadas. |
| Playwright — interações | 136 verificações: seletores, combobox, data/hora, modal com validação/salvamento, três drawers, popover, menu, quatro posições de tooltip, diálogo amplo e calendário aninhado. Ambos os temas e quatro larguras. |
| Capturas | FullPage com fontes e imagens carregadas e animações desativadas; inspeção visual de desktop, tablet e mobile. |
| Testes da biblioteca e exemplos | 29 testes aprovados em seis arquivos, incluindo 11 testes de layout, associação de campos, tema, foco e camadas. |
| `npm test` | 1.690 aprovados; seis falhas em seis arquivos. Todas as falhas reproduzidas em cópia limpa de `HEAD`, usando as mesmas dependências. |
| `npm run lint` | Aprovado, com quatro avisos preexistentes. |
| `npm run build` | Aprovado, incluindo verificação de segredos, auditoria visual e bundle do editor. Aviso de chunk grande já presente. |
| `npm run architecture:check` | Aprovado. |
| `npm run typecheck` | Dois erros preexistentes de `Uint8Array<ArrayBufferLike>`; nenhum novo erro na biblioteca ou showcase. |

Roteiros e relatórios brutos locais: `output/playwright/design-system-refinement-20261024/`. As áreas de prévia maior que o dispositivo, abas e tabelas extensas possuem rolagem localizada intencional; isso não é overflow do documento.

Após compactar as colunas de seleção e ações, a listagem também foi revalidada nas oito combinações de largura/tema, sem overflow. As capturas aguardam explicitamente o carregamento do documento dentro do iframe; as páginas completas de cada padrão documentam o conteúdo além da área rolável da prévia.

## Pendências externas a esta revisão

- Typecheck: `src/features/communication/whatsapp/hooks/useVoiceRecording.ts:248` e `src/lib/xlsxExport.ts:241`.
- Testes existentes: sincronização de próximo retorno em `write-actions.test.ts`; contratos de campanhas em `campaign-admission-safety-contract.test.ts`; contrato de simulação em `comm-whatsapp-follow-up-v2-contract.test.ts`; mocks sem `.is()` em `remindersRepository.test.ts` e `inboxRepository.test.ts`; seletor de textarea desatualizado em `FeatureEditorDrawer.test.tsx`.
- Avisos de lint: três em `local-artifacts/ux-review-20261023/` e um em `useMetaAds.ts`. O browser também registra o aviso legado de lifecycle do `react-helmet`; as matrizes não registraram exceções de página.
- Adoção nas features do CRM, validação de cada fluxo real, zoom/teclado virtual e testes com leitores de tela continuam sendo etapas da migração futura. A matriz usa Chromium e não substitui testes em dispositivos físicos e outros navegadores.

As capturas anteriores na raiz de `docs/design-system/screenshots/` foram preservadas como histórico.

## Complemento — geometria dos controles compostos

Após a revisão visual do usuário, foi corrigida a herança de raios em cápsula nos contêineres de segmentação, opções de dropdown, grupos de botões, paginação, checkboxes, ações de campos, fechar e calendários. A aparência operacional agora cobre também o próprio nó de portal do popover, além de seus descendentes.

Segmentação usa contêiner de 12px com padding de 4px e itens de 8px. Menus usam superfície de 12px e opções de 8px em seleção, hover e foco. Grupos conectados têm contorno de 8px, cantos internos das extremidades de 7px e junções retas. Esses valores derivam dos tokens compartilhados.

As opções consecutivas dos dropdowns também receberam separação de 4px (`--space-1`), aplicada aos selects, comboboxes, multiseleção e filtros, para distinguir fundos de seleção e hover de linhas vizinhas.

Playwright verificou 73 condições de geometria e estados nas quatro larguras e nos dois temas, além de confirmar ausência de overflow nas listagens. A auditoria dos controles visíveis nas abas do catálogo, Estados e Padrões não encontrou raios de cápsula residuais. O build foi aprovado e as capturas foram atualizadas.
