# Conversas privadas vazias no Inbox — 23/10/2026

## Diagnóstico confirmado por consultas somente de leitura

- Fabiola (Super): o chat por telefone tem 517 mensagens. O segundo registro,
  por LID (`@lid`), tem zero mensagens e foi criado em 23/10/2026.
- Na consulta, havia 492 registros LID sem exclusão ou mesclagem, incluindo
  arquivados; 484 foram criados nessa data. Isso não prova que todos sejam duplicados.
- 201 tinham `last_message_at` vazio, mas um deles tinha mensagens. Portanto,
  ausência de prévia não é prova suficiente para ocultar/excluir uma conversa.
- 200 não tinham mensagens. A simulação somente de leitura dos critérios de
  limpeza encontrou 200 elegíveis, incluindo o registro vazio da Fabiola.
  Esses registros estavam arquivados e continuavam acessíveis na busca.
- A sincronização chamava `comm_whatsapp_ensure_observed_chat` antes de ler o
  histórico. Uma resposta vazia ou uma falha da Whapi deixava um registro sem
  mensagens. O registro vazio da Fabiola não tinha job de enriquecimento de identidade.
- Logs do worker também mostram mapeamentos LID/telefone ainda não confirmados
  bidirecionalmente. Nomes iguais não autorizam mesclar chats.

### Prévia com mensagem ausente do histórico aberto

No exemplo de G, a prévia do chat por telefone termina em “Você é de qual
empresa ?”, às 17:47:30 de 01/09/2026. A mensagem existe, mas está em outro
registro, por LID, enquanto o chat por telefone termina em “Boa tarde”, cinco
segundos antes. A linha da mensagem foi criada em setembro; o chat LID foi
criado em 23/10. O job desse LID estava na quinta tentativa, sem confirmação
bidirecional do provider.

Uma consulta encontrou **151 chats por telefone** cuja prévia corresponde
exatamente ao texto/data de uma mensagem em outro chat do mesmo canal, sem
essa mensagem no próprio chat. Isso identifica inconsistência; não autoriza
mesclar automaticamente cada par.

O teste com as implementações SQL de produção reproduz a causa: o caminho de
atualização de uma mensagem já existente reatribuía seu `chat_id` ao chat
observado na reimportação, mesmo quando o LID não estava conciliado. A prévia
do antigo chat permanecia inalterada.

## Correção preparada

- Consultar o histórico antes de qualquer criação ou conciliação de chat.
- Em páginas vazias, retornar somente a rota canônica já conhecida, sem criar
  registros, buscar nomes ou atualizar o chat. Preservar a paginação do provider.
- Persistir mensagens no identificador canônico confirmado e manter o LID
  original nos metadados de auditoria.
- Adiar criação do chat até a persistência atômica de uma mensagem nova,
  inclusive em páginas não vazias compostas apenas por reimportações.
- Na RPC, serializar reimportações pelo ID da mensagem dentro do canal e
  resolver primeiro o proprietário de uma mensagem já existente. Reutilizar
  seu chat canônico, sem cadastrar um alias LID por esse motivo. Preservar
  `INSERT ... ON CONFLICT DO NOTHING`, estado de leitura e arquivamento.
- Na sincronização, no worker e no resolvedor de LIDs, permitir o telefone
  consistente de remetentes inbound como pista de consulta. Ignorar outbound,
  telefone do próprio canal, cartões compartilhados e remetentes ambíguos.
  Exigir que o provider confirme telefone → LID e LID → telefone; a pista
  sozinha nunca autoriza uma mesclagem.
- Retirar reversivelmente da lista os registros LID sem telefone, nome salvo,
  lead, histórico vivo/arquivado, prévia, pendências de leitura, marcações de
  prioridade, silenciamento, conflito ou atendimento autônomo. Exigir origem
  `provider_observed` e ausência de alias por telefone.
- Preservar qualquer referência comercial encontrada pelas FKs, incluindo
  compostas, tabelas futuras e chats mesclados. Conferir também referências de
  auditoria sem FK. Identificadores, presença e jobs técnicos permanecem.
- A limpeza apenas preenche `deleted_at`/`updated_at`; não exclui mensagens,
  não mescla pessoas e não altera o estado de arquivamento. Inbound real pode
  reabrir o registro pelas regras existentes.

## Validação e publicação

Os testes importam a sincronização de produção com Whapi e Supabase simulados.
A migration inteira é executada em PostgreSQL local via PGlite, cobrindo
mensagens sem prévia, arquivo de mensagens, referências comerciais por FK
simples/composta, auditorias sem FK, dados operacionais e reaplicação.

- 31 testes relevantes passaram; lint dos arquivos alterados e arquitetura passaram.
- `typecheck` encontrou erros fora do diff em `useVoiceRecording.ts:248` e
  `src/lib/xlsxExport.ts:241`, relativos a `ArrayBufferLike`/`ArrayBuffer`.
- `migrations:check` encontrou o slug histórico duplicado
  `comm_whatsapp_status_refresh_index_trigger`, presente em duas migrations
  já rastreadas no HEAD. Nenhuma migration histórica foi alterada.

Para colocar a correção em produção, é necessário publicar
`comm-whatsapp-sync-chat`, `comm-whatsapp-sync-all-chats`,
`comm-whatsapp-enrichment-worker` e `comm-whatsapp-resolve-lids`, e aplicar
as migrations `20261023185356_prevent_empty_private_inbox_chats.sql` e
`20261023190542_preserve_whatsapp_message_owner_on_reimport.sql`, após autorização explícita.
Nenhum deploy, migration remota, alteração de dados ou envio foi executado nesta investigação.

Chats LID com mensagens e identidade ainda não confirmada permanecem preservados;
a conciliação exige prova bidirecional do provider. Depois da publicação, é
necessário executar/acompanhar a conciliação autorizada e verificar o histórico
dos casos sinalizados. A limpeza de chats vazios não resolve esses casos.
