# Invariantes de domínio

Este arquivo registra regras que não são evidentes pela estrutura de pastas. Alterações nessas áreas exigem testes de caracterização e revisão do frontend, Edge Functions, RPCs e triggers envolvidos.

## Automações de leads

- Execução é sequencial: somente a primeira etapa é criada inicialmente; a seguinte nasce após a conclusão real da anterior e respeita delay/janela.
- A primeira etapa de inatividade ancora em `inactivity_started_at + triggerDurationHours`. Spread determinístico vale para backlog real e excesso de cap, nunca para a abordagem `lead_created`.
- `step.messages[]` representa um pacote ordenado de mensagens na mesma etapa. Não existe modo `together`.
- `settings.autoSend=false` pausa globalmente; cada fluxo também possui `ativo`. Jobs pendentes de fluxo inativo viram `skipped`, sem envio.
- `leads.skip_automation` é persistente e deve ser respeitado pelo trigger, cron, `leads-api`, engine e scripts de distribuição.
- Arquivamento de chat ou lead não exclui um lead dos fluxos. A tabela `leads` não possui coluna `ativo`.
- Inatividade só continua quando a última atividade comercial relevante aguarda o cliente. Uma resposta inbound real/visível após a primeira outbound cancela o ciclo de forma sticky; eventos técnicos invisíveis não contam.
- Cancelamento por inbound atinge apenas fluxos `inactivity_duration`, nunca etapas administrativas da abordagem.
- O backlog de `lead_created` cobre leads recentes sem qualquer job e reutiliza a mesma engine do trigger original.
- `automation_run_log` registra crons; `automation_flows_health()` é a RPC de diagnóstico; `npm run verify:automations` é o smoke test pós-deploy.

## Campanhas WhatsApp

- O claim prioriza alvos já admitidos (`current_step_index > 0`) antes de novos contatos. Pacing/cap diário restringe admissão, não follow-ups vencidos ou mensagens imediatas do pacote.
- `stop_on_reply` registra a resposta, mas não interrompe mensagens do mesmo estágio com delay zero; a parada ocorre antes da próxima espera real.
- Eventos inbound sem preview visível não contam como resposta. Worker e RPC devem compartilhar essa semântica.
- Classificação de permissão de contato e compatibilidade com intents antigas vive em `_shared/campaign-intent-classification.ts`; testes devem importar esse módulo.

## Inbox e persistência WhatsApp

- Identidade canônica é resolvida antes de buscar/criar chat. Variantes de telefone e chats mesclados sempre persistem no UUID canônico.
- Nome de perfil/push name de `GET /contacts/{ContactID}` tem prioridade sobre `chat_name` de eventos.
- Persistência com `external_message_id` deve manter o caminho de `INSERT ... ON CONFLICT DO NOTHING`; nunca substituir por apenas SELECT/UPDATE.
- Deduplicação e `message_at > archived_at` protegem contra ecos. Mensagem inbound ou outbound nova desarquiva o chat, salvo regra de silenciamento; soft-delete reabre com inbound real posterior.
- Mídias históricas ficam em Storage (`comm-whatsapp-media`), não dependem de URL/MediaID temporário da Whapi.
- Status outbound continua sendo consultado de `delivered` até `read`; webhook ausente usa `GET /statuses/{MessageID}`.
- Follow-up normal usa duas etapas na mesma Feature `followup.generate`: a primeira gera o rascunho e a segunda IA faz revisão semântica com o histórico completo, podendo aprovar, reescrever ou recomendar espera. Cada etapa admite no máximo um retry de contrato técnico e mantém o mesmo modelo resolvido. `followup.refine` é manual e a recuperação tardia usa `comm_follow_up_audit_log` para evitar chamada duplicada.
- A mensagem de follow-up retoma o último fio comercial não resolvido, preservando decisor, objeção, compromisso e uma microdecisão atômica. Julgamentos como genericidade, repetição, pressão, coerência de estágio e avanço comercial pertencem à revisão por IA; validações determinísticas cuidam apenas de transporte, segurança da saída e formatação. Quando não existe contato comercialmente útil e apropriado naquele momento, a revisão retorna uma decisão interna de espera.

## Atendimento autônomo e IA

- Export/import de IA usa schema v3 autocontido. Overrides preservam `model_override_enabled`, `provider` e `model`; `configuration_examples`, campos `effective_*` e snapshots são apenas informativos e nunca são aplicados. Imports v1/v2 seguem suportados.
- Payloads de geração são montados pelo perfil do provider e da família do modelo em `_shared/ai-provider-request-profile.ts`; parâmetros incompatíveis não podem ser enviados uniformemente a todos os modelos.
- `reasoning_effort` pertence à versão da Feature: `NULL` significa automático, e valores explícitos só são oferecidos/aplicados quando o modelo efetivo declara suporte.
- Cada linha de `ai_call_attempts` registra `requested_reasoning_effort` e `applied_reasoning_effort`; o segundo representa o parâmetro do último payload HTTP realmente tentado e não pode ser inferido apenas da configuração exibida na UI.
- Features desativadas no catálogo são legadas e não podem ser reativadas por configuração residual.
- `sandbox.chat` foi aposentada: chat interativo usa `autonomous.reply`; `sandbox.scenario` fica restrita a lead simulado e juiz.
- Menor de 12 anos não é cotado sozinho: adulto é titular e criança dependente, com mensalidade para ambos.
- Antes da primeira resposta autônoma, `Contato Inicial` muda condicionalmente para `Atendimento`; nunca regredir outro status.
- A resposta autônoma só pode ser enviada se a última inbound ainda for a mesma que embasou o prompt. Nova mensagem durante a geração cancela a resposta obsoleta; o job pendente responde ao turno completo após o debounce.
- Quando a IA confirma que vai preparar/enviar a cotação após coletar a qualificação, o chat faz handoff para atendimento manual e o lead vai para `Aguardando cotação`. A tag técnica é o caminho normal; a confirmação explícita é uma proteção contra sua omissão pelo modelo.
- Ao concluir qualificação, `QUALIFICACAO_COMPLETA` faz handoff para `Aguardando cotação`, cancela respostas pendentes e impede novas mensagens até reativação manual.
- `ai_models` e `ai_model_pricing` são deliberadamente desacopladas. Resolva o preço vigente pelo par `(provider, model)`; não use join PostgREST `ai_model_pricing!left`.

## Formulários públicos

- `/forms/:slug` usa `public_forms`, `public_form_steps` e `public_form_submissions`; o passo `contact` é fixo e último.
- Submissão passa obrigatoriamente por `public-form-submit`: allowlist de origem, honeypot, rate limit por IP hasheado e validação server-side contra a definição real.
- Submissão válida cria um lead. Geolocalização é opcional e sempre pulável.

## Design system

- Terracota CRM é light-first; dark mode permanece opcional usando os mesmos tokens semânticos.
- Canvas bege quente, superfícies branco quente, terracota primária, dourado de destaque e marrom profundo; cores de status só para semântica funcional.
- Use Playfair Display em títulos e Inter em corpo/UI. Use tokens de raio `--kds-radius-*`; evite hardcodes e valide com `npm run audit:visual`.
