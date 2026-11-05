# Provedores de WhatsApp

A operação usa um provedor por vez no canal principal. A Z-API é a escolha para a operação regular e a WHAPI Cloud fica disponível para contingência manual. Em instalações existentes, a primeira aplicação da migration mantém a seleção WHAPI até um administrador ativar a Z-API.

O painel de operações cobre agora as 107 operações documentadas (96 rotas distintas) de Mensagens, Contatos, Grupos, Comunidades, Canais/Newsletter e Listas de transmissão. Consulte o [catálogo de operações, acesso e limitações](zapi-operations.md). Essa cobertura amplia as ações disponíveis no painel; a matriz abaixo também descreve limitações dos fluxos tradicionais do Inbox e da sincronização automática.

## Arquitetura e inventário

- **Frontend.** Configurações → Integrações → WhatsApp consulta `comm-whatsapp-admin`. O Inbox continua lendo histórico, estado das conversas, pesquisas, lembretes e atualizações em tempo real do Supabase. A interface mantém a seleção em edição separada do provedor confirmado pelo servidor.
- **Despacho.** `_shared/comm-whatsapp/transport.ts` resolve a revisão do canal e reserva cada operação em Postgres. A WHAPI usa seu transporte HTTP existente. `zapi.ts` converte destinatários, tipos, anexos, citações e resultados para o contrato usado pelos consumidores do CRM. Nenhum adaptador decide cadência, permissão comercial, elegibilidade ou conteúdo.
- **Consumidores.** O Inbox e os envios MCP autorizados usam `comm-whatsapp-send`. O reenvio de anexos, encaminhamento e reações têm funções próprias. `process-scheduled-messages` cobre agendamentos simples, sequências e follow-ups. `leads-api` cobre jobs comerciais, a primeira abordagem legada, testes de fluxo e o caminho legado `/client/sendMessage/`. `comm-whatsapp-campaign-worker` cobre admissão, etapas, compatibilidade legada e testes. `ai-autonomous-reply-worker` mantém as reservas por turno e revalida o turno antes de enviar.
- **Banco, triggers e cron.** As RPCs existentes continuam reservando etapas, atribuindo produção, agrupando conversas, atualizando status e mantendo as filas. Os crons chamam os workers de campanhas, agendamentos, enriquecimento, status e automações. A migration nova concentra a troca e a reserva de transporte em duas RPCs de acesso exclusivo do servidor. Nenhuma tabela de histórico é recriada.
- **Entrada.** `comm-whatsapp-webhook` usa a mesma persistência para as mensagens normalizadas. A autenticação, a validação da instância e a tradução dos callbacks da Z-API ficam em módulos próprios. Os eventos tardios de status podem completar a conciliação do histórico do provedor anterior.
- **Ferramentas operacionais.** Os scripts `recover-whatsapp-messages.mjs` e `reconcile-whatsapp-identities.mjs` são ferramentas legadas. A recuperação remota da WHAPI continua restrita à WHAPI e à identidade já verificada. Use o painel para trocar o provedor. O MCP consulta a situação e usa a seleção persistida para envios.

## Matriz de compatibilidade

| Recurso | Implementação atual e dependência WHAPI | Recurso Z-API e comportamento no CRM | Compatibilidade |
|---|---|---|---|
| Texto manual, MCP e testes | `comm-whatsapp-send`, Bearer, `POST /messages/text` | `POST /send-text`, com telefone e texto. MCP usa a seleção do canal | Mediante adaptação |
| Texto de campanha, IA, leads, agendamentos e follow-ups | Workers e `leads-api` tinham chamadas diretas distintas | Despacho compartilhado, chave de operação, permissões e cadência existentes | Mediante adaptação |
| Imagem, vídeo, documento | Multipart, ID de mídia ou URL WHAPI | `send-image`, `send-video`, `send-document/{extensão}`. Mídia enviada conforme o formato do endpoint | Mediante adaptação |
| Áudio e nota de voz | Endpoints WHAPI de áudio e voz | `send-audio`. A nota de voz usa `waveform`. Homologar os codecs gravados no navegador | Mediante adaptação |
| Legenda | Dependente do tipo WHAPI | Imagem, vídeo, documento e GIF têm campos próprios. Áudio usa seu contrato sem legenda | Mediante adaptação |
| Figurinhas e GIFs | Renderização e anexos no histórico | A Z-API documenta `send-sticker` e `send-gif`. O normalizador reconhece anexos recebidos. O seletor de anexos continua limitado aos tipos expostos pelo Inbox | Mediante adaptação |
| Contato e localização em mensagem | Cartão, endereço e coordenadas no histórico | Normalização de contato e localização recebidos. Há endpoints de envio do provedor, sem ação dedicada no compositor atual | Mediante adaptação |
| Resposta citada | ID ou objeto de citação WHAPI | `messageId` da própria instância para texto, imagem, vídeo e documento. Citações de outra instância ou tipo incompatível são recusadas | Mediante adaptação |
| Reenvio de mídia | Referência WHAPI e reserva pelo Inbox | Anexo do Storage privado, falha confirmada e chave da mensagem original. O reenvio exige o provedor de origem | Mediante adaptação |
| Envio aceito, entregue, lido e falha | Resposta WHAPI e eventos de status | HTTP aceito gera `queued`. `DeliveryCallback` confirma processamento ou falha. `MessageStatusCallback` atualiza entrega, leitura e reprodução | Mediante adaptação |
| Callback antes da resposta HTTP | Status ou mutação pendente por ID externo | Reutiliza as RPCs de recibos pendentes. `messageId` identifica a mensagem. `zaapId` identifica a operação no provedor e fica separado | Mediante adaptação |
| Mensagens próprias | Mensagens `from_me` da WHAPI | `ReceivedCallback` com `fromMe`, com notificação de enviadas pelo próprio número habilitada no painel | Mediante adaptação |
| Reações | Endpoint WHAPI e mutações locais | `send-reaction` e `send-remove-reaction`. A atualização definitiva usa o callback de reação | Mediante adaptação |
| Encaminhamento | `forwardMessage` e persistência do resultado | `forward-message`, com telefones das conversas de origem e destino e ID da própria instância | Mediante adaptação |
| Exclusão | DELETE WHAPI e mutação local | `DELETE /messages` com `messageId`, `phone` e `owner`. O callback de revogação exige referência inequívoca ao original | Mediante adaptação |
| Edição | Edição WHAPI e histórico de revisão | Recebe `isEdit` com texto, sujeito à forma do callback. Envio de edição de texto não foi confirmado na referência pública | Não confirmado pela documentação para edição de saída |
| Mensagem com estrela | Mutação WHAPI e projeção local | A referência pública lista fixação de mensagem, cuja semântica difere da estrela | Não confirmado pela documentação |
| Histórico remoto e recuperação em lote | `sync-chat`, `sync-all-chats` e script recuperam mensagens WHAPI | Inbox continua com histórico no Supabase e entrada por webhook. A Z-API documenta que descarta as mensagens enviadas depois de processá-las | Mediante implementação alternativa |
| Listagem e metadados de chats | Descoberta WHAPI e cache local | A Z-API documenta `GET /chats`. O Inbox usa sua lista local e os eventos recebidos. Descoberta completa pelo endpoint não integra a recuperação de histórico | Mediante implementação alternativa |
| Grupos e participantes | IDs, eventos de grupo, snapshots e sincronização WHAPI | Mensagens com `-group` e remetente separado. Sincronização de grupos conhecidos por `light-group-metadata`. Notificações de administração sem semântica mapeada não alteram integrantes | Mediante adaptação |
| Contatos e agenda | Lista, cache, cadastro, renomeação e validação WHAPI | `GET /contacts`, `POST /contacts/add` e `GET /phone-exists/{phone}`. Renomeação remota fica indisponível no painel Z-API | Mediante adaptação, com limitação |
| Foto e perfil de contato | Metadados WHAPI e cache do Inbox | A Z-API documenta perfil e foto. Foto remota e sincronização incremental de contatos não integram este fluxo | Mediante adaptação possível |
| Telefone, LID e vínculo com lead | Resolução WHAPI em duas direções, conflitos e IDs canônicos | Aceita telefone explícito confirmado. Registra LID sem telefone e conflitos em `whatsapp_transport_identity_review`, sem vincular o evento a um lead. A consulta de existência não é uma prova de equivalência entre IDs de dois provedores | Mediante implementação alternativa |
| Presença e digitação | Assinatura e consulta WHAPI, mais Realtime | `PresenceChatCallback` de composição e gravação. A interface usa o estado transitório recebido. Presença consultada sob demanda e envio de indicador são operações distintas | Mediante adaptação |
| Arquivamento, não lidas, silêncio e fixação de chat | Estado do CRM via RPC | Mantém o estado local. A Z-API documenta ações na sessão do WhatsApp, separadas dos controles locais | Compatível diretamente no CRM |
| Busca, Realtime e atribuição de produção | Supabase e RPCs do CRM | Mesmas projeções e histórico local | Compatível diretamente |
| Saúde, conexão e QR | `/health`, limites WHAPI e webhook de canal | `GET /status` e `GET /device` verificam conexão e número. Pareamento, QR, desconexão e reconexão ficam no painel do provedor | Mediante adaptação |
| Diagnósticos, credenciais e webhook | Edge Secrets, URL e diagnóstico WHAPI | Edge Secrets independentes, recebimento HTTPS, autenticação da URL e confirmação da instância | Mediante adaptação |

As classificações descrevem contratos documentados e o código local. A homologação com uma instância real confirma formatos de mídia, comportamento dos callbacks e limites operacionais.

## Configuração da Z-API

1. Crie uma instância no painel Z-API e ative a proteção por token de segurança da conta. Conecte **o mesmo número do canal principal** pela tela de pareamento do provedor.
2. Cadastre `ZAPI_INSTANCE_ID`, `ZAPI_INSTANCE_TOKEN` e `ZAPI_CLIENT_TOKEN` nos Edge Function Secrets do Supabase. A URL externa segue `https://api.z-api.io/instances/{instanceId}/token/{instanceToken}/...` e o token de segurança vai no cabeçalho `Client-Token`.
3. Gere um segredo aleatório exclusivo com pelo menos 32 caracteres para `ZAPI_WEBHOOK_SECRET`. Configure uma URL HTTPS terminando em `/functions/v1/comm-whatsapp-webhook?channel=primary&provider=zapi&secret=<segredo-codificado>`. Use a URL de base mostrada em Configurações e acrescente o segredo apenas no painel do provedor. Restrinja a exposição das URLs completas nas ferramentas de acesso e observabilidade.
4. Configure os callbacks **Ao receber**, **Ao enviar**, **Status da mensagem**, **Status do chat**, **Ao conectar** e **Ao desconectar**. Habilite a notificação das mensagens enviadas pelo próprio número na URL de recebimento. Uma URL de recebimento específica para mensagens próprias pode ter prioridade no painel Z-API.
5. Cadastre em `ZAPI_MEDIA_ORIGINS` as origens HTTPS exatas dos arquivos da instância, separadas por vírgula. Confirme as origens com o provedor ou em um callback de teste controlado. Cadastre somente esquema, host e porta quando aplicável. Downloads recusam redirecionamentos, têm limite de 32 MiB e arquivam o arquivo no bucket privado existente.
6. Em Configurações → Integrações → WhatsApp, selecione Z-API e use **Testar conexão**. A verificação é de leitura. Confira o número, o horário da verificação e o recebimento de pelo menos um callback autenticado da instância. O seletor não exibe tokens.
7. Ative a Z-API pelo seletor. Mantenha `WHAPI_TOKEN` e `COMM_WHATSAPP_WEBHOOK_SECRET` configurados se a WHAPI for usada como contingência. A URL WHAPI exibida é a base. Acrescente o segredo no painel WHAPI pela query ou pelo cabeçalho `X-Kifer-Webhook-Secret`.

## Contingência, persistência e retorno

1. Selecione o provedor disponível e teste a conexão. O número confirmado deve coincidir exatamente com o número do canal principal. Para mudar o número, use um procedimento separado de identidade.
2. A troca padrão exige que as filas sejam drenadas. Durante uma indisponibilidade, revise os trabalhos pendentes e marque a opção de contingência para autorizá-los explicitamente. Envios em andamento continuam bloqueando a troca enquanto a tentativa estiver em execução. A operação usa a revisão do provedor e registra o administrador e a autorização de transferência em `whatsapp_transport_switches`.
3. O trabalho pendente autorizado continua sujeito às permissões, janelas e cadência existentes. Uma operação que já recebeu aceite reaproveita o resultado armazenado no mesmo provedor. Uma operação sem confirmação continua vinculada ao provedor de origem. O suporte pode consultar as tentativas pendentes em `whatsapp_transport_attempts` e comparar a conversa e os recibos da instância de origem. Sem um identificador confiável, o CRM mantém o bloqueio de reenvio da operação.
4. O canal mantém os chats e mensagens no Supabase. Mensagens Z-API usam a chave `zapi:<instância>:<messageId>` no identificador externo, com o provedor indicado nos metadados. O namespace separa as mensagens da WHAPI e de outras instâncias. Os anexos usam uma chave derivada e ficam no Storage privado. O status avança pelas RPCs existentes, inclusive quando o callback chega antes do registro da mensagem.
5. Para voltar à WHAPI Cloud, confirme o mesmo número e use o mesmo seletor. A troca não reconecta o aparelho. Faça o pareamento pelo painel WHAPI se necessário. Preserve os webhooks dos dois provedores para conciliar estados tardios das mensagens aceitas anteriormente.

Uma mensagem que só chegou ao provedor inativo antes da troca não dispara atendimento nem entra automaticamente no histórico. A Z-API não oferece recuperação histórica equivalente à WHAPI para preencher esse intervalo. A troca manual retoma os novos eventos após a ativação, desde que a instância de destino já esteja conectada.

## Publicação e homologação

- Aplicar a migration aditiva `20261103122551_whatsapp_provider_dispatch.sql` antes da publicação coordenada das funções. Ela cria a seleção, a proteção de despacho, o diagnóstico e a auditoria. A WHAPI permanece selecionada nessa etapa.
- Publicar as funções alteradas em conjunto para que todos os despachos consultem a seleção. Inclui `comm-whatsapp-admin`, `comm-whatsapp-webhook`, `comm-whatsapp-send`, `comm-whatsapp-retry-message`, `comm-whatsapp-manage-message`, `comm-whatsapp-react`, `comm-whatsapp-contacts`, `comm-whatsapp-media`, `comm-whatsapp-transcribe`, `comm-whatsapp-presence`, `comm-whatsapp-refresh-message-status`, `comm-whatsapp-sync-chat`, `comm-whatsapp-sync-all-chats`, `comm-whatsapp-sync-group-metadata`, `comm-whatsapp-enrichment-worker`, `comm-whatsapp-resolve-lids`, `comm-whatsapp-campaign-worker`, `ai-autonomous-reply-worker`, `process-scheduled-messages`, `leads-api` e `chatgpt-mcp`. Publicar também o frontend com o seletor.
- Em ambiente isolado, confirmar o número e o webhook antes de fazer um envio controlado. Validar texto, citação, arquivo, áudio, grupo, reação, falha, entrega, leitura, envio próprio e mídia já arquivada depois de remover a URL temporária. Validar um turno de IA, um agendamento e uma campanha de teste com opt-out.
- Simular uma interrupção de cada provedor com uma tentativa já iniciada. Verificar que a troca aguarda o despacho em execução, que o caso incerto fica retido, que novos atendimentos usam o provedor escolhido e que os webhooks antigos só conciliam status.
- O rollback operacional usa o seletor e preserva o schema. Caso seja necessário reverter o código, volte primeiro à WHAPI pelo seletor e preserve as tabelas e os registros criados pela migration.

## Verificações locais

- `npm test` passou com 1.921 testes em 362 arquivos. Os cenários focados cobrem autenticação, mídia, callbacks duplicados e tardios, identidade, concorrência, troca de contingência e retorno à WHAPI. A migration foi exercitada com PGlite.
- `npm run typecheck`, `npm run lint`, `npm run build`, `npm run migrations:check` e `npm run architecture:check` passaram. O lint manteve 15 avisos existentes. O build mantém o aviso de tamanho de bundles do Vite.
- A checagem Deno dos módulos novos passou. A checagem adicional dos entrypoints completos encontrou 252 diagnósticos que já constavam na comparação com o `HEAD` anterior, que registrava 256.
- A homologação com instâncias reais, a publicação e a aplicação remota da migration seguem pendentes.

## Referências oficiais

- [Índice Z-API](https://developer.z-api.io/llms.txt), [referência de API](https://developer.z-api.io/_llms/pt-br/api-reference.txt) e [repositório da documentação](https://github.com/Z-API/z-api-docs)
- [Credenciais e token de segurança](https://developer.z-api.io/security/client-token), [status](https://developer.z-api.io/instance/status) e [dados do celular](https://developer.z-api.io/instance/device)
- [Texto e identificadores de resposta](https://developer.z-api.io/message/send-text), [documento](https://developer.z-api.io/message/send-message-document), [áudio](https://developer.z-api.io/message/send-message-audio) e [encaminhamento](https://developer.z-api.io/message/forward-message)
- [Recebimento](https://developer.z-api.io/webhooks/on-message-received), [exemplos por tipo](https://developer.z-api.io/webhooks/on-message-received-examples), [envio processado](https://developer.z-api.io/webhooks/on-message-send) e [status](https://developer.z-api.io/webhooks/on-whatsapp-message-status-changes)
- [Presença](https://developer.z-api.io/webhooks/on-chat-presence-examples), [LID](https://developer.z-api.io/tips/lid), [expiração de arquivos](https://developer.z-api.io/tips/file-expiration), [grupos](https://developer.z-api.io/group/light-group-metadata) e [agenda de contatos](https://developer.z-api.io/contacts/get-contacts)
- [Saúde da WHAPI Cloud](https://whapi.readme.io/reference/checkhealth)
