# Comissões e produção — revisão visual

**Estado: revisado com adaptações funcionais.** Referências: [desktop](../../../references/desktop/page--comissoes.png) e [mobile](../../../references/mobile/page--comissoes.png).

## Adaptação ao CRM real

- A página real é um calendário de previsões de comissão e bonificação. Ela não possui a série histórica, os contratos pagos, o ticket médio ou a ação de exportar relatório mostrados pela referência estática. Esses elementos não foram simulados.
- O cabeçalho e a hierarquia seguem a referência; quatro cartões resumem apenas dados derivados do mês selecionado: total de comissão prevista, total de bonificação prevista, contratos distintos com previsão e quantidade de lançamentos.
- Quando não há lançamento de um tipo, o cartão mostra `—`, sem converter ausência em um recebimento de R$ 0,00. A lista de eventos e os cálculos existentes permanecem ligados ao calendário real.
- `state--comissoes-dia` aponta para um modal genérico de cadastro sobre o Dashboard. O CRM não tem essa entidade ou fluxo. O comportamento real é selecionar uma data e consultar seus lançamentos ao lado do calendário; a referência foi adaptada a esse estado, sem criar formulário ou persistência.

## Comportamento e responsividade

- Playwright confirmou navegação para mês anterior e próximo, limpeza da seleção ao trocar de mês, seleção de 28/10/2026 com quatro previsões sintéticas e estado sem lançamentos em 01/10/2026.
- Capturas em 1920 × 1080, 768 × 1024, 390 × 844 e 320 × 640, em tema claro e escuro. Nenhuma largura apresentou overflow horizontal. O shell mantém a navegação inferior fixa e o conteúdo da página continua rolável.
- A fixture serviu quatro contratos sintéticos; nenhuma escrita, alteração financeira, integração externa ou comunicação foi executada.
- O console registrou timeout do transporte Realtime local e o aviso preexistente de ciclo de vida de uma dependência. A consulta sintética, as mudanças de mês e a seleção de datas foram concluídas.

## Capturas da página

Cada resolução tem imagem da viewport e da página completa nos dois temas. Dimensões exatas e largura medida do documento estão em [`coverage.json`](coverage.json).

| Resolução | Claro | Escuro |
|---|---|---|
| Desktop 1920 × 1080 | [viewport](desktop/calendar-viewport.png) · [página completa](desktop/calendar-full.png) | [viewport](desktop/calendar-dark-viewport.png) · [página completa](desktop/calendar-dark-full.png) |
| Tablet 768 × 1024 | [viewport](tablet/calendar-viewport.png) · [página completa](tablet/calendar-full.png) | [viewport](tablet/calendar-dark-viewport.png) · [página completa](tablet/calendar-dark-full.png) |
| Mobile 390 × 844 | [viewport](mobile/calendar-viewport.png) · [página completa](mobile/calendar-full.png) | [viewport](mobile/calendar-dark-viewport.png) · [página completa](mobile/calendar-dark-full.png) |
| Mobile compacto 320 × 640 | [viewport](mobile-320/calendar-viewport.png) · [página completa](mobile-320/calendar-full.png) | [viewport](mobile-320/calendar-dark-viewport.png) · [página completa](mobile-320/calendar-dark-full.png) |

## Estado sem lançamentos

O resumo de 01/10/2026 confirma que a seleção vazia informa a ausência sem exibir totais como zero.

| Resolução | Claro | Escuro |
|---|---|---|
| Desktop 1920 × 1080 | [viewport](states/day-without-forecast-desktop-viewport.png) · [página completa](states/day-without-forecast-desktop-full.png) | [viewport](states/day-without-forecast-dark-desktop-viewport.png) · [página completa](states/day-without-forecast-dark-desktop-full.png) |
| Mobile 390 × 844 | [viewport](states/day-without-forecast-mobile-viewport.png) · [página completa](states/day-without-forecast-mobile-full.png) | [viewport](states/day-without-forecast-dark-mobile-viewport.png) · [página completa](states/day-without-forecast-dark-mobile-full.png) |
