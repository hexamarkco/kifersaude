# Project Operating Conventions

Este projeto adota, como referencia operacional permanente, os seguintes frameworks e colecoes de praticas:

- `claude-mem`
- `get-shit-done`
- `superpowers`
- `awesome-claude-code`
- design system proprio Kifer Saude

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

- 2026-03-10: Este repositorio passou a adotar como referencia permanente os frameworks `claude-mem`, `get-shit-done`, `superpowers` e `awesome-claude-code` para comportamento, planejamento e execucao.
- 2026-03-11: A paleta institucional padrao do front passa a priorizar marrom, laranja, preto e branco, com cinzas apenas como apoio neutro. Cores semanticas como verde, vermelho e azul devem ficar restritas a feedback funcional e status.
- 2026-03-11: Superficies de comunicacao/WhatsApp devem priorizar classes semanticas compartilhadas `.comm-*` e o comando `npm run audit:visual` passa a ser a referencia para rastrear hardcodes visuais remanescentes no `src`.
- 2026-03-22: O hot path de nao lidas do WhatsApp passa a priorizar cursores compartilhados por chat (`whatsapp_chat_read_cursors`) e a inbox deve evitar cargas globais antecipadas de fotos fallback e syncs agressivos quando o chat ainda esta fresco.
- 2026-03-22: O armazenamento bruto de webhooks barulhentos do WhatsApp deve priorizar archive em Storage (`whatsapp-webhook-archive`) com resumo leve em `whatsapp_webhook_events`, preservando compatibilidade para scripts operacionais.
- 2026-03-26: O modulo operacional `/painel/whatsapp` e sua stack de inbox/campanhas foram removidos; permanece apenas a integracao WhatsApp usada por automacoes e configurada em Integracoes/Automacoes.
- 2026-04-29: O projeto deixa de usar `ui-ux-pro-max-skill` como referencia de UI e passa a adotar o design system proprio Kifer Saude. Novas interfaces de `/painel` devem priorizar `src/design-system` e tratar `src/components/ui` como camada de compatibilidade temporaria durante a migracao.
- 2026-05-08: Mídias do WhatsApp operacional devem ser arquivadas em Storage (`comm-whatsapp-media`) no webhook/sync e servidas pela Edge Function `comm-whatsapp-media`, evitando depender de URLs/MediaIDs temporários da Whapi para histórico antigo.
- 2026-05-18: Raios de borda em novas telas de `/painel` devem usar tokens semanticos do design system (`--kds-radius-*`) via componentes DS; evitar valores arbitrarios como `rounded-[26px]` ou `rounded-[1.7rem]` salvo necessidade visual documentada.
- 2026-05-20: Sugestoes de IA no inbox WhatsApp devem seguir o padrao conversacional Kifer: mensagens curtas, condução passo a passo e uma unica pergunta por vez; evitar listas/checklists para coletar dados salvo pedido explicito do cliente.
- 2026-05-20: O desarquivamento automatico de chats do WhatsApp em `comm_whatsapp_persist_message` agora exige (a) mensagem recem inserida, (b) inbound real (`increment_unread=true` e `direction='inbound'`), (c) chat nao mutado e (d) `message_at > archived_at`. Syncs manuais de historico, envios outbound e eventos de status nao desarquivam mais conversas. O patch otimista de arquivamento no front passa a ter TTL de 30s e janela de protecao de 20s contra refetch/realtime.
- 2026-05-20: Excluir conversa no Inbox WhatsApp passa a ser soft-delete (`comm_whatsapp_chats.deleted_at`), removendo a conversa das listagens/search/unread; uma nova mensagem inbound real posterior a `deleted_at` reabre automaticamente o chat.
- 2026-06-30: A base do design system do CRM passa a ser dark-first em `src/design-system`, com tokens globais `--bg-*`, `--text-*`, `--brand-primary`, `--accent-gold`, estados semanticos e aliases `--panel-*` apenas como compatibilidade temporaria. Novas telas e a proxima varredura page-by-page devem usar os componentes DS em vez de hardcodes visuais.
- 2026-06-30: O design system do CRM passa a ter `theme-light` complementar ao dark mode, mantendo terracota/laranja queimado/dourado sobre canvas off-white, surfaces brancas, bordas bege suaves e sombras leves. O dark mode nao deve ser substituido; componentes DS devem funcionar nos dois temas via tokens semanticos.
- 2026-07-01: O sistema passa a usar somente duas fontes: `Playfair Display` para titulos/display e `Inter` para corpo, UI, dados, codigo e qualquer uso mono. Novas interfaces devem usar os tokens `--font-display`, `--font-sans`, `--ks-font-heading` e `--ks-font-body`, sem introduzir outras familias tipograficas.
- 2026-07-13: O design system visual do CRM passa a seguir a referencia Terracota CRM em light-first: canvas bege quente, superficies branco quente, terracota para acao primária, dourado para destaque e marrom profundo para titulos. Raios devem permanecer contidos (`6/8/12/16px`), sombras sutis e gradientes apenas quando comunicarem estado; o dark mode permanece opcional e deve reutilizar os mesmos tokens semânticos.
