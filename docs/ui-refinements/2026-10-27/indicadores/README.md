# Indicadores: raios e alinhamento

`CardIcon` passa a usar o raio semântico de controle (8 px) em todas as composições que reutilizam o componente.

O padrão reutilizável `kds-kpi-grid` organiza KpiCard em três faixas compartilhadas: cabeçalho, valor e contexto. Os títulos reservam duas linhas, e subtítulos, valores e rodapés ficam alinhados entre os cards da mesma linha. A altura acompanha o conteúdo e valores monetários maiores podem quebrar no mobile sem sobreposição. Aplicado aos indicadores comerciais e ao resumo do dashboard; demonstrado com três indicadores no showcase. Use títulos curtos de até duas linhas e ajuste o número de colunas à largura disponível.

Playwright verificou as posições verticais reais de subtítulo, valor e rodapé, o raio dos ícones visíveis, overflow de cada card e overflow da página. Cenários: claro em 1920, 768, 390 e 320 px; escuro em 1920, 1536, 768, 390 e 320 px, incluindo valores monetários maiores. Showcase validado em desktop e mobile. Onze capturas com dados fictícios; resultados em `coverage.json`. Não houve envio, alteração de registro real ou execução de integração.

Typecheck, lint e build aprovados, incluindo auditorias do design system e estilos. Teste existente de DashboardDailyOverview aprovado. Permanece o aviso preexistente de tamanho de chunk no build.
