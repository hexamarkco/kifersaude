# Agenda e tarefas — revisão visual

**Estado: revisado com adaptações funcionais.** A comparação foi feita com as referências [desktop](../../../references/desktop/page--agenda.png), [mobile](../../../references/mobile/page--agenda.png) e os estados de [tarefas](../../../references/desktop/extra--agenda-tarefas.png), [concluídos](../../../references/desktop/extra--agenda-concluidos.png), [criação](../../../references/desktop/state--agenda-criar.png), [organização](../../../references/desktop/state--agenda-organizar.png), [reagendamento](../../../references/desktop/state--agenda-reagendar.png) e [tipos](../../../references/desktop/state--agenda-tipos.png).

## Adaptações ao CRM real

- O calendário mantém os lembretes reais e suas ações atuais. A aba Pendentes apresenta os itens que ainda aguardam atendimento; Concluídos consulta o estado lido já persistido. Não foram criados campos, dados nem regras para imitar os mockups.
- O formulário real de tarefa pede título e descrição; a data usa o comportamento padrão já existente. Campos de responsável, tipo e prioridade da referência não foram adicionados porque não fazem parte desse fluxo. A validação obrigatória foi mostrada sem criar o registro.
- “Organizar follow-ups” configura a fila existente. A captura registra o estado inicial da configuração; não foi gerada prévia nem aplicada nenhuma alteração, pois essas ações chamam o serviço de organização.
- Reagendamento é feito escolhendo uma data na agenda, não por modal de intervalo. A seleção visual foi cancelada sem confirmar alteração.
- O filtro de tipo usa seleção única da taxonomia presente nos lembretes carregados. A referência de canal de origem com múltipla seleção não corresponde ao modelo real.
- A fixture não contém itens concluídos. A aba vazia foi documentada como estado real, sem fabricar registros para preencher a tela.
- Rótulos persistidos como follow_up são apresentados como “Follow-up”; valores e semântica de filtro continuam iguais.

## Comportamento e responsividade

- Playwright percorreu calendário, listas pendentes/concluídas, busca, filtros, formulário, validação, menu de tipos, configuração da fila e seleção de data para reagendamento. Nenhum registro foi salvo, concluído ou reagendado; não houve envio de mensagens ou acionamento de integração externa.
- Capturas em 1920 × 1080, 768 × 1024, 390 × 844 e 320 × 640, nos temas claro e escuro. A largura rolável do documento permaneceu abaixo da viewport em todas as resoluções (1910, 758, 380 e 310 px, respectivamente), sem overflow horizontal.
- Em 320 px, ações do cabeçalho ficam lado a lado, a busca usa placeholder compacto e a navegação do calendário reorganiza seus controles. A navegação inferior fixa permanece acessível e o conteúdo continua rolável.
- O transporte Realtime da fixture local expirou durante o carregamento e uma dependência registrou um aviso preexistente de ciclo de vida. A agenda e as interações de leitura funcionaram.

## Capturas principais

Cada viewport tem captura inicial e da página completa nos dois temas.

| Viewport | Tema claro | Tema escuro |
|---|---|---|
| Desktop 1920 × 1080 | [viewport](desktop/calendar-light-viewport.png) · [página completa](desktop/calendar-light-full.png) | [viewport](desktop/calendar-dark-viewport.png) · [página completa](desktop/calendar-dark-full.png) |
| Tablet 768 × 1024 | [viewport](tablet/calendar-light-viewport.png) · [página completa](tablet/calendar-light-full.png) | [viewport](tablet/calendar-dark-viewport.png) · [página completa](tablet/calendar-dark-full.png) |
| Mobile 390 × 844 | [viewport](mobile/calendar-light-viewport.png) · [página completa](mobile/calendar-light-full.png) | [viewport](mobile/calendar-dark-viewport.png) · [página completa](mobile/calendar-dark-full.png) |
| Mobile compacto 320 × 640 | [viewport](mobile-320/calendar-light-viewport.png) · [página completa](mobile-320/calendar-light-full.png) | [viewport](mobile-320/calendar-dark-viewport.png) · [página completa](mobile-320/calendar-dark-full.png) |

## Todos os estados capturados

São 53 imagens PNG. A dimensão final e a largura do documento medidas em cada captura estão registradas em [coverage.json](coverage.json).

| Estado | Viewport | Tema | Captura | Arquivo | Dimensão |
|---|---:|---|---|---|---:|
| calendar-with-synthetic-reminders | 1920x1080 | Escuro | fullPage | [calendar dark — página completa](desktop/calendar-dark-full.png) | 1920 × 1080 |
| calendar-with-synthetic-reminders | 1920x1080 | Escuro | viewport | [calendar dark — viewport](desktop/calendar-dark-viewport.png) | 1920 × 1080 |
| calendar-with-synthetic-reminders | 1920x1080 | Claro | fullPage | [calendar light — página completa](desktop/calendar-light-full.png) | 1920 × 1080 |
| calendar-with-synthetic-reminders | 1920x1080 | Claro | viewport | [calendar light — viewport](desktop/calendar-light-viewport.png) | 1920 × 1080 |
| calendar-with-synthetic-reminders | 320x640 | Escuro | fullPage | [calendar dark — página completa](mobile-320/calendar-dark-full.png) | 320 × 1651 |
| calendar-with-synthetic-reminders | 320x640 | Escuro | viewport | [calendar dark — viewport](mobile-320/calendar-dark-viewport.png) | 320 × 640 |
| calendar-with-synthetic-reminders | 320x640 | Claro | fullPage | [calendar light — página completa](mobile-320/calendar-light-full.png) | 320 × 1651 |
| calendar-with-synthetic-reminders | 320x640 | Claro | viewport | [calendar light — viewport](mobile-320/calendar-light-viewport.png) | 320 × 640 |
| calendar-with-synthetic-reminders | 390x844 | Escuro | fullPage | [calendar dark — página completa](mobile/calendar-dark-full.png) | 390 × 1576 |
| calendar-with-synthetic-reminders | 390x844 | Escuro | viewport | [calendar dark — viewport](mobile/calendar-dark-viewport.png) | 390 × 844 |
| calendar-with-synthetic-reminders | 390x844 | Claro | fullPage | [calendar light — página completa](mobile/calendar-light-full.png) | 390 × 1576 |
| calendar-with-synthetic-reminders | 390x844 | Claro | viewport | [calendar light — viewport](mobile/calendar-light-viewport.png) | 390 × 844 |
| completed-empty | 320x640 | Escuro | fullPage | [completed empty dark 320 — página completa](states/completed-empty-dark-320-full.png) | 320 × 933 |
| completed-empty | 320x640 | Escuro | viewport | [completed empty dark 320 — viewport](states/completed-empty-dark-320-viewport.png) | 320 × 640 |
| completed-empty | 390x844 | Escuro | fullPage | [completed empty dark 390 — página completa](states/completed-empty-dark-390-full.png) | 390 × 1179 |
| completed-empty | 390x844 | Escuro | viewport | [completed empty dark 390 — viewport](states/completed-empty-dark-390-viewport.png) | 390 × 844 |
| completed-empty | 390x844 | Claro | fullPage | [completed empty light 390 — página completa](states/completed-empty-light-390-full.png) | 390 × 1179 |
| completed-empty | 390x844 | Claro | viewport | [completed empty light 390 — viewport](states/completed-empty-light-390-viewport.png) | 390 × 844 |
| completed-empty | 1920x1080 | Claro | fullPage | [completed empty light desktop — página completa](states/completed-empty-light-desktop-full.png) | 1920 × 1080 |
| completed-empty | 1920x1080 | Claro | viewport | [completed empty light desktop — viewport](states/completed-empty-light-desktop-viewport.png) | 1920 × 1080 |
| create-task-form | 320x640 | Escuro | fullPage | [create task dark 320 — página completa](states/create-task-dark-320-full.png) | 320 × 1747 |
| create-task-form | 320x640 | Escuro | viewport | [create task dark 320 — viewport](states/create-task-dark-320-viewport.png) | 320 × 640 |
| create-task-form | 390x844 | Claro | fullPage | [create task light 390 — página completa](states/create-task-light-390-full.png) | 390 × 1600 |
| create-task-form | 390x844 | Claro | viewport | [create task light 390 — viewport](states/create-task-light-390-viewport.png) | 390 × 844 |
| create-task-form | 1920x1080 | Claro | fullPage | [create task light desktop — página completa](states/create-task-light-desktop-full.png) | 1920 × 1080 |
| create-task-form | 1920x1080 | Claro | viewport | [create task light desktop — viewport](states/create-task-light-desktop-viewport.png) | 1920 × 1080 |
| create-task-required-validation | 320x640 | Claro | viewport | [create task required 320](states/create-task-required-320.png) | 320 × 640 |
| expanded-filters | 320x640 | Escuro | fullPage | [filters open dark 320 — página completa](states/filters-open-dark-320-full.png) | 320 × 1747 |
| expanded-filters | 320x640 | Escuro | viewport | [filters open dark 320 — viewport](states/filters-open-dark-320-viewport.png) | 320 × 640 |
| organizer-configuration | 390x844 | Claro | scroll-position | [organize light 390 — trecho inferior](states/organize-light-390-bottom.png) | 390 × 844 |
| organizer-configuration | 390x844 | Claro | fullPage | [organize light 390 — página completa](states/organize-light-390-full.png) | 390 × 1600 |
| organizer-configuration | 390x844 | Claro | viewport | [organize light 390 — viewport](states/organize-light-390-viewport.png) | 390 × 844 |
| organizer-configuration | 1920x1080 | Claro | fullPage | [organize light desktop — página completa](states/organize-light-desktop-full.png) | 1920 × 1080 |
| organizer-configuration | 1920x1080 | Claro | viewport | [organize light desktop — viewport](states/organize-light-desktop-viewport.png) | 1920 × 1080 |
| pending-reminders | 320x640 | Escuro | fullPage | [pending dark 320 — página completa](states/pending-dark-320-full.png) | 320 × 1553 |
| pending-reminders | 320x640 | Escuro | viewport | [pending dark 320 — viewport](states/pending-dark-320-viewport.png) | 320 × 640 |
| pending-reminders | 390x844 | Escuro | fullPage | [pending dark 390 — página completa](states/pending-dark-390-full.png) | 390 × 1600 |
| pending-reminders | 390x844 | Escuro | viewport | [pending dark 390 — viewport](states/pending-dark-390-viewport.png) | 390 × 844 |
| pending-reminders | 1920x1080 | Escuro | fullPage | [pending dark desktop — página completa](states/pending-dark-desktop-full.png) | 1920 × 1080 |
| pending-reminders | 1920x1080 | Escuro | viewport | [pending dark desktop — viewport](states/pending-dark-desktop-viewport.png) | 1920 × 1080 |
| pending-reminders | 390x844 | Claro | fullPage | [pending light 390 — página completa](states/pending-light-390-full.png) | 390 × 1600 |
| pending-reminders | 390x844 | Claro | viewport | [pending light 390 — viewport](states/pending-light-390-viewport.png) | 390 × 844 |
| pending-reminders | 1920x1080 | Claro | fullPage | [pending light desktop — página completa](states/pending-light-desktop-full.png) | 1920 × 1080 |
| pending-reminders | 1920x1080 | Claro | viewport | [pending light desktop — viewport](states/pending-light-desktop-viewport.png) | 1920 × 1080 |
| reschedule-inline-date-selection | 390x844 | Claro | fullPage | [reschedule select date light 390 — página completa](states/reschedule-select-date-light-390-full.png) | 390 × 1915 |
| reschedule-inline-date-selection-instruction | 390x844 | Claro | viewport | [reschedule select date light 390 — instrução](states/reschedule-select-date-light-390-instruction.png) | 390 × 844 |
| reschedule-inline-date-selection | 390x844 | Claro | viewport | [reschedule select date light 390 — viewport](states/reschedule-select-date-light-390-viewport.png) | 390 × 844 |
| type-filter-options | 390x844 | Claro | fullPage | [type filter open light 390 — página completa](states/type-filter-open-light-390-full.png) | 390 × 1770 |
| type-filter-options | 390x844 | Claro | viewport | [type filter open light 390 — viewport](states/type-filter-open-light-390-viewport.png) | 390 × 844 |
| calendar-with-synthetic-reminders | 768x1024 | Escuro | fullPage | [calendar dark — página completa](tablet/calendar-dark-full.png) | 768 × 1361 |
| calendar-with-synthetic-reminders | 768x1024 | Escuro | viewport | [calendar dark — viewport](tablet/calendar-dark-viewport.png) | 768 × 1024 |
| calendar-with-synthetic-reminders | 768x1024 | Claro | fullPage | [calendar light — página completa](tablet/calendar-light-full.png) | 768 × 1361 |
| calendar-with-synthetic-reminders | 768x1024 | Claro | viewport | [calendar light — viewport](tablet/calendar-light-viewport.png) | 768 × 1024 |
