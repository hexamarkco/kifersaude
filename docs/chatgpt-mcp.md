# Kifer Saude no ChatGPT

O endpoint `chatgpt-mcp` permite consultar dados atuais do CRM e executar ações explicitamente autorizadas nos domínios operacionais. Não oferece SQL, RPC arbitrária, escrita genérica de registros nem exclusão genérica.

## Limites de segurança

- O acesso do ChatGPT exige OAuth com PKCE S256, vínculo do token ao URI do recurso MCP e uma conta com perfil `admin` no CRM.
- Ferramentas de leitura exigem `kifer.read`; ferramentas de escrita exigem também `kifer.write`. O catálogo `tools/list` anuncia todas as ferramentas e seus requisitos OAuth, inclusive para uma conexão antiga de leitura. A execução continua validando os escopos: uma escrita sem `kifer.write` retorna `isError` e `_meta["mcp/www_authenticate"]` com `insufficient_scope`, permitindo ao cliente abrir a autorização de leitura e escrita.
- Tabelas de códigos, tokens e auditoria são acessíveis somente pela Edge Function via `service_role`; o cliente não consulta esses registros diretamente.
- Tokens de autorização, acesso e renovação são armazenados somente como hashes, têm validade limitada e são invalidados quando a conta deixa de ser administradora.
- As ferramentas de leitura continuam anotadas como `readOnlyHint`. As ações de escrita são schemas fechados, com validação de entidades, auditoria e OAuth de administrador.
- Consultas genéricas de registro exigem OAuth de administrador e aceitam somente catálogos sem dados de clientes. Leads, contratos, titulares, dependentes, documentos, conversas, mensagens e conflitos não podem ser consultados por `select *` genérico.
- Consultas de leads, conversas, mensagens, lembretes, automações e conflitos com contexto operacional também exigem OAuth de administrador. A conexão legada permanece leitura apenas em ferramentas específicas de baixo risco.
- Segredos, configuracoes de integracao, sessao/autenticacao e arquivos brutos de webhook nao sao expostos.
- As configurações de IA retornam prompts somente em ferramentas específicas para administradores; rotas de modelo são projetadas por tarefa e campos de integração/credenciais permanecem privados.
- Cada consulta é registrada em `chatgpt_mcp_audit_log`; cada ação comercial é registrada em `mcp_action_audit_log`, com payload sanitizado e resultado.
- Exceções inesperadas retornam uma mensagem genérica; detalhes internos não são enviados na resposta nem gravados no resultado da auditoria.
- O payload de auditoria também mascara chaves comuns de dados pessoais (CPF/CNPJ, documentos, contatos e endereço), além de credenciais e conteúdo base64.

As ações de escrita exigem OAuth de administrador. O token legado do MCP permanece compatível apenas com as ferramentas de leitura.

## Ferramentas de ação

O agendador oferece `kifer_update_scheduled_whatsapp_sequence` para editar sequências ainda não iniciadas. Consulte `kifer_get_scheduled_whatsapp_sequence` primeiro e informe `scheduled_sequence_id`, o `updated_at` recebido como `expected_updated_at`, `scheduled_at` e a lista completa de `steps`. As etapas substituem as anteriores e aceitam o mesmo formato da criação (mensagem, mídia e ações de status/lembrete). `label` e `cancel_on_inbound_message` são opcionais: omitir preserva o valor atual; `label: ""` remove o título. Conflitos de versão exigem nova consulta. A RPC valida novamente o administrador e reutiliza os locks e restrições da edição no Inbox, recusando etapas já processadas. A operação fica registrada na auditoria MCP.

| Tool | Schema fechado | Efeito |
| --- | --- | --- |
| `kifer_send_whatsapp_message` | `chat_id`, `message`, `client_request_id` | Envia texto pela integração atual; em resultado `ambiguous`, consulte a conversa antes de tentar novamente com outra chave. |
| `kifer_send_whatsapp_media` | `chat_id`, MIME/nome/base64 e `client_request_id` | Envia mídia imediata de até 20 MiB pelo endpoint interno existente; valida MIME, evita URL externa e não persiste base64 na auditoria. Provider aceita PDF/documento, imagem, áudio/voz e vídeo. Em resultado `ambiguous`, consulte a conversa antes de tentar novamente com outra chave. |
| `kifer_schedule_whatsapp_message` | `chat_id`, `message`, `scheduled_at`, `client_request_id` | Programa uma única mensagem de texto para uma conversa existente. Usa a fila nativa do Inbox; não aceita telefone, mídia ou recorrência. |
| `kifer_create_reminder` | `lead_id?`, `contract_id?`, `tipo`, `titulo`, `descricao?`, `data_lembrete`, `prioridade` | Cria lembrete de lead ou tarefa avulsa (`Tarefa`/`Outro`). Quando vinculado ao lead, sincroniza `leads.proximo_retorno` a partir do próximo lembrete aberto. |
| `kifer_update_lead_status` | `lead_id`, `status`, `observacao?` | Aceita somente status ativos de `lead_status_config`, registra interação e histórico. |
| `kifer_create_interaction` | `lead_id`, `contract_id?`, `tipo`, `descricao`, `responsavel?` | Registra observação no histórico comercial. |
| `kifer_set_next_follow_up` | `lead_id`, `proximo_retorno`, `observacao?` | Cria um lembrete de retorno; não cria uma segunda fonte de verdade. |
| `kifer_list_automation_jobs` / `kifer_get_automation_job` | filtros fechados / `job_id` | Consulta a fila de automação sem expor payloads internos. |
| `kifer_cancel_automation_job` / `kifer_retry_automation_job` | `job_id`, agendamento opcional | Cancela pendentes ou reagenda jobs falhos/ignorados; jobs concluídos não podem ser repetidos. |
| `kifer_get_automation_settings` / `kifer_update_automation_settings` | schema fechado de operação | Consulta ou altera somente horários, dias, limite diário, estado e refresh permitidos. |
| `kifer_list_followup_flows` / `kifer_get_followup_flow` | opcional / `flow_id` | Consulta a configuração operacional dos fluxos, sem templates ou URLs internas. |
| `kifer_update_followup_flow` / `kifer_pause_followup_flow` / `kifer_resume_followup_flow` | `flow_id` e campos fechados | Ajusta nome, gatilho, ativação, horários, limites, status-gatilho e configuração das etapas existentes. |
| `kifer_enqueue_lead_followup` / `kifer_remove_lead_from_followup` | `lead_id`, `flow_id` | Adiciona um lead sem duplicar job ativo ou cancela jobs futuros pendentes do fluxo. |
| `kifer_update_lead` | `lead_id`, dados comerciais fechados | Atualiza somente cadastro comercial explicitamente autorizado. |
| `kifer_create_lead` | `lead`, `client_request_id` | Valida opções comerciais ativas, bloqueia duplicata por telefone/e-mail e cria um lead. A mesma requisição retorna o mesmo lead; a criação inicia automações do CRM por padrão. |
| `kifer_archive_lead` / `kifer_unarchive_lead` | `lead_id` | Arquiva ou desarquiva logicamente. Arquivar não cancela jobs ou fluxos existentes. |
| `kifer_set_lead_favorite` | `lead_id`, `favorite` | Define o favorito usando o campo existente do lead. |
| `kifer_update_lead_administration` | `lead_id`, `changes` | Altera somente reativação, `skip_automation`, limite diário individual e datas de blackout. `skip_automation` não cancela jobs já criados. |
| `kifer_bulk_update_leads` / `kifer_bulk_assign_leads` | até 25 `lead_ids` e campos comerciais fechados | Atualiza os mesmos campos ou atribui responsável ativo por lead, com `dry_run`, resultado individual e falha parcial isolada. |
| `kifer_bulk_update_lead_status` | até 25 `lead_ids`, status ativo | Atualiza status e registra interação/histórico individual; aceita `dry_run` e retorna resultados por lead. |
| `kifer_bulk_archive_leads` | até 25 `lead_ids` | Arquiva logicamente sem excluir histórico; aceita `dry_run` e retorna resultados por lead. |
| `kifer_bulk_enqueue_followup` | até 25 `lead_ids`, `flow_id`, `client_request_id` | Enfileira individualmente com chave determinística por ator, requisição e lead; repetições com payload divergente são recusadas. Aceita `dry_run`. |
| `kifer_list_identity_conflicts` / `kifer_get_identity_conflict` | filtros fechados / `conflict_id` | Lista e consulta somente metadados mínimos. Detalhes brutos com telefone e mapeamentos não são expostos. |
| `kifer_update_contract_status` / `kifer_cancel_contract` | `contract_id`, `expected_updated_at`, status opcional | Altera o status configurado com controle de concorrência otimista; impede reabrir contratos cancelados/encerrados e preserva gatilhos de lembrete. |
| `kifer_list_lead_statuses` | sem parâmetros | Lista status comerciais ativos e válidos. |
| `kifer_list_reminders` / `kifer_update_reminder` | filtros fechados / campos fechados | Consulta ou altera lembretes sem acesso genérico à tabela. |
| `kifer_complete_reminder` / `kifer_cancel_reminder` | `reminder_id` | Conclui ou cancela sem exclusão física, preservando auditoria e a sincronização do próximo retorno. |
| `kifer_get_reminder` | `reminder_id` | Consulta um item da agenda e sua `ultima_modificacao`, inclusive tarefas sem lead. |
| `kifer_reschedule_reminders` | `items[]`, `dry_run?` | Reagenda de 1 a 100 itens com datas individuais e versões atuais em uma transação; `reopen: true` torna o item novamente pendente. Um conflito cancela o lote inteiro. |
| `kifer_reopen_reminder` | `reminder_id`, `expected_ultima_modificacao` | Reabre um lembrete concluído/cancelado e sincroniza o próximo retorno do lead. |
| `kifer_delete_reminders` | `items[]`, `confirm_deletion: true`, `dry_run?` | Exclui de 1 a 100 itens como a Agenda do CRM; exige versões atuais e registra auditoria na mesma transação. |
| `kifer_get_next_follow_up` | `lead_id` | Retorna o próximo lembrete pendente de retorno/follow-up. |
| `kifer_bulk_cancel_automation_jobs` | filtros fechados de fila | Cancela logicamente no máximo 100 jobs pendentes, preservando histórico e retornando itens ignorados/erros. |
| `kifer_create_followup_flow` | gatilho e janela comercial fechados | Cria um fluxo vazio; não aceita URLs, webhooks ou configurações técnicas. |
| `kifer_create_followup_step` | ação comercial permitida e configuração fechada | Adiciona texto customizado, template ou messages ordenadas com itens `template`, `custom` e `ai`; a instrução IA é obrigatória e só é executada no envio. |
| `kifer_update_followup_step_message` | `flow_id`, `step_id` e origem da mensagem | Troca uma única mensagem de uma etapa `send_message`; aceita `message`, `template_id` ou `ai_instruction` conforme `message_source`. |
| `kifer_update_followup_step_messages` | `flow_id`, `step_id`, `messages` | Substitui a lista completa e ordenada de mensagens, preservando a mistura de Template, Texto customizado e IA. |
| `kifer_delete_followup_step` / `kifer_reorder_followup_steps` | `flow_id` e etapa / lista completa de IDs | Remove ou reordena etapas somente quando não há jobs pendentes ou em processamento no fluxo. |
| `kifer_clone_followup_flow` | fluxo de origem e sobrescritas fechadas | Copia fluxo e etapas com novos IDs; bloqueia etapas destrutivas, webhook e e-mail. |

### Disparos WhatsApp

O MCP expõe o módulo real de `/painel/disparos` sobre `comm_whatsapp_campaigns`, `comm_whatsapp_campaign_steps` e `comm_whatsapp_campaign_targets`. Ele não cria uma segunda campanha nem reutiliza follow-up flows. Criação/importação são não-enviadoras; a ativação é uma ação separada e chama o `comm-whatsapp-campaign-worker` existente.

| Grupo | Ferramentas | Contrato resumido |
| --- | --- | --- |
| Leitura | `kifer_list_whatsapp_campaigns`, `kifer_get_whatsapp_campaign`, `kifer_preview_whatsapp_campaign`, `kifer_list_whatsapp_campaign_contacts`, `kifer_get_whatsapp_campaign_contact`, `kifer_get_whatsapp_campaign_metrics` | Filtros/paginação, configuração segura, preview determinístico com validação de contatos/variáveis/opt-out/janela, contatos com telefone mascarado e métricas iguais às da UI. Payloads de contato e URLs de mídia não são devolvidos sem filtragem. |
| Escrita | `kifer_create_whatsapp_campaign`, `kifer_update_whatsapp_campaign`, `kifer_import_whatsapp_campaign_contacts` | Campanha começa em `draft`; atualização exige `expected_updated_at`; importação aceita lotes `contacts[]`, normaliza/deduplica e nunca cria leads. |
| Controle | `kifer_activate_whatsapp_campaign`, `kifer_pause_whatsapp_campaign`, `kifer_resume_whatsapp_campaign`, `kifer_schedule_whatsapp_campaign`, `kifer_remove_whatsapp_campaign_contact`, `kifer_delete_whatsapp_campaign` | Estados e validações compatíveis com a UI; remoção de contato é lógica; exclusão de campanha bloqueia processamento iniciado. |

Todas as mutações exigem OAuth de administrador, `client_request_id` estável e, quando há concorrência, `expected_updated_at`. A migration `20261014010000_mcp_whatsapp_campaign_actions.sql` mantém apenas o envelope de idempotência/auditoria; a fonte de verdade continua sendo o módulo `comm_*`. O worker revalida `contact_permission_policies` no escopo `commercial` antes de cada envio e `create_leads_from_csv` permanece falso para o caminho MCP.

O endpoint também publica recursos MCP (`kifer://capabilities/catalog`, guias de operação segura e workflows compostos) e prompts de planejamento/triagem. Eles orientam composição de ferramentas sem liberar SQL, RPC arbitrária, credenciais ou escrita implícita. A importação atual aceita `contacts[]` em lotes de até 500 registros; o runtime JSON-RPC deste endpoint não recebe arquivos anexados como argumento top-level, portanto CSV deve ser convertido para esses lotes pelo conector/agente sem enviar base64 gigante.

Para uma etapa `send_message`, `action_config.messages` e `kifer_update_followup_step_messages.messages` aceitam itens na ordem enviada: `{ "template_id": "..." }`, `{ "custom": { "type": "text", "text": "..." } }` ou `{ "ai": { "instruction": "..." } }`. Templates precisam existir na biblioteca do fluxo; seus IDs continuam ocultos nas respostas de leitura. A IA usa a configuração central da Feature `automation.message_generate` e não é gerada durante a alteração do fluxo.

### Módulos administrativos da expansão

Todas as ferramentas abaixo exigem OAuth de administrador ativo. As ferramentas de escrita usam parâmetros tipados e allowlists; operações com risco de repetição ou concorrência usam `client_request_id` e/ou `expected_updated_at`. Os schemas publicados pelo MCP são a referência exata para cada campo.

| Domínio | Ferramentas | Leitura/escrita | Contrato, efeitos e limites |
| --- | --- | --- | --- |
| Oportunidades | `kifer_create_opportunity`, `kifer_get_opportunity`, `kifer_get_opportunity_360`, `kifer_update_opportunity`, `kifer_archive_opportunity`, `kifer_add_lead_to_opportunity`, `kifer_remove_lead_from_opportunity`, `kifer_set_opportunity_primary_contact` | 2 leitura, 6 escrita | Criação aceita até 50 leads únicos e `client_request_id`; edição, arquivamento e vínculos exigem `expected_updated_at`. Remoção preserva histórico e o contato principal precisa ser trocado antes de removê-lo. |
| Contratos, titulares e dependentes | `kifer_create_contract`, `kifer_update_contract`, `kifer_update_contract_commission`, `kifer_create_contract_holder`, `kifer_create_contract_holder_from_import`, `kifer_create_dependent`, `kifer_create_dependent_from_import`, `kifer_update_contract_holder`, `kifer_remove_contract_holder`, `kifer_update_dependent`, `kifer_remove_dependent`, `kifer_create_contract_bundle`, `kifer_create_contract_value_adjustment`, `kifer_list_contract_value_adjustments` | 1 leitura, 13 escrita | Schemas fechados preservam validações e catálogos do CRM; criação usa idempotência, atualização usa concorrência otimista e o bundle grava contrato/grafo relacionado atomicamente. Titular e dependente podem ser consumidos de staging privado: a ferramenta recebe só IDs opacos, apaga a PII staged na mesma transação e responde somente com IDs. Remoções bloqueiam dependentes e documentos legados/privados ainda ativos ou não limpos. Ajustes registram acréscimo/desconto no modelo existente; não representam pagamentos nem estornos. |
| Documentos | `kifer_list_documents`, `kifer_get_document`, `kifer_upload_document`, `kifer_update_document_metadata`, `kifer_delete_document` | 2 leitura, 3 escrita | Upload privado limitado a 20 MiB e MIME allowlist; acesso administrativo, URL assinada de curta duração e trilha de listagem/acesso sem gravar URL, token, hash ou conteúdo no audit log. A infraestrutura nova não migra URLs de documentos legados. |
| Consentimento | `kifer_get_contact_permission`, `kifer_set_contact_permission`, `kifer_bulk_set_contact_permission` | 1 leitura, 2 escrita | Estados `allowed`, `blocked` ou `unknown` por canal, endpoint e escopo (`global`, `commercial`, `service_reply`, `transactional`). Bulk é atômico e limitado a 50 entradas; decisões ficam em eventos append-only. |
| Inbox e mensagens | `kifer_archive_whatsapp_chat`, `kifer_unarchive_whatsapp_chat`, `kifer_pin_whatsapp_chat`, `kifer_unpin_whatsapp_chat`, `kifer_mute_whatsapp_chat`, `kifer_unmute_whatsapp_chat`, `kifer_mark_whatsapp_chat_read`, `kifer_mark_whatsapp_chat_unread`, `kifer_link_chat_to_lead`, `kifer_unlink_chat_from_lead`, `kifer_delete_whatsapp_chat`, `kifer_set_whatsapp_autonomous_attendance`, `kifer_edit_whatsapp_message`, `kifer_delete_whatsapp_message`, `kifer_set_whatsapp_message_reaction`, `kifer_set_whatsapp_message_starred`, `kifer_forward_whatsapp_message`, `kifer_transcribe_whatsapp_audio`, `kifer_retry_whatsapp_media` | 12 ações de conversa, 7 ações de mensagem | Ações de estado do chat usam RPC MCP, admin revalidado, lock canônico, auditoria, controle de versão e idempotência. Exclusão do chat é lógica. Ativar atendimento autônomo pode gerar resposta externa real após 30 segundos e repete a qualificação no servidor. Edição, exclusão, reação, estrela e encaminhamento confirmam efeitos reais no WhatsApp; transcrição pode gerar custo; retry usa idempotência e valida consentimento. |
| Contatos e respostas rápidas do WhatsApp | `kifer_list_whatsapp_saved_contacts`, `kifer_save_whatsapp_contact`, `kifer_rename_whatsapp_contact`, `kifer_get_whatsapp_quick_replies`, `kifer_update_whatsapp_quick_replies` | 2 leitura, 3 escrita | Contatos são lidos do cache da conta e salvos/renomeados no provedor só após confirmação. Respostas rápidas usam o `integration_settings` lido pelo composer e substituição completa com concorrência otimista. A auditoria registra apenas sufixo do telefone, tamanhos, IDs e contagem; texto de resposta não é copiado para o audit log. |
| Rastreamento da landing page | `kifer_get_tracking_configuration`, `kifer_set_meta_pixel_id`, `kifer_set_google_tag_manager_id` | 1 leitura, 2 escrita | O MCP consulta e atualiza os IDs persistidos pelo painel com controle de versão e confirmação. Não há neste repositório um consumidor desses registros fora do painel; a execução efetiva de Meta Pixel/GTM no site depende de uma integração separada. O MCP só aceita IDs, nunca código/script arbitrário. |
| Assistência de IA no WhatsApp | `kifer_list_whatsapp_attendance_critiques`, `kifer_suggest_whatsapp_reply`, `kifer_rewrite_whatsapp_message`, `kifer_generate_whatsapp_followup`, `kifer_refine_whatsapp_followup`, `kifer_critique_whatsapp_attendance` | 1 leitura, 5 escrita | Geração exige confirmação, pode enviar contexto a um provider configurado e gerar custo. Sugestões e follow-ups retornam rascunhos e não enviam mensagens; crítica é persistida no CRM. Auditorias não guardam rascunho, instruções ou texto da conversa. |
| Conflitos de identidade | `kifer_resolve_identity_conflict` (além de `kifer_list_identity_conflicts` e `kifer_get_identity_conflict`) | 3 ferramentas no total: 2 leitura, 1 escrita | A resolução aceita somente candidato de lead já persistido em conflitos ambíguos ou conflitantes e exige versões atuais do conflito e conversa. Conflitos que dependem de prova externa retornam `requires_review`; merge genérico de lead/chat não é oferecido. |
| Mídia do WhatsApp | `kifer_get_whatsapp_media` | 1 leitura | Retorna mídia apenas por conversa autorizada, com URL assinada temporária e metadados sanitizados; nunca retorna token de provider ou credenciais. |

Exemplos mínimos. Os valores de status, modalidade, operadora e produto no contrato são ilustrativos; use os valores ativos do catálogo retornados pelo CRM.

```json
{"tool":"kifer_create_contract","arguments":{"client_request_id":"contrato-2026-001","contract":{"codigo_contrato":"KFS-001","status":"Ativo","modalidade":"Individual","operadora":"Operadora ativa","produto_plano":"Plano ativo","responsavel":"Equipe comercial"}}}
{"tool":"kifer_set_contact_permission","arguments":{"client_request_id":"optout-001","channel":"whatsapp","endpoint":"5511999999999","purpose_scope":"commercial","state":"blocked"}}
{"tool":"kifer_archive_whatsapp_chat","arguments":{"chat_id":"00000000-0000-4000-8000-000000000001","expected_updated_at":"2026-09-15T12:00:00Z","client_request_id":"archive-chat-001"}}
```

O envio e o agendamento de WhatsApp exigem `client_request_id`, para que uma nova tentativa da mesma solicitação retorne o resultado anterior em vez de disparar ou programar uma segunda mensagem.

Contratos, titulares e dependentes são operados por RPCs MCP com validação, auditoria e transações apropriadas. O bucket contratual é privado e separado da mídia do Inbox; registros legados em `documents` mantêm suas referências e URLs originais. A Inbox usa RPCs que revalidam o administrador e o lock canônico. A permissão de contato é verificada centralmente em campanhas, automações, mensagens manuais, retentativas e respostas autônomas; cada tentativa comercial revalida o estado antes do POST externo. Mensagens manuais e campanhas usam o escopo `commercial`; respostas autônomas usam `service_reply`.

### Import privado de titular

Um backend interno/admin autorizado chama `create_contract_holder_import` com `p_actor_user_id`, `p_client_request_id`, `p_holder_payload` e, opcionalmente, `p_lead_id`, `p_contract_id`, `p_source` e `p_ttl_hours`. A função verifica o perfil admin, valida os campos e retorna somente `success`, `import_id`, `expires_at` e `replayed`; o TTL padrão é 24 horas e o limite é 7 dias. A RPC é restrita a `service_role`, não é uma ferramenta MCP e não é acessível pelo navegador. O MCP recebe somente identificadores opacos em `kifer_create_contract_holder_from_import`; o consumo valida vínculo/expiração, grava o titular e apaga os campos PII do staging na mesma transação. Um tombstone sem PII é mantido por até sete dias para distinguir imports expirados/consumidos. A migration tenta habilitar `pg_cron` e agenda a limpeza por hora quando a extensão está disponível; confirme o job no ambiente após aplicar a migration. O staging não integra `kifer_list_resources` nem a allowlist de leitura.

O cadastro manual continua independente: `HolderForm`/`DependentForm` seguem gravando pelas ações/repositórios atuais e não dependem de `import_id`. Não há migração do formulário manual para staging. A criação MCP direta, o bundle e o consumo do import usam os helpers de validação/inserção existentes no servidor. `kifer_create_dependent_from_import` consome um import criado por backend autorizado, exige o contrato e titular de destino, verifica os vínculos staged quando presentes, usa `client_request_id` idempotente, apaga a PII staged na mesma transação e devolve somente IDs. A criação de staging continua restrita a `service_role` e não é uma ferramenta MCP.

O consumer bloqueia o contrato durante a checagem e a criação, mas `contract_holders.contract_id` não tem constraint `UNIQUE` no schema legado. Uma gravação manual direta concorrente ainda pode criar duplicata; não foi adicionada uma constraint/trigger para evitar alterar o comportamento do fluxo manual.

Exemplo da chamada MCP sem dados pessoais e resposta esperada:

```json
{
  "tool": "kifer_create_contract_holder_from_import",
  "arguments": {
    "contract_id": "00000000-0000-4000-8000-000000000001",
    "import_id": "00000000-0000-4000-8000-000000000002",
    "client_request_id": "holder-import-2026-001"
  }
}
```

```json
{
  "success": true,
  "replayed": false,
  "contract_id": "00000000-0000-4000-8000-000000000001",
  "holder_id": "00000000-0000-4000-8000-000000000003",
  "import_id": "00000000-0000-4000-8000-000000000002"
}
```

O schema de oportunidades registra grupos comerciais e preserva histórico de vínculo, mas não substitui o cadastro do lead. Merge de leads permanece indisponível: relações em várias tabelas, referências de auditoria/IA sem FK, colisões de unicidade e caminhos de Storage atrelados ao UUID impedem uma transferência segura sem estratégia de linhagem. Merge genérico de chats também não é exposto. A resolução manual cobre apenas candidatos sustentados pelos dados persistidos; evidência externa exige validação pelo servidor/provider. Comissão pode ser ajustada nos campos modelados e receber acréscimos/descontos, mas pagamentos, bônus pagos e estornos não são implementados porque não há ledger financeiro que os represente. Tags e motivos estruturados de perda também não existem no modelo atual.

`config_options` foi removida da allowlist de leitura: o recurso constava no MCP, mas não aparece no schema tipado vigente. O CRM usa hoje tabelas dedicadas e `system_configurations`; as migrations de `config_options` são históricas. Assim, o MCP deixa de anunciar uma consulta que falha no schema atual.

### Paginação de fluxos e respostas grandes

`kifer_list_followup_flows` aceita `page` (1–10000), `page_size` (1–50, padrão 1) e `include_steps` (padrão true). A resposta mantém `flows` e acrescenta `page`, `page_size`, `total` e `has_more`. Percorra as páginas até `has_more=false`. Para listar resumos sem textos extensos, use `include_steps=false`: cada fluxo retorna `steps=[]`, `steps_count` e `steps_included=false`. Consulte `kifer_get_followup_flow` para obter suas etapas.

Respostas acima de 40 mil caracteres são primeiro compactadas sem perda de conteúdo. Se ainda excederem o limite, o MCP retorna um envelope JSON válido com `response_truncated`, `RESPONSE_TOO_LARGE` e `action_success` quando disponível. Esse erro é de apresentação: uma escrita pode já ter sido concluída. Não repita a ação com uma nova chave; consulte o registro ou recupere o resultado com a mesma chave idempotente. Para leituras, diminua a página ou restrinja os filtros.

## Cobertura funcional

O catálogo `kifer://capabilities/catalog` é gerado do registry publicado no endpoint e acompanha as ferramentas ativas. O MCP cobre ações de negócio tipadas, não CRUD irrestrito de tabelas.

| Área do CRM | Cobertura MCP |
| --- | --- |
| Leads e oportunidades | Consulta detalhada, criação, edição, status, favoritos, arquivamento, atribuição, operações em lote, follow-ups e resolução de conflitos suportados pelos dados existentes. |
| Contratos e pessoas vinculadas | Criação/edição de contratos, titulares, dependentes, bundles, import staged, documentos e ajustes de valor; exclusões obedecem aos vínculos e à limpeza de arquivos. |
| Inbox, WhatsApp e automações | Estados de conversa, associação a lead, exclusão lógica, estado de atendimento autônomo, edição/exclusão/reação/estrela/encaminhamento de mensagem, transcrição e retry de mídia, contatos salvos, respostas rápidas, assistentes de IA, mensagens agendadas, campanhas, consentimento, lembretes, jobs e fluxos de follow-up. Envios ou efeitos externos exigem confirmação e validações de consentimento. |
| Integração WhatsApp | `kifer_get_whatsapp_integration_status`, `kifer_set_whatsapp_integration_enabled` e `kifer_refresh_whatsapp_connection_health`. O MCP pode consultar a saúde, ativar/desativar o canal e atualizar o diagnóstico; tokens e URL secreta de webhook não são retornados. Ativação exige controle de versão e confirmação. |
| Conteúdo público | Formulários e etapas, submissões com projeção controlada, página de links, itens e artigos do blog; escritas editoriais são auditadas e o HTML é sanitizado. |
| Dashboard e financeiro | Relatório individual/equipe, ativação da medição, calendário/listagem de comissão e bonificação projetadas. O CRM não tem ledger de pagamentos para registrar baixa ou estorno. |
| Preferências e catálogos comerciais | Preferências gerais seguras e catálogos allowlisted de leads/contratos/operadoras/planos, com schemas por categoria e controle de concorrência. |
| Configuração de IA | Histórico e ativação de versões, prompts globais e por funcionalidade, catálogo de modelos, rotas OpenAI permitidas, ativação do provider e import/export v3. Mudanças de prompt/rota são validadas e auditadas. |
| Usuários e acessos | `kifer_list_users`, `kifer_invite_user`, `kifer_update_user`, `kifer_delete_user`, `kifer_send_user_password_reset`, `kifer_list_access_profiles`, `kifer_create_access_profile`, `kifer_update_access_profile`, `kifer_delete_access_profile` e `kifer_set_access_profile_permission`. Atribuir administrador, convidar, redefinir senha e excluir exige confirmação explícita; senhas em texto nunca entram no MCP. |
| Bancada de IA | Listar, consultar, criar, renomear e excluir simulações; gerar resposta, abordagem inicial e cenário automatizado. Geração usa modelos configurados e pode gerar custo; exige confirmação e grava apenas na bancada, sem enviar WhatsApp. |
| Recursos da Inbox | Contatos salvos no provider, respostas rápidas do composer e ferramentas de assistência de IA estão cobertos por operações específicas. O MCP não oferece sincronização irrestrita do catálogo de contatos nem acesso a dados brutos de provider. |
| Rastreamento público | O MCP cobre a leitura/edição dos IDs guardados pelo painel com confirmação e concorrência otimista. Este repositório não consome os registros para carregar scripts na página; isso permanece uma integração pendente do próprio site. Snippets livres não são aceitos. |
| Credenciais e segurança de infraestrutura | Senhas em texto, tokens/chaves de integração, configuração de autenticação, sessões, payloads brutos de webhook, SQL/RPC genérico e Storage irrestrito ficam fora do MCP. Segredos não são trafegados por prompts ou respostas. |
| Conteúdo de páginas de operadoras | A página pública de operadoras é montada pelo código do frontend e não tem editor CRUD no CRM. Para alterá-la é necessário mudar e publicar o código do site. |

As consultas operacionais exigem OAuth de administrador e `kifer.read`; as ações de escrita exigem também `kifer.write`. O catálogo completo permanece visível com seus requisitos, e tokens somente de leitura recebem um desafio de autorização ao tentar escrever. `kifer_get_connection_access` informa os escopos efetivos e se a conexão pode escrever. A conexão legada continua somente leitura para ferramentas específicas. A auditoria MCP registra mutações em `mcp_action_audit_log`, decisões de consentimento em eventos append-only e acesso a documentos na auditoria específica de documentos. Auditorias de conteúdo/prompts, usuários e simulações registram IDs, chaves, campos alterados ou comprimentos, sem copiar PII, senhas ou texto integral.

### Agenda e reagendamento em lote

`kifer_create_reminder` também cria tarefas avulsas com `tipo: "Tarefa"` ou `"Outro"` sem `lead_id`. Follow-ups comerciais continuam vinculados a um lead. Para reagendar vários itens, consulte `kifer_list_reminders` ou `kifer_get_reminder` e envie a `ultima_modificacao` de cada registro como `expected_ultima_modificacao`. As datas exigem fuso explícito; por exemplo, 09h em São Paulo pode ser enviado como `2030-10-22T09:00:00-03:00`. Cada item aceita sua própria data, permitindo intervalos de três minutos ou outra distribuição solicitada. `dry_run: true` valida versões e mostra o plano sem gravar. Lotes maiores podem ser divididos em chamadas de até 100 itens. As ações operam as mesmas linhas da Agenda, preservam a atribuição de produção e sincronizam `leads.proximo_retorno` na mesma transação. A migration necessária é `20261022041916_mcp_agenda_reminder_actions.sql`.

### Conexões antigas que perderam ações

A versão 1.2.0 passou a exigir `kifer.write`, mas ocultava escritas de `tools/list` quando o token antigo tinha somente `kifer.read`. Isso impedia o cliente de descobrir a ação e solicitar o novo escopo. A versão 1.3.0 publica o catálogo completo, solicita leitura/escrita por padrão no desafio inicial e devolve o desafio OAuth também no erro de uma ferramenta. Os tokens antigos não são promovidos silenciosamente. Depois do deploy, atualize as ferramentas na configuração do plugin existente e conclua a autorização **Autorizar leitura e escrita** quando solicitada. Se os escopos estiverem configurados manualmente no cliente, inclua `kifer.read kifer.write`. Confirme com `kifer_get_connection_access`: `can_write` deve ser `true` antes de executar mutações.

## Migration adicional

As migrations MCP incluem a base de contratos/oportunidades/consentimento/documentos/Inbox/conflitos (`20261008010000` a `20261008090000`), o staging privado de titulares/dependentes (`20261008090100`), consumo privado de dependentes (`20261021220404`), ativação da medição de produção (`20261021223000`), escrita transacional de configuração de IA (`20261021224000`), ativação transacional do canal WhatsApp (`20261021225000`) e conclusão de exclusão lógica/atendimento autônomo no Inbox (`20261021230000`). A migration de pacing (`20261021221500`) configura os intervalos das campanhas, e `20261021230953` restaura o bucket público dedicado de mídia usado pelos disparos. Antes de publicar, confira `supabase migration list --linked` e `supabase db push --dry-run --linked`; não altere migrations já aplicadas e use uma nova migration para qualquer ajuste posterior.

## Publicação e reativação

1. Aplique as migrations, publique a function e a página `public/mcp-oauth-authorize.html` junto com o site. A página de autorização é pública, mas só emite um código OAuth depois de validar a sessão de um administrador.
2. Configure os secrets abaixo no Supabase. A URL de retorno deve ser copiada exatamente do modal do ChatGPT.

   ```bash
   supabase secrets set \
     KIFER_MCP_OAUTH_CLIENT_ID="chatgpt-kifer" \
     KIFER_MCP_OAUTH_REDIRECT_URI="<url-de-retorno-exibida-pelo-chatgpt>" \
     KIFER_MCP_OAUTH_UI_URL="https://www.kifersaude.com.br/mcp-oauth-authorize.html"
   ```

3. Publique as Edge Functions alteradas usando o script do repositório, que lê a configuração de `verify_jwt` em `supabase/config.toml`:

   ```bash
   # Windows
   deploy-functions.bat --no-pause

   # WSL/Linux
   bash scripts/deploy-supabase-functions.sh
   ```

   Defina `KIFER_MCP_WHATSAPP_INTERNAL_SECRET` como secret em `chatgpt-mcp` e `comm-whatsapp-send`. É uma credencial servidor-a-servidor: nunca use o prefixo `VITE_`, nunca a exponha no navegador e nunca a inclua no ChatGPT.

4. Verifique os metadados OAuth e o desafio MCP. Uma chamada não autenticada ao MCP deve retornar `401` com `resource_metadata`; o ChatGPT então inicia o OAuth automaticamente.

## Configuracao no ChatGPT

O endpoint oferece OAuth com login do próprio CRM. Somente usuários com o perfil `admin` conseguem autorizar o ChatGPT; a senha é validada pelo Supabase Auth e nunca é enviada ao ChatGPT.

```text
https://eaxvvhamkmovkoqssahj.supabase.co/functions/v1/chatgpt-mcp
```

Preencha o modal do ChatGPT assim:

| Campo | Valor |
| --- | --- |
| Nome | `CRM Kifer Saude` |
| Descricao | `Consultas e ações comerciais controladas no CRM Kifer Saude.` |
| Conexao | `URL do servidor` |
| URL | `https://eaxvvhamkmovkoqssahj.supabase.co/functions/v1/chatgpt-mcp` |
| Autenticacao | `OAuth` |
| Registro de cliente | `Cliente OAuth definido pelo usuario` |
| ID do cliente OAuth | `chatgpt-kifer` |
| Segredo do cliente OAuth | deixe em branco |
| Autenticacao do endpoint de token | `Nenhuma` / `none` |
| Escopos | `openid offline_access kifer.read kifer.write` |

Em **Configuracoes avancadas de OAuth**, mantenha a URL de retorno exibida pelo ChatGPT. O servidor ja aceita essa URL e anuncia automaticamente os endpoints OAuth. Se a tela pedir os enderecos manualmente, use:

```text
Autorizacao: https://eaxvvhamkmovkoqssahj.supabase.co/functions/v1/chatgpt-mcp/oauth/authorize
Token: https://eaxvvhamkmovkoqssahj.supabase.co/functions/v1/chatgpt-mcp/oauth/token
```

Depois clique em **Verificar ferramentas**. A página `www.kifersaude.com.br/mcp-oauth-authorize.html` pedirá o e-mail e a senha da conta administradora e exibirá os escopos solicitados. Clique em **Autorizar leitura e escrita** para habilitar ações, ou conecte somente `kifer.read` quando quiser uma sessão apenas de consulta. Tokens antigos de leitura podem descobrir todas as ferramentas, mas precisam da nova autorização para executar escritas. Confirme `can_write: true` em `kifer_get_connection_access` antes de tentar alterar registros.

> A URL de retorno fica vinculada a este plugin do ChatGPT. Nao descarte este rascunho nem crie outro plugin antes de finalizar. Se for necessario recria-lo, atualize tambem o secret `KIFER_MCP_OAUTH_REDIRECT_URI` com a nova URL mostrada pelo ChatGPT e publique a function novamente.

5. Comece por perguntas como:

   - "Mostre o resumo operacional do Kifer."
   - "Busque o lead Maria Silva e resuma o contexto."
   - "Quais automacoes tiveram execucao diferente de ok?"
   - "Traga a conversa de WhatsApp deste lead."

## Revogacao

Para interromper novas conexões, remova `KIFER_MCP_OAUTH_REDIRECT_URI` e publique a function novamente. Para revogar conexões existentes, revogue os tokens OAuth no banco ou retire o perfil `admin` da conta autorizadora; o servidor revalida essa permissão a cada chamada.
