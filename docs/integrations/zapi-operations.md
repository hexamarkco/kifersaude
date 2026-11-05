# Operações Z-API no CRM

Contrato revisado em 05/11/2026. As áreas solicitadas somam **107 operações e 96 rotas distintas**. A cobertura inclui variações de corpo na mesma rota: respostas, menções, botões com imagem/vídeo e administração de grupos/comunidades.

## Onde usar

Em **Configurações → Integrações → WhatsApp → Operações do WhatsApp**, com Z-API ativa, selecione a área e a ação. Os formulários aceitam objetos e listas estruturados, valores booleanos explícitos e arquivos de até 32 MB. GIF usa o formato MP4 exigido pelo provedor. Imagens de perfil do canal são informadas por URL conforme o endpoint.

Consultas exigem acesso de visualização do Inbox; envios exigem edição; alterações administrativas exigem administrador. O servidor valida a sessão, a revisão da conexão e o número conectado. Dados de conexão e tokens não são enviados ao navegador.

## Execução e retorno

- A função `comm-whatsapp-provider-operations` recebe uma operação permitida, seus dados, a revisão do canal e um identificador da solicitação. Caminho, método e parâmetros são definidos no servidor; não existe passagem livre de URLs.
- O contrato recursivo recusa campos desconhecidos, tipos inválidos, caminhos adulterados e referências de outra instância. Arrays de contatos mantêm o formato de raiz da API; queries preservam `false`.
- Alterações e envios usam as reservas de transporte existentes. Solicitações aceitas podem ser consultadas com o mesmo identificador sem repetir a chamada externa. Reutilizar o identificador com outro conteúdo é recusado. Falhas ambíguas permanecem retidas para conciliação.
- Permissões comerciais são verificadas antes dos envios diretos, de convites com destinatários e das alterações de listas que incluem contatos. Envio a lista de transmissão confere os destinatários remotos e bloqueia se algum estiver impedido. Grupos e publicações de canal seguem a distinção existente entre conversa coletiva e contato direto.
- Envio aceito permanece `queued`; entrega e leitura dependem dos callbacks. Envio direto ou em grupo registra um resumo legível no Inbox; elementos avançados não ganham novos widgets de composição no Inbox. Mídias e representações completas continuam dependentes dos callbacks já configurados. Publicações em canais/listas e alterações administrativas ficam no registro de execução, sem criar vínculos artificiais com leads.
- Aceite de uma edição não altera a mensagem original nem cria outra mensagem: a confirmação chega pelo callback de edição. O registro da execução identifica a operação realizada sem armazenar o conteúdo completo da solicitação.
- Se a projeção local falhar depois do aceite, o painel informa a pendência. Consultar a mesma solicitação repete apenas a projeção local.
- Botões, opções de listas, votos de enquetes e respostas a eventos recebidos são normalizados para texto visível. Conteúdo técnico sem representação comercial continua ignorado.
- A alteração de contatos invalida o marcador de sincronização; a próxima consulta normal recarrega a agenda. Os controles locais de chat continuam separados das ações da sessão do WhatsApp.

## Contratos e manutenção

O catálogo canônico fica em `supabase/functions/_shared/comm-whatsapp/zapi-operation-contract.ts`. O navegador possui uma cópia gerada, independente do deploy Deno. Após alterar o contrato, execute `npm run types:zapi`; `npm run types:zapi:check` e os testes verificam a paridade. A API pública da feature exporta `providerOperationsRepository`, `ZapiOperation` e `ZapiOperationInput`.

## Catálogo completo

A coluna Acesso distingue consulta, envio e administração. Os caminhos são relativos a `https://api.z-api.io/instances/{instanceId}/token/{token}`. Os links apontam para a documentação de cada operação.

| Área | Operação no CRM | Método e rota | Acesso | Identificador no contrato |
|---|---|---|---|---|
| Mensagens | [Enviar texto simples](https://developer.z-api.io/message/send-text) | `POST /send-text` | Envio | `message/send-text` |
| Mensagens | [Reencaminhar mensagem](https://developer.z-api.io/message/forward-message) | `POST /forward-message` | Envio | `message/forward-message` |
| Mensagens | [Enviar reação](https://developer.z-api.io/message/send-message-reaction) | `POST /send-reaction` | Administrador | `message/send-message-reaction` |
| Mensagens | [Remover reação](https://developer.z-api.io/message/send-remove-reaction) | `POST /send-remove-reaction` | Administrador | `message/send-remove-reaction` |
| Mensagens | [Enviar imagem](https://developer.z-api.io/message/send-message-image) | `POST /send-image` | Envio | `message/send-message-image` |
| Mensagens | [Enviar sticker](https://developer.z-api.io/message/send-message-sticker) | `POST /send-sticker` | Envio | `message/send-message-sticker` |
| Mensagens | [Enviar GIF](https://developer.z-api.io/message/send-message-gif) | `POST /send-gif` | Envio | `message/send-message-gif` |
| Mensagens | [Enviar áudio](https://developer.z-api.io/message/send-message-audio) | `POST /send-audio` | Envio | `message/send-message-audio` |
| Mensagens | [Enviar vídeo](https://developer.z-api.io/message/send-message-video) | `POST /send-video` | Envio | `message/send-message-video` |
| Mensagens | [Enviar PTV](https://developer.z-api.io/message/send-message-ptv) | `POST /send-ptv` | Envio | `message/send-message-ptv` |
| Mensagens | [Enviar documento](https://developer.z-api.io/message/send-message-document) | `POST /send-document/{extension}` | Envio | `message/send-message-document` |
| Mensagens | [Enviar link](https://developer.z-api.io/message/send-message-link) | `POST /send-link` | Envio | `message/send-message-link` |
| Mensagens | [Enviar localização](https://developer.z-api.io/message/send-message-location) | `POST /send-location` | Envio | `message/send-message-location` |
| Mensagens | [Enviar produto](https://developer.z-api.io/message/send-message-product) | `POST /send-product` | Envio | `message/send-message-product` |
| Mensagens | [Enviar catálogo](https://developer.z-api.io/message/send-message-catalog) | `POST /send-catalog` | Envio | `message/send-message-catalog` |
| Mensagens | [Enviar contato](https://developer.z-api.io/message/send-message-contact) | `POST /send-contact` | Envio | `message/send-message-contact` |
| Mensagens | [Enviar múltiplos contatos](https://developer.z-api.io/message/send-message-multiple-contacts) | `POST /send-contacts` | Envio | `message/send-message-multiple-contacts` |
| Mensagens | [Enviar botões de ação](https://developer.z-api.io/message/send-button-actions) | `POST /send-button-actions` | Envio | `message/send-button-actions` |
| Mensagens | [Enviar lista de botões](https://developer.z-api.io/message/send-button-list) | `POST /send-button-list` | Envio | `message/send-button-list` |
| Mensagens | [Enviar botões com imagem](https://developer.z-api.io/message/send-button-list-image) | `POST /send-button-list` | Envio | `message/send-button-list-image` |
| Mensagens | [Enviar botões com vídeo](https://developer.z-api.io/message/send-button-list-video) | `POST /send-button-list` | Envio | `message/send-button-list-video` |
| Mensagens | [Enviar lista de opções](https://developer.z-api.io/message/send-option-list) | `POST /send-option-list` | Envio | `message/send-option-list` |
| Mensagens | [Enviar botão OTP](https://developer.z-api.io/message/send-button-otp) | `POST /send-button-otp` | Envio | `message/send-button-otp` |
| Mensagens | [Enviar botão PIX](https://developer.z-api.io/message/send-button-pix) | `POST /send-button-pix` | Envio | `message/send-button-pix` |
| Mensagens | [Enviar carrossel](https://developer.z-api.io/message/send-carousel) | `POST /send-carousel` | Envio | `message/send-carousel` |
| Mensagens | [Deletar mensagens](https://developer.z-api.io/message/delete-message) | `DELETE /messages` | Administrador | `message/delete-message` |
| Mensagens | [Ler mensagens](https://developer.z-api.io/message/read-message) | `POST /read-message` | Administrador | `message/read-message` |
| Mensagens | [Responder mensagem](https://developer.z-api.io/message/reply-message) | `POST /send-text` | Envio | `message/reply-message` |
| Mensagens | [Enviar enquete](https://developer.z-api.io/message/send-poll) | `POST /send-poll` | Envio | `message/send-poll` |
| Mensagens | [Enviar voto para enquete](https://developer.z-api.io/message/send-poll-vote) | `POST /send-poll-vote` | Envio | `message/send-poll-vote` |
| Mensagens | [Enviar pedido](https://developer.z-api.io/message/send-message-order) | `POST /send-order` | Envio | `message/send-message-order` |
| Mensagens | [Atualizar status do pedido](https://developer.z-api.io/message/send-order-status-update) | `POST /order-status-update` | Envio | `message/send-order-status-update` |
| Mensagens | [Atualizar pagamento do pedido](https://developer.z-api.io/message/send-order-payment-update) | `POST /order-payment-update` | Envio | `message/send-order-payment-update` |
| Mensagens | [Fixar / Desafixar mensagens](https://developer.z-api.io/message/send-pin-message) | `POST /pin-message` | Administrador | `message/send-pin-message` |
| Mensagens | [Enviar convite de admin do canal](https://developer.z-api.io/message/send-newsletter-admin-invite) | `POST /send-newsletter-admin-invite` | Envio | `message/send-newsletter-admin-invite` |
| Mensagens | [Enviar evento](https://developer.z-api.io/message/send-event) | `POST /send-event` | Envio | `message/send-event` |
| Mensagens | [Editar evento](https://developer.z-api.io/message/send-edit-event) | `POST /send-edit-event` | Envio | `message/send-edit-event` |
| Mensagens | [Responder evento](https://developer.z-api.io/message/send-event-response) | `POST /send-event-response` | Envio | `message/send-event-response` |
| Mensagens | [Responder texto com botões](https://developer.z-api.io/message/reply-button) | `POST /reply-button` | Envio | `message/reply-button` |
| Mensagens | [Responder botão de ação](https://developer.z-api.io/message/reply-template-button) | `POST /reply-template-button` | Envio | `message/reply-template-button` |
| Mensagens | [Responder lista de opções](https://developer.z-api.io/message/reply-option-list) | `POST /reply-option-list` | Envio | `message/reply-option-list` |
| Contatos | [Pegar contatos](https://developer.z-api.io/contacts/get-contacts) | `GET /contacts` | Consulta | `contacts/get-contacts` |
| Contatos | [Adicionar contatos](https://developer.z-api.io/contacts/add-contacts) | `POST /contacts/add` | Administrador | `contacts/add-contacts` |
| Contatos | [Remover contatos](https://developer.z-api.io/contacts/remove-contacts) | `DELETE /contacts/remove` | Administrador | `contacts/remove-contacts` |
| Contatos | [Metadata do contato](https://developer.z-api.io/contacts/get-metadata-contact) | `GET /contacts/{phone}` | Consulta | `contacts/get-metadata-contact` |
| Contatos | [Pegar imagem do contato](https://developer.z-api.io/contacts/get-profile-picture) | `GET /profile-picture` | Consulta | `contacts/get-profile-picture` |
| Contatos | [Número com conta no aplicativo?](https://developer.z-api.io/contacts/get-iswhatsapp) | `GET /phone-exists/{phone}` | Consulta | `contacts/get-iswhatsapp` |
| Contatos | [Verificação em lote](https://developer.z-api.io/contacts/get-iswhatsapp-batch) | `POST /phone-exists-batch` | Consulta | `contacts/get-iswhatsapp-batch` |
| Contatos | [Bloquear / Desbloquear contato](https://developer.z-api.io/contacts/block-contact) | `POST /contacts/modify-blocked` | Administrador | `contacts/block-contact` |
| Contatos | [Denunciar contato](https://developer.z-api.io/contacts/report-contact) | `POST /contacts/{phone}/report` | Administrador | `contacts/report-contact` |
| Grupos | [Buscar grupos](https://developer.z-api.io/group/get-groups) | `GET /groups` | Consulta | `group/get-groups` |
| Grupos | [Criando grupos](https://developer.z-api.io/group/create-group) | `POST /create-group` | Administrador | `group/create-group` |
| Grupos | [Atualizar nome do grupo](https://developer.z-api.io/group/update-group-name) | `POST /update-group-name` | Administrador | `group/update-group-name` |
| Grupos | [Atualizar imagem do grupo](https://developer.z-api.io/group/update-group-photo) | `POST /update-group-photo` | Administrador | `group/update-group-photo` |
| Grupos | [Adicionar participantes](https://developer.z-api.io/group/add-participant) | `POST /add-participant` | Administrador | `group/add-participant` |
| Grupos | [Remover participantes](https://developer.z-api.io/group/remove-participant) | `POST /remove-participant` | Administrador | `group/remove-participant` |
| Grupos | [Aprovar participantes](https://developer.z-api.io/group/approve-participant) | `POST /approve-participant` | Administrador | `group/approve-participant` |
| Grupos | [Rejeitar participantes](https://developer.z-api.io/group/reject-participant) | `POST /reject-participant` | Administrador | `group/reject-participant` |
| Grupos | [Mencionar membro](https://developer.z-api.io/group/mention-participant) | `POST /send-text` | Envio | `group/mention-participant` |
| Grupos | [Mencionar grupo](https://developer.z-api.io/group/mention-group) | `POST /send-text` | Envio | `group/mention-group` |
| Grupos | [Mencionar todos](https://developer.z-api.io/group/mention-all) | `POST /send-text` | Envio | `group/mention-all` |
| Grupos | [Promover admin do grupo](https://developer.z-api.io/group/add-admin) | `POST /add-admin` | Administrador | `group/add-admin` |
| Grupos | [Remover admin do grupo](https://developer.z-api.io/group/remove-admin) | `POST /remove-admin` | Administrador | `group/remove-admin` |
| Grupos | [Sair do grupo](https://developer.z-api.io/group/leave-group) | `POST /leave-group` | Administrador | `group/leave-group` |
| Grupos | [Metadata do grupo](https://developer.z-api.io/group/metadata-group) | `GET /group-metadata/{phone}` | Consulta | `group/metadata-group` |
| Grupos | [Metadata do grupo (leve)](https://developer.z-api.io/group/light-group-metadata) | `GET /light-group-metadata/{phone}` | Consulta | `group/light-group-metadata` |
| Grupos | [Metadata do grupo por convite](https://developer.z-api.io/group/group-invitation-metadata) | `GET /group-invitation-metadata` | Consulta | `group/group-invitation-metadata` |
| Grupos | [Configurações do grupo](https://developer.z-api.io/group/update-group-settings) | `POST /update-group-settings` | Administrador | `group/update-group-settings` |
| Grupos | [Alterar descrição](https://developer.z-api.io/group/update-group-description) | `POST /update-group-description` | Administrador | `group/update-group-description` |
| Grupos | [Redefinir link de convite](https://developer.z-api.io/group/redefine-invitation-link) | `POST /redefine-invitation-link/{groupId}` | Administrador | `group/redefine-invitation-link` |
| Grupos | [Obter link de convite](https://developer.z-api.io/group/get-invitation-link) | `GET /group-invitation-link/{groupId}` | Consulta | `group/get-invitation-link` |
| Grupos | [Aceitar convite do grupo](https://developer.z-api.io/group/accept-group-invite) | `GET /accept-invite-group` | Administrador | `group/accept-group-invite` |
| Comunidades | [Criar comunidade](https://developer.z-api.io/communities/create-community) | `POST /communities` | Administrador | `communities/create-community` |
| Comunidades | [Listar comunidades](https://developer.z-api.io/communities/list-communities) | `GET /communities` | Consulta | `communities/list-communities` |
| Comunidades | [Vincular grupos](https://developer.z-api.io/communities/link-groups) | `POST /communities/link` | Administrador | `communities/link-groups` |
| Comunidades | [Desvincular grupos](https://developer.z-api.io/communities/unlink-groups) | `POST /communities/unlink` | Administrador | `communities/unlink-groups` |
| Comunidades | [Metadata da comunidade](https://developer.z-api.io/communities/community-metadata) | `GET /communities-metadata/{communityId}` | Consulta | `communities/community-metadata` |
| Comunidades | [Redefinir link de convite](https://developer.z-api.io/communities/redefine-invitation-link) | `POST /redefine-invitation-link/{communityId}` | Administrador | `communities/redefine-invitation-link` |
| Comunidades | [Adicionar participantes](https://developer.z-api.io/communities/add-community-participant) | `POST /add-participant` | Administrador | `communities/add-community-participant` |
| Comunidades | [Remover participantes](https://developer.z-api.io/communities/remove-community-participant) | `POST /remove-participant` | Administrador | `communities/remove-community-participant` |
| Comunidades | [Promover admin da comunidade](https://developer.z-api.io/communities/add-community-admin) | `POST /add-admin` | Administrador | `communities/add-community-admin` |
| Comunidades | [Remover admin da comunidade](https://developer.z-api.io/communities/remove-community-admin) | `POST /remove-admin` | Administrador | `communities/remove-community-admin` |
| Comunidades | [Configurações da comunidade](https://developer.z-api.io/communities/community-settings) | `POST /communities/settings` | Administrador | `communities/community-settings` |
| Comunidades | [Desativar comunidade](https://developer.z-api.io/communities/deactivate-community) | `DELETE /communities/{communityId}` | Administrador | `communities/deactivate-community` |
| Comunidades | [Alterar descrição da comunidade](https://developer.z-api.io/communities/update-community-description) | `POST /update-community-description` | Administrador | `communities/update-community-description` |
| Canais e Newsletter | [Criando canais](https://developer.z-api.io/newsletter/create-newsletter) | `POST /create-newsletter` | Administrador | `newsletter/create-newsletter` |
| Canais e Newsletter | [Atualizar imagem do canal](https://developer.z-api.io/newsletter/update-newsletter-picture) | `POST /update-newsletter-picture` | Administrador | `newsletter/update-newsletter-picture` |
| Canais e Newsletter | [Atualizar nome do canal](https://developer.z-api.io/newsletter/update-newsletter-name) | `POST /update-newsletter-name` | Administrador | `newsletter/update-newsletter-name` |
| Canais e Newsletter | [Atualizar descrição do canal](https://developer.z-api.io/newsletter/update-newsletter-description) | `POST /update-newsletter-description` | Administrador | `newsletter/update-newsletter-description` |
| Canais e Newsletter | [Seguir canal](https://developer.z-api.io/newsletter/follow-newsletter) | `PUT /follow-newsletter` | Administrador | `newsletter/follow-newsletter` |
| Canais e Newsletter | [Deixar de seguir canal](https://developer.z-api.io/newsletter/unfollow-newsletter) | `PUT /unfollow-newsletter` | Administrador | `newsletter/unfollow-newsletter` |
| Canais e Newsletter | [Mutar canal](https://developer.z-api.io/newsletter/mute-newsletter) | `PUT /mute-newsletter` | Administrador | `newsletter/mute-newsletter` |
| Canais e Newsletter | [Desmutar canal](https://developer.z-api.io/newsletter/unmute-newsletter) | `PUT /unmute-newsletter` | Administrador | `newsletter/unmute-newsletter` |
| Canais e Newsletter | [Deletar canal](https://developer.z-api.io/newsletter/delete-newsletter) | `DELETE /delete-newsletter` | Administrador | `newsletter/delete-newsletter` |
| Canais e Newsletter | [Metadata do canal](https://developer.z-api.io/newsletter/newsletter-metadata) | `GET /newsletter/metadata/{newsletterId}` | Consulta | `newsletter/newsletter-metadata` |
| Canais e Newsletter | [Listar seguidores do canal](https://developer.z-api.io/newsletter/newsletter-subscribers) | `GET /newsletter/subscribers/{newsletterId}` | Consulta | `newsletter/newsletter-subscribers` |
| Canais e Newsletter | [Listar canais](https://developer.z-api.io/newsletter/newsletter-list) | `GET /newsletter` | Consulta | `newsletter/newsletter-list` |
| Canais e Newsletter | [Encontrar canais](https://developer.z-api.io/newsletter/search-newsletter) | `POST /search-newsletter` | Consulta | `newsletter/search-newsletter` |
| Canais e Newsletter | [Configurações do canal](https://developer.z-api.io/newsletter/update-newsletter-config) | `POST /newsletter/settings/{newsletterId}` | Administrador | `newsletter/update-newsletter-config` |
| Canais e Newsletter | [Aceitar convite de admin](https://developer.z-api.io/newsletter/accept-newsletter-admin-invite) | `POST /newsletter/accept-admin-invite/{newsletterId}` | Administrador | `newsletter/accept-newsletter-admin-invite` |
| Canais e Newsletter | [Remover admin do canal](https://developer.z-api.io/newsletter/newsletter-remove-admin) | `POST /newsletter/remove-admin/{newsletterId}` | Administrador | `newsletter/newsletter-remove-admin` |
| Canais e Newsletter | [Anular convite de admin](https://developer.z-api.io/newsletter/newsletter-revoke-admin-invite) | `POST /newsletter/revoke-admin-invite/{newsletterId}` | Administrador | `newsletter/newsletter-revoke-admin-invite` |
| Canais e Newsletter | [Transferir propriedade do canal](https://developer.z-api.io/newsletter/transfer-newsletter-ownership) | `POST /newsletter/transfer-ownership/{newsletterId}` | Administrador | `newsletter/transfer-newsletter-ownership` |
| Listas de transmissão | [Criar lista de transmissão](https://developer.z-api.io/broadcast/create-broadcast) | `POST /broadcast` | Administrador | `broadcast/create-broadcast` |
| Listas de transmissão | [Editar lista de transmissão](https://developer.z-api.io/broadcast/update-broadcast) | `PUT /broadcast/{broadcastId}` | Administrador | `broadcast/update-broadcast` |
| Listas de transmissão | [Listar listas de transmissão](https://developer.z-api.io/broadcast/list-broadcast) | `GET /broadcast` | Consulta | `broadcast/list-broadcast` |
| Listas de transmissão | [Deletar lista de transmissão](https://developer.z-api.io/broadcast/delete-broadcast) | `DELETE /broadcast/{broadcastId}` | Administrador | `broadcast/delete-broadcast` |

## Publicação e homologação

Não há mudança de schema nem migration nova. É necessário publicar a nova Edge Function, as funções que incorporam o adaptador/normalizador alterado e o frontend. O deploy e a ativação remota não fazem parte desta alteração local.

A homologação com instância isolada deve confirmar os recursos habilitados na conta Z-API/WhatsApp: especialmente botões, GIF/MP4, codecs de áudio, pedidos Business, permissões de administrador, canais e listas. Os testes usam transporte simulado e não enviam mensagens reais.

Referências: [catálogo oficial](https://developer.z-api.io/llms.txt), [recebimento de mensagens](https://developer.z-api.io/webhooks/on-message-received-examples), [arquivo GIF em MP4](https://developer.z-api.io/message/send-message-gif).

## Verificação local desta ampliação

- 147 testes novos passaram: 132 de contratos/normalização, 12 do serviço e da fronteira HTTP e 3 do painel. Os 30 testes anteriores de contratos, callbacks e troca de provedor também passaram.
- `npm run typecheck`, `npm run build`, `npm run architecture:check`, `npm run types:zapi:check`, `npm run migrations:check` e `deno check` do novo entrypoint passaram. O build inclui verificação de segredos, design system, cores e bundle do editor.
- ESLint sobre `src`, `supabase`, `scripts` e as configurações passou com um aviso já existente em `PainelWrapper.tsx`. O comando global `npm run lint` encontra duas regras ausentes em caches `.vite-cache` de prévias locais sob `output/playwright`; esses arquivos não pertencem à alteração.
- A execução ampla, antes do último teste adicional de edição, registrou 2.052 testes passando e 27 falhando. Uma cópia isolada do `HEAD` anterior reproduziu 26 falhas de telas existentes. A falha restante de `inboxChatCollection.test.ts` foi reproduzida nessa cópia ao incorporar somente as alterações paralelas de `chatPresentation.ts` e `contactLookup.ts`, sem código novo desta integração. Essas alterações de identidade do Inbox foram preservadas.
- Nenhum deploy, migration remota, ativação de provedor ou envio real foi executado.
