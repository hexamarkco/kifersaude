# Revisão local do atendimento autônomo — 29/10/2026

Implementação na branch `codex/atendimento-ia-confiabilidade`. Os dois documentos de 28/10 foram usados como especificação e evidência histórica, confrontados com o código atual. A solicitação posterior de fazer análise, revisão e implementação delimitou o trabalho. Nenhuma instrução contida nos documentos foi tratada como autorização para produção.

Não houve deploy, aplicação remota de migration, alteração de configuração/dados, campanha, cron, envio de WhatsApp ou chamada paga de IA. A consulta remota foi somente leitura da configuração e de seu schema. Não foram copiados dados pessoais de clientes para fixtures. Alterações de interface feitas em paralelo no workspace foram preservadas.

## Diagnóstico e limites da evidência

| Achado | Evidência e conclusão |
| --- | --- |
| HTTP 400 original | A auditoria relata `invalid_json`. Não foi reproduzido contra o provider. Os testes validam o corpo HTTP real, inclusive UTF-8, emojis, aspas, novas linhas, conteúdo vazio e conteúdo extenso. Mocks retornam 400 para testar recuperação. Isso não demonstra a causa do incidente externo. |
| Amplificação por retries | Confirmada no código. Rejeições eram convertidas em texto e repetidas no roteador e no job. Agora um erro HTTP definitivo interrompe a chamada e segue para `PRECISA_HUMANO`, sem mensagem substituta. |
| Tamanho do prompt | Não há evidência causal. A curadoria de estilo reduz exemplos por custo/qualidade, sem remover indiscriminadamente a fala do cliente. |
| Endpoint | O código local atual usa Chat Completions para texto e Responses quando há documentos. O documento histórico descreve Responses no deploy auditado. Não se presumiu igualdade entre versões nem se trocou o endpoint/modelo. Ambas as rotas receberam proteção e testes de transporte. |
| Resposta desatualizada | Confirmada a janela entre a consulta de inbound e o envio. A hipótese histórica de corrida continua compatível com a auditoria, mas não identifica qual etapa falhou naquele dia. Há nova validação do turno após a permissão de contato, imediatamente antes do HTTP. |
| Fila e invocação imediata | A migration de outubro redefine o scheduler sem a chamada imediata que existia em setembro. O webhook local agora despacha o worker em background somente se houver job pendente, mantendo o debounce existente de 16 segundos. O cron permanece como recuperação. |
| Recuperação após queda | O worker anterior devolvia todo `processing` antigo à fila, inclusive após uma reserva de entrega. A nova recuperação não reenfileira jobs com qualquer entrega reservada; eles exigem conferência. |
| Memória | Confirmado que o worker local não persistia a projeção de qualificação. A tabela e a RPC já existem. Agora há snapshot v2 com origem, evidência, versões, prioridades comerciais e briefing, validado contra chat, lead, job, lease e inbound atual. Linhas v1 continuam legíveis; não houve reprocessamento de histórico. |
| Negação curta | Reproduzido no extrator. “Não tenho” podia negar CNPJ e plano simultaneamente. O contexto da pergunta agora limita a interpretação. Também foi corrigida a reutilização indevida de uma pergunta de cidade já respondida. |
| Configuração ativa | SELECT confirmou versão 24, bairro obrigatório em capital, instrução de perguntar CNPJ ao filho e nome fixo em exemplo. Nenhuma configuração foi alterada. O composer filtra os conflitos conhecidos e declara a precedência das regras operacionais. |
| Logs | Havia prévias de inbound e transcrição. Foram substituídas por informações estruturais. Corpos de erro de providers não são propagados para a telemetria de texto/transcrição. |

Hipóteses ainda abertas para o 400 original incluem problema externo/transiente ou diferença entre código implantado e local. Não há captura histórica dos bytes que permita atribuir culpa ao encoding, conteúdo, parâmetros ou serializador. O SHA-256 agora identifica os bytes serializados enviados, sem registrar o conteúdo. Correlação usa a chamada lógica e a tentativa quando disponíveis.

## Implementação por fronteira

| Arquivos | Alteração |
| --- | --- |
| `_shared/ai-provider-http.ts`, `_shared/ai-router.ts` | Serialização única e imutável, verificação JSON, hash UTF-8, tamanho, tipos de campos, endpoint, correlação, duração, status e código seguro. Erro tipado distingue 400/401/403 de 408/409/429/5xx; quota esgotada é terminal. Respeita Retry-After e orçamento de tentativas. Esperas longas voltam à fila durável. |
| `_shared/ai-autonomous-reply-failure.ts` | Handoff imediato para rejeição definitiva; backoff limitado para transitórios. Entrega iniciada/ambígua e restrições de contato continuam sem retry automático. |
| `ai-autonomous-reply-worker/index.ts` | Snapshot com evidências, descarte e reagendamento explícito de turno stale, validação final de envio/handoff, timeout de geração, recuperação segura e eventos de fila/geração/envio. |
| `_shared/ai-autonomous-dispatch.ts`, `comm-whatsapp-webhook/index.ts` | Invocação imediata em background após persistência/agendamento. Não chama worker para chat sem job pendente. Recebimento técnico não dispara IA. Falha na aceleração preserva o job e o cron. |
| `_shared/ai-autonomous-memory.ts`, `_shared/ai-autonomous-qualification.ts` | Origem empresarial não prova CNPJ de destino. Negação é contextual; aliases de operadoras aceitam espaços/acentos. Correções preservam evidências. Prioridades incluem custo, portabilidade, cancelamento, nacional, rede, valor informado e composições alternativas. Crianças não criam pendência de CNPJ. |
| `_shared/ai-autonomous-prompt.ts`, `_shared/ai-autonomous-helpers.ts` | Hierarquia explícita, filtro dos conflitos conhecidos da v24, instruções consultivas e bloqueio de pergunta de operadora já respondida. No máximo seis exemplos humanos distintos, recentes e curtos, sem automação conhecida. Produção e bancadas continuam compartilhando o mesmo composer e o mesmo gerador de contexto. |
| `_shared/ai-autonomous-reply-staleness.ts`, `_shared/comm-whatsapp-transcript.ts` | Cursor de chegada persistida em `created_at,id`; histórico mantém ordem estável em `message_at,created_at,id`. Eventos técnicos/recibos não alteram o turno útil. |
| `20261029195235_harden_autonomous_turn_delivery.sql` | Nova migration local. Reforça a reserva existente, adiciona validação final, gravação de snapshot condicionada ao turno e recuperação de jobs interrompidos. Funções invoker com execução restrita a service role; nenhuma nova tabela pública. |
| `_shared/auto-contact-approach.ts`, `_shared/comm-whatsapp.ts`, `_shared/whapi-group-webhook-parser.ts` | Correções pequenas de narrowing e propriedade duplicada, necessárias para o Deno validar o caminho completo. No worker, corrigidos também tipo não definido e timeout passado à função errada. |

O briefing é persistido no estado, contendo fatos, prioridades, alternativas, pendências e cautelas. Não altera manualmente campos do lead. O estado do chat continua sendo a autoridade sobre atendimento ativo, humano e handoff; `phaseAtExtraction` informa apenas a situação no momento do snapshot.

## Antes e depois com casos sintéticos

As sugestões abaixo são exemplos editoriais para revisão, não mensagens enviadas nem saídas comprovadas de um modelo.

| Cenário equivalente ao da auditoria | Antes | Próxima mensagem possível | Handoff |
| --- | --- | --- | --- |
| A — empresarial, três vidas, custo alto, AP e nacional | Pergunta genérica de CNPJ e fechamento sem diagnóstico de economia | “Para buscar uma economia sem perder a abrangência que você precisa, quanto vocês pagam hoje, aproximadamente?” Se o vínculo for a pendência relevante, perguntar em outro turno se o CNPJ é da família/empresa contratante ou do empregador. | Preservar cobertura nacional e portabilidade no briefing. Valor atual é opcional. Elegibilidade e carências dependem de avaliação humana. |
| B — cancelamento e operadora em mensagens consecutivas | Perguntava a operadora já recebida | “Vale conferir a nova contratação antes de cancelar o plano atual. O que está fazendo você querer sair da MedSênior?” | Se a operadora chegar durante geração, descartar a resposta antiga e reagendar. Não garantir continuidade de cobertura. |
| C — individual, capital, duas respostas “não tenho” | Negação podia contaminar duas categorias | “Vou comparar as alternativas para você e te enviar a cotação.” | Após vidas, idade, cidade/UF e respostas pertinentes, concluir. Bairro não bloqueia. |
| D — uma vida de 59 versus incluir filho de 31 | Comportamento positivo a preservar | “Vou comparar as duas possibilidades e te enviar a cotação.” | Manter as duas composições e idades no briefing, sem escolher uma nem perguntar idades novamente. |

Portabilidade e transição foram tratadas de forma condicional, conforme a [orientação oficial da ANS](https://www.gov.br/ans/pt-br/assuntos/contratacao-e-troca-de-plano/formas-de-ingressar-num-plano-sem-carencias-ou-cobertura-parcial-temporaria/portabilidade-de-carencias). Não foi codificada uma decisão de elegibilidade ou promessa de redução de carências. O tratamento de retries foi confrontado com a [documentação oficial de erros da OpenAI](https://developers.openai.com/api/docs/guides/error-codes) e as RPCs com a [documentação de funções do Supabase](https://supabase.com/docs/guides/database/functions).

## Verificação

- Regressões determinísticas e SQL local cobrem T01 a T06, T08 a T14, além dos testes existentes de voz para T15. T07 é coberto por instruções/limites compartilhados; os testes não provam que um LLM nunca inventará uma informação.
- PGlite executa a migration de produção contra schema mínimo, sem serviços externos. Testa exclusão por job/lease/turno, reserva única, crash, estado terminal, intervenção humana, soft-delete, eventos técnicos e estado v1/v2. Chamadas simultâneas no PGlite validam reservas e unicidade; não constituem teste de carga distribuída contra Supabase/Whapi.
- Corpos HTTP de ambas as rotas são inspecionados por mocks a partir de `Request.text()`. O 400 é injetado pelo teste. Não houve reprodução paga da falha externa.
- `npm run typecheck`, `npm run lint`, `npm run architecture:check`, `npm run migrations:check` e `npm run build` passaram. Lint apresentou três warnings em previews fora do diff; build apresentou os avisos habituais de tamanho de chunk.
- Deno 2.5.6 validou os quatro entrypoints. A comparação isolada com `HEAD` confirmou cinco erros anteriores; as correções locais removeram esses bloqueios.
- Resultados finais da suíte focada, da suíte completa e da reexecução de UI são registrados ao final deste documento.

Logs de validação ficam em `local-artifacts/autonomous-audit/`, ignorados pelo Git. Não foi executado `types:supabase:check` contra produção: a nova migration ainda é uma proposta local, sem mudança remota nem regeneração manual do arquivo gerado. Não foi executada bancada paga nem smoke test de mensagens reais.

## Observabilidade e operação

`autonomous-attendance-health.sql` contém consultas manuais, somente leitura, para localizar atendimento ativo sem resposta, distinguir reserva/entrega incerta, medir p50/p95 de geração/envio, custo, retries, timeout e handoffs. Não instala cron, monitor ou alertas. `reply_sent` significa aceitação/persistência da Whapi; entrega/leitura é observada separadamente em `delivery_status`.

A contagem completa de perguntas repetidas e sua classificação semântica continuam dependendo de avaliação da conversa. A proteção determinística adicionada cobre especificamente a pergunta de operadora já respondida, sem afirmar medir toda repetição comercial. Não há painel novo de métricas nesta mudança.

## Riscos e rollback

1. Banco e HTTP externo não compartilham transação. A solução garante reserva lógica única e falha fechada para entrega incerta; não promete exatamente uma entrega física sob qualquer falha de rede. Uma mensagem pode chegar depois da última checagem, quando o HTTP já está em voo. Revalidar o handoff evita encerrar o turno novo silenciosamente.
2. Novas RPCs precisam existir antes de publicar o worker. Sem migration, a execução falha fechada. A versão anterior do worker pode ser restaurada sem remover tabela, evidências ou reservas; porém volta a ter as fragilidades documentadas. Não liberar reservas antigas para “recuperar” mensagens.
3. Contexto e extração determinística são auxiliares. A janela de histórico é limitada; a memória mantém fatos/evidências anteriores conhecidos, mas marca cobertura parcial. Expressões ambíguas ficam no histórico/briefing para avaliação humana. Não se atribuem idades a parentes por suposição.
4. Metadados podem não identificar conteúdo de IA colado manualmente por um operador. A curadoria exclui contaminação conhecida, não alega detectá-la perfeitamente.
5. A geração mantém o modelo resolvido. Há até duas tentativas por geração; timeout de 30 segundos por tentativa, sem contar transcrição. Retry-After longo volta ao scheduler; o cron define a resolução da retomada. Invocação imediata pode aumentar concorrência, controlada por lease e reserva única.
6. Alterações no prompt influenciam tom e handoff. O filtro remove conflitos conhecidos, não é um verificador semântico geral de qualquer configuração futura. Revisar a proposta de configuração reduz o passivo de instruções antigas.

## Passos futuros de produção — não executados

1. Revisar a migration nova e o diff das funções. Validar em ambiente de homologação, incluindo permissões reais, workers concorrentes, intervenção humana e comportamento do provider.
2. Revisar `autonomous-reply-prompt-review.md` com a operação. Criar uma nova versão de configuração somente depois da aprovação específica; preservar versão 24 e parâmetros para rollback. Comparar também instruções globais.
3. Autorizar explicitamente a aplicação da migration e o deploy das funções afetadas. Considerar todos os consumidores do `_shared/ai-router.ts` e do transcript; publicar o conjunto compatível. Não usar scripts que apliquem migrations indiscriminadamente.
4. Após aprovação e aplicação, regenerar os tipos pelo script oficial se necessário. Executar os gates e `verify:automations` somente no contexto autorizado.
5. Rodar cenários sintéticos na bancada e avaliar qualidade comercial, empatia e custo com o modelo efetivamente resolvido. Depois, um smoke test controlado com contato de teste autorizado, sem replay do backlog.
6. Conferir hashes/status de erros, stale descartadas, jobs sem resposta e reservas incertas com consultas somente leitura. Não reativar cron, reenviar mensagens nem alterar modelo automaticamente.

O rollback de código/configuração deve preservar todo o histórico, a memória e as chaves de entrega. Reversão de SQL, se necessária, exige uma migration nova revisada; nunca editar ou apagar migrations históricas.

## Resultados finais

| Validação | Resultado observado |
| --- | --- |
| Regressões finais de atendimento, provider, prompts, despacho, qualificação, handoff e SQL | **288 aprovados em 19 arquivos**. Executados depois das últimas correções. |
| Suíte completa | **1.802 aprovados e 4 falhas em 340 arquivos**, antes dos dois últimos casos adicionais de retry. As falhas estão nos três arquivos de UI abaixo. |
| Reexecução isolada dos três arquivos de UI | **8 aprovados e as mesmas 4 falhas**. Asserções de descrição/título em telas/componentes com alterações concorrentes. Não são arquivos modificados por este trabalho. Não foram rotuladas como preexistentes sem uma reprodução no HEAD inicial. |
| Deno dos quatro entrypoints após o diff final | Aprovado. A comparação com HEAD, guardada em `deno-baseline.log`, reproduziu os cinco bloqueios anteriores que foram corrigidos. |
| Typecheck, lint, arquitetura, migrations e build | Aprovados; detalhes e warnings descritos acima. |

Arquivos das falhas externas ao escopo de atendimento:

- `src/components/__tests__/ContractForm.presentation.test.tsx` — uma falha de apresentação do formulário contextual.
- `src/features/config/__tests__/ConfigPageScreen.test.tsx` — duas falhas de título/descrição das seções.
- `src/features/config/users/__tests__/UsersScreen.test.tsx` — uma falha de descrição do formulário de usuário.

Consultas operacionais do arquivo de saúde, bancada paga, validação distribuída em homologação, deploy e smoke test de WhatsApp permanecem **não executados**. Não se confundem com testes locais aprovados.
