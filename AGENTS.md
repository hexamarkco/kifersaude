# Project Operating Conventions

Este projeto adota, como referencia operacional permanente, os seguintes frameworks e colecoes de praticas:

- `ui-ux-pro-max-skill`
- `claude-mem`
- `get-shit-done`
- `superpowers`
- `awesome-claude-code`

## Default workflow

Para qualquer tarefa, seguir este fluxo:

1. `discovery`
   - entender o problema, restricoes, contexto e impacto
   - revisar arquivos relevantes antes de propor mudancas
2. `planning`
   - definir a estrategia de menor risco
   - alinhar abordagem com decisoes ja existentes no projeto
3. `execution`
   - implementar de forma incremental, tipada, modular e manutenivel
   - preferir componentes reutilizaveis e baixo acoplamento
4. `verification`
   - validar comportamento, revisar regressao e registrar achados relevantes

Antes de gerar codigo grande, explicar rapidamente o plano e depois implementar.

## Memory and decision tracking

Aplicar uma memoria persistente inspirada em `claude-mem`:

- registrar decisoes importantes do projeto neste arquivo ou em documentacao dedicada
- respeitar padroes arquiteturais ja adotados antes de sugerir mudancas estruturais
- evitar recomendacoes que contradigam decisoes anteriores sem explicitar tradeoffs
- ao identificar uma nova convencao relevante, adiciona-la de forma sucinta e objetiva

## Frontend and UX

Ao trabalhar com interface, usar como criterio:

- UX clara e orientada a tarefa
- consistencia visual entre telas e estados
- componentes reutilizaveis e composiveis
- boas praticas modernas de UI
- acessibilidade, responsividade e feedback de estado como requisitos basicos

Mudancas visuais devem preservar a linguagem existente do produto, salvo quando a tarefa pedir evolucao de design.

## Engineering standards

Ao implementar ou corrigir:

- preferir solucoes tipadas, modulares, escalaveis e faceis de manter
- investigar bugs com profundidade antes de corrigir sintomas
- refatorar de forma estruturada quando isso reduzir risco ou complexidade
- considerar automacoes, verificacoes e organizacao de projeto quando agregarem valor real

## Working style

- nao pular direto para codigo sem contexto
- nao propor mudancas amplas sem verificar impacto no projeto atual
- comunicar o plano de forma curta quando a tarefa tiver mais de um passo relevante
- finalizar tarefas com validacao objetiva e riscos remanescentes, se houver

## Project memory

- 2026-03-10: Este repositorio passou a adotar como referencia permanente os frameworks `ui-ux-pro-max-skill`, `claude-mem`, `get-shit-done`, `superpowers` e `awesome-claude-code` para comportamento, planejamento e execucao.
