# Revisão visual comparativa

As referências em [`../../references/`](../../references/) definem a meta visual para páginas, diálogos, drawers, menus e estados do CRM. Esta rodada compara código real com essas referências; as capturas anteriores em `validacao/consolidacao/` continuam sendo evidência histórica.

## Cobertura atual

- **39 de 160 contextos** revisados; 121 permanecem sem comparação concluída.
- **509 screenshots** nesta nova rodada: Leads (incluindo edição em página, lembrete e os quatro filtros rápidos), Contratos (incluindo edição em página), Dashboard, Comissões, Agenda, a página principal da Inbox, Configurações, Usuários e permissões e Login.
- A descoberta de telas e overlays fora do manifesto continua pendente.
- O resumo por interface e o status de cada contexto ficam em [`REVISAO_VISUAL.json`](../../REVISAO_VISUAL.json).

## Módulos

- [Leads — listagem, Kanban, criação, ficha completa e drawer revisados; outros overlays pendentes](leads/README.md)
- [Edição de Lead em página — formulário responsivo, ações e orientações](lead-edit/README.md)
- [Filtros avançados de Leads — diálogo desktop, drawer mobile e critérios reais](leads-advanced-filters/README.md)
- [Filtros rápidos de Leads — status, responsável, origem e tipo](leads-filter-menus/README.md)
- [Agendamento de lembrete — diálogo responsivo, campos e datepicker](leads-reminder/README.md)
- [Detalhe de Lead — ficha, drawer, abas e responsividade](lead-detail/README.md)
- [Contratos — listagem, edição em página, drawer de detalhe e importação em lote revisados com adaptações](contracts/README.md)
- [Dashboard — página principal, filtros, período e análises reais revisados com adaptações](dashboard/README.md)
- [Comissões e produção — calendário financeiro real revisado com adaptações](commissions/README.md)
- [Agenda e tarefas — calendário, pendentes, concluídos e interações reais revisados com adaptações](agenda/README.md)
- [WhatsApp Inbox — estrutura da conversa, painel contextual, composer responsivo e fluxos de abertura revisados](inbox/README.md)
- [Configurações — preferências, origens dos leads e criação revisadas com adaptações](config/README.md)
- [Usuários e permissões — listagem, busca, criação, edição e confirmação revisadas com adaptações](config-users/README.md)
- [Login — formulário pré-autenticado, teclado e responsividade revisados com adaptações](login/README.md)

## Critério

Um contexto só recebe `revisado_com_adaptacoes` depois da comparação com a referência, captura nas larguras e temas especificados e registro das diferenças causadas pelos dados ou fluxos reais. Capturas de um estado, sem comparação, não aprovam a interface.
