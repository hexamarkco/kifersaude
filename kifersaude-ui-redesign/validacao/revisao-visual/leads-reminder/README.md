# Agendamento de lembrete — comparação visual

**Status: comparado com as referências desktop e mobile.** A implementação usa o `Dialog` e os campos reais do design system. Nenhum lembrete foi salvo durante a revisão.

## Ajustes

- O diálogo agora usa a largura reutilizável de formulário (37rem / 592px), próxima à referência, e mantém título, contexto e ações em posições consistentes.
- A variante semântica `Dialog size="form"` está demonstrada no catálogo interativo do design system para servir de padrão reutilizável.
- No desktop e tablet largo, os campos seguem as três linhas da referência: título/tipo, prioridade/data e responsável/observações. Abaixo de 640px, os campos ficam empilhados e as ações Cancelar/Agendar lembrete permanecem lado a lado no rodapé fixo.
- O aviso grande foi reduzido a uma orientação de uma linha ou duas, preservando `promptMessage` sem competir com o formulário.
- O valor inicial do título continua incluindo o nome do lead. Em larguras estreitas, o texto excedente usa reticências e o campo mantém o título completo para edição.
- **Diferença funcional da referência:** o CRM não possui responsável próprio para o lembrete. O campo exibe `lead.responsavel` como somente leitura, com explicação, sem adicionar uma atribuição que o modelo não persiste.
- A ação continua criando o mesmo lembrete e sincronizando os dados reais do lead. O botão principal mantém o rótulo operacional **Agendar lembrete**; **Cancelar** fecha sem gravar.

## Capturas Playwright

Os dados são de uma fixture local sintética. As imagens mostram a janela do navegador com o estado aberto, incluindo o fundo sob o backdrop.

| Estado | Captura |
| --- | --- |
| Desktop claro, 1920×1080 | [desktop-lembrete-1920.png](desktop-lembrete-1920.png) |
| Tablet claro, 768×1024 | [tablet-lembrete-768.png](tablet-lembrete-768.png) |
| Mobile claro, 390×844 | [mobile-lembrete-390.png](mobile-lembrete-390.png) |
| Mobile compacto, 320×640 | [mobile-320-lembrete.png](mobile-320-lembrete.png) |
| Desktop escuro, 1920×1080 | [desktop-dark-lembrete.png](desktop-dark-lembrete.png) |
| Menu de tipo aberto, 320×640 | [mobile-320-tipo-menu.png](mobile-320-tipo-menu.png) |
| Datepicker aberto, 320×640 | [mobile-320-datepicker.png](mobile-320-datepicker.png) |

## Verificação

- Playwright mediu o diálogo central em 592×507px no desktop e tablet. Em 390px e 320px ele usa a viewport disponível e mantém as duas ações inteiramente visíveis.
- Não houve overflow horizontal no documento nem no corpo rolável do modal. A 320px, o menu de tipo e o datepicker permanecem dentro da viewport; o datepicker mede 304×461px e fecha com Escape sem alterar a data exibida.
- Fechar o diálogo por Cancelar e Escape não executou gravações. Não foram acionadas integrações ou comunicações.
- A sessão local registrou avisos preexistentes do `react-side-effect` e timeouts do Realtime de demonstração. Um erro transitório de contexto durante o hot reload desapareceu ao recarregar a página; o modal permaneceu disponível e operável.

As medidas estruturadas estão em [`coverage.json`](coverage.json).
