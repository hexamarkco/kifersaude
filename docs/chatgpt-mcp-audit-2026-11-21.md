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
