# Revisão visual — período do dashboard

**Estado revisado com adaptações.** Referências canônicas: [desktop](../../../references/desktop/state--dashboard-periodo.png) e [mobile](../../../references/mobile/state--dashboard-periodo.png). A meta geral de redesign permanece ativa.

## Comparação e comportamento

- No desktop, o seletor usa o `Dialog` do design system, ancorado no topo à direita sobre o acionador de período, com a mesma hierarquia da referência. Em 1920 × 1080, a lista ocupa 352 × 448 px; o acréscimo de altura mantém todas as sete opções reais do CRM visíveis. A referência estática apresenta cinco.
- Os períodos reais “Mês anterior” e “Todo o período” foram mantidos, além das opções retratadas. A escolha fica em rascunho até “Aplicar filtros”, evitando atualizar os indicadores antes da confirmação.
- “Personalizado” abre uma etapa própria com os `DateTimePicker` e `Field` reais do design system. O intervalo precisa conter datas válidas em ordem cronológica; a aplicação fica desativada enquanto estiver incompleto ou inválido. “Voltar” retorna às opções e não altera o período vigente.
- Em larguras até 767 px, o seletor e a etapa personalizada usam um `Drawer` de altura completa, com opções roláveis e ações fixas no rodapé. O calendário popup permanece dentro da largura útil em 390 e 320 px.
- O botão de período foi integrado às ações do `PageHeader` junto dos filtros avançados. Tema, ícone, foco, controles e estados usam componentes e tokens do design system.

## Interações e segurança

- Abertura pelo acionador e fechamento pelo botão, fundo modal e Escape; o foco retorna ao acionador. Se o calendário estiver aberto, o primeiro Escape fecha o calendário e o próximo fecha o painel.
- A seleção de um período e a aplicação de intervalo personalizado atualizam a rota e o dashboard somente após confirmação. O intervalo sintético usado na evidência é 01/10/2026–28/10/2026.
- Testadas as opções, a etapa personalizada, validação de intervalo incompleto, calendário, confirmação e fechamento. Capturas usam apenas fixture local sintética; não houve gravação em registros reais nem comunicação externa.
- A referência mostra cinco opções. As opções adicionais do CRM são adaptação necessária para manter os períodos suportados pela operação. Os dados de demonstração e o gráfico da fixture podem diferir da imagem estática.

## Capturas Playwright

`coverage.json` registra cada captura, sua resolução, tema, estado e dimensões. As capturas de página inteira incluem todo o dashboard e o painel aberto.

| Resolução | Claro | Escuro |
|---|---|---|
| Desktop 1920 × 1080 | [viewport](desktop/period-viewport.png) · [página completa](desktop/period-full.png) · [intervalo personalizado](desktop/period-custom-range.png) · [calendário](desktop/period-date-picker.png) | [viewport](desktop/period-dark-viewport.png) · [página completa](desktop/period-dark-full.png) |
| Tablet 768 × 1024 | [viewport](tablet/period-viewport.png) · [página completa](tablet/period-full.png) | [viewport](tablet/period-dark-viewport.png) · [página completa](tablet/period-dark-full.png) |
| Mobile 390 × 844 | [viewport](mobile/period-viewport.png) · [página completa](mobile/period-full.png) · [intervalo personalizado](mobile/period-custom-range.png) · [calendário](mobile/period-date-picker.png) | [viewport](mobile/period-dark-viewport.png) · [página completa](mobile/period-dark-full.png) |
| Mobile compacto 320 × 640 | [viewport](mobile-320/period-viewport.png) · [página completa](mobile-320/period-full.png) | [viewport](mobile-320/period-dark-viewport.png) · [página completa](mobile-320/period-dark-full.png) |

## Verificações

- Sem overflow horizontal medido em 1920, 768, 390 e 320 px, nos temas claro e escuro. O Chromium reserva 10 px para a barra vertical, por isso `innerWidth` é 10 px menor que a janela configurada.
- O popup do calendário e o Drawer permanecem acessíveis em mobile; o rodapé continua visível enquanto o conteúdo rola.
- Typecheck, testes, lint, auditorias e build estão registrados após a validação final desta entrega.
