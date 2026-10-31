# Inbox — agendamento de mensagens

Prévia da modal `WhatsAppScheduleMessageModal` real, montada com dados e configuração sintéticos. A validação não usa a sessão autenticada da aplicação.

## Capturas

- `desktop-light-1920.png` e `desktop-dark-1920.png` — mensagem simples no tema claro e escuro.
- `tablet-light-768.png` e `mobile-light-390.png` — comportamento em tablet e mobile.
- `mobile-320-light.png` — largura mínima; o corpo rola internamente e o rodapé permanece acessível.
- `desktop-date-picker-open.png` — etapa de data do seletor compacto.
- `desktop-date-picker-hour.png` e `desktop-date-picker-minute-step.png` — etapas de hora e minutos.
- `tablet-date-picker-open.png`, `mobile-date-picker-open-390.png` e `mobile-date-picker-open-320.png` — popover dentro da viewport em telas menores.
- `desktop-options-weekly-validation.png` — recorrência semanal selecionada, data limite obrigatória e ação desativada até preencher a validação.
- `desktop-sequence-mode.png` — etapas e ações da sequência.

## Resultado e limites

Playwright conferiu 1920×1080, 768×1024, 390×844 e 320×640. A modal mede 592 px no desktop/tablet e ocupa a viewport em mobile; não houve overflow horizontal. Em 320 px, o conteúdo extenso rola dentro da modal. O popover de data/hora permaneceu dentro dos limites da tela nos tamanhos verificados.

As interações verificadas incluem abertura do seletor e suas três etapas, seleção de recorrência, validação da data final e modo de sequência. Não foi acionada a ação **Agendar mensagem**, nem houve upload ou chamada de serviço. A composição autenticada dentro de `/painel/inbox` continua pendente; o mapeamento marca este estado como parcial.
