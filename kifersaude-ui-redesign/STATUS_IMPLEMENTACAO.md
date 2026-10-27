# Implementação do redesign Kifer Saúde

## Escopo e diagnóstico

Inventário: 47 páginas/seções, 19 complementos e 94 estados. Mapeamento detalhado: [MAPEAMENTO.json](MAPEAMENTO.json).

- [x] Ler README, manifesto e galeria; inspecionar as seis referências prioritárias de Leads.
- [x] Identificar stack, rotas em `src/main.tsx`, shell em `src/components/Layout.tsx` e componentes reais.
- [x] Fase 1: base do shell e tokens implementada; validação nesta etapa sobre Leads. Demais módulos ainda exigem revisão própria.
- [ ] Fase 2 (parcial): lista, Kanban, criação, edição, filtros e validação de formulário implementados e validados. Detalhes, conversão, seletores e demais estados específicos continuam no checklist.
- [ ] Fases 3–6: Inbox e demais módulos, por etapa.

## Preservação de comportamento

O pacote permanece documentação, fora de `src/`, sem imports no bundle. As exclusões preexistentes em `.opencode`, `.playwright-cli`, `.vite`, `design-system/` e CSV não pertencem a este trabalho e não serão incluídas nos commits.
As capturas usam somente fixtures e backend interceptado. POST/PATCH/DELETE, integrações e automações são bloqueados; nenhum registro de produção é alterado.

## Cobertura por rota e estado

| Contexto | Rota | Componente atual | Referências | Estado |
|---|---|---|---|---|
| page--dashboard | `/painel/dashboard` | `src/features/dashboard/DashboardScreen.tsx` | [desktop](references/desktop/page--dashboard.png) / [mobile](references/mobile/page--dashboard.png) | pendente |
| page--leads-listagem | `/painel/leads` | `src/features/leads/LeadsManagerScreen.tsx` | [desktop](previous-approved/leads-list-desktop-viewport.png) / [mobile](previous-approved/leads-list-mobile-viewport.png) | validado |
| page--contratos-listagem | `/painel/contratos` | `src/features/contracts/ContractsManagerScreen.tsx` | [desktop](references/desktop/page--contratos-listagem.png) / [mobile](references/mobile/page--contratos-listagem.png) | pendente |
| page--comissoes | `/painel/comissoes` | `src/features/commissions/CommissionCalendarScreen.tsx` | [desktop](references/desktop/page--comissoes.png) / [mobile](references/mobile/page--comissoes.png) | pendente |
| page--agenda | `/painel/agenda` | `src/features/agenda/AgendaScreen.tsx` | [desktop](references/desktop/page--agenda.png) / [mobile](references/mobile/page--agenda.png) | pendente |
| page--inbox | `/painel/inbox` | `src/features/communication/whatsapp/WhatsAppInboxScreen.tsx` | [desktop](references/desktop/page--inbox.png) / [mobile](references/mobile/page--inbox.png) | pendente |
| page--campanhas | `/painel/disparos` | `src/features/communication/whatsapp-campaigns/WhatsAppCampaignsScreen.tsx` | [desktop](references/desktop/page--campanhas.png) / [mobile](references/mobile/page--campanhas.png) | pendente |
| page--campanha-detalhes | `/painel/disparos/00000000-0000-4000-8000-000000000700` | `src/features/communication/whatsapp-campaigns/WhatsAppCampaignDetailScreen.tsx` | [desktop](references/desktop/page--campanha-detalhes.png) / [mobile](references/mobile/page--campanha-detalhes.png) | pendente |
| page--blog | `/painel/blog` | `src/features/blog/BlogTabScreen.tsx` | [desktop](references/desktop/page--blog.png) / [mobile](references/mobile/page--blog.png) | pendente |
| page--api | `/painel/api` | `src/features/config/integrations/api-docs/ApiDocsScreen.tsx` | [desktop](references/desktop/page--api.png) / [mobile](references/mobile/page--api.png) | pendente |
| page--chat-ia | `/chat` | `src/features/ai-sandbox/AiSandboxChatScreen.tsx` | [desktop](references/desktop/page--chat-ia.png) / [mobile](references/mobile/page--chat-ia.png) | pendente |
| page--login | `/login` | `src/pages/LoginPage.tsx` | [desktop](references/desktop/page--login.png) / [mobile](references/mobile/page--login.png) | pendente |
| page--config-system | `/painel/config?tab=system` | `src/features/config/general/SystemSettingsScreen.tsx` | [desktop](references/desktop/page--config-system.png) / [mobile](references/mobile/page--config-system.png) | pendente |
| page--config-users | `/painel/config?tab=users` | `src/features/config/users/UsersScreen.tsx` | [desktop](references/desktop/page--config-users.png) / [mobile](references/mobile/page--config-users.png) | pendente |
| page--config-links | `/painel/config?tab=links` | `src/features/config/links/LinksScreen.tsx` | [desktop](references/desktop/page--config-links.png) / [mobile](references/mobile/page--config-links.png) | pendente |
| page--config-forms | `/painel/config?tab=forms` | `src/features/config/forms/FormsScreen.tsx` | [desktop](references/desktop/page--config-forms.png) / [mobile](references/mobile/page--config-forms.png) | pendente |
| page--config-automation | `/painel/automacoes?tab=automation` | `src/features/config/automation/AutoContactFlowSettingsScreen.tsx` | [desktop](references/desktop/page--config-automation.png) / [mobile](references/mobile/page--config-automation.png) | pendente |
| page--config-integrations | `/painel/automacoes?tab=integrations` | `src/features/config/integrations/IntegrationsScreen.tsx` | [desktop](references/desktop/page--config-integrations.png) / [mobile](references/mobile/page--config-integrations.png) | pendente |
| page--config-ai | `/painel/automacoes?tab=ai` | `src/features/config/ai/AiConfigScreen.tsx` | [desktop](references/desktop/page--config-ai.png) / [mobile](references/mobile/page--config-ai.png) | pendente |
| page--config-access | `/painel/config?tab=system&section=access` | `src/features/config/general/SystemSettingsScreen.tsx` | [desktop](references/desktop/page--config-access.png) / [mobile](references/mobile/page--config-access.png) | pendente |
| page--config-leads | `/painel/config?tab=system&section=leads` | `src/features/config/general/SystemSettingsScreen.tsx` | [desktop](references/desktop/page--config-leads.png) / [mobile](references/mobile/page--config-leads.png) | pendente |
| page--config-contracts | `/painel/config?tab=system&section=contracts` | `src/features/config/general/SystemSettingsScreen.tsx` | [desktop](references/desktop/page--config-contracts.png) / [mobile](references/mobile/page--config-contracts.png) | pendente |
| page--config-leads-origins | `/painel/config?tab=system&section=leads&leadTab=origins` | `src/features/config/general/SystemSettingsScreen.tsx` | [desktop](references/desktop/page--config-leads-origins.png) / [mobile](references/mobile/page--config-leads-origins.png) | pendente |
| page--config-leads-manager-lead_tipo_contratacao | `/painel/config?tab=system&section=leads&leadTab=manager:lead_tipo_contratacao` | `src/features/config/general/SystemSettingsScreen.tsx` | [desktop](references/desktop/page--config-leads-manager-lead_tipo_contratacao.png) / [mobile](references/mobile/page--config-leads-manager-lead_tipo_contratacao.png) | pendente |
| page--config-leads-manager-lead_responsavel | `/painel/config?tab=system&section=leads&leadTab=manager:lead_responsavel` | `src/features/config/general/SystemSettingsScreen.tsx` | [desktop](references/desktop/page--config-leads-manager-lead_responsavel.png) / [mobile](references/mobile/page--config-leads-manager-lead_responsavel.png) | pendente |
| page--config-contract_modalidade | `/painel/config?tab=system&section=contracts&contractTab=contract_modalidade` | `src/features/config/general/SystemSettingsScreen.tsx` | [desktop](references/desktop/page--config-contract_modalidade.png) / [mobile](references/mobile/page--config-contract_modalidade.png) | pendente |
| page--config-contract_abrangencia | `/painel/config?tab=system&section=contracts&contractTab=contract_abrangencia` | `src/features/config/general/SystemSettingsScreen.tsx` | [desktop](references/desktop/page--config-contract_abrangencia.png) / [mobile](references/mobile/page--config-contract_abrangencia.png) | pendente |
| page--config-contract_acomodacao | `/painel/config?tab=system&section=contracts&contractTab=contract_acomodacao` | `src/features/config/general/SystemSettingsScreen.tsx` | [desktop](references/desktop/page--config-contract_acomodacao.png) / [mobile](references/mobile/page--config-contract_acomodacao.png) | pendente |
| page--config-contract_carencia | `/painel/config?tab=system&section=contracts&contractTab=contract_carencia` | `src/features/config/general/SystemSettingsScreen.tsx` | [desktop](references/desktop/page--config-contract_carencia.png) / [mobile](references/mobile/page--config-contract_carencia.png) | pendente |
| page--integracao-whatsapp | `/painel/automacoes?tab=integrations&section=whatsapp` | `src/features/config/integrations/IntegrationsScreen.tsx` | [desktop](references/desktop/page--integracao-whatsapp.png) / [mobile](references/mobile/page--integracao-whatsapp.png) | pendente |
| page--integracao-meta | `/painel/automacoes?tab=integrations&section=meta` | `src/features/config/integrations/IntegrationsScreen.tsx` | [desktop](references/desktop/page--integracao-meta.png) / [mobile](references/mobile/page--integracao-meta.png) | pendente |
| page--integracao-tracking | `/painel/automacoes?tab=integrations&section=tracking` | `src/features/config/integrations/IntegrationsScreen.tsx` | [desktop](references/desktop/page--integracao-tracking.png) / [mobile](references/mobile/page--integracao-tracking.png) | pendente |
| page--ia-global | `/painel/automacoes?tab=ai&section=global` | `src/features/config/ai/AiConfigScreen.tsx` | [desktop](references/desktop/page--ia-global.png) / [mobile](references/mobile/page--ia-global.png) | pendente |
| page--public-home | `/` | `src/pages/public/HomePage.tsx` | [desktop](references/desktop/page--public-home.png) / [mobile](references/mobile/page--public-home.png) | pendente |
| page--public-links | `/links` | `src/pages/public/LinksPage.tsx` | [desktop](references/desktop/page--public-links.png) / [mobile](references/mobile/page--public-links.png) | pendente |
| page--public-form | `/forms/demonstracao` | `src/pages/public/FormPage.tsx` | [desktop](references/desktop/page--public-form.png) / [mobile](references/mobile/page--public-form.png) | pendente |
| page--public-operator | `/planos/amil` | `src/features/operator-landings/OperatorLandingScreen.tsx` | [desktop](references/desktop/page--public-operator.png) / [mobile](references/mobile/page--public-operator.png) | pendente |
| page--public-privacy | `/politica-de-privacidade` | `src/features/public-content/PrivacyPolicyPage.tsx` | [desktop](references/desktop/page--public-privacy.png) / [mobile](references/mobile/page--public-privacy.png) | pendente |
| page--public-operator-porto-saude | `/planos/porto-saude` | `src/features/operator-landings/OperatorLandingScreen.tsx` | [desktop](references/desktop/page--public-operator-porto-saude.png) / [mobile](references/mobile/page--public-operator-porto-saude.png) | pendente |
| page--public-operator-bradesco-saude | `/planos/bradesco-saude` | `src/features/operator-landings/OperatorLandingScreen.tsx` | [desktop](references/desktop/page--public-operator-bradesco-saude.png) / [mobile](references/mobile/page--public-operator-bradesco-saude.png) | pendente |
| page--public-operator-sulamerica | `/planos/sulamerica` | `src/features/operator-landings/OperatorLandingScreen.tsx` | [desktop](references/desktop/page--public-operator-sulamerica.png) / [mobile](references/mobile/page--public-operator-sulamerica.png) | pendente |
| page--public-operator-unimed | `/planos/unimed` | `src/features/operator-landings/OperatorLandingScreen.tsx` | [desktop](references/desktop/page--public-operator-unimed.png) / [mobile](references/mobile/page--public-operator-unimed.png) | pendente |
| page--public-operator-medsenior | `/planos/medsenior` | `src/features/operator-landings/OperatorLandingScreen.tsx` | [desktop](references/desktop/page--public-operator-medsenior.png) / [mobile](references/mobile/page--public-operator-medsenior.png) | pendente |
| page--public-operator-assim-saude | `/planos/assim-saude` | `src/features/operator-landings/OperatorLandingScreen.tsx` | [desktop](references/desktop/page--public-operator-assim-saude.png) / [mobile](references/mobile/page--public-operator-assim-saude.png) | pendente |
| page--public-operator-hapvida-notredame | `/planos/hapvida-notredame` | `src/features/operator-landings/OperatorLandingScreen.tsx` | [desktop](references/desktop/page--public-operator-hapvida-notredame.png) / [mobile](references/mobile/page--public-operator-hapvida-notredame.png) | pendente |
| page--public-operator-leve-saude | `/planos/leve-saude` | `src/features/operator-landings/OperatorLandingScreen.tsx` | [desktop](references/desktop/page--public-operator-leve-saude.png) / [mobile](references/mobile/page--public-operator-leve-saude.png) | pendente |
| page--public-operator-klini | `/planos/klini` | `src/features/operator-landings/OperatorLandingScreen.tsx` | [desktop](references/desktop/page--public-operator-klini.png) / [mobile](references/mobile/page--public-operator-klini.png) | pendente |
| extra--leads-detalhe-pagina | `/painel/leads` | `src/features/leads/LeadsManagerScreen.tsx` | [desktop](references/desktop/extra--leads-detalhe-pagina.png) / [mobile](references/mobile/extra--leads-detalhe-pagina.png) | validado |
| extra--leads-edicao-pagina | `/painel/leads` | `src/features/leads/LeadsManagerScreen.tsx` | [desktop](references/desktop/extra--leads-edicao-pagina.png) / [mobile](references/mobile/extra--leads-edicao-pagina.png) | validado |
| extra--leads-filtros-avancados | `/painel/leads` | `src/features/leads/LeadsManagerScreen.tsx` | [desktop](references/desktop/extra--leads-filtros-avancados.png) / [mobile](references/mobile/extra--leads-filtros-avancados.png) | validado |
| extra--leads-historico | `/painel/leads` | `src/features/leads/LeadsManagerScreen.tsx` | [desktop](references/desktop/extra--leads-historico.png) / [mobile](references/mobile/extra--leads-historico.png) | pendente |
| extra--leads-followups | `/painel/leads` | `src/features/leads/LeadsManagerScreen.tsx` | [desktop](references/desktop/extra--leads-followups.png) / [mobile](references/mobile/extra--leads-followups.png) | pendente |
| extra--leads-kanban | `/painel/leads` | `src/features/leads/LeadsManagerScreen.tsx` | [desktop](previous-approved/leads-kanban-desktop-viewport.png) / [mobile](previous-approved/leads-kanban-mobile-viewport.png) | validado |
| extra--contratos-ficha | `/painel/contratos` | `src/features/contracts/ContractsManagerScreen.tsx` | [desktop](references/desktop/extra--contratos-ficha.png) / [mobile](references/mobile/extra--contratos-ficha.png) | validado |
| extra--contratos-beneficiarios | `/painel/contratos` | `src/features/contracts/ContractsManagerScreen.tsx` | [desktop](references/desktop/extra--contratos-beneficiarios.png) / [mobile](references/mobile/extra--contratos-beneficiarios.png) | pendente |
| extra--contratos-importar | `/painel/contratos` | `src/features/contracts/ContractsManagerScreen.tsx` | [desktop](references/desktop/extra--contratos-importar.png) / [mobile](references/mobile/extra--contratos-importar.png) | pendente |
| extra--inbox-conversa | `/painel/inbox` | `src/features/communication/whatsapp/WhatsAppInboxScreen.tsx` | [desktop](references/desktop/extra--inbox-conversa.png) / [mobile](references/mobile/extra--inbox-conversa.png) | pendente |
| extra--inbox-agendamentos | `/painel/inbox` | `src/features/communication/whatsapp/WhatsAppInboxScreen.tsx` | [desktop](references/desktop/extra--inbox-agendamentos.png) / [mobile](references/mobile/extra--inbox-agendamentos.png) | pendente |
| extra--agenda-tarefas | `/painel/agenda` | `src/features/agenda/AgendaScreen.tsx` | [desktop](references/desktop/extra--agenda-tarefas.png) / [mobile](references/mobile/extra--agenda-tarefas.png) | pendente |
| extra--agenda-concluidos | `/painel/agenda` | `src/features/agenda/AgendaScreen.tsx` | [desktop](references/desktop/extra--agenda-concluidos.png) / [mobile](references/mobile/extra--agenda-concluidos.png) | pendente |
| extra--automacoes-fluxo-detalhes | `/painel/automacoes?tab=automation` | `src/features/config/automation/AutoContactFlowSettingsScreen.tsx` | [desktop](references/desktop/extra--automacoes-fluxo-detalhes.png) / [mobile](references/mobile/extra--automacoes-fluxo-detalhes.png) | pendente |
| extra--automacoes-execucao | `/painel/automacoes?tab=automation` | `src/features/config/automation/AutoContactFlowSettingsScreen.tsx` | [desktop](references/desktop/extra--automacoes-execucao.png) / [mobile](references/mobile/extra--automacoes-execucao.png) | pendente |
| extra--automacoes-templates | `/painel/automacoes?tab=automation` | `src/features/config/automation/AutoContactFlowSettingsScreen.tsx` | [desktop](references/desktop/extra--automacoes-templates.png) / [mobile](references/mobile/extra--automacoes-templates.png) | pendente |
| extra--campanhas-criar-pagina | `/painel/disparos` | `src/features/communication/whatsapp-campaigns/WhatsAppCampaignsScreen.tsx` | [desktop](references/desktop/extra--campanhas-criar-pagina.png) / [mobile](references/mobile/extra--campanhas-criar-pagina.png) | pendente |
| extra--conteudo-editor | `/painel/blog` | `src/features/blog/BlogTabScreen.tsx` | [desktop](references/desktop/extra--conteudo-editor.png) / [mobile](references/mobile/extra--conteudo-editor.png) | pendente |
| extra--config-formularios-editor | `/painel/config?tab=forms` | `src/features/config/forms/FormsScreen.tsx` | [desktop](references/desktop/extra--config-formularios-editor.png) / [mobile](references/mobile/extra--config-formularios-editor.png) | pendente |
| state--dashboard-filtros | `/painel/dashboard` | `src/features/dashboard/DashboardScreen.tsx` | [desktop](references/desktop/state--dashboard-filtros.png) / [mobile](references/mobile/state--dashboard-filtros.png) | pendente |
| state--dashboard-periodo | `/painel/dashboard` | `src/features/dashboard/DashboardScreen.tsx` | [desktop](references/desktop/state--dashboard-periodo.png) / [mobile](references/mobile/state--dashboard-periodo.png) | pendente |
| state--dashboard-analises | `/painel/dashboard` | `src/features/dashboard/DashboardScreen.tsx` | [desktop](references/desktop/state--dashboard-analises.png) / [mobile](references/mobile/state--dashboard-analises.png) | pendente |
| state--leads-criar | `/painel/leads` | `src/components/LeadForm.tsx` | [desktop](previous-approved/leads-create-desktop-viewport.png) / [mobile](previous-approved/leads-create-mobile-completa.png) | validado |
| state--leads-detalhes | `/painel/leads` | `src/components/LeadDetails.tsx` | [desktop](references/desktop/state--leads-detalhes.png) / [mobile](references/mobile/state--leads-detalhes.png) | validado |
| state--leads-agendar | `/painel/leads` | `src/components/ReminderSchedulerModal.tsx` | [desktop](references/desktop/state--leads-agendar.png) / [mobile](references/mobile/state--leads-agendar.png) | validado |
| state--leads-excluir-confirmacao | `/painel/leads` | `src/features/leads/LeadsManagerScreen.tsx` | [desktop](references/desktop/state--leads-excluir-confirmacao.png) / [mobile](references/mobile/state--leads-excluir-confirmacao.png) | validado |
| state--leads-filtros-avancados | `/painel/leads` | `src/features/leads/LeadsManagerScreen.tsx` | [desktop](references/desktop/state--leads-filtros-avancados.png) / [mobile](references/mobile/state--leads-filtros-avancados.png) | validado |
| state--leads-status-menu | `/painel/leads` | `src/features/leads/LeadsManagerScreen.tsx` | [desktop](references/desktop/state--leads-status-menu.png) / [mobile](references/mobile/state--leads-status-menu.png) | validado |
| state--leads-responsavel-menu | `/painel/leads` | `src/features/leads/LeadsManagerScreen.tsx` | [desktop](references/desktop/state--leads-responsavel-menu.png) / [mobile](references/mobile/state--leads-responsavel-menu.png) | validado |
| state--leads-origem-menu | `/painel/leads` | `src/features/leads/LeadsManagerScreen.tsx` | [desktop](references/desktop/state--leads-origem-menu.png) / [mobile](references/mobile/state--leads-origem-menu.png) | validado |
| state--leads-tipo-menu | `/painel/leads` | `src/features/leads/LeadsManagerScreen.tsx` | [desktop](references/desktop/state--leads-tipo-menu.png) / [mobile](references/mobile/state--leads-tipo-menu.png) | validado |
| state--leads-ordenacao-menu | `/painel/leads` | `src/features/leads/LeadsManagerScreen.tsx` | [desktop](references/desktop/state--leads-ordenacao-menu.png) / [mobile](references/mobile/state--leads-ordenacao-menu.png) | validado |
| state--leads-status-contextual | `/painel/leads` | `src/features/leads/LeadsManagerScreen.tsx` | [desktop](references/desktop/state--leads-status-contextual.png) / [mobile](references/mobile/state--leads-status-contextual.png) | validado |
| state--contratos-criar | `/painel/contratos` | `src/components/ContractForm.tsx` | [desktop](references/desktop/state--contratos-criar.png) / [mobile](references/mobile/state--contratos-criar.png) | validado |
| state--contratos-detalhes | `/painel/contratos` | `src/components/ContractDetails.tsx` | [desktop](references/desktop/state--contratos-detalhes.png) / [mobile](references/mobile/state--contratos-detalhes.png) | validado |
| state--contratos-importacao | `/painel/contratos` | `src/features/contracts/components/ContractBulkJsonImportDialog.tsx` | [desktop](references/desktop/state--contratos-importacao.png) / [mobile](references/mobile/state--contratos-importacao.png) | validado |
| state--contratos-excluir-confirmacao | `/painel/contratos` | `src/features/contracts/ContractsManagerScreen.tsx` | [desktop](references/desktop/state--contratos-excluir-confirmacao.png) / [mobile](references/mobile/state--contratos-excluir-confirmacao.png) | validado |
| state--contratos-status-menu | `/painel/contratos` | `src/features/contracts/ContractsManagerScreen.tsx` | [desktop](references/desktop/state--contratos-status-menu.png) / [mobile](references/mobile/state--contratos-status-menu.png) | validado |
| state--contratos-operadoras-menu | `/painel/contratos` | `src/features/contracts/ContractsManagerScreen.tsx` | [desktop](references/desktop/state--contratos-operadoras-menu.png) / [mobile](references/mobile/state--contratos-operadoras-menu.png) | validado |
| state--contratos-datas-menu | `/painel/contratos` | `src/features/contracts/ContractsManagerScreen.tsx` | [desktop](references/desktop/state--contratos-datas-menu.png) / [mobile](references/mobile/state--contratos-datas-menu.png) | validado |
| state--comissoes-dia | `/painel/comissoes` | `src/features/commissions/CommissionCalendarScreen.tsx` | [desktop](references/desktop/state--comissoes-dia.png) / [mobile](references/mobile/state--comissoes-dia.png) | pendente |
| state--agenda-criar | `/painel/agenda` | `src/features/agenda/AgendaScreen.tsx` | [desktop](references/desktop/state--agenda-criar.png) / [mobile](references/mobile/state--agenda-criar.png) | pendente |
| state--agenda-organizar | `/painel/agenda` | `src/features/agenda/components/FollowUpAgendaOrganizerModal.tsx` | [desktop](references/desktop/state--agenda-organizar.png) / [mobile](references/mobile/state--agenda-organizar.png) | pendente |
| state--agenda-reagendar | `/painel/agenda` | `src/features/agenda/AgendaScreen.tsx` | [desktop](references/desktop/state--agenda-reagendar.png) / [mobile](references/mobile/state--agenda-reagendar.png) | pendente |
| state--agenda-tipos | `/painel/agenda` | `src/features/agenda/AgendaScreen.tsx` | [desktop](references/desktop/state--agenda-tipos.png) / [mobile](references/mobile/state--agenda-tipos.png) | pendente |
| state--inbox-agenda | `/painel/inbox` | `src/features/communication/whatsapp/components/WhatsAppAgendaModal.tsx` | [desktop](references/desktop/state--inbox-agenda.png) / [mobile](references/mobile/state--inbox-agenda.png) | validado |
| state--inbox-agendadas | `/painel/inbox` | `src/features/communication/whatsapp/WhatsAppInboxScreen.tsx` | [desktop](references/desktop/state--inbox-agendadas.png) / [mobile](references/mobile/state--inbox-agendadas.png) | validado |
| state--inbox-painel | `/painel/inbox` | `src/features/communication/whatsapp/components/WhatsAppDashboardModal.tsx` | [desktop](references/desktop/state--inbox-painel.png) / [mobile](references/mobile/state--inbox-painel.png) | validado |
| state--inbox-nova-conversa | `/painel/inbox` | `src/features/communication/whatsapp/components/WhatsAppStartChatModal.tsx` | [desktop](references/desktop/state--inbox-nova-conversa.png) / [mobile](references/mobile/state--inbox-nova-conversa.png) | validado |
| state--inbox-filtros | `/painel/inbox` | `src/features/communication/whatsapp/WhatsAppInboxScreen.tsx` | [desktop](references/desktop/state--inbox-filtros.png) / [mobile](references/mobile/state--inbox-filtros.png) | validado |
| state--campanhas-criar | `/painel/disparos` | `src/features/communication/whatsapp-campaigns/WhatsAppCampaignsScreen.tsx` | [desktop](references/desktop/state--campanhas-criar.png) / [mobile](references/mobile/state--campanhas-criar.png) | pendente |
| state--campanhas-editar | `/painel/disparos` | `src/features/communication/whatsapp-campaigns/WhatsAppCampaignsScreen.tsx` | [desktop](references/desktop/state--campanhas-editar.png) / [mobile](references/mobile/state--campanhas-editar.png) | pendente |
| state--campanhas-excluir | `/painel/disparos` | `src/features/communication/whatsapp-campaigns/WhatsAppCampaignsScreen.tsx` | [desktop](references/desktop/state--campanhas-excluir.png) / [mobile](references/mobile/state--campanhas-excluir.png) | pendente |
| state--blog-criar | `/painel/blog` | `src/features/blog/BlogTabScreen.tsx` | [desktop](references/desktop/state--blog-criar.png) / [mobile](references/mobile/state--blog-criar.png) | pendente |
| state--blog-editar | `/painel/blog` | `src/features/blog/BlogTabScreen.tsx` | [desktop](references/desktop/state--blog-editar.png) / [mobile](references/mobile/state--blog-editar.png) | pendente |
| state--blog-visualizar | `/painel/blog` | `src/features/blog/BlogTabScreen.tsx` | [desktop](references/desktop/state--blog-visualizar.png) / [mobile](references/mobile/state--blog-visualizar.png) | pendente |
| state--blog-excluir | `/painel/blog` | `src/features/blog/BlogTabScreen.tsx` | [desktop](references/desktop/state--blog-excluir.png) / [mobile](references/mobile/state--blog-excluir.png) | pendente |
| state--leads-editar | `/painel/leads` | `src/components/LeadForm.tsx` | [desktop](references/desktop/state--leads-editar.png) / [mobile](references/mobile/state--leads-editar.png) | validado |
| state--leads-converter | `/painel/leads` | `src/features/leads/LeadsManagerScreen.tsx` | [desktop](references/desktop/state--leads-converter.png) / [mobile](references/mobile/state--leads-converter.png) | validado |
| state--contratos-editar | `/painel/contratos` | `src/components/ContractForm.tsx` | [desktop](references/desktop/state--contratos-editar.png) / [mobile](references/mobile/state--contratos-editar.png) | validado |
| state--contratos-titular | `/painel/contratos` | `src/components/HolderForm.tsx` | [desktop](references/desktop/state--contratos-titular.png) / [mobile](references/mobile/state--contratos-titular.png) | validado |
| state--contratos-dependente | `/painel/contratos` | `src/components/DependentForm.tsx` | [desktop](references/desktop/state--contratos-dependente.png) / [mobile](references/mobile/state--contratos-dependente.png) | validado |
| state--usuarios-criar | `/painel/config?tab=users` | `src/features/config/users/UsersScreen.tsx` | [desktop](references/desktop/state--usuarios-criar.png) / [mobile](references/mobile/state--usuarios-criar.png) | pendente |
| state--usuarios-editar | `/painel/config?tab=users` | `src/features/config/users/UsersScreen.tsx` | [desktop](references/desktop/state--usuarios-editar.png) / [mobile](references/mobile/state--usuarios-editar.png) | pendente |
| state--links-criar | `/painel/config?tab=links` | `src/features/config/links/LinksScreen.tsx` | [desktop](references/desktop/state--links-criar.png) / [mobile](references/mobile/state--links-criar.png) | pendente |
| state--links-editar | `/painel/config?tab=links` | `src/features/config/links/LinksScreen.tsx` | [desktop](references/desktop/state--links-editar.png) / [mobile](references/mobile/state--links-editar.png) | pendente |
| state--formularios-criar | `/painel/config?tab=forms` | `src/features/config/forms/FormsScreen.tsx` | [desktop](references/desktop/state--formularios-criar.png) / [mobile](references/mobile/state--formularios-criar.png) | pendente |
| state--formularios-editar | `/painel/config?tab=forms` | `src/features/config/forms/FormsScreen.tsx` | [desktop](references/desktop/state--formularios-editar.png) / [mobile](references/mobile/state--formularios-editar.png) | pendente |
| state--formularios-pergunta | `/painel/config?tab=forms` | `src/features/config/forms/StepEditorDialog.tsx` | [desktop](references/desktop/state--formularios-pergunta.png) / [mobile](references/mobile/state--formularios-pergunta.png) | pendente |
| state--perfis-criar | `/painel/config?tab=system&section=access` | `src/features/config/general/SystemSettingsScreen.tsx` | [desktop](references/desktop/state--perfis-criar.png) / [mobile](references/mobile/state--perfis-criar.png) | pendente |
| state--perfis-permissoes | `/painel/config?tab=system&section=access` | `src/features/config/general/SystemSettingsScreen.tsx` | [desktop](references/desktop/state--perfis-permissoes.png) / [mobile](references/mobile/state--perfis-permissoes.png) | pendente |
| state--config-etapa-criar | `/painel/config?tab=system&section=leads` | `src/features/config/general/SystemSettingsScreen.tsx` | [desktop](references/desktop/state--config-etapa-criar.png) / [mobile](references/mobile/state--config-etapa-criar.png) | pendente |
| state--config-origem-criar | `/painel/config?tab=system&section=leads&leadTab=origins` | `src/features/config/general/SystemSettingsScreen.tsx` | [desktop](references/desktop/state--config-origem-criar.png) / [mobile](references/mobile/state--config-origem-criar.png) | pendente |
| state--config-tipo-criar | `/painel/config?tab=system&section=leads&leadTab=manager:lead_tipo_contratacao` | `src/features/config/general/SystemSettingsScreen.tsx` | [desktop](references/desktop/state--config-tipo-criar.png) / [mobile](references/mobile/state--config-tipo-criar.png) | pendente |
| state--config-responsavel-criar | `/painel/config?tab=system&section=leads&leadTab=manager:lead_responsavel` | `src/features/config/general/SystemSettingsScreen.tsx` | [desktop](references/desktop/state--config-responsavel-criar.png) / [mobile](references/mobile/state--config-responsavel-criar.png) | pendente |
| state--config-status-contrato-criar | `/painel/config?tab=system&section=contracts` | `src/features/config/general/SystemSettingsScreen.tsx` | [desktop](references/desktop/state--config-status-contrato-criar.png) / [mobile](references/mobile/state--config-status-contrato-criar.png) | pendente |
| state--config-modalidade-criar | `/painel/config?tab=system&section=contracts&contractTab=contract_modalidade` | `src/features/config/general/SystemSettingsScreen.tsx` | [desktop](references/desktop/state--config-modalidade-criar.png) / [mobile](references/mobile/state--config-modalidade-criar.png) | pendente |
| state--config-abrangencia-criar | `/painel/config?tab=system&section=contracts&contractTab=contract_abrangencia` | `src/features/config/general/SystemSettingsScreen.tsx` | [desktop](references/desktop/state--config-abrangencia-criar.png) / [mobile](references/mobile/state--config-abrangencia-criar.png) | pendente |
| state--config-acomodacao-criar | `/painel/config?tab=system&section=contracts&contractTab=contract_acomodacao` | `src/features/config/general/SystemSettingsScreen.tsx` | [desktop](references/desktop/state--config-acomodacao-criar.png) / [mobile](references/mobile/state--config-acomodacao-criar.png) | pendente |
| state--config-carencia-criar | `/painel/config?tab=system&section=contracts&contractTab=contract_carencia` | `src/features/config/general/SystemSettingsScreen.tsx` | [desktop](references/desktop/state--config-carencia-criar.png) / [mobile](references/mobile/state--config-carencia-criar.png) | pendente |
| state--ia-feature-editar | `/painel/automacoes?tab=ai` | `src/features/config/ai/components/FeatureEditorDrawer.tsx` | [desktop](references/desktop/state--ia-feature-editar.png) / [mobile](references/mobile/state--ia-feature-editar.png) | pendente |
| state--automacao-novo-fluxo | `/painel/automacoes?tab=automation` | `src/features/config/automation/AutoContactFlowSettingsScreen.tsx` | [desktop](references/desktop/state--automacao-novo-fluxo.png) / [mobile](references/mobile/state--automacao-novo-fluxo.png) | pendente |
| state--automacao-novo-template | `/painel/automacoes?tab=automation` | `src/features/config/automation/AutoContactFlowSettingsScreen.tsx` | [desktop](references/desktop/state--automacao-novo-template.png) / [mobile](references/mobile/state--automacao-novo-template.png) | pendente |
| state--nav-notificacoes | `/painel/dashboard` | `src/features/dashboard/DashboardScreen.tsx` | [desktop](references/desktop/state--nav-notificacoes.png) / [mobile](references/mobile/state--nav-notificacoes.png) | pendente |
| state--leads-criar-seletor-1 | `/painel/leads` | `src/features/leads/LeadsManagerScreen.tsx` | [desktop](references/desktop/state--leads-criar-seletor-1.png) / [mobile](references/mobile/state--leads-criar-seletor-1.png) | pendente |
| state--leads-criar-seletor-2 | `/painel/leads` | `src/features/leads/LeadsManagerScreen.tsx` | [desktop](references/desktop/state--leads-criar-seletor-2.png) / [mobile](references/mobile/state--leads-criar-seletor-2.png) | pendente |
| state--leads-criar-seletor-3 | `/painel/leads` | `src/features/leads/LeadsManagerScreen.tsx` | [desktop](references/desktop/state--leads-criar-seletor-3.png) / [mobile](references/mobile/state--leads-criar-seletor-3.png) | pendente |
| state--leads-criar-seletor-4 | `/painel/leads` | `src/features/leads/LeadsManagerScreen.tsx` | [desktop](references/desktop/state--leads-criar-seletor-4.png) / [mobile](references/mobile/state--leads-criar-seletor-4.png) | pendente |
| state--leads-criar-seletor-5 | `/painel/leads` | `src/features/leads/LeadsManagerScreen.tsx` | [desktop](references/desktop/state--leads-criar-seletor-5.png) / [mobile](references/mobile/state--leads-criar-seletor-5.png) | pendente |
| state--leads-criar-seletor-6 | `/painel/leads` | `src/features/leads/LeadsManagerScreen.tsx` | [desktop](references/desktop/state--leads-criar-seletor-6.png) / [mobile](references/mobile/state--leads-criar-seletor-6.png) | pendente |
| state--leads-criar-validacao | `/painel/leads` | `src/features/leads/LeadsManagerScreen.tsx` | [desktop](references/desktop/state--leads-criar-validacao.png) / [mobile](references/mobile/state--leads-criar-validacao.png) | validado |
| state--campanhas-criar-etapa-2 | `/painel/disparos` | `src/features/communication/whatsapp-campaigns/WhatsAppCampaignsScreen.tsx` | [desktop](references/desktop/state--campanhas-criar-etapa-2.png) / [mobile](references/mobile/state--campanhas-criar-etapa-2.png) | pendente |
| state--campanhas-criar-etapa-3 | `/painel/disparos` | `src/features/communication/whatsapp-campaigns/WhatsAppCampaignsScreen.tsx` | [desktop](references/desktop/state--campanhas-criar-etapa-3.png) / [mobile](references/mobile/state--campanhas-criar-etapa-3.png) | pendente |
| state--campanhas-criar-etapa-4 | `/painel/disparos` | `src/features/communication/whatsapp-campaigns/WhatsAppCampaignsScreen.tsx` | [desktop](references/desktop/state--campanhas-criar-etapa-4.png) / [mobile](references/mobile/state--campanhas-criar-etapa-4.png) | pendente |
| state--inbox-lead-drawer | `/painel/inbox` | `src/features/communication/whatsapp/components/WhatsAppLeadDrawer.tsx` | [desktop](references/desktop/state--inbox-lead-drawer.png) / [mobile](references/mobile/state--inbox-lead-drawer.png) | pendente |
| state--inbox-arquivos-drawer | `/painel/inbox` | `src/features/communication/whatsapp/components/WhatsAppChatFilesDrawer.tsx` | [desktop](references/desktop/state--inbox-arquivos-drawer.png) / [mobile](references/mobile/state--inbox-arquivos-drawer.png) | pendente |
| state--inbox-busca-mensagens | `/painel/inbox` | `src/features/communication/whatsapp/WhatsAppInboxScreen.tsx` | [desktop](references/desktop/state--inbox-busca-mensagens.png) / [mobile](references/mobile/state--inbox-busca-mensagens.png) | pendente |
| state--inbox-agendadas-conversa | `/painel/inbox` | `src/features/communication/whatsapp/WhatsAppInboxScreen.tsx` | [desktop](references/desktop/state--inbox-agendadas-conversa.png) / [mobile](references/mobile/state--inbox-agendadas-conversa.png) | pendente |
| state--inbox-mensagens-rapidas | `/painel/inbox` | `src/features/communication/whatsapp/WhatsAppInboxScreen.tsx` | [desktop](references/desktop/state--inbox-mensagens-rapidas.png) / [mobile](references/mobile/state--inbox-mensagens-rapidas.png) | pendente |
| state--inbox-emojis | `/painel/inbox` | `src/features/communication/whatsapp/components/WhatsAppMediaDrawer.tsx` | [desktop](references/desktop/state--inbox-emojis.png) / [mobile](references/mobile/state--inbox-emojis.png) | pendente |
| state--inbox-anexos | `/painel/inbox` | `src/features/communication/whatsapp/WhatsAppInboxScreen.tsx` | [desktop](references/desktop/state--inbox-anexos.png) / [mobile](references/mobile/state--inbox-anexos.png) | pendente |
| state--inbox-formatacao | `/painel/inbox` | `src/features/communication/whatsapp/WhatsAppInboxScreen.tsx` | [desktop](references/desktop/state--inbox-formatacao.png) / [mobile](references/mobile/state--inbox-formatacao.png) | pendente |
| state--automacao-fluxo-editar | `/painel/automacoes?tab=automation` | `src/features/config/automation/AutoContactFlowSettingsScreen.tsx` | [desktop](references/desktop/state--automacao-fluxo-editar.png) / [mobile](references/mobile/state--automacao-fluxo-editar.png) | pendente |
| state--automacao-fluxo-regras | `/painel/automacoes?tab=automation` | `src/features/config/automation/AutoContactFlowSettingsScreen.tsx` | [desktop](references/desktop/state--automacao-fluxo-regras.png) / [mobile](references/mobile/state--automacao-fluxo-regras.png) | pendente |
| state--automacao-fluxo-testes | `/painel/automacoes?tab=automation` | `src/features/config/automation/AutoContactFlowSettingsScreen.tsx` | [desktop](references/desktop/state--automacao-fluxo-testes.png) / [mobile](references/mobile/state--automacao-fluxo-testes.png) | pendente |
| state--formulario-publico-contato | `/forms/demonstracao` | `src/pages/public/FormPage.tsx` | [desktop](references/desktop/state--formulario-publico-contato.png) / [mobile](references/mobile/state--formulario-publico-contato.png) | pendente |
| state--inbox-mensagens-rapidas-gerenciar | `/painel/inbox` | `src/features/communication/whatsapp/components/WhatsAppQuickRepliesModal.tsx` | [desktop](references/desktop/state--inbox-mensagens-rapidas-gerenciar.png) / [mobile](references/mobile/state--inbox-mensagens-rapidas-gerenciar.png) | pendente |
| state--inbox-dados-mensagem | `/painel/inbox` | `src/features/communication/whatsapp/components/WhatsAppMessageDetailsModal.tsx` | [desktop](references/desktop/state--inbox-dados-mensagem.png) / [mobile](references/mobile/state--inbox-dados-mensagem.png) | pendente |
| state--inbox-editar-mensagem | `/painel/inbox` | `src/features/communication/whatsapp/components/WhatsAppEditMessageModal.tsx` | [desktop](references/desktop/state--inbox-editar-mensagem.png) / [mobile](references/mobile/state--inbox-editar-mensagem.png) | pendente |
| state--inbox-encaminhar | `/painel/inbox` | `src/features/communication/whatsapp/WhatsAppInboxScreen.tsx` | [desktop](references/desktop/state--inbox-encaminhar.png) / [mobile](references/mobile/state--inbox-encaminhar.png) | pendente |
| state--inbox-resposta | `/painel/inbox` | `src/features/communication/whatsapp/WhatsAppInboxScreen.tsx` | [desktop](references/desktop/state--inbox-resposta.png) / [mobile](references/mobile/state--inbox-resposta.png) | pendente |
| state--inbox-visualizador-imagem | `/painel/inbox` | `src/features/communication/whatsapp/WhatsAppInboxScreen.tsx` | [desktop](references/desktop/state--inbox-visualizador-imagem.png) / [mobile](references/mobile/state--inbox-visualizador-imagem.png) | pendente |
| state--contratos-importacao-individual | `/painel/contratos` | `src/features/contracts/components/ContractJsonImportDialog.tsx` | [desktop](references/desktop/state--contratos-importacao-individual.png) / [mobile](references/mobile/state--contratos-importacao-individual.png) | pendente |

## Validação e exceções

Em execução. O relatório registra separadamente falhas preexistentes e introduzidas. Estado visual herdado do shell não significa que um módulo foi redesenhado ou testado.

## Consolidação desta etapa — 27/10/2026

Na primeira etapa, oito dos 160 contextos foram implementados e validados. As entregas seguintes ampliam essa cobertura, conforme o checklist e os registros abaixo. Uma captura de regressão não equivale a redesign concluído: os fluxos contextuais não migrados continuam pendentes no mapeamento.

### Base reutilizável

- Paleta clara bege/branco/terracota, tema claro como padrão e preferência de tema existente preservada; tema escuro mantém seus tokens próprios.
- Sidebar com largura semântica e grupo ativo expandido; topbar `WorkspaceHeader` usa conta conectada, breadcrumb e alternância real de tema, documentada no showcase.
- Tokens de largura do shell, altura da topbar, superfícies, controle, bordas e tipografia; avatar com variante opcional `brand` mantendo o comportamento anterior como padrão.
- `FormSection` aceita numeração opcional; `FormActions` mantém salvar/cancelar e carregamento. Grupos e exemplos adicionados ao showcase real.

### Leads

- Lista com identificação, avatar, ações rápidas, filtros, busca, exportação, seleção e paginação preservados.
- Mobile com filtros recolhíveis e informações secundárias expansíveis; Kanban com rolagem localizada.
- Criar/editar em workspace, quatro grupos de campos e rodapé acessível acima da navegação mobile. Sem nova rota, API ou alteração de persistência.
- Mantidos todos os campos de produção, opção de não disparar automações, limites de envio, atribuição, follow-up e permissões, mesmo quando omitidos na referência.

### Exceções e próximos módulos

- Detalhes/histórico/lembretes permanecem no fluxo contextual existente; sua abertura e cancelamento foram conferidos. A referência de página de detalhe ainda não foi implementada.
- Conversão, variações de seletores, perfis restritos, calendário e demais estados pendentes precisam de revisão própria. Nenhuma gravação ou ação comercial foi executada no navegador.
- Inbox, contratos, dashboard, agenda, campanhas, configurações e site público ainda não foram redesenhados por módulo. Herdam apenas a base compartilhada aplicável; isso não comprova aderência às respectivas referências.
- Site institucional não recebe shell do CRM. Não há imports do pacote de documentação em `src/`.

### Verificações

- Playwright: antes/depois em 1920×1080, 768×1024, 390×844 e 320×640; ver [relatório de validação](validacao/README.md).
- Build e auditorias de design system/valores visuais/bundle aprovados; arquitetura aprovada.
- Lint: zero erros, um aviso preexistente em `useMetaAds.ts:25`.
- Typecheck: os mesmos dois erros preexistentes em `useVoiceRecording.ts:248` e `xlsxExport.ts:241` (`ArrayBufferLike`); nenhum erro novo de tipagem.
- Testes focados: 15/15 aprovados. Suíte completa: 1713/1717 aprovados, mesmas quatro falhas da execução anterior às mudanças, detalhadas no relatório.

## Continuação — workspaces e estados contextuais

- Detalhe de lead em página com abas funcionais de visão geral, histórico, follow-ups e dados; agendar, converter, editar e excluir usam os callbacks existentes. Confirmações e lembretes permanecem fora da listagem condicional.
- Contratos: cadastro/conversão e ficha em workspace, com apresentação contextual preservada para consumidores existentes; todos os campos e cálculos mantidos.
- Inbox: cabeçalho operacional, lista com avatar, superfícies claras e tipografia de interface; funções de comunicação preservadas e sem envios nos testes.
- Configurações: títulos contextuais por seção e abas alinhadas às referências. Marca tipográfica reutilizável documentada no showcase; login e links claros, homepage com composição mais flat e conteúdo institucional preservado.
- Tokens de padding dos cards centralizados em 16/20/24px; componentes continuam no design system real.
- 128 verificações de estados aprovadas, em 32 contextos × quatro resoluções, sem overflow do documento; [resultados](validacao/consolidacao/estados.json). A revisão das páginas principais e dos estados adicionais continua em execução.
- Typecheck passou: corrigidas a tipagem dos mocks e as fronteiras de ArrayBuffer no áudio/exportação, sem mudar o conteúdo dos arquivos ou o processamento do áudio. Build passou. Onze testes focados passaram, incluindo paridade de campos de ContractForm entre página e modal. Teste de IA atualizado para o rótulo atual da interface e aprovado. Lint sem erros, mantendo um aviso preexistente.
