# Invariantes de domínio

Este arquivo registra regras que não são evidentes pela estrutura de pastas. Alterações nessas áreas exigem testes de caracterização e revisão do frontend, Edge Functions, RPCs e triggers envolvidos.

## Automações de leads

- Execução é sequencial: somente a primeira etapa é criada inicialmente; a seguinte nasce após a conclusão real da anterior e respeita delay/janela.
- Mensagem outbound produzida por um fluxo de inatividade não abre outro enrollment do mesmo fluxo. As etapas permanecem no enrollment atual; inbound do cliente, saída do status de gatilho ou cancelamento explícito encerram a régua.
- A primeira etapa de inatividade ancora em `inactivity_started_at + triggerDurationHours`. Spread determinístico vale para backlog real e excesso de cap, nunca para a abordagem `lead_created`.
- `step.messages[]` representa um pacote ordenado de mensagens na mesma etapa. Não existe modo `together`.
- Cada item de `step.messages[]` é Template, Custom ou IA. A instrução IA é obrigatória, gera exatamente um texto no worker antes do primeiro envio e o resultado fica em `action_payload.ai_generated_messages` para retries determinísticos. Falha de geração invalida o job e cancela as próximas etapas sem fallback textual.
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

## Oportunidades comerciais

- `leads` representa contatos/pessoas e não um ciclo de venda único. O mesmo lead pode participar de oportunidades ativas distintas (por exemplo, nova contratação e renovação); a associação ativa é única somente dentro de cada oportunidade.
- Cada oportunidade tem no máximo um contato principal, que deve ser membro ativo. Retirar um lead encerra o vínculo com `removed_at` e preserva o histórico; arquivar a oportunidade também é não destrutivo.
- Alterações via MCP passam pelas RPCs `mcp_*_opportunity`, que verificam novamente o papel admin em `user_profiles`, usam `expected_updated_at` em mutações e registram auditoria sem copiar notas ou dados de contato.
- Os status da oportunidade são `open`, `qualified`, `proposal`, `won` e `lost`; `archived` é um estado separado para manter a etapa comercial original.
- O auditor de follow-up agrupa datas no fuso `America/Sao_Paulo`; ele apenas sinaliza lembretes/mensagens equivalentes entre membros, retornos coincidentes e mensagens dirigidas a não principais sem justificativa registrada. Não altera agenda automaticamente e marca cobertura parcial quando RPCs truncam membros/oportunidades.

## Contratos e documentos privados

- A importação JSON em massa cria somente contratos novos: não vincula leads nem importa titulares/dependentes, parcelas de comissão ou faixas de bônus. O lote inteiro é validado antes de um único insert; códigos repetidos no arquivo ou já existentes impedem a gravação de todos os itens.
- Escritas MCP de contrato/titular/dependente usam funções `mcp_*` com OAuth admin revalidado no banco, allowlists de campos, idempotência para criação/remoção e `expected_updated_at` nas atualizações. `kifer_create_contract_bundle` grava contrato, titular e dependentes atomicamente e não muda o lead; a conversão de lead continua sendo uma etapa explícita da UI.
- Remoção física de titular/dependente só ocorre quando não há dependentes ou metadados de documentos associados; ao encontrar referências, a RPC rejeita a operação sem exclusão parcial. O log de auditoria guarda ator, entidade, campos alterados e timestamps, nunca valores de saúde/identificação.
- Arquivos novos de lead/contrato/titular/dependente ficam em `contract-documents-private`, bucket privado de 20 MiB com allowlist PDF/JPEG/PNG/WebP. Metadados continuam polimórficos, mas RPCs validam a existência do alvo e triggers bloqueiam órfãos até a limpeza do Storage terminar. MCP recebe links assinados de 120 segundos.
- A tabela legada `documents` preserva linhas e URLs existentes e permanece leitura somente no MCP. Novos documentos não são gravados nela.
- O financeiro modela somente ajustes de acréscimo/desconto em `contract_value_adjustments`; não existe ledger de pagamentos/chargebacks/bonificações que autorize inferir tools de registro desses eventos.
- `kifer_update_contract_commission` altera apenas os campos de comissão e bônus já existentes no formulário; pagamento, chargeback e pagamento de bônus continuam sem tool porque não há ledger correspondente.

## Permissão de contato

- A política de saída é por canal, endpoint normalizado e escopo: `global` bloqueia todo envio; `commercial` bloqueia prospecção/follow-up comercial; `service_reply` e `transactional` são escopos distintos. O estado antigo de opt-out de campanhas permanece como compatibilidade sincronizada, não como segundo árbitro.
- Preferência de contato nunca se propaga a familiares. Leads só são associados quando o endpoint corresponde a exatamente um lead ativo; ambiguidades permanecem sem lead vinculado.
- Envios comerciais e respostas de serviço consultam a fonte central imediatamente antes do despacho. Falha na consulta bloqueia o envio; nenhuma tela ou tool faz override silencioso.

## Inbox e persistência WhatsApp

- Identidade canônica é resolvida antes de buscar/criar chat. Variantes de telefone e chats mesclados sempre persistem no UUID canônico.
- Alterações MCP de estado/link da Inbox passam por RPCs estreitas, com ator OAuth admin revalidado no banco, lock do chat canônico, `expected_updated_at`, idempotência e auditoria; não se escrevem tabelas do Inbox diretamente pelo dispatcher MCP.
- `kifer_resolve_identity_conflict` só resolve `lead_ambiguous` e `lead_conflict` escolhendo um lead entre os IDs candidatos persistidos. Exige as versões atuais do conflito e do chat. Conflitos de identificadores externos retornam `requires_review` até que uma RPC revalide a identidade no provider.
- Link/deslink manual de chat não mescla nem exclui chats. Conflitos de identificadores externos sem evidência round-trip persistida permanecem para revisão; nenhum ID fornecido pelo cliente é aceito como prova de identidade.
- Merge de leads permanece pendente: as referências por FK têm políticas de exclusão distintas, existem colisões em índices únicos e documentos privados prendem metadados e caminho do Storage ao UUID original.
- Nome de perfil/push name de `GET /contacts/{ContactID}` tem prioridade sobre `chat_name` de eventos.
- Persistência com `external_message_id` deve manter o caminho de `INSERT ... ON CONFLICT DO NOTHING`; nunca substituir por apenas SELECT/UPDATE.
- Deduplicação e `message_at > archived_at` protegem contra ecos. Mensagem inbound nova e contabilizada pode desarquivar o chat, salvo regra de silenciamento; persistência outbound e atualização de status preservam o arquivamento manual. Soft-delete reabre com inbound real posterior.
- Mídias históricas ficam em Storage (`comm-whatsapp-media`), não dependem de URL/MediaID temporário da Whapi.
- Status outbound continua sendo consultado de `delivered` até `read`; webhook ausente usa `GET /statuses/{MessageID}`.
- Follow-up normal usa duas etapas na mesma Feature `followup.generate`: a primeira gera o rascunho e a segunda IA faz revisão semântica com o histórico completo, podendo aprovar, reescrever ou recomendar espera. Cada etapa admite no máximo um retry de contrato técnico e mantém o mesmo modelo resolvido. `followup.refine` é manual e a recuperação tardia usa `comm_follow_up_audit_log` para evitar chamada duplicada.
- Avaliações internas podem usar `simulationMode` exclusivamente com service role. A simulação executa o mesmo pipeline de geração e revisão, mas não cria `comm_follow_up_audit_log`, não altera lembrete e não envia mensagem.
- A mensagem de follow-up retoma o último fio comercial não resolvido, preservando decisor, objeção, compromisso e uma microdecisão atômica. A microdecisão é o destino comercial, não toda a mensagem: vínculo e avanço devem coexistir. Quando o contexto pede acolhimento, uma ou duas frases humanas, curtas e sustentadas no histórico antecedem o CTA; objetividade não autoriza abordagem fria, interrogativa ou com aparência de formulário. O histórico, e não o título do lembrete, distingue follow-up comercial, retomada de qualificação e retorno solicitado. Quando um lead ainda não qualificado interrompeu por indisponibilidade, o retorno primeiro confirma se ele pode retomar do ponto interrompido. A IA também deve distinguir ações pendentes das já concluídas: uma cotação, pesquisa, comparação ou verificação registrada no transcript não pode ser oferecida novamente como ação futura. Alternativas apresentadas ao lead precisam ser distintas no critério perguntado; o CTA não pode criar falsa escolha entre estados que podem coexistir. Julgamentos como genericidade, repetição, pressão, coerência de estágio, calor humano e avanço comercial pertencem à revisão por IA; validações determinísticas cuidam apenas de transporte, segurança da saída e formatação. O transcript entregue às IAs elimina apenas linhas consecutivas idênticas de sincronização, sem resumir ou remover fatos distintos. Quando não existe contato comercialmente útil e apropriado naquele momento, a revisão retorna uma decisão interna de espera. Esperas por contato recente ou data explicitamente combinada podem gerar nova data; esperas por falta de movimento útil, contexto pessoal ou ação pendente da corretora são dirigidas por evento e não criam novo follow-up apenas porque o tempo passou.

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
