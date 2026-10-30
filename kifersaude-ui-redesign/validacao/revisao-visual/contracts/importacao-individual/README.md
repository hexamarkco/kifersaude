# Contratos — importação JSON individual

**Revisão parcial.** As capturas mostram o `ContractJsonImportDialog` real em uma prévia local. A rota `/painel/contratos` redirecionou para autenticação sem sessão local disponível, portanto a abertura dentro do formulário e do shell de Contratos ainda precisa de comparação integrada.

## Referências

- [Referência desktop](../../../../references/desktop/state--contratos-importacao-individual.png)
- [Referência mobile](../../../../references/mobile/state--contratos-importacao-individual.png)

A referência representa campos genéricos de contrato, titular e modalidade, com uma ação de salvamento. O fluxo existente recebe um arquivo JSON, valida seu conteúdo e aplica os dados ao formulário ainda não salvo. Essa diferença funcional foi preservada: esta etapa não grava o contrato e não substitui o importador por campos sem comportamento.

## Componentes e comportamento

- Diálogo e fechamento: `Dialog`, `DialogHeader`, `DialogBody` e `DialogFooter` do design system.
- Ações e arquivo: `Button`, `FileInput`, `Alert` e `Text` reutilizáveis.
- A pessoa pode baixar o modelo JSON, selecionar um arquivo, receber erros de extensão ou de leitura, validar os dados, revisar a prévia e só então aplicar os valores ao formulário. O salvamento continua sob responsabilidade do formulário existente.
- O teste de componente confirma que o diálogo não pode ser fechado por Escape ou pelo fundo enquanto a leitura está em andamento.
- Playwright confirmou foco inicial no botão de fechar, fechamento por Escape quando ocioso e retorno do foco ao acionador persistente.
- Em larguras de até 640 px, as ações ocupam duas colunas proporcionais. Em 320 px os rótulos permanecem em uma linha, os botões têm 44 px de altura e o conteúdo do diálogo continua rolável.

## Capturas

Todas as capturas são `fullPage`, com animações e transições desativadas e fontes carregadas antes da captura. O ambiente usa apenas arquivos sintéticos e não envia dados, não grava contratos e não chama integrações externas.

| Captura | Resolução/tema | Estado |
| --- | --- | --- |
| [dialog-1920x1080-light.png](dialog-1920x1080-light.png) | 1920×1080, claro | Diálogo inicial |
| [dialog-1920x1080-dark.png](dialog-1920x1080-dark.png) | 1920×1080, escuro | Diálogo inicial |
| [dialog-768x1024-light.png](dialog-768x1024-light.png) | 768×1024, claro | Diálogo inicial |
| [dialog-768x1024-dark.png](dialog-768x1024-dark.png) | 768×1024, escuro | Diálogo inicial |
| [dialog-390x844-light.png](dialog-390x844-light.png) | 390×844, claro | Diálogo inicial |
| [dialog-390x844-dark.png](dialog-390x844-dark.png) | 390×844, escuro | Diálogo inicial |
| [dialog-320x640-light.png](dialog-320x640-light.png) | 320×640, claro | Diálogo inicial e ações compactas |
| [dialog-320x640-dark.png](dialog-320x640-dark.png) | 320×640, escuro | Diálogo inicial e ações compactas |
| [extension-error-390x844-light.png](extension-error-390x844-light.png) | 390×844, claro | Extensão de arquivo não aceita |
| [json-error-390x844-light.png](json-error-390x844-light.png) | 390×844, claro | Conteúdo JSON inválido |
| [json-validated-390x844-light.png](json-validated-390x844-light.png) | 390×844, claro | JSON válido, prévia para conferência |
| [validation-loading-320x640-light.png](validation-loading-320x640-light.png) | 320×640, claro | Validação em andamento e ações desativadas |

## Medidas e cobertura

Playwright mediu largura do documento igual à viewport em todos os quatro tamanhos. O diálogo mede 592 px em desktop e tablet, ocupa a viewport em 390 px e 320 px; no menor tamanho as ações medem 125×44 px e 153×44 px. A evidência detalhada está em [coverage.json](coverage.json).

**Pendente:** abrir o modal pela ação real do `ContractForm`, comparar a composição sobre a tela autenticada de Contratos e verificar o acionador no shell. Até essa revisão, o contexto permanece `pendente` no manifesto, mesmo com o componente e seus estados já documentados.
