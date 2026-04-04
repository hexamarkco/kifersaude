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
- 2026-03-11: A paleta institucional padrao do front passa a priorizar marrom, laranja, preto e branco, com cinzas apenas como apoio neutro. Cores semanticas como verde, vermelho e azul devem ficar restritas a feedback funcional e status.
- 2026-03-11: Superficies de comunicacao/WhatsApp devem priorizar classes semanticas compartilhadas `.comm-*` e o comando `npm run audit:visual` passa a ser a referencia para rastrear hardcodes visuais remanescentes no `src`.
- 2026-03-22: O hot path de nao lidas do WhatsApp passa a priorizar cursores compartilhados por chat (`whatsapp_chat_read_cursors`) e a inbox deve evitar cargas globais antecipadas de fotos fallback e syncs agressivos quando o chat ainda esta fresco.
- 2026-03-22: O armazenamento bruto de webhooks barulhentos do WhatsApp deve priorizar archive em Storage (`whatsapp-webhook-archive`) com resumo leve em `whatsapp_webhook_events`, preservando compatibilidade para scripts operacionais.
- 2026-03-26: O modulo operacional `/painel/whatsapp` e sua stack de inbox/campanhas foram removidos; permanece apenas a integracao WhatsApp usada por automacoes e configurada em Integracoes/Automacoes.
- 2026-04-04: O modulo `Cotador` passa a viver em `/painel/cotador`, com cotacoes separadas do fluxo de contratos e estrutura preparada para operadoras, administradoras e entidades de classe evoluirem sem acoplar o pre-venda ao fechamento.
- 2026-04-04: O `Cotador` passa a persistir cotacoes em `cotador_quotes`, `cotador_quote_beneficiaries` e `cotador_quote_items`, enquanto o catalogo normalizado evolui em `cotador_administradoras`, `cotador_entidades_classe`, `cotador_produtos` e `cotador_produto_entidades`, com backfill inicial do legado `produtos_planos`.
- 2026-04-04: O catalogo do `Cotador` passa a suportar hierarquia `operadora -> linha -> produto -> tabela -> precos por faixa etaria`, com tabelas variando por `PF/ADESAO/PME`, `MEI/nao MEI`, coparticipacao e faixas de vidas.
- 2026-04-04: A entrada principal de `/painel/cotador` passa a ser a lista de cotacoes salvas, com detalhe por rota dedicada (`/painel/cotador/:quoteId`) e configuracao propria do modulo em `/painel/cotador/configuracoes`.
- 2026-04-04: A manutencao administrativa de `operadoras` deixa de viver em `/painel/config` e passa a ser centralizada em `/painel/cotador/configuracoes`, preservando a tabela compartilhada `operadoras` por compatibilidade com contratos e com o catalogo do Cotador.
