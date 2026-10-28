# Revisão visual — filtros rápidos de Leads

**Status: comparados com as referências desktop e mobile.** Os filtros de status, responsável, origem e tipo usam o `FilterMultiSelect` reutilizável do design system.

## Padrão aplicado

- Cada acionador abre um `Dialog` compacto. Em desktop ele se posiciona no canto superior direito; em telas menores fica centralizado, mantendo conteúdo rolável e botões acessíveis.
- As opções usam caixas de seleção com a opção “Todos”. As alterações ficam em rascunho até **Aplicar filtros**; **Cancelar**, fechar e Escape descartam o rascunho.
- O acionador mostra a seleção aplicada. O botão existente “Limpar filtros” restaura a listagem sem alterar registros.
- O mesmo componente é usado pelo showcase e pelos filtros de público das campanhas, com títulos acessíveis conforme o contexto.

## Capturas

São **11 screenshots** de dados sintéticos: os quatro filtros em desktop 1920×1080 e mobile 390×844; status também em tablet 768×1024, mobile compacto 320×640 e tema escuro desktop. As imagens registram a janela do navegador com o painel aberto para permitir comparação direta com as referências.

| Filtro | Desktop claro | Mobile |
| --- | --- | --- |
| Status | [desktop-status.png](desktop-status.png) | [mobile-status.png](mobile-status.png) |
| Responsável | [desktop-responsavel.png](desktop-responsavel.png) | [mobile-responsavel.png](mobile-responsavel.png) |
| Origem | [desktop-origem.png](desktop-origem.png) | [mobile-origem.png](mobile-origem.png) |
| Tipo de contratação | [desktop-tipo.png](desktop-tipo.png) | [mobile-tipo.png](mobile-tipo.png) |

Capturas responsivas adicionais: [tablet](tablet-status.png), [mobile 320 px](mobile-320-status.png) e [desktop escuro](desktop-dark-status.png).

## Verificação

Playwright confirmou que o painel cabe no viewport e não causa overflow horizontal em 1920×1080, 768×1024, 390×844 ou 320×640. No browser, selecionar uma opção e cancelar manteve o filtro inalterado; aplicar atualizou o acionador; limpar filtros restaurou o estado inicial. O teste do componente também cobre Escape, descarte do rascunho e retorno do foco.

Durante a navegação local, o console registrou o aviso legado de `react-side-effect` e uma falha de handshake do canal Realtime de demonstração. A tela e os filtros continuaram operáveis; nenhuma gravação ou comunicação externa foi executada.

As medições, estados e limitações estão em [`coverage.json`](coverage.json).
