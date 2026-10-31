# Inbox — agendamento de mensagens

Revisão da modal real `WhatsAppScheduleMessageModal`, primeiro em prévia sintética e depois integrada ao fluxo de `/painel/inbox`, com uma conversa sintética. A captura integrada não usa dados de clientes, não aciona integrações e não grava nem envia mensagens.

## Capturas

- `desktop-light-1920.png` e `desktop-dark-1920.png` — mensagem simples no tema claro e escuro.
- `tablet-light-768.png` e `mobile-light-390.png` — comportamento em tablet e mobile.
- `mobile-320-light.png` — largura mínima; o corpo rola internamente e o rodapé permanece acessível.
- `desktop-date-picker-open.png` — etapa de data do seletor compacto.
- `desktop-date-picker-hour.png` e `desktop-date-picker-minute-step.png` — etapas de hora e minutos.
- `tablet-date-picker-open.png`, `mobile-date-picker-open-390.png` e `mobile-date-picker-open-320.png` — popover dentro da viewport em telas menores.
- `desktop-options-weekly-validation.png` — recorrência semanal selecionada, data limite obrigatória e ação desativada até preencher a validação.
- `desktop-sequence-mode.png` — etapas e ações da sequência.
- `integrated-empty-validation-desktop-1920.png` — estado inválido; `integrated-filled-desktop-1920.png`, `integrated-filled-tablet-768.png`, `integrated-filled-mobile-390.png` e `integrated-filled-mobile-320.png` — formulário preenchido no fluxo integrado, sem enviar.
- `integrated-date-picker-desktop-1920.png`, `integrated-date-picker-hour-desktop-1920.png` e `integrated-date-picker-minute-desktop-1920.png` — seletor compacto nas etapas Data, Hora e Minutos dentro da modal integrada.
- `integrated-date-picker-mobile-390.png` — popover de data dentro da viewport em mobile.
- `integrated-sequence-desktop-1920.png` — modo de sequência integrado, com as etapas e ações comerciais existentes.
- `integrated-options-mobile-320.png` e `integrated-options-mobile-320-scrolled.png` — opções adicionais no mobile, incluindo o conteúdo após rolagem interna.

## Resultado e limites

Playwright conferiu 1920×1080, 768×1024, 390×844 e 320×640. A modal mede 592 px no desktop/tablet e ocupa a viewport em mobile; não houve overflow horizontal. Em 320 px, o conteúdo extenso rola dentro da modal. O popover de data/hora permaneceu dentro dos limites da tela nos tamanhos verificados.

As interações verificadas incluem abertura do fluxo pela conversa, validação de mensagem obrigatória, seletor de data/hora nas etapas Data, Hora e Minutos, opções adicionais, recorrência e modo de sequência. Em 320 px, as opções rolam dentro da modal e o rodapé permanece acessível. O popover mediu 312 px e permaneceu na viewport em desktop e mobile; o documento não teve overflow horizontal em 1920, 768, 390 ou 320 px.

A referência mostra data e horário separados, contato editável e uma ação **Salvar**. O CRM real usa um único `DateTimePicker`, parte do contato selecionado e oferece mensagem única ou sequência, recorrência, mídia e ações existentes. A comparação fica registrada como adaptação: a validação preserva o fluxo e as regras reais em vez de substituir esses controles por elementos fictícios. A ação **Agendar mensagem** não foi acionada, nenhum arquivo foi enviado e nenhuma chamada de serviço foi feita.
