# Refinamentos de interface — 27/10/2026

Validação direcionada aos problemas relatados. Não substitui o inventário integral do CRM.

## Alterações

- Agenda: “Nova tarefa” usa o botão primário independente; organização permanece uma ação secundária separada.
- Abas segmentadas: largura respeita o texto; opções não são truncadas quando há espaço. Em telas pequenas, rolagem fica no controle.
- Contratos: seletor de status usa botão de texto, sem a largura fixa de um botão de ícone; título Financeiro acompanha o alinhamento dos valores.
- Ficha de contrato: carregamento, erro e tentativa de recuperação respeitam a apresentação de página, sem abrir um modal intermediário. O modo de diálogo continua disponível. LeadDetails, LeadForm e ContractForm também foram inspecionados; não possuem o mesmo retorno antecipado de modal.
- Field: nova opção reutilizável `descriptionPlacement="tooltip"`, aplicada às dicas dos formulários de leads e contratos e demonstrada no showcase. Descrição acessível permanece associada ao campo; validações continuam visíveis. A dica abre por hover, foco e clique no ícone de informação.
- Gráfico: confirmado o preenchimento do espaço disponível pela implementação responsiva já presente, preservando tamanho dos textos e pontos.

## Evidências

44 screenshots com dados fictícios. Larguras: desktop 1920×1080, tablet 768×1024, mobile 390×844 e mobile-320 320×640.

| Sufixo do arquivo | Interface ou estado |
| --- | --- |
| `trend-{dispositivo}.png` | Gráfico com série mensal em seis pontos |
| `{dispositivo}-dashboard.png` | Dashboard e rótulos das abas em tema claro |
| `{dispositivo}-agenda.png` | Ação primária independente em tema claro |
| `{dispositivo}-status.png` | Menu de status do contrato aberto |
| `{dispositivo}-contract-loading.png` | Carregamento na página, sem diálogo |
| `{dispositivo}-contract-detail.png` | Ficha carregada |
| `{dispositivo}-field-help.png` | Dica da cidade no ícone de informação |
| `{dispositivo}-{dashboard,agenda,contratos}-dark.png` | As três interfaces em tema escuro |
| `{dispositivo}-contract-error-dark.png` | Erro da ficha na página; recuperação validada depois da captura |

O arquivo `coverage.json` registra os resultados. Nenhum overflow horizontal foi encontrado nas verificações; nenhuma exceção de execução foi registrada. Menus, ajuda, carregamento e recuperação foram exercitados via Playwright CLI, com fontes aguardadas e animações desativadas nas capturas. Nenhum registro ou integração real foi acionado.

## Verificações

- Typecheck e lint sem erros.
- Build, auditorias do design system e estilos, e verificação do bundle do editor aprovados.
- Quatro testes direcionados aprovados: ajuda acessível/validação, redimensionamento do gráfico e repository da ficha contratual.
- Aviso preexistente do Vite sobre tamanho de chunk permanece; não impede o build.
