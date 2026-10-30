# Cadastro de dependente

O formulário `DependentForm` foi comparado com as referências de [desktop](../../../../references/desktop/state--contratos-dependente.png) e [mobile](../../../../references/mobile/state--contratos-dependente.png), usando a prévia local da ficha de contrato e dados sintéticos. A tela segue com todos os campos reais do CRM: titular, CPF, nome, nascimento, bônus por vida, parentesco, valor individual, carência e elegibilidade. Os campos adicionais da aplicação foram mantidos para preservar o fluxo comercial.

Corrigi os ícones de CPF e valor individual, a acentuação dos rótulos e a validação de nome e nascimento. Erros aparecem abaixo dos campos e o foco vai para o primeiro campo inválido. A validação não chama a rotina de salvar. O teste focado confirma os dois erros, o foco inicial e zero chamadas à persistência.

## Capturas Playwright

As capturas usam fontes carregadas e animações desativadas. Nenhum CPF foi consultado, nenhuma data foi selecionada e nenhum registro foi gravado. As capturas em `dialog-*` mostram o estado inicial; `*-scrolled` mostra o fim do formulário com o rodapé fixo; `validacao-*` mostra a resposta aos campos obrigatórios; `relacao-aberta-*` e `data-aberta-*` mostram os seletores abertos.

- Desktop 1920×1080: [claro](dialog-desktop-1920x1080-light.png), [escuro](dialog-desktop-1920x1080-dark.png), [relação aberta](relacao-aberta-desktop-1920x1080-light.png), [calendário aberto](data-aberta-desktop-1920x1080-light.png), [validação](validacao-desktop-1920x1080-light.png).
- Tablet 768×1024: [claro](dialog-tablet-768x1024-light.png), [escuro](dialog-tablet-768x1024-dark.png).
- Mobile 390×844: [claro](dialog-mobile-390x844-light.png), [claro com rolagem](dialog-mobile-390x844-light-scrolled.png), [escuro](dialog-mobile-390x844-dark.png), [escuro com rolagem](dialog-mobile-390x844-dark-scrolled.png), [validação](validacao-mobile-390x844-light.png).
- Mobile compacto 320×640: [claro](dialog-mobile-320x640-light.png), [claro com rolagem](dialog-mobile-320x640-light-scrolled.png), [escuro](dialog-mobile-320x640-dark.png), [escuro com rolagem](dialog-mobile-320x640-dark-scrolled.png).

O documento permaneceu sem overflow horizontal nos quatro tamanhos. Em 390 e 320 px, o corpo do diálogo rola internamente e o rodapé fixo mantém **Cancelar** e **Salvar dependente** visíveis.

## Limites

- A rota integrada redirecionou para autenticação; a comparação usa o componente real numa prévia isolada com mocks locais.
- A referência mostra menos campos e estados de beneficiário. O CRM não possui status individual persistido para beneficiários; nenhum status foi inventado.
- A consulta externa de CPF e a gravação não foram acionadas.

[Medições e estados capturados](coverage.json) · [Script reproduzível](capture.js).
