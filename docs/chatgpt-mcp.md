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

O envio e o agendamento de WhatsApp exigem `client_request_id`, para que uma nova tentativa da mesma solicitação retorne o resultado anterior em vez de disparar ou programar uma segunda mensagem.

Criação/edição completa de contratos e operações de titulares/dependentes permanecem adiadas: a UI concentra validações que não existem no banco e a gravação do grafo não é transacional. Só status/cancelamento de contrato foram expostos com validação de status ativo e controle de concorrência. Documentos não têm bucket privado nem ciclo de storage concluído; o bucket de mídia agendada não será reutilizado para arquivos contratuais. Os RPCs atuais de estado e vínculo do Inbox exigem `auth.uid()` e permissão de edição; o token OAuth próprio do MCP não fornece uma sessão Supabase, portanto essas ações aguardam RPCs específicos que revalidem o administrador e preservem o lock canônico. Conflitos podem ser consultados por metadados mínimos, mas não resolvidos manualmente: reconciliação de identidade reversa exige evidência verificada do provider e pode mesclar chats. A tabela de opt-out só bloqueia campanhas hoje; não é uma fonte global de consentimento para envios manuais ou automações. Também não há entidade de oportunidade/núcleo familiar no schema atual.

O MCP oferece upload privado para mídia agendada e envio imediato de mídia pelo endpoint Whapi já existente. Tags e motivos estruturados de perda não foram expostos porque o modelo atual não possui essa estrutura.

`config_options` foi removida da allowlist de leitura: o recurso constava no MCP, mas não aparece no schema tipado vigente. O CRM usa hoje tabelas dedicadas e `system_configurations`; as migrations de `config_options` são históricas. Assim, o MCP deixa de anunciar uma consulta que falha no schema atual.

## Inventário

O servidor publica 65 ferramentas: 22 de leitura/consulta e 43 de escrita. Antes da continuação atual, o working tree já tinha 55 (48 no `HEAD` mais 7 da fase anterior); esta fase acrescentou 10. O inventário histórico tinha 45 no commit `6ace016030`. As ações de escrita e consultas operacionais/genéricas exigem OAuth de administrador; a conexão legada continua somente leitura para ferramentas específicas. A auditoria MCP registra cada mutação em `mcp_action_audit_log`.

## Migration adicional

Além da migration de auditoria MCP, aplique `20260912233141_add_mcp_reminder_cancellation.sql` e `20260913015722_add_mcp_scheduled_message_idempotency.sql`. A segunda acrescenta uma chave de idempotência apenas às mensagens programadas pelo MCP, sem alterar os agendamentos já existentes do Inbox.

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
