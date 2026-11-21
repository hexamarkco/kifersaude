# Auditoria de paridade do ChatGPT MCP — 21/11/2026

## Escopo e fonte
- Fonte da verdade: `hexamarkco/kifersaude` (main) + Edge Functions implantadas no Supabase.
- Antes da intervenção, os **37 arquivos** do deployment `chatgpt-mcp` v144 foram comparados com o repositório e estavam idênticos. Paridade de código não implica paridade funcional.
- Disparos na UI: `WhatsAppCampaignsScreen.tsx`, `commWhatsAppCampaignService.ts`.
- Execução: `comm-whatsapp-campaign-worker/index.ts` versão 188.
- Exposição MCP: `chatgpt-mcp/whatsapp-campaign-actions.ts`; mutações por RPC `mcp_comm_whatsapp_campaign_mutation`.

## Falhas confirmadas e correções
1. **Só A e B:** o MCP tinha enum `ANY|A|B`, embora o banco e a UI aceitem `ANY|A..Z`. Corrigido para A–Z e validação no helper SQL.
2. **Variações com listas independentes:** nova entrada `stages[].variations` aceita cada copy com quantidade própria de balões, delays por etapa, mídia de bucket validada, e `split_by_line_breaks` opcional. Limites: 30 posições de step, 240 linhas físicas, 26 copies (A–Z). Não é permitido combinar `stages` e `steps`.
3. **Mensagens obsoletas depois da edição:** na configuração nova (`audience_config.variant_sequences_v2=true`), o helper SQL substitui atomicamente os steps apenas quando a campanha não teve processamento; um erro faz rollback de tudo. O fluxo legado mantém a edição parcial.
4. **Alternância:** o modo novo é `balanced`, com `ab_test_enabled=true`; o worker preserva a copy atribuída, sem herdar balões extras da copy A.
5. **Prévia misturava versões:** `kifer_preview_whatsapp_campaign` aceita `variant` e agora devolve `available_variants`, `selected_variant` e `copy_sequences`. `kifer_get_whatsapp_campaign` também devolve as sequências resolvidas por copy.
6. **Atualização apagava configurações:** edição de apenas cadência ou sequências agora mescla `audience_config` com os valores persistidos, preservando critérios e configurações preexistentes.
7. **Leituras operacionais ausentes:** novas ações `kifer_list_whatsapp_campaign_events`, `kifer_get_whatsapp_campaign_worker_health`, `kifer_list_whatsapp_campaign_templates` e `kifer_get_whatsapp_campaign_template`; com paginação, campos controlados e sem payload bruto de eventos.

## Exemplo mínimo — MCP (sem disparar)
```json
{
  "name": "Campanha consultiva de teste",
  "client_request_id": "campanha-consultiva-20261121",
  "stages": [
    {
      "variations": {
        "A": ["Oi {{primeiro_nome}}! Tudo bem?", "Sou a Luíza Kifer, especialista em planos de saúde.", "Posso apresentar uma alternativa?"],
        "B": ["Oi {{primeiro_nome}}! Aqui é a Luíza Kifer.", "Posso enviar uma comparação?"],
        "C": ["Olá! Sou a Luíza Kifer. Posso te apresentar outra opção?"]
      }
    },
    {
      "delay_amount": 3,
      "delay_unit": "days",
      "variations": {
        "A": ["Passando para saber se conseguiu avaliar."],
        "B": ["Posso esclarecer alguma dúvida?"],
        "C": ["Ainda faz sentido comparar os planos?"]
      }
    }
  ]
}
```
A criação continua em **rascunho**. Importação de contatos e ativação são ações explícitas, separadas e auditadas. O worker respeita opt-out e stop_on_reply.

## Cobertura atual e oportunidades adicionais

| Domínio | Cobertura MCP existente | Lacuna identificada | Prioridade |
|---|---|---|---|
| Disparos — copies e etapas | Criar, editar, consultar, prévia, importar, ativar/pausar/agendar | Novo modelo de listas independentes foi corrigido nesta entrega | Concluído |
| Disparos — diagnósticos | Métricas resumidas | Worker health e eventos sem payload bruto | Concluído (leituras) |
| Disparos — modelos | Editor salva e remove modelos no Supabase | Leitura MCP adicionada; **criar/editar/remover modelos via MCP não existe**, precisa de mutações auditadas e proteção de autoria | Alta |
| Disparos — teste de envio | UI tem "Enviar teste" | MCP não oferece teste de envio; requer ferramenta de escrita com autorização explícita, controle de destino e idempotência | Média |
| Disparos — histórico de execuções por alvo | Listagem de contatos/status | Cronologia de mensagens/etapas por destinatário de modo anonimizado ainda pode ser melhorada | Média |
| Fluxos de follow-up | Leitura e edição de fluxos existentes | Revisar paridade detalhada das listas `messageVariations` e ações de template/IA com o novo editor de Fluxos | Alta |
| Inbox | Ler conversas/mensagens, enviar, agendar, permissões, contatos etc. | Revisar paridade de gestão de chats, merge e operações administrativas novas; evitar expor ferramentas genéricas sem lock | Média |
| Gestão do CRM | Leads, oportunidades, contratos, titulares, documentos, administração, configurações e analytics | Uma auditoria por tela/ação e matriz de permissões é necessária antes de afirmar **cobertura funcional completa** | Média |

## Validações e limitações
- Testes unitários adicionados para 3 copies com comprimentos diferentes, separação por quebras de linha, delays e ausência de herança acidental.
- Migração SQL versionada e aplicada. **Nenhum contato/campanha foi criado, ativado ou disparado para testar**.
- Revisar status das verificações automáticas após push; deploy da Edge Function MCP deve ser conferido separadamente, pois Vercel atualiza apenas o frontend.

## Complemento implementado em 21/11/2026

Os itens identificados como parciais/indisponíveis no módulo Disparos e Fluxos passaram a ter ferramentas MCP especializadas.

### Novas ações

| Área | Leituras | Escritas |
|---|---|---|
| Modelos de Disparos | `kifer_list_whatsapp_campaign_templates`, `kifer_get_whatsapp_campaign_template` (anteriores) | `kifer_create_whatsapp_campaign_template`, `kifer_update_whatsapp_campaign_template`, `kifer_archive_whatsapp_campaign_template` |
| Testes de Disparos | `kifer_get_whatsapp_campaign_test_status` | `kifer_send_whatsapp_campaign_test` com `confirm_send=true` e chave idempotente |
| Mensagens de campanhas | `kifer_get_whatsapp_campaign_contact_history` (balões, etapa, status, eventos sanitizados) | Nenhuma ação de envio em lote adicionada |
| Modelos de Fluxos | `kifer_list_followup_message_templates`, `kifer_get_followup_message_template` | `kifer_create_followup_message_template`, `kifer_update_followup_message_template` (texto, CAS) |
| Variações de Fluxos | `kifer_get_followup_flow` retorna `message_variations` e `settings_updated_at` | `kifer_update_followup_step_variations` e `message_variations` na criação de etapas |
| Inbox/identidades | `kifer_find_duplicate_whatsapp_chats` | `kifer_reconcile_verified_whatsapp_lid` somente com prova bidirecional verificada |

### Proteções importantes

- As campanhas, os leads, os disparos e os fluxos existentes não foram usados como massa de teste. Nenhuma mensagem real foi disparada.
- Novos modelos de Disparos são arquivados logicamente; o editor foi ajustado para ocultar arquivados e preservar os registros.
- A chave de teste fica registrada em `mcp_whatsapp_campaign_test_requests` com hashes do telefone e payload; uma chamada repetida não reenvia. O envio exige operador identificado, opt-out verificado no worker e `confirm_send=true`.
- Fluxos exigem versão `integration_settings.updated_at` e bloqueiam edição de variações quando existirem jobs `pending/processing`. Cópias de IA ou template preservam o formato da interface.
- Mesclagens genéricas por nome ou semelhança de telefone **não são disponibilizadas**. Apenas a ponte de reconciliação LID + WA-ID verificada nos dois sentidos, com CAS dos dois chats, ausência de conflitos e função existente com histórico e auditoria preservados. Sem prova, somente diagnóstico.
- Modelos de Fluxos oferecidos pelo MCP para criação/edição são texto. Mídias já existentes não são descartadas ao mudar somente o nome. Upload de novas mídias para essa biblioteca e alterações genéricas de grafos que poderiam comprometer os jobs ficam fora do escopo de escrita segura.
- Todos os tools novos são nomes fechados, com OAuth admin (`kifer.read` ou `kifer.write` conforme ação), auditoria por operação e validações locais/servidor.

### Implantação e verificação

- Migrações aplicadas: `20261121165307_mcp_campaign_template_test_ledger_20261121` e `20261121170111_mcp_verified_chat_merge_20261121`.
- Testes de regressão adicionados, além da verificação de TypeScript e lint segmentado no workflow `.github/workflows/mcp-parity-regression.yml`.
- Um deploy do Vercel não atualiza automaticamente o Supabase MCP. Conferir a versão Edge Function `chatgpt-mcp` em cada publicação.
- A ferramenta de mesclagem de chats **não** foi chamada em produção. Para todas as operações de escrita reais ainda é necessário pedido explícito com escopo e identificadores corretos.
