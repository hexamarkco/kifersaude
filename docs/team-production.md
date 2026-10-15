# Produção individual de Nick e Luiza

## Identidades e indicadores

A carteira continua compartilhada. `production_operators` define os usuários operacionais; `qa-teste` não é cadastrado. O autor de uma ação é independente do responsável pelo cliente e do responsável escolhido para a venda.

Na Inbox, a identidade vem da sessão validada. No ChatGPT compartilhado, o MCP exige `operator_user_id` informado explicitamente para cada operação comercial. `kifer_list_production_operators` fornece os IDs válidos. Não inferir o operador pelo OAuth, cliente, responsável, texto da mensagem ou conversa anterior. Um lote explicitamente solicitado pode compartilhar o operador. Não usar o campo de atribuição para conceder acesso: as permissões permanecem com o ator OAuth, revalidado no servidor/banco.

Erros anteriores à execução: `OPERATOR_REQUIRED` (identificação ausente/inválida), `INVALID_OPERATOR` (não cadastrado/inativo), `OPERATOR_UNAVAILABLE` (consulta indisponível). A auditoria preserva ator autorizador e operador declarado. Fechamentos MCP precisam também de `sale_operator_user_id` explicitamente escolhido; ele pode ser diferente do executor.

Agendamentos preservam a atribuição original, inclusive sequências e lotes. Edições/cancelamentos registram o executor da alteração e não transferem o crédito. Agendar e enviar são eventos distintos, contados em suas respectivas datas. O worker consulta a atribuição persistida; mensagens de agendamentos legados não são atribuídas ao criador do login compartilhado.

Envios `auto_contact`, `campaign` e `ai_autonomous` são automações. Texto assistido por IA enviado pela Inbox ou solicitado explicitamente no MCP conta para seu operador. Mensagens pelo aplicativo WhatsApp ficam como externas, sem autoria individual comprovada. Confirmações/atualizações de status e ecos não multiplicam eventos.

O relatório usa dias em `America/Sao_Paulo`, com limite inicial inclusivo e final exclusivo. Clientes distintos podem contar para ambos os atendentes; a equipe elimina duplicidades. Retornos contam por conclusão real (`concluido_em`), não por leitura. Reabertura/cancelamento desfaz a conclusão vigente. Etapas usam a ordem configurada; regressões e perdas ficam separadas. O primeiro estado `Emitido` ou `Ativo` fecha a venda e congela sua atribuição; cancelamentos são separados.

## Ativação após autorização de deploy

1. Aplicar a nova migration antes das Edge Functions. Ela instala o registro atômico, mas deixa `production_settings.started_at` nulo: nada do histórico compartilhado é reatribuído.
2. Publicar as funções alteradas e o frontend juntos. Atualizar a descoberta das ferramentas na conexão ChatGPT, pois as mutações comerciais agora exigem identificação do operador.
3. Em Configurações → Usuários, criar `nick`, com e-mail e senha inicial fornecidos no provisionamento, e selecionar Administrador. O fluxo existente cria a conta; o trigger cadastra automaticamente o operador Nick e sua opção de responsável comercial. Luiza mantém seu acesso.
4. Conferir Nick e Luiza em `kifer_list_production_operators`, testar seus logins em sessões separadas e validar atribuições em ambiente de teste, sem mensagens reais.
5. No Dashboard → Produção da equipe, um administrador usa “Iniciar medição a partir de agora” quando os logins individuais estiverem em uso. A ativação é idempotente e não pode retroceder pelo frontend.
6. Verificar registros e contagens para envios imediatos, agendados, retornos e fechamento. A data de início aparece no painel. Falhas de consulta mostram indisponibilidade, não zero.

## Validação e tipos

`npm test` inclui regressões reais do PostgreSQL via PGlite, isoladas de serviços remotos. `node --test scripts/test-production-database.mjs` executa somente as regressões de banco. Whapi não é chamado.

`npm run types:production` gera o esquema aditivo diretamente dos catálogos PostgreSQL após executar a migration no banco de teste. `npm run types:production:check` verifica esse resultado. `database.generated.ts` continua gerenciado exclusivamente por `npm run types:supabase`; `database.ts` combina os tipos existentes com o esquema aditivo gerado, sem alterações manuais nos arquivos gerados. Após o rollout remoto autorizado, regenerar os tipos vinculados e executar os dois checks.

Não há medição de horas online, leitura de conversas, tempo de resposta ou conversão individual. Autoria MCP é declarada; a conexão compartilhada não comprova qual pessoa estava no computador.
