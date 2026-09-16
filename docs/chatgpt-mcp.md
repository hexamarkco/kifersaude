# Kifer Saude no ChatGPT

O endpoint `chatgpt-mcp` permite consultar dados atuais do CRM e executar ações comerciais explicitamente autorizadas. Ele não oferece SQL, RPC, atualização genérica de tabelas nem exclusões.

## Limites de segurança

- O acesso do ChatGPT exige OAuth com PKCE S256 e uma conta com perfil `admin` no CRM.
- Tokens de autorização, acesso e renovação são armazenados somente como hashes, têm validade limitada e são invalidados quando a conta deixa de ser administradora.
- As ferramentas de leitura continuam anotadas como `readOnlyHint`. As ações de escrita são schemas fechados, com validação de entidades, auditoria e OAuth de administrador.
- Consultas genéricas de registro exigem OAuth de administrador e aceitam somente catálogos sem dados de clientes. Leads, contratos, titulares, dependentes, documentos, conversas, mensagens e conflitos não podem ser consultados por `select *` genérico.
- Consultas de leads, conversas, mensagens, lembretes, automações e conflitos com contexto operacional também exigem OAuth de administrador. A conexão legada permanece leitura apenas em ferramentas específicas de baixo risco.
- Segredos, configuracoes de integracao, sessao/autenticacao e arquivos brutos de webhook nao sao expostos.
- Cada consulta é registrada em `chatgpt_mcp_audit_log`; cada ação comercial é registrada em `mcp_action_audit_log`, com payload sanitizado e resultado.
- Exceções inesperadas retornam uma mensagem genérica; detalhes internos não são enviados na resposta nem gravados no resultado da auditoria.
- O payload de auditoria também mascara chaves comuns de dados pessoais (CPF/CNPJ, documentos, contatos e endereço), além de credenciais e conteúdo base64.

As ações de escrita exigem OAuth de administrador. O token legado do MCP permanece compatível apenas com as ferramentas de leitura.

## Ferramentas de ação

| Tool | Schema fechado | Efeito |
| --- | --- | --- |
| `kifer_send_whatsapp_message` | `chat_id`, `message`, `client_request_id` | Envia texto pela integração atual; em resultado `ambiguous`, consulte a conversa antes de tentar novamente com outra chave. |
| `kifer_send_whatsapp_media` | `chat_id`, MIME/nome/base64 e `client_request_id` | Envia mídia imediata de até 20 MiB pelo endpoint interno existente; valida MIME, evita URL externa e não persiste base64 na auditoria. Provider aceita PDF/documento, imagem, áudio/voz e vídeo. Em resultado `ambiguous`, consulte a conversa antes de tentar novamente com outra chave. |
| `kifer_schedule_whatsapp_message` | `chat_id`, `message`, `scheduled_at`, `client_request_id` | Programa uma única mensagem de texto para uma conversa existente. Usa a fila nativa do Inbox; não aceita telefone, mídia ou recorrência. |
| `kifer_create_reminder` | `lead_id`, `contract_id?`, `tipo`, `titulo`, `descricao?`, `data_lembrete`, `prioridade` | Cria lembrete e sincroniza `leads.proximo_retorno` a partir do próximo lembrete aberto. |
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
| `kifer_get_next_follow_up` | `lead_id` | Retorna o próximo lembrete pendente de retorno/follow-up. |
| `kifer_bulk_cancel_automation_jobs` | filtros fechados de fila | Cancela logicamente no máximo 100 jobs pendentes, preservando histórico e retornando itens ignorados/erros. |
| `kifer_create_followup_flow` | gatilho e janela comercial fechados | Cria um fluxo vazio; não aceita URLs, webhooks ou configurações técnicas. |
| `kifer_create_followup_step` | ação comercial permitida e configuração fechada | Adiciona somente texto, alteração de status, criação de tarefa ou ativação de atendimento autônomo. |
| `kifer_update_followup_step_message` | `flow_id`, `step_id`, `message` | Troca exclusivamente o texto de uma etapa `send_message`. |
| `kifer_delete_followup_step` / `kifer_reorder_followup_steps` | `flow_id` e etapa / lista completa de IDs | Remove ou reordena etapas somente quando não há jobs pendentes ou em processamento no fluxo. |
| `kifer_clone_followup_flow` | fluxo de origem e sobrescritas fechadas | Copia fluxo e etapas com novos IDs; bloqueia etapas destrutivas, webhook e e-mail. |

### Módulos administrativos da expansão

Todas as ferramentas abaixo exigem OAuth de administrador ativo. As ferramentas de escrita usam parâmetros tipados e allowlists; operações com risco de repetição ou concorrência usam `client_request_id` e/ou `expected_updated_at`. Os schemas publicados pelo MCP são a referência exata para cada campo.

| Domínio | Ferramentas | Leitura/escrita | Contrato, efeitos e limites |
| --- | --- | --- | --- |
| Oportunidades | `kifer_create_opportunity`, `kifer_get_opportunity`, `kifer_get_opportunity_360`, `kifer_update_opportunity`, `kifer_archive_opportunity`, `kifer_add_lead_to_opportunity`, `kifer_remove_lead_from_opportunity`, `kifer_set_opportunity_primary_contact` | 2 leitura, 6 escrita | Criação aceita até 50 leads únicos e `client_request_id`; edição, arquivamento e vínculos exigem `expected_updated_at`. Remoção preserva histórico e o contato principal precisa ser trocado antes de removê-lo. |
| Contratos, titulares e dependentes | `kifer_create_contract`, `kifer_update_contract`, `kifer_update_contract_commission`, `kifer_create_contract_holder`, `kifer_create_contract_holder_from_import`, `kifer_update_contract_holder`, `kifer_remove_contract_holder`, `kifer_create_dependent`, `kifer_update_dependent`, `kifer_remove_dependent`, `kifer_create_contract_bundle`, `kifer_create_contract_value_adjustment`, `kifer_list_contract_value_adjustments` | 1 leitura, 12 escrita | Schemas fechados preservam validações e catálogos do CRM; criação usa idempotência, atualização usa concorrência otimista e o bundle grava contrato/grafo relacionado atomicamente. O fluxo via import resolve PII apenas em staging privado, consome o import atomicamente e responde somente com IDs. Remoções bloqueiam dependentes e documentos legados/privados ainda ativos ou não limpos. Ajustes registram acréscimo/desconto no modelo existente; não representam pagamentos nem estornos. |
| Documentos | `kifer_list_documents`, `kifer_get_document`, `kifer_upload_document`, `kifer_update_document_metadata`, `kifer_delete_document` | 2 leitura, 3 escrita | Upload privado limitado a 20 MiB e MIME allowlist; acesso administrativo, URL assinada de curta duração e trilha de listagem/acesso sem gravar URL, token, hash ou conteúdo no audit log. A infraestrutura nova não migra URLs de documentos legados. |
| Consentimento | `kifer_get_contact_permission`, `kifer_set_contact_permission`, `kifer_bulk_set_contact_permission` | 1 leitura, 2 escrita | Estados `allowed`, `blocked` ou `unknown` por canal, endpoint e escopo (`global`, `commercial`, `service_reply`, `transactional`). Bulk é atômico e limitado a 50 entradas; decisões ficam em eventos append-only. |
| Inbox | `kifer_archive_whatsapp_chat`, `kifer_unarchive_whatsapp_chat`, `kifer_pin_whatsapp_chat`, `kifer_unpin_whatsapp_chat`, `kifer_mute_whatsapp_chat`, `kifer_unmute_whatsapp_chat`, `kifer_mark_whatsapp_chat_read`, `kifer_mark_whatsapp_chat_unread`, `kifer_link_chat_to_lead`, `kifer_unlink_chat_from_lead` | 10 escrita | Cada operação usa RPC MCP com admin revalidado, lock canônico, auditoria, `expected_updated_at` e idempotência. Link não mescla chats; conflito aberto exige resolução restrita por evidência persistida. |
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

O cadastro manual continua independente: `HolderForm`/`DependentForm` seguem gravando pelas ações/repositórios atuais e não dependem de `import_id`. Não há migração do formulário manual para staging. A criação MCP direta, o bundle e o consumo do import usam os helpers de validação/inserção de titular existentes no servidor (`_mcp_validate_holder_payload` e `_mcp_insert_holder`); as gravações da interface continuam no caminho direto atual, sem mudança de comportamento. O staging privado de dependentes prepara a mesma fronteira para uma futura action `kifer_create_dependent_from_import`, ainda não publicada.

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

## Inventário

O registry atual publica 107 ferramentas únicas: 29 de leitura e 78 de escrita. A classificação funcional exclusiva é 23 de comunicação, 21 de automação, 6 de analytics e 57 de administração/CRM geral; esses grupos funcionais são um eixo diferente da contagem leitura/escrita. O inventário histórico tinha 45 ferramentas no commit `6ace016030`. As ações de escrita e consultas operacionais/genéricas exigem OAuth de administrador; a conexão legada continua somente leitura para ferramentas específicas. A auditoria MCP registra mutações em `mcp_action_audit_log`, decisões de consentimento em eventos append-only e acesso a documentos na auditoria específica de documentos.

## Migration adicional

As migrations MCP atuais seguem as migrations anteriores do repositório e incluem a base de contratos/oportunidades/consentimento/documentos/Inbox/conflitos (`20261008010000` a `20261008090000`) e o staging privado de titulares/dependentes (`20261008090100`). Elas devem ser aplicadas em ordem antes de publicar a versão correspondente da Edge Function; migrations históricas permanecem imutáveis.

## Publicação e reativação

1. Aplique as migrations, publique a function e a página `public/mcp-oauth-authorize.html` junto com o site. A página de autorização é pública, mas só emite um código OAuth depois de validar a sessão de um administrador.
2. Configure os secrets abaixo no Supabase. A URL de retorno deve ser copiada exatamente do modal do ChatGPT.

   ```bash
   supabase secrets set \
     KIFER_MCP_OAUTH_CLIENT_ID="chatgpt-kifer" \
     KIFER_MCP_OAUTH_REDIRECT_URI="<url-de-retorno-exibida-pelo-chatgpt>" \
     KIFER_MCP_OAUTH_UI_URL="https://www.kifersaude.com.br/mcp-oauth-authorize.html"
   ```

3. Publique a function:

   ```bash
   supabase functions deploy chatgpt-mcp --no-verify-jwt
   supabase functions deploy comm-whatsapp-send
   ```

   Defina também `KIFER_MCP_WHATSAPP_INTERNAL_SECRET` como secret nas duas functions. É uma credencial servidor-a-servidor: nunca use o prefixo `VITE_`, nunca a exponha no navegador e nunca a inclua no ChatGPT.

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
| Escopos | `openid offline_access kifer.read` |

Em **Configuracoes avancadas de OAuth**, mantenha a URL de retorno exibida pelo ChatGPT. O servidor ja aceita essa URL e anuncia automaticamente os endpoints OAuth. Se a tela pedir os enderecos manualmente, use:

```text
Autorizacao: https://eaxvvhamkmovkoqssahj.supabase.co/functions/v1/chatgpt-mcp/oauth/authorize
Token: https://eaxvvhamkmovkoqssahj.supabase.co/functions/v1/chatgpt-mcp/oauth/token
```

Depois clique em **Verificar ferramentas**. A página `www.kifersaude.com.br/mcp-oauth-authorize.html` pedirá o e-mail e a senha da conta administradora. Clique em **Autorizar consultas** e aguarde o retorno automático ao ChatGPT. Então teste somente uma consulta de leitura e publique o plugin apenas para o grupo autorizado.

> A URL de retorno fica vinculada a este plugin do ChatGPT. Nao descarte este rascunho nem crie outro plugin antes de finalizar. Se for necessario recria-lo, atualize tambem o secret `KIFER_MCP_OAUTH_REDIRECT_URI` com a nova URL mostrada pelo ChatGPT e publique a function novamente.

5. Comece por perguntas como:

   - "Mostre o resumo operacional do Kifer."
   - "Busque o lead Maria Silva e resuma o contexto."
   - "Quais automacoes tiveram execucao diferente de ok?"
   - "Traga a conversa de WhatsApp deste lead."

## Revogacao

Para interromper novas conexões, remova `KIFER_MCP_OAUTH_REDIRECT_URI` e publique a function novamente. Para revogar conexões existentes, revogue os tokens OAuth no banco ou retire o perfil `admin` da conta autorizadora; o servidor revalida essa permissão a cada chamada.
