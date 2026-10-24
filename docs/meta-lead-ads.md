# Meta Lead Ads, CRM e sinais comerciais

Migrations e três Edge Functions implantadas no projeto `eaxvvhamkmovkoqssahj`
em 23/10/2026, após autorização. O receptor e o processamento periódico estão
ativos. Em 24/10, `pages_manage_metadata` foi concedida e a Página inscrita no
aplicativo. O getLeads foi atribuído no Gerenciador de Acesso a Leads e o fluxo
automático Meta → webhook → cron → importação com rollback foi comprovado com
teste oficial, sem persistir contato nem enviar mensagens. A CAPI permanece desabilitada.

## O que já existia e o que foi reutilizado

- A migration `20260822120000_add_facebook_ads_integration.sql` instalou somente
  `integration_settings.slug=facebook_ads_manager`, com defaults comerciais e
  credenciais no JSON. Não havia receptor Meta no repositório.
- `public-lead-submit`, formulário do CRM e importações oficiais inserem em `leads`
  com as relações configuradas. A integração mantém esse mesmo INSERT e o trigger
  `trigger_auto_send_lead_messages`; não chama WhatsApp nem cria outra tabela de contatos.
- A engine `leads-api` e seu backlog continuam responsáveis por `lead_created`.
  `skip_automation`, pausa global, fluxos ativos e a verificação canônica de
  `check_contact_permission_for_send` continuam valendo. O formulário Meta não
  concede permissão comercial, não remove opt-out e não escreve políticas de contato.
- `contracts.lead_id` é o vínculo real com contratos. `opportunity_leads` relaciona
  os contatos às oportunidades, inclusive propostas (`opportunities.status=proposal`).
  Não foi inventada uma segunda estrutura de propostas.
- A inspeção foi feita no código, migrations e tipos versionados. A categoria da
  fonte de dados no Gerenciador de Eventos e as permissões da conta não foram
  verificadas remotamente nesta entrega.

## Fluxo e proteção dos dados

1. `meta-lead-webhook`: GET valida `hub.mode`, token e desafio. POST aceita no
   máximo 256 KiB e verifica `X-Hub-Signature-256` por HMAC SHA-256 sobre os bytes
   originais. Somente `object=page`, campo `leadgen`, página e formulário configurados
   entram na fila. A resposta 200 só ocorre após persistência; indisponibilidade ou
   pausa retorna 503 para permitir nova tentativa da Meta.
2. `meta_lead_receipts`: chave primária `leadgen_id` textual. Reentregas não
   sobrescrevem dados nem reabrem imports concluídos. Guarda IDs e horários, sem
   payload bruto ou campos de contato.
3. `meta-ads-worker`: consulta o lead na Graph API com credencial exclusivamente
   de servidor. Confere ID, formulário e anúncio quando presentes. Importa nome,
   telefone e somente a resposta comercial explicitamente mapeada. Não armazena
   o restante das respostas do formulário. Campos publicitários indisponíveis ficam nulos.
4. `meta_ads_import`: transação com lock do recibo e do telefone; insere em `leads`
   e grava a atribuição atomicamente. Telefones locais brasileiros são normalizados;
   números E.164 com `+` preservam o país. Um cadastro existente é vinculado sem
   alterar nome, responsável, status, origem, notas ou `skip_automation`. Vários
   cadastros com o mesmo telefone geram `AMBIGUOUS_CONTACT` para revisão humana.
   A trava de telefone serializa imports desta integração; outros produtores do CRM
   seguem suas regras existentes de deduplicação.
5. `meta_lead_attributions`: origem de cada entrada, separada da pessoa. Guarda
   página, formulário, campanha/conjunto/anúncio, horários e resposta comercial.
   `paid` exige anúncio identificado e ausência de indicação orgânica; `organic` e
   `unknown` ficam separados, usam a origem de fallback e não produzem sinais CAPI.
   Não há backfill de leads antigos por telefone, origem ou status.
6. `meta_commercial_reviews`: avaliação explícita do administrador, com ator, hora
   e versão `pme-mei-v1`. Qualificado exige **todos**: empresário/MEI elegível,
   pelo menos duas vidas, região atendida e interesse confirmado. A interpretação
   comercial e a região devem ser verificadas pelo operador; respostas do formulário,
   Atendimento, Proposta Enviada e `opportunities.status=qualified` não aprovam automaticamente.
7. A oportunidade selecionada precisa ter vínculo ativo com o contato. Um contrato
   precisa pertencer ao contato e ter sido criado depois da entrada Meta. Sua existência
   ou status não gera venda: o administrador precisa selecionar o contrato relacionado
   àquela entrada e atestar a conclusão. O horário do sinal é o da confirmação no CRM;
   não se infere uma data de venda a partir de `data_inicio`.
8. `meta_conversion_events`: primeira qualificação por entrada e conclusão por
   contrato, com identidade e horário estáveis. Um contrato não gera sinais para duas
   entradas distintas. Todos nascem **held**. Mudanças posteriores de qualificação
   invalidam sinais ainda não enviados; antes do transporte o worker confere novamente
   a avaliação atual e o vínculo do contrato. Uma qualificação invalidada não é
   recriada automaticamente por outra revisão. Confirmações contratuais anteriores
   permanecem no histórico; correções após envio exigem reconciliação administrativa.

Todas as tabelas novas têm RLS habilitado e nenhum grant para `anon` ou
`authenticated`; não existem políticas de leitura pública. RPCs são restritas a
`service_role`. O painel usa `meta-ads-admin` com JWT válido, perfil admin revalidado
e nova verificação do ator no banco. Funções com `SECURITY DEFINER` têm `search_path`
fixo e acesso público revogado; são necessárias para ler oportunidades que também
negam acesso direto a `service_role`.

Não há tokens no frontend. A migration limpa o JSON legado e rejeita chaves fora
da allowlist. Antes da ativação, **rotacionar** qualquer token antes armazenado no
JSON: removê-lo do banco atual não o remove de backups ou exposições anteriores.
Não copiar credenciais do Kifer Meta MCP para o browser. É possível provisionar a
mesma credencial de Página no cofre de servidor, após conferir escopo e autorização;
o código não lê arquivos/configuração privados do MCP nem depende do outro projeto.

## Fila, tentativas e reconciliação

- Claims usam `FOR UPDATE SKIP LOCKED`, lease de dois minutos e token de posse.
  Workers antigos não conseguem finalizar uma tentativa retomada por outro worker.
- Cada claim e resultado tem histórico com códigos operacionais. Não se grava
  resposta Graph, texto de exceção, nome, telefone, resposta comercial ou credencial
  nos logs de tentativa. Os dados comerciais ficam apenas na atribuição restrita.
- Falhas de rede, HTTP 408/429/5xx e erros transitórios/rate limits da Graph recebem
  espera exponencial com jitter; limite de oito tentativas. Erros permanentes ficam
  para revisão. Lotes de até quatro imports e quatro sinais limitam cada execução.
- Um crash entre aceite da Meta e confirmação local repete o **mesmo** `event_id`,
  destino, nome e horário. A reconciliação depende da deduplicação do provedor;
  não é uma garantia de transporte exatamente uma vez.
- Leases expirados são retomados; `meta_ads_reconcile()` encerra sinais com sete
  dias ou mais sem mudar a data original. O prazo conservador deve ser conferido
  com a documentação vigente antes da liberação.
- No painel, tentar receber novamente só reabre recibos com falha. A revisão de um
  sinal devolve-o a `held`, mantendo a identidade, o horário e o destino aprovado.
  Exige outra liberação explícita de servidor; sinais expirados ou revogados não
  podem ser reaproveitados. Corrigir um erro de payload não autoriza trocar dataset
  ou renomear o sinal para escapar de restrições.
- O painel mostra contadores globais, recebimentos, última importação, falhas,
  atribuições pesquisáveis por nome/ID Meta e histórico paginado. Cada página tem até
  50 registros. A busca permite avaliar entradas comerciais mais antigas.

## Configuração do recebimento

Depois da autorização de implantação, aplicar a nova migration e publicar
`meta-lead-webhook`, `meta-ads-worker` e `meta-ads-admin`. `supabase/config.toml`
declara a autenticação de cada função. Não usar o pipeline de automações como
atalho para aplicar migrations sem revisão.

Secrets de servidor necessários:

| Nome | Uso |
| --- | --- |
| `META_APP_SECRET` | Validar HMAC do aplicativo Meta |
| `META_WEBHOOK_VERIFY_TOKEN` | Token aleatório exclusivo para o desafio |
| `META_PAGE_ACCESS_TOKEN` | Ler leads da Página, nunca token do frontend |
| `META_GRAPH_VERSION` | Versão explícita suportada pelo aplicativo, no formato `vNN.0` |
| `META_WORKER_SECRET` | Credencial exclusiva do scheduler, também guardada no Vault |
| `META_VALIDATION_LEAD_ID` | ID exato do teste oficial que executa importação com rollback |
| `META_VALIDATION_LEAD_IDS` | IDs exatos separados por vírgula, preservando a proteção de testes anteriores |

O runtime já fornece `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_ANON_KEY`.
Não há fallback para versões Graph ou tokens de outras integrações.

Validar as permissões necessárias na documentação atual do aplicativo e no Lead
Access Manager (incluindo `leads_retrieval`, acesso à Página/formulário e, quando
necessário para atribuição, acesso de anúncios). Não presumir que o token usado
para métricas pelo MCP tem permissão para receber leads.

Referências reais, utilizadas somente na configuração:

| Recurso | ID |
| --- | --- |
| Página | `547836751743652` |
| Conta | `act_9519030184783024` |
| Formulário | `2050340295676923` |
| Anúncio PME/MEI | `120248660839720534` |
| Anúncio Família | `120248660840020534` |

Conferir `defaultOrigem`, `defaultResponsavel`, status ativo marcado como padrão,
origem fallback `Meta — origem não confirmada` e a chave exata da pergunta comercial
em `commercialField`. A configuração validada usa `FBS`, `Luiza` e a pergunta
`perfil_contratacao`, conferida no formulário. O tipo de contratação permanece
indefinido até a avaliação comercial.

O callback configurado é
`https://eaxvvhamkmovkoqssahj.supabase.co/functions/v1/meta-lead-webhook`.
O desafio e a assinatura `leadgen` do aplicativo foram confirmados na versão
`v26.0`. O aplicativo foi atribuído no Gerenciador de Acesso a Leads e a entrega
automática foi comprovada. A permissão
`pages_manage_metadata` e a inscrição da Página já foram confirmadas em 24/10;
o token atual permite consultar o lead de teste.

`settings.enabled=true` permite o teste controlado e o recebimento posterior.
O cron `meta-ads-worker` (job 47), ativado depois do provisionamento da credencial,
executa `private.invoke_meta_ads_worker()` a cada minuto. A função obtém a chave
`meta_ads_worker_secret` no Vault e a envia no header `x-meta-worker-secret`;
nenhuma chave `service_role` fica no comando cron. A mesma chave precisa existir
em `META_WORKER_SECRET` na Edge Function. A migration prepara a função e o Vault,
mas a ativação do cron é separada. Pausar `settings.enabled` impede o despacho.
Dimensionar frequência/concurrency pelo volume; o painel não dispara o worker.

## Configuração pendente: CAPI

O SDK oficial consultado confirma `lead_id` textual, IDs de atribuição do objeto
Lead e o envelope de eventos. [UserData oficial](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/serverside/user_data.py),
[Lead oficial](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/lead.py),
[Event oficial](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/serverside/event.py).
O payload preparado usa `action_source=system_generated`, `user_data.lead_id`,
`custom_data.event_source=crm` e `lead_event_source=Kifer CRM`. Os nomes dos dois
eventos dependem do mapeamento explicitamente aprovado para a fonte de dados.
Não se envia telefone/email, nem mesmo hash, dados de dependentes, documentos,
vidas, respostas comerciais, valores de plano, diagnósticos ou dados de saúde.

As páginas da documentação Meta de CRM/webhooks retornaram HTTP 429 e os termos
exigiram login durante a inspeção. A consulta ao SDK **não substitui** verificar os
requisitos atuais e os termos aplicáveis à conta. Antes de qualquer liberação:

1. No Gerenciador de Eventos, verificar classificação da fonte de dados,
   restrições de compartilhamento, dataset vinculado e eventos efetivamente permitidos.
2. Revisar se compartilhar o próprio vínculo/avanço comercial com planos de saúde
   é permitido. Excluir campos sensíveis não basta, por si só, para autorizar o envio.
3. Validar elegibilidade da integração CRM, formato de correspondência por `lead_id`,
   janela temporal, consentimento/base aplicável e mapeamento dos dois eventos.
4. Registrar aprovação da configuração, verificação de conformidade e autorização
   explícita de produção. Não renomear eventos nem trocar origem/dataset para
   contornar restrições. Se não permitido, manter somente a rastreabilidade interna.

Fontes a revisar nessa etapa: [CRM Conversions API](https://developers.facebook.com/docs/marketing-api/conversions-api/conversion-leads-integration/),
[obtenção de leads](https://developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving/),
[validação de webhooks](https://developers.facebook.com/docs/graph-api/webhooks/getting-started/),
[parâmetros de correspondência](https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/customer-information-parameters/),
[termos Meta Business Tools](https://www.facebook.com/legal/technology_terms).

Somente depois dessas verificações, provisionar:

- `META_CAPI_ACCESS_TOKEN`, `META_CAPI_DATASET_ID`;
- `META_CAPI_QUALIFIED_EVENT` e `META_CAPI_CONTRACT_EVENT`, distintos e aprovados;
- `META_CAPI_AUTHORIZATION_REFERENCE`, referência interna de aprovação sem dados pessoais;
- `META_CAPI_COMPLIANCE_APPROVED=true` e `META_CAPI_ENABLED=true`.

Além dos secrets, um administrador do servidor deve liberar IDs específicos por
`meta_ads_release(p_ids,p_dataset,p_qualified_event,p_contract_event,p_approval)`.
Essa RPC não está exposta ao navegador e não é chamada pelo painel/worker. Destino,
mapeamento e aprovação precisam coincidir com os secrets. Aprovar o ambiente não
libera automaticamente eventos históricos. Para pausar, remover `META_CAPI_ENABLED`
ou defini-lo como `false`; não alterar datas/identidades dos eventos.

## Validação ponta a ponta

Local, sem credenciais reais:

```bash
npm test -- supabase/functions/_shared/__tests__/meta-ads.test.ts supabase/functions/_shared/__tests__/meta-ads-pg.test.ts supabase/functions/_shared/__tests__/meta-ads-scheduler-pg.test.ts src/features/config/integrations/components/__tests__/MetaAdsPanel.test.tsx
npm run typecheck
npm run lint
npm run architecture:check
npm run migrations:check
npm run build
```

O teste PGlite executa a migration de produção em um banco descartável, com as
dependências mínimas do CRM e trigger de comunicação substituído por contador
local. O teste E2E assina o webhook, reentrega o mesmo ID, persiste a fila, simula
a resposta Graph, executa o worker e verifica exatamente um contato e atribuição,
fluxo de criação preservado e evento retido. Os testes usam IDs sintéticos e números
reservados `202-555`; não usam os IDs da campanha nem contatos reais.

Também são verificados assinatura inválida, desafio, origem divergente, tamanho,
campos ausentes, falhas transitórias, leases abandonados, defaults ausentes,
contatos existentes/ambíguos, ausência de qualificação por status, critérios,
contratos anteriores/incompatíveis, RLS/grants, autorização administrativa,
reconciliação e bloqueio de transporte CAPI.

Para testar o ambiente implantado sem persistir contato nem acionar comunicações,
os IDs oficiais fixados em `META_VALIDATION_LEAD_ID` ou `META_VALIDATION_LEAD_IDS` seguem exclusivamente para
`meta_ads_validate_test_import`. Essa RPC exige o nome sintético fixo, telefone
reservado e resposta comercial; executa a função real de importação e reverte a
subtransação, incluindo os triggers. O recibo termina em `validation_passed`,
separado de uma importação concluída. Requisições pg_net só partem após commit;
o endpoint de push também foi conferido como não configurado nesse ambiente.
Preservar os IDs anteriores na lista protege contra entregas atrasadas. Não usar
outro lead de teste em produção sem pausar o worker, fixar seu ID e conferir a
configuração antes de retomar: os demais IDs seguem o fluxo comercial normal e
podem gerar comunicações reais.

A inscrição da Página e a entrega originada pela Meta foram comprovadas em 24/10.
Avaliação, contrato sintético e eventos `held` são cobertos pelos
testes locais; o teste remoto de rollback não valida essas etapas. Transporte
CAPI/Test Events exige autorização própria e aprovação de dados e não foi executado.

Não alterar `database.generated.ts` manualmente. Após implantação autorizada e
schema confirmado, gerar novamente os tipos pelo script oficial do projeto.

## Resultado das verificações locais

- 34 testes específicos passaram, incluindo execução das migrations em PGlite,
  E2E com Graph simulada, rollback do teste, autenticação do scheduler e histórico.
- As três Edge Functions passaram em `deno check`; build, lint, arquitetura,
  checagem de credenciais e auditoria visual passaram. O lint geral aponta três
  avisos em artefatos locais já existentes e um aviso no cleanup de `useMetaAds`.
- A execução da suíte completa registrou 1.664 testes aprovados e seis falhas em
  testes existentes de lembretes/MCP, campanhas, follow-up, agenda do inbox e editor
  de IA. As mesmas seis falhas foram reproduzidas numa cópia limpa de `HEAD`.
- `typecheck` continua com dois erros preexistentes de `Uint8Array/ArrayBuffer`
  em `useVoiceRecording.ts:248` e `xlsxExport.ts:241`. A cópia limpa de `HEAD`
  reproduziu ambos.
- `migrations:check` já falha em `HEAD` por duas migrations históricas com slug
  `comm_whatsapp_status_refresh_index_trigger`. Nenhuma foi editada ou renomeada.
- Durante a implementação e os testes locais não foram aplicadas migrations,
  publicados serviços ou enviados eventos de produção. A implantação autorizada
  posterior está registrada abaixo.

## Implantação autorizada em 23/10/2026

- Migration `20261024011732_meta_lead_ads_crm_pipeline.sql` aplicada com sua versão
  original e conferida no histórico remoto. Nenhuma outra migration foi executada.
- Functions `meta-lead-webhook`, `meta-ads-worker` e `meta-ads-admin` publicadas e
  confirmadas como `ACTIVE`, versão 1. A configuração JWT foi preservada: autenticação
  própria no webhook/worker e JWT obrigatório no endpoint administrativo.
- O token de Página e o token de verificação existentes foram preservados em
  `META_PAGE_ACCESS_TOKEN` e `META_WEBHOOK_VERIFY_TOKEN`, com conferência de digest
  antes da remoção do JSON legado. Nenhum valor foi exibido ou salvo no repositório.
  Isso confirma a preservação, não a validade atual das credenciais na Meta.
- `enabled=false`, fila de recebimentos vazia e fila de eventos vazia confirmados.
  As cinco tabelas têm RLS habilitado; `anon` e `authenticated` não têm leitura
  direta nem execução das RPCs. O snapshot administrativo foi executado com sucesso.
- As verificações HTTP confirmaram bloqueio de requisições sem autenticação:
  worker/admin retornam 401 e o desafio sem token válido retorna 403. Um POST sem
  assinatura retorna 503 enquanto o App Secret ainda não está provisionado.
- Ainda faltam `META_APP_SECRET`, `META_GRAPH_VERSION`, mapeamento da pergunta
  comercial, conferência dos defaults e da validade/rotação das credenciais,
  inscrição da Página e agendamento do worker. Não foi criado cron nem ativado
  recebimento nesta etapa. Secrets e liberações da CAPI continuam ausentes.
- Há uma divergência histórica preexistente: a migration local
  `20261022142800_fix_step_dispatch_transition_result.sql` corresponde à versão
  remota `20261022142917`. O deploy utilizou uma cópia isolada em `.deploy-cache`
  com os arquivos compartilhados e a migration obtida do histórico remoto. O
  dry-run indicou somente a nova migration Meta. Nenhum arquivo histórico do
  repositório ou registro histórico remoto foi editado, removido ou renomeado.
- Tipos Supabase regenerados pelo script oficial e conferidos com o banco
  implantado. Nenhum contato real foi criado ou consultado, e nenhum evento
  foi enviado à Meta durante as verificações.

## Conexão e teste remoto em 23/10/2026

- Aplicativo `1213514694030711` (getLeads), Página e formulário conferidos na Meta.
  O callback legado foi substituído pelo receptor implantado e sua assinatura
  `page/leadgen` foi confirmada ativa em `v26.0`. O desafio retornou HTTP 200.
- A credencial estática antiga estava expirada. Uma credencial válida de Página,
  do mesmo aplicativo e recurso, foi provisionada com segurança no servidor a
  partir do cofre autorizado do Kifer Meta MCP. A sessão consultada vence em
  22/12/2026; manter renovação operacional. Não há dependência de runtime entre
  os projetos. App Secret e novo token aleatório de verificação foram provisionados;
  nenhum segredo foi exibido, versionado ou disponibilizado ao frontend.
- A Meta criou o lead de teste oficial `1097931793037511` no formulário configurado,
  usando somente `KIFER TESTE DE INTEGRACAO`, o número reservado `+1 202 555 0100`
  e uma opção comercial existente. Sua recuperação pela Graph API foi confirmada.
  O ID foi fixado no secret de validação antes do processamento.
- Às 23:38:41 BRT, uma **reprodução assinada por nós** da notificação desse teste
  retornou HTTP 200 no webhook e no worker. Resultado: `validatedTests=1`,
  `imported=0`, `sent=0`, `failed=0`, `capiEnabled=false`. O recibo ficou em
  `validation_passed`; consultas ao banco confirmaram zero contatos e atribuições
  desse teste persistidos e zero eventos de conversão. Isso valida o receptor,
  a consulta Graph e a importação canônica com rollback, mas não comprova entrega
  originada pela infraestrutura da Meta.
- A ferramenta oficial informou que a Página não possui aplicativo associado.
  A inscrição pela API retornou erro de permissão; falta `pages_manage_metadata`
  no login atual. A ampliação foi apresentada para confirmação do usuário.
  Depois da concessão, inscrever a Página em `leadgen`, conferir `subscribed_apps`
  e verificar a entrega original da Meta com o mesmo teste protegido. Não criar
  outro ID sintético em produção sem antes proteger seu processamento.
- Migrations adicionais `20261024022700_meta_lead_validation_probe.sql` e
  `20261024023443_meta_ads_worker_schedule.sql` aplicadas. Worker atualizado,
  autenticação dedicada conferida e cron de um minuto ativo. Tipos regenerados
  pelo script oficial. A chamada pela função do scheduler via pg_net recebeu
  HTTP 200, sem timeout, com fila vazia e CAPI desabilitada (request `710542`).
  O cron registrou execuções `succeeded` às 23:44 e 23:45 BRT.
  Nenhuma migration histórica foi alterada.
- `META_CAPI_ENABLED=false` permanece explícito. Não houve envio de conversão,
  mensagens WhatsApp/IA, cadastro persistido ou contrato de teste em produção.

## Permissão concedida e Página inscrita em 24/10/2026

- Após confirmação explícita do usuário, `pages_manage_metadata` foi habilitada
  no caso de uso de captura de leads do aplicativo e concedida no login Meta.
  A seleção foi limitada à Página `547836751743652`, sem acesso a Páginas futuras.
- O getLeads aceitou o escopo somente por configuração explícita em produção.
  Também foi corrigida a reconexão quando a troca de token não retorna
  `expires_in`: o servidor consulta `debug_token`, confere validade, aplicativo,
  tipo USER e os prazos informados pela Meta; usa o menor prazo positivo e
  recusa validade desconhecida ou vencida. Não se inventa um prazo de 60 dias.
  Os 12 testes do login, typecheck e lint passaram no projeto `meta-mcp`.
  Commits `f8f0def` e `0bda011` publicados nesse repositório; serviço implantado.
- A reconexão terminou em `result=connected`; validade conservadora registrada
  até 22/01/2027, 00:34:51 BRT. A nova credencial da Página foi provisionada no
  secret de servidor do CRM, sem exposição de valores.
- `POST /547836751743652/subscribed_apps` confirmou sucesso; a consulta posterior
  retornou o aplicativo `1213514694030711` com `subscribed_fields=[leadgen]`.
  O callback do aplicativo continua ativo em `v26.0` no receptor implantado.
- O teste sintético anterior foi conferido por ID, nome e telefone reservado
  antes de substituí-lo na ferramenta oficial. Novo ID `1840662990291917`, criado
  às 00:34:06 BRT, com os mesmos dados sintéticos. O worker ficou pausado durante
  a criação; o novo ID foi fixado em `META_VALIDATION_LEAD_ID`, conferido por digest
  e o worker republicado antes da retomada. O histórico do recibo anterior foi
  preservado. Nenhuma notificação desse novo ID foi reproduzida localmente.
- A ferramenta oficial agora mostra o getLeads associado à Página, mas informa
  **App does not have leads permission — Add this app to Lead Access Manager**.
  Os logs do receptor entre 00:30 e 00:40 BRT e a fila confirmaram ausência de
  entrega desse teste, apesar de a consulta Graph funcionar. A entrega automática
  não foi declarada validada.
- A Meta exige confirmação de identidade para abrir as configurações do portfólio
  empresarial. A tela ficou aberta para o usuário concluir essa verificação.
  Depois, atribuir somente o getLeads à Página no Gerenciador de Acesso a Leads
  e comprovar o recebimento original e o resultado `validation_passed` do ID protegido.
  O cron 47 foi retomado e a chamada via pg_net recebeu HTTP 200, sem timeout
  (request `710811`). Banco confirmou zero contatos e atribuições do teste e zero
  eventos de conversão; CAPI continua explicitamente desativada.

## Fluxo automático comprovado em 24/10/2026

- Após o usuário concluir a confirmação de identidade, o getLeads foi atribuído
  como CRM da Página no Gerenciador de Acesso a Leads. A lista passou a exibir
  `getLeads`; a integração Google Sheets existente foi preservada.
- O worker ficou pausado durante a substituição do teste sintético anterior.
  Novo teste oficial `2387036975167734`, com o mesmo nome fixo, telefone reservado
  e resposta comercial, criado às 02:20:02 BRT. Seu ID foi protegido no servidor;
  os IDs anteriores `1097931793037511` e `1840662990291917` também permaneceram
  na lista exata de validação, para impedir importações por entregas atrasadas.
- A própria Meta entregou a notificação: recibo persistido às 02:20:07,538 BRT,
  com Página e formulário corretos, assinatura aceita e status `pending`.
  Nenhum POST local foi feito para esse ID.
- Após publicar o worker atualizado e retomar a agenda às 02:20:44 BRT, o cron 47
  executou automaticamente às 02:21:00. O worker consultou o lead na Graph API,
  executou a importação canônica com rollback e finalizou às 02:21:01,117 BRT:
  `validation_passed`, uma tentativa, nenhum erro.
- Resposta HTTP do worker via pg_net (request `710828`): HTTP 200, sem timeout,
  `validatedTests=1`, `imported=0`, `sent=0`, `failed=0`, `capiEnabled=false`.
  Consultas ao banco confirmaram zero contatos do telefone reservado, zero
  atribuições do teste e zero eventos de conversão. Não houve mensagem WhatsApp/IA.
- Os 34 testes específicos, lint dos módulos alterados, `deno check`, checagem de
  credenciais e arquitetura passaram. Este teste comprova o caminho real de
  recebimento e importação; não valida transporte CAPI, revisão comercial nem
  criação de contrato em produção. A CAPI continua desativada e o cron ativo.
