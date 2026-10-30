# Contratos — importação JSON individual

**Revisado com adaptação.** Além do diálogo isolado, o Playwright abriu o `ContractJsonImportDialog` real pelo acionador real do `ContractForm` dentro de uma prévia local do formulário de criação. A rota autenticada `/painel/contratos` não estava disponível; a prévia usa configuração sintética e bloqueia gravações.

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

As capturas isoladas `dialog-*`, de erro, sucesso e loading são `fullPage`, com fontes carregadas e movimento reduzido. As capturas integradas são do viewport para manter o formulário, o diálogo e as ações fixas no mesmo enquadramento. O ambiente usa somente JSON sintético, bloqueia gravações e não chama integrações externas.

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

### Formulário real — integração local

O harness renderiza `src/components/ContractForm.tsx` e abre o `ContractJsonImportDialog` real por **Importar de arquivo**. A ação não é simulada. Serviços de configuração e persistência usam fixtures locais; nenhum dado foi salvo.

| Captura | Resolução/tema | Estado |
| --- | --- | --- |
| [integrated-1920x1080-light.png](integrated-1920x1080-light.png) | 1920×1080, claro | Diálogo aberto no formulário real |
| [integrated-1920x1080-dark.png](integrated-1920x1080-dark.png) | 1920×1080, escuro | Diálogo aberto no formulário real |
| [integrated-768x1024-light.png](integrated-768x1024-light.png) | 768×1024, claro | Diálogo aberto no formulário real |
| [integrated-390x844-light.png](integrated-390x844-light.png) | 390×844, claro | Diálogo ocupa a tela; ações fixas |
| [integrated-390x844-dark.png](integrated-390x844-dark.png) | 390×844, escuro | Diálogo ocupa a tela; ações fixas |
| [integrated-320x640-light.png](integrated-320x640-light.png) | 320×640, claro | Conteúdo inicial e rodapé fixo |
| [integrated-320x640-dark.png](integrated-320x640-dark.png) | 320×640, escuro | Conteúdo inicial e rodapé fixo |
| [integrated-320x640-light-body-scrolled.png](integrated-320x640-light-body-scrolled.png) | 320×640, claro | Corpo interno rolado até as instruções e seleção |
| [integrated-json-validated-390x844-dark.png](integrated-json-validated-390x844-dark.png) | 390×844, escuro | JSON sintético validado; prévia pronta para aplicar |
| [integrated-json-applied-form-390x844-dark.png](integrated-json-applied-form-390x844-dark.png) | 390×844, escuro | Dados aplicados ao formulário, ainda não salvo |

## Medidas e cobertura

Playwright mediu largura do documento igual à viewport integrada em 1920, 768, 390 e 320 px. O diálogo mede 592 px em desktop e tablet e ocupa a viewport em 390 px e 320 px. No menor tamanho, o corpo tem rolagem interna (107 px) e o rodapé permanece acessível; a captura adicional mostra o fim das instruções e o seletor de arquivo. No diálogo isolado, as ações em 320 px medem 125×44 px e 153×44 px. A evidência detalhada está em [coverage.json](coverage.json).

O fixture `contrato-demo.json` validou cinco campos do contrato e um do titular. **Aplicar ao formulário** preencheu o código `DS-DEMO-01`, a modalidade, a operadora, o plano e a mensalidade; o botão de continuidade/salvamento não foi acionado. O foco inicial no fechamento e o retorno ao acionador foram conferidos.

**Limitação registrada:** não foi possível usar a rota autenticada nem comparar a lista real de contratos por falta de sessão. A revisão integrada cobre a página real de criação e o fluxo real do importador dentro do shell de formulário sintético; não representa uma sessão autenticada de produção.
