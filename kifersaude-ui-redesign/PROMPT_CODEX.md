# Prompt para o Codex — Redesign integral Kifer Saúde

## Contexto

Estou na raiz do repositório do Kifer Saúde. Extraí nele a pasta `kifersaude-ui-redesign/`, com referências visuais desktop/mobile e um manifesto de telas. **Implemente o redesign das interfaces existentes**, mantendo integralmente as funcionalidades de produção. A identidade visual deve corresponder à proposta aprovada: fundo bege-claro, superfícies brancas, acento terracota, tipografia operacional legível, espaçamentos consistentes, cards leves e ações previsíveis.

**Antes de codificar, leia obrigatoriamente:**

1. `kifersaude-ui-redesign/README.md`
2. `kifersaude-ui-redesign/manifest.json`
3. `kifersaude-ui-redesign/GALERIA.html` e as imagens PNG correspondentes ao módulo.
4. Os componentes e tokens reais do `/design-system` atual, além dos componentes de cada rota no código.

## Fonte de verdade e precedência

- **Funcionalidade:** o código atual da aplicação sempre prevalece para campos, regras, permissões, validações, integrações, dados, eventos e automações.
- **Visual:** para `leads-listagem`, Kanban e novo lead, use PRIMEIRO `kifersaude-ui-redesign/previous-approved/` (referências já aprovadas). Para o restante, use `references/desktop` e `references/mobile`.
- `audit-samples` contém capturas da interface anterior, úteis para garantir que nenhuma ação ou campo suma.
- Nunca trate dados fictícios ou rótulos demonstrativos dos mockups como conteúdo a ser salvo no banco.
- Caso uma referência visual omita uma função existente, **reintroduza a função no novo layout** de maneira consistente e registre o ajuste; NÃO remova a função.

## Objetivo de UX

Quero um CRM com padrão único de organização, navegação e posicionamento de ações.

- PageHeader: breadcrumb quando útil, título, descrição e ações em posições padronizadas.
- Listagens: cabeçalho → ações → busca → filtros → resultados → paginação.
- Detalhes: identificação/status → ações principais → seções → histórico/contexto.
- Formulários longos: preferir página dedicada, com agrupamento lógico e salvar/cancelar acessíveis; manter o fluxo existente quando uma migração para nova rota for arriscada.
- Modais: decisões rápidas e confirmações. Drawers: detalhes contextuais. Conversas: tratar como workspace próprio.
- Mobile-first: evitar overflow horizontal; ações essenciais acessíveis; filtros colapsáveis; tabelas reorganizadas sem perder os dados; formulários com áreas de toque confortáveis.
- Tokens compartilhados para cor, tipografia, radius, espaçamento, elevação e z-index. Variantes para botões, chips, inputs, alertas, modais e navegação.
- Diferencie ação primária, secundária e destrutiva; estados hover/focus/disabled/loading/error; suporte teclado e acessibilidade.
- O site público (`category: publico` no manifesto) é uma experiência separada: **não aplique o shell do CRM ao site institucional**.

## Metodologia — importante

**Não tente alterar todas as rotas de uma vez.** Execute por módulos, validando e consolidando os componentes de base entre etapas. Aplique mudanças no repositório real e execute os testes após cada fase.

### Fase 0 — Diagnóstico e preparação

1. Analise stack, estrutura, rotas e componentes existentes.
2. Faça mapeamento concreto `rota -> componente atual -> imagem de referência -> componentes compartilhados` usando `manifest.json`.
3. Verifique o `/design-system` e preserve seus tokens/contratos quando possível; harmonize o que divergir.
4. Confirme que o pacote fica como documentação em `kifersaude-ui-redesign/`, sem ser importado para o bundle da aplicação.
5. Crie um checklist em `kifersaude-ui-redesign/STATUS_IMPLEMENTACAO.md` com cada rota e estado: pendente, implementado, validado, exceções.

### Fase 1 — Shell e componentes compartilhados

Padronize sidebar, topbar, navegação mobile, cabeçalhos, barras de ação, containers, grids, formulários, tabelas e modais. Garanta retrocompatibilidade com as props e os comportamentos existentes. Não altere APIs, contratos de dados, backend, autenticação ou persistência.

### Fase 2 — Leads (prioridade máxima)

Implemente listagem, Kanban, cadastro, edição, detalhe, histórico, filtros, menus, follow-ups, conversão e todas as confirmações. Use os PNGs aprovados do diretório `previous-approved` para listagem/Kanban/cadastro; para novas telas, use os PNGs correspondentes do manifesto. Preserve limites e bloqueios de automação, follow-up, atribuição de responsável, ordenação, exportação e ações rápidas, inclusive no mobile.

### Fase 3 — WhatsApp Inbox

Reorganize lista de conversas, janela de mensagens, detalhes do contato, painel, anexos, mensagens rápidas, emojis, mensagens agendadas e recursos de IA. Preserve estados, API, canais e regras de envio. Não envie mensagens reais durante os testes. No mobile, diferencie claramente lista de conversas e conversa aberta.

### Fase 4 — Contratos, clientes, agenda, comissões

Implemente listagens, detalhes, criação, edição, titulares, dependentes, importações, confirmação de exclusão, agenda, tarefas e relatórios financeiros. Preserve todos os campos, valores e cálculos existentes, bem como permissões e regras comerciais.

### Fase 5 — Campanhas, automações, IA, integrações

Implemente listagens, assistentes multi-etapas, templates, editores de fluxos, regras, testes, integrações e opções de IA. **Não dispare campanhas nem execute automações durante testes visuais.** Preservar inteiramente a semântica e segurança dos fluxos atuais.

### Fase 6 — Configurações, conteúdo e demais rotas

Aplique padrão visual aos cadastros administrativos, usuários, permissões, links, formulários, blog e demais telas do manifesto. As páginas públicas devem respeitar o design institucional e a usabilidade própria de conversão, não a navegação do CRM.

## Critérios obrigatórios de aceitação

- Nenhuma rota ou funcionalidade existente removida, ignorada ou substituída por conteúdo falso.
- Botões e menus executam exatamente suas ações anteriores; há navegação funcional e estados reais.
- Validações, autorizações, fluxos, cálculos, integrações, webhooks e banco permanecem intactos.
- Checar desktop **1920×1080**, tablet **768×1024**, mobile **390×844** e **320×640**.
- Zero overflow horizontal acidental; nenhuma ação bloqueada por footer, drawer ou teclado; evitar scroll duplo nos modais.
- Aderência visual às imagens aprovadas e aos novos padrões; não criar aparência divergente entre módulos.
- Testar loading, empty, error, permissão restrita, formulários inválidos e estados de seleção.
- Rodar lint, typecheck, build e testes do repositório, quando disponíveis, e corrigir falhas introduzidas.
- Usar Playwright para screenshots de antes/depois e conferir visualmente componentes, tabelas e modais. **Não realizar operações destrutivas nem enviar comunicações reais.**
- Não adicionar bibliotecas pesadas ou substituir a stack só para estilizar.
- Se for impossível ou inseguro reproduzir alguma decisão de UX por depender da lógica de negócio, preservar comportamento e documentar a divergência.

## Entregáveis

1. UI implementada no projeto real, não uma galeria paralela.
2. Atualização do `/design-system` somente quando houver componentes/padrões novos que precisem de documentação.
3. `kifersaude-ui-redesign/STATUS_IMPLEMENTACAO.md` com cobertura, módulos concluídos, exceções e pendências por rota/estado.
4. Capturas Playwright de validação antes/depois em `kifersaude-ui-redesign/validacao/`, sem informações reais de clientes.
5. Relatório final breve: mudanças de componentes compartilhados, módulos atendidos, testes executados e problemas remanescentes.

Comece imediatamente pela **Fase 0 e Fase 1**, e prossiga pelo módulo de Leads. Continue pelos módulos seguintes enquanto houver contexto/tempo de execução, sem criar páginas falsas nem declarar concluído o que não foi testado.
