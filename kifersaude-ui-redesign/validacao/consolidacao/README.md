# Evidências finais — 27/10/2026

**160/160 contextos validados**, em quatro larguras: 1920, 768, 390 e 320 px. Os 47 destinos principais, 19 contextos adicionais e 94 estados possuem evidências no [mapeamento](../../MAPEAMENTO.json).

A [cobertura estruturada](cobertura.json) registra cada contexto/resolução, os arquivos e as adaptações. O [catálogo](CATALOGO.md) relaciona todas as capturas; [execuções](execucoes.json) contém os resultados Playwright.

## Leitura das imagens

- `page--…-viewport.png`: área visível inicial da página.
- `…-inicial.png` e `…-completa.png`: viewport e página inteira de um estado.
- `…-componente.png`: componente isolado.
- `…-conteudo-N-N.png`: posições adicionais de rolagem interna de diálogos/drawers.
- `tema-escuro-…`: tema escuro real, confirmado pela aparência ativa do shell.
- `…-observador`: perfil somente leitura, com criação bloqueada.
- `acoes-finais-…`: ações finais acessíveis acima da navegação mobile.

Alguns contextos extras são a mesma seção real coberta por um estado; suas evidências são compartilhadas explicitamente no JSON. Capturas antigas do mesmo estado foram mantidas como auxiliares; o checklist aponta para a captura completa atual.

## Resultado

1.720 testes aprovados em 323 arquivos; 14 testes focados após o Stepper também aprovados. Typecheck, lint sem avisos, build, auditorias visuais e de componentes, bundle do editor, arquitetura e baseline de migrations aprovados.

O baseline reconhece uma duplicação histórica cujo SQL só difere pelo ponto e vírgula final. Nenhum SQL, schema ou function de produção foi alterado ou implantado.

Os dados são fictícios. Requisições comerciais e integrações permaneceram interceptadas. Não houve envios, gravações remotas nem execução de campanhas/automações. A aprovação visual não afirma que serviços externos foram testados.

## Telas por módulo

### acesso

- `page--login` — Acesso ao CRM — `/login`.

### agenda

- `page--agenda` — Agenda, tarefas e lembretes — `/painel/agenda`.
- `extra--agenda-tarefas` — Minhas tarefas — `/painel/agenda`.
- `extra--agenda-concluidos` — Tarefas concluídas — `/painel/agenda`.

### automacoes

- `page--config-automation` — Automações — `/painel/automacoes?tab=automation`.
- `page--config-integrations` — Integrações — `/painel/automacoes?tab=integrations`.
- `page--config-ai` — Inteligência artificial — `/painel/automacoes?tab=ai`.
- `extra--automacoes-fluxo-detalhes` — Detalhes do fluxo — `/painel/automacoes?tab=automation`.
- `extra--automacoes-execucao` — Execuções das automações — `/painel/automacoes?tab=automation`.
- `extra--automacoes-templates` — Templates de mensagens — `/painel/automacoes?tab=automation`.

### campanhas

- `page--campanhas` — Campanhas e disparos — `/painel/disparos`.
- `page--campanha-detalhes` — Detalhes de campanha — `/painel/disparos/00000000-0000-4000-8000-000000000700`.
- `extra--campanhas-criar-pagina` — Criar campanha — `/painel/disparos`.

### comunicacao

- `page--inbox` — WhatsApp Inbox — `/painel/inbox`.
- `extra--inbox-conversa` — Conversa no WhatsApp — `/painel/inbox`.
- `extra--inbox-agendamentos` — Mensagens agendadas — `/painel/inbox`.

### configuracoes

- `page--config-system` — Geral — `/painel/config?tab=system`.
- `page--config-users` — Usuários — `/painel/config?tab=users`.
- `page--config-links` — Links — `/painel/config?tab=links`.
- `page--config-forms` — Formulários — `/painel/config?tab=forms`.
- `page--config-access` — Perfis e acessos — `/painel/config?tab=system&section=access`.
- `page--config-leads` — Configurações de leads — `/painel/config?tab=system&section=leads`.
- `page--config-contracts` — Configurações de contratos — `/painel/config?tab=system&section=contracts`.
- `page--config-leads-origins` — Origens — `/painel/config?tab=system&section=leads&leadTab=origins`.
- `page--config-leads-manager-lead_tipo_contratacao` — Tipos de contratação — `/painel/config?tab=system&section=leads&leadTab=manager:lead_tipo_contratacao`.
- `page--config-leads-manager-lead_responsavel` — Responsáveis — `/painel/config?tab=system&section=leads&leadTab=manager:lead_responsavel`.
- `page--config-contract_modalidade` — Modalidade — `/painel/config?tab=system&section=contracts&contractTab=contract_modalidade`.
- `page--config-contract_abrangencia` — Abrangencia — `/painel/config?tab=system&section=contracts&contractTab=contract_abrangencia`.
- `page--config-contract_acomodacao` — Acomodacao — `/painel/config?tab=system&section=contracts&contractTab=contract_acomodacao`.
- `page--config-contract_carencia` — Carencia — `/painel/config?tab=system&section=contracts&contractTab=contract_carencia`.
- `extra--config-formularios-editor` — Editor de formulários — `/painel/config?tab=forms`.

### conteudo

- `page--blog` — Gestão de conteúdo — `/painel/blog`.
- `extra--conteudo-editor` — Editor de artigo — `/painel/blog`.

### contratos

- `page--contratos-listagem` — Gestão de contratos e clientes — `/painel/contratos`.
- `extra--contratos-ficha` — Ficha do contrato — `/painel/contratos`.
- `extra--contratos-beneficiarios` — Titulares e dependentes — `/painel/contratos`.
- `extra--contratos-importar` — Importação de contratos — `/painel/contratos`.

### dashboard

- `page--dashboard` — Dashboard — `/painel/dashboard`.

### financeiro

- `page--comissoes` — Comissões e produção — `/painel/comissoes`.

### geral

- `state--dashboard-filtros` — dashboard-filtros — `/painel/dashboard`.
- `state--dashboard-periodo` — dashboard-periodo — `/painel/dashboard`.
- `state--dashboard-analises` — dashboard-analises — `/painel/dashboard`.
- `state--leads-criar` — leads-criar — `/painel/leads`.
- `state--leads-detalhes` — leads-detalhes — `/painel/leads`.
- `state--leads-agendar` — leads-agendar — `/painel/leads`.
- `state--leads-excluir-confirmacao` — leads-excluir-confirmacao — `/painel/leads`.
- `state--leads-filtros-avancados` — leads-filtros-avancados — `/painel/leads`.
- `state--leads-status-menu` — leads-status-menu — `/painel/leads`.
- `state--leads-responsavel-menu` — leads-responsavel-menu — `/painel/leads`.
- `state--leads-origem-menu` — leads-origem-menu — `/painel/leads`.
- `state--leads-tipo-menu` — leads-tipo-menu — `/painel/leads`.
- `state--leads-ordenacao-menu` — leads-ordenacao-menu — `/painel/leads`.
- `state--leads-status-contextual` — leads-status-contextual — `/painel/leads`.
- `state--contratos-criar` — contratos-criar — `/painel/contratos`.
- `state--contratos-detalhes` — contratos-detalhes — `/painel/contratos`.
- `state--contratos-importacao` — contratos-importacao — `/painel/contratos`.
- `state--contratos-excluir-confirmacao` — contratos-excluir-confirmacao — `/painel/contratos`.
- `state--contratos-status-menu` — contratos-status-menu — `/painel/contratos`.
- `state--contratos-operadoras-menu` — contratos-operadoras-menu — `/painel/contratos`.
- `state--contratos-datas-menu` — contratos-datas-menu — `/painel/contratos`.
- `state--comissoes-dia` — comissoes-dia — `/painel/comissoes`.
- `state--agenda-criar` — agenda-criar — `/painel/agenda`.
- `state--agenda-organizar` — agenda-organizar — `/painel/agenda`.
- `state--agenda-reagendar` — agenda-reagendar — `/painel/agenda`.
- `state--agenda-tipos` — agenda-tipos — `/painel/agenda`.
- `state--inbox-agenda` — inbox-agenda — `/painel/inbox`.
- `state--inbox-agendadas` — inbox-agendadas — `/painel/inbox`.
- `state--inbox-painel` — inbox-painel — `/painel/inbox`.
- `state--inbox-nova-conversa` — inbox-nova-conversa — `/painel/inbox`.
- `state--inbox-filtros` — inbox-filtros — `/painel/inbox`.
- `state--campanhas-criar` — campanhas-criar — `/painel/disparos`.
- `state--campanhas-editar` — campanhas-editar — `/painel/disparos`.
- `state--campanhas-excluir` — campanhas-excluir — `/painel/disparos`.
- `state--blog-criar` — blog-criar — `/painel/blog`.
- `state--blog-editar` — blog-editar — `/painel/blog`.
- `state--blog-visualizar` — blog-visualizar — `/painel/blog`.
- `state--blog-excluir` — blog-excluir — `/painel/blog`.
- `state--leads-editar` — leads-editar — `/painel/leads`.
- `state--leads-converter` — leads-converter — `/painel/leads`.
- `state--contratos-editar` — contratos-editar — `/painel/contratos`.
- `state--contratos-titular` — contratos-titular — `/painel/contratos`.
- `state--contratos-dependente` — contratos-dependente — `/painel/contratos`.
- `state--usuarios-criar` — usuarios-criar — `/painel/config?tab=users`.
- `state--usuarios-editar` — usuarios-editar — `/painel/config?tab=users`.
- `state--links-criar` — links-criar — `/painel/config?tab=links`.
- `state--links-editar` — links-editar — `/painel/config?tab=links`.
- `state--formularios-criar` — formularios-criar — `/painel/config?tab=forms`.
- `state--formularios-editar` — formularios-editar — `/painel/config?tab=forms`.
- `state--formularios-pergunta` — formularios-pergunta — `/painel/config?tab=forms`.
- `state--perfis-criar` — perfis-criar — `/painel/config?tab=system&section=access`.
- `state--perfis-permissoes` — perfis-permissoes — `/painel/config?tab=system&section=access`.
- `state--config-etapa-criar` — config-etapa-criar — `/painel/config?tab=system&section=leads`.
- `state--config-origem-criar` — config-origem-criar — `/painel/config?tab=system&section=leads&leadTab=origins`.
- `state--config-tipo-criar` — config-tipo-criar — `/painel/config?tab=system&section=leads&leadTab=manager:lead_tipo_contratacao`.
- `state--config-responsavel-criar` — config-responsavel-criar — `/painel/config?tab=system&section=leads&leadTab=manager:lead_responsavel`.
- `state--config-status-contrato-criar` — config-status-contrato-criar — `/painel/config?tab=system&section=contracts`.
- `state--config-modalidade-criar` — config-modalidade-criar — `/painel/config?tab=system&section=contracts&contractTab=contract_modalidade`.
- `state--config-abrangencia-criar` — config-abrangencia-criar — `/painel/config?tab=system&section=contracts&contractTab=contract_abrangencia`.
- `state--config-acomodacao-criar` — config-acomodacao-criar — `/painel/config?tab=system&section=contracts&contractTab=contract_acomodacao`.
- `state--config-carencia-criar` — config-carencia-criar — `/painel/config?tab=system&section=contracts&contractTab=contract_carencia`.
- `state--ia-feature-editar` — ia-feature-editar — `/painel/automacoes?tab=ai`.
- `state--automacao-novo-fluxo` — automacao-novo-fluxo — `/painel/automacoes?tab=automation`.
- `state--automacao-novo-template` — automacao-novo-template — `/painel/automacoes?tab=automation`.
- `state--nav-notificacoes` — nav-notificacoes — `/painel/dashboard`.
- `state--leads-criar-seletor-1` — leads-criar-seletor-1 — `/painel/leads`.
- `state--leads-criar-seletor-2` — leads-criar-seletor-2 — `/painel/leads`.
- `state--leads-criar-seletor-3` — leads-criar-seletor-3 — `/painel/leads`.
- `state--leads-criar-seletor-4` — leads-criar-seletor-4 — `/painel/leads`.
- `state--leads-criar-seletor-5` — leads-criar-seletor-5 — `/painel/leads`.
- `state--leads-criar-seletor-6` — leads-criar-seletor-6 — `/painel/leads`.
- `state--leads-criar-validacao` — leads-criar-validacao — `/painel/leads`.
- `state--campanhas-criar-etapa-2` — campanhas-criar-etapa-2 — `/painel/disparos`.
- `state--campanhas-criar-etapa-3` — campanhas-criar-etapa-3 — `/painel/disparos`.
- `state--campanhas-criar-etapa-4` — campanhas-criar-etapa-4 — `/painel/disparos`.
- `state--inbox-lead-drawer` — inbox-lead-drawer — `/painel/inbox`.
- `state--inbox-arquivos-drawer` — inbox-arquivos-drawer — `/painel/inbox`.
- `state--inbox-busca-mensagens` — inbox-busca-mensagens — `/painel/inbox`.
- `state--inbox-agendadas-conversa` — inbox-agendadas-conversa — `/painel/inbox`.
- `state--inbox-mensagens-rapidas` — inbox-mensagens-rapidas — `/painel/inbox`.
- `state--inbox-emojis` — inbox-emojis — `/painel/inbox`.
- `state--inbox-anexos` — inbox-anexos — `/painel/inbox`.
- `state--inbox-formatacao` — inbox-formatacao — `/painel/inbox`.
- `state--automacao-fluxo-editar` — automacao-fluxo-editar — `/painel/automacoes?tab=automation`.
- `state--automacao-fluxo-regras` — automacao-fluxo-regras — `/painel/automacoes?tab=automation`.
- `state--automacao-fluxo-testes` — automacao-fluxo-testes — `/painel/automacoes?tab=automation`.
- `state--formulario-publico-contato` — formulario-publico-contato — `/forms/demonstracao`.
- `state--inbox-mensagens-rapidas-gerenciar` — inbox-mensagens-rapidas-gerenciar — `/painel/inbox`.
- `state--inbox-dados-mensagem` — inbox-dados-mensagem — `/painel/inbox`.
- `state--inbox-editar-mensagem` — inbox-editar-mensagem — `/painel/inbox`.
- `state--inbox-encaminhar` — inbox-encaminhar — `/painel/inbox`.
- `state--inbox-resposta` — inbox-resposta — `/painel/inbox`.
- `state--inbox-visualizador-imagem` — inbox-visualizador-imagem — `/painel/inbox`.
- `state--contratos-importacao-individual` — contratos-importacao-individual — `/painel/contratos`.

### ia

- `page--chat-ia` — Chat e testes de IA — `/chat`.
- `page--ia-global` — IA: configurações globais — `/painel/automacoes?tab=ai&section=global`.

### integracoes

- `page--api` — Documentação da API — `/painel/api`.
- `page--integracao-whatsapp` — Integrações: whatsapp — `/painel/automacoes?tab=integrations&section=whatsapp`.
- `page--integracao-meta` — Integrações: meta — `/painel/automacoes?tab=integrations&section=meta`.
- `page--integracao-tracking` — Integrações: tracking — `/painel/automacoes?tab=integrations&section=tracking`.

### leads

- `page--leads-listagem` — Gestão de leads — `/painel/leads`.
- `extra--leads-detalhe-pagina` — Detalhes do lead — `/painel/leads`.
- `extra--leads-edicao-pagina` — Editar lead — `/painel/leads`.
- `extra--leads-filtros-avancados` — Filtros avançados — `/painel/leads`.
- `extra--leads-historico` — Histórico e interações — `/painel/leads`.
- `extra--leads-followups` — Follow-ups do lead — `/painel/leads`.
- `extra--leads-kanban` — Kanban de leads — `/painel/leads`.

### publico

- `page--public-home` — Site público — `/`.
- `page--public-links` — Página pública de links — `/links`.
- `page--public-form` — Formulário público — `/forms/demonstracao`.
- `page--public-operator` — Página de operadora — `/planos/amil`.
- `page--public-privacy` — Política de privacidade — `/politica-de-privacidade`.
- `page--public-operator-porto-saude` — Operadora: Porto Saude — `/planos/porto-saude`.
- `page--public-operator-bradesco-saude` — Operadora: Bradesco Saude — `/planos/bradesco-saude`.
- `page--public-operator-sulamerica` — Operadora: Sulamerica — `/planos/sulamerica`.
- `page--public-operator-unimed` — Operadora: Unimed — `/planos/unimed`.
- `page--public-operator-medsenior` — Operadora: Medsenior — `/planos/medsenior`.
- `page--public-operator-assim-saude` — Operadora: Assim Saude — `/planos/assim-saude`.
- `page--public-operator-hapvida-notredame` — Operadora: Hapvida Notredame — `/planos/hapvida-notredame`.
- `page--public-operator-leve-saude` — Operadora: Leve Saude — `/planos/leve-saude`.
- `page--public-operator-klini` — Operadora: Klini — `/planos/klini`.

