# Revisão visual comparativa

As referências em [`../../references/`](../../references/) definem a meta visual para páginas, diálogos, drawers, menus e estados do CRM. Esta rodada compara código real com essas referências; as capturas anteriores em `validacao/consolidacao/` continuam sendo evidência histórica.

## Cobertura atual

- **22 de 160 contextos** revisados; 138 permanecem sem comparação concluída.
- **415 screenshots** nesta nova rodada: Leads, Contratos, Dashboard, Comissões e Agenda, incluindo lista, ficha completa e drawer de Lead, filtros, seleção de período, análises reais, calendário financeiro e estados de tarefas.
- A descoberta de telas e overlays fora do manifesto continua pendente.
- O resumo por interface e o status de cada contexto ficam em [`REVISAO_VISUAL.json`](../../REVISAO_VISUAL.json).

## Módulos

- [Leads — listagem, Kanban, criação, ficha completa e drawer revisados; outros overlays pendentes](leads/README.md)
- [Detalhe de Lead — ficha, drawer, abas e responsividade](lead-detail/README.md)
- [Contratos — listagem, drawer de detalhe e importação em lote revisados com adaptações](contracts/README.md)
- [Dashboard — página principal, filtros, período e análises reais revisados com adaptações](dashboard/README.md)
- [Comissões e produção — calendário financeiro real revisado com adaptações](commissions/README.md)
- [Agenda e tarefas — calendário, pendentes, concluídos e interações reais revisados com adaptações](agenda/README.md)

## Critério

Um contexto só recebe `revisado_com_adaptacoes` depois da comparação com a referência, captura nas larguras e temas especificados e registro das diferenças causadas pelos dados ou fluxos reais. Capturas de um estado, sem comparação, não aprovam a interface.
