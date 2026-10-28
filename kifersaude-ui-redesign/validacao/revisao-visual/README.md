# Revisão visual comparativa

As referências em [`../../references/`](../../references/) definem a meta visual para páginas, diálogos, drawers, menus e estados do CRM. Esta rodada compara código real com essas referências; as capturas anteriores em `validacao/consolidacao/` continuam sendo evidência histórica.

## Cobertura atual

- **8 de 160 contextos** revisados; 152 permanecem sem comparação concluída.
- **231 screenshots** nesta nova rodada: Leads, Contratos e Dashboard.
- A descoberta de telas e overlays fora do manifesto continua pendente.
- O resumo por interface e o status de cada contexto ficam em [`REVISAO_VISUAL.json`](../../REVISAO_VISUAL.json).

## Módulos

- [Leads — listagem, Kanban e criação revisados; detalhe e outros overlays pendentes](leads/README.md)
- [Contratos — listagem, drawer de detalhe e importação em lote revisados com adaptações](contracts/README.md)
- [Dashboard — página principal revisada com adaptações; filtros, período e análises pendentes](dashboard/README.md)

## Critério

Um contexto só recebe `revisado_com_adaptacoes` depois da comparação com a referência, captura nas larguras e temas especificados e registro das diferenças causadas pelos dados ou fluxos reais. Capturas de um estado, sem comparação, não aprovam a interface.
