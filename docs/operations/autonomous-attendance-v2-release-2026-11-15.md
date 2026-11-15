# Publicação da V2 em 15/11/2026

Estado confirmado em 15/11/2026 às 20h28 de Brasília. A V2 está publicada no projeto Supabase `eaxvvhamkmovkoqssahj`, na função `ai-autonomous-reply-worker`, versão de infraestrutura **155**, versão de configuração **kifer-v2-2026-11-15.2**. O endpoint autenticado de saúde retornou `ready: true` e `paused: false`.

## Abrangência atual

- Piloto de **10% dos leads novos DDD 21**, atribuído de forma estável pelo ID do lead.
- Corte de criação de lead e chat em **15/11/2026 às 20h11min38s de Brasília**, equivalente a `2026-11-15T23:11:38Z`.
- Conversas iniciadas pelo motor antigo são preservadas nesta etapa. `includeExisting` permanece `false`; ampliação de abrangência foi apresentada ao usuário e ainda aguarda escolha.
- A função continua exigindo o atendimento autônomo ativo, mensagem elegível, identidade canônica, permissões de contato e turno atual. A publicação não iniciou conversas nem criou jobs para o histórico.
- Modelo **GPT-6 Luna**, raciocínio **medium**, duas etapas, tentativas limitadas ao mesmo modelo. A configuração geral legada `autonomous.reply` v24 não foi sobrescrita. A V2 usa um perfil próprio versionado e validado contra o catálogo.
- Biblioteca **kifer-human-546c3e1ad04e**, com os 17 exemplos anonimizados já revisados localmente, incluída no pacote do worker. Os dados brutos e o mapa privado de proveniência não foram publicados.

A configuração é definida em `supabase/functions/ai-autonomous-reply-worker/deployment.ts`. O modo de continuidade de conversas anteriores está implementado e testado, mas não está habilitado na abrangência atual. Quando habilitado explicitamente, ele só permite primeira entrada na V2 com uma mensagem do lead recebida após o novo corte, evitando consumo de backlog. Conversas com V2 já iniciada podem continuar, respeitando a chave de pausa e demais verificações.

## Continuidade do motor antigo

A primeira passagem verifica o histórico disponível, incluindo perguntas anteriores. Projeções legadas são importadas como apoio incerto; as mensagens reais confirmam os fatos. Até 80 identificadores de evidência do estado legado podem recuperar mensagens anteriores à janela recente, sempre limitados ao mesmo chat. Erros de idade da projeção antiga não viram conflitos artificiais com a transcrição. O estado legado e o histórico original permanecem preservados.

O teste sintético na nuvem começou com um resumo legado errado, leu as mensagens anteriores com as idades 35/33 e a cidade Niterói, recebeu uma resposta sobre MEI e seguiu para a pergunta opcional sobre plano atual. As idades e a cidade foram recuperadas sem repeti-las ao cliente.

## Publicação e verificações

Foi preservado um backup completo do worker anterior, versão 149, e das definições SQL relevantes, em `local-artifacts/autonomous-v2-cloud/`. Uma migration que já existia na nuvem, `20261114200833`, foi recuperada para o repositório a partir do registro remoto; seu conteúdo não foi reaplicado. Um workspace isolado e um dry-run confirmaram a aplicação exclusiva de:

1. `20261114193309_autonomous_attendance_v2_handoff_guard.sql`
2. `20261115000607_autonomous_v2_residence_neighborhood.sql`
3. `20261115024410_autonomous_v2_optional_qualification_fields.sql`
4. `20261115123308_autonomous_v2_city_neighborhood_question.sql`
5. `20261115124035_autonomous_v2_qualification_only_handoff.sql`

As cinco foram aplicadas pelo CLI preservando seus identificadores de versão. Não houve migration destrutiva, limpeza de histórico, mudança de campanha, publicação do frontend ou ativação manual de chats. O pacote continha apenas o worker e suas dependências importadas; o snapshot e os hashes do pacote foram salvos localmente.

A publicação ocorreu com a chave de pausa habilitada. O serviço de saúde foi verificado antes de liberar o piloto. As versões de infraestrutura 151 a 155 refletem as etapas de preparação, testes sintéticos, publicação do corte e continuidade; o gerenciamento de variáveis também atualiza a versão da função.

Validações concluídas:

- 166 testes V2 e quatro do preparador de exemplos.
- 37 testes de roteamento, limites de retry e perfis de requisição.
- Checagem Deno do worker completo, lint focado, typecheck do projeto e baseline de migrations.
- Saúde autenticada da função na nuvem, sem tocar a fila de jobs.
- Quatro cenários sintéticos com o modelo real pela própria função: qualificação completa com dados mínimos, idade pendente, cancelamento e continuidade legada. Todos passaram.
- Guarda SQL real: essenciais completos aceitos; idade ausente e capital sem bairro bloqueadas; execução negada a `anon` e `authenticated`.
- Reuso dos envelopes exatos de uma resposta preparada, inclusive após alteração de configuração; idempotência e validação de turno por bolha permanecem no transporte.

O script geral `verify:automations` não foi executado porque ele agenda fluxos reais de inatividade. Foram usadas verificações de saúde somente leitura e o modo de teste que retorna antes de qualquer claim de job, atualização de lead ou envio WhatsApp. As chamadas sintéticas de IA ficam identificadas como `ai-autonomous-reply-worker:preview` na telemetria.

## Situação observada após publicar

Em 15/11/2026 às 20h28min28s de Brasília, havia zero jobs em processamento, zero jobs vencidos aguardando execução, zero conversas persistidas com V2 e zero turnos reais de V2 registrados. Portanto, a checagem comprova publicação e execução sintética na nuvem; ainda não comprova qualidade de atendimentos reais em produção. Havia 89 conversas com atendimento autônomo ativo na checagem anterior, aguardando continuidade. Nenhuma foi despertada pela publicação.

Evidência final dos testes: `local-artifacts/autonomous-v2-cloud/probe-v155-1794785279711.json`. Hash do pacote remoto: `875ab446624ef546b4cb7aff86c88f76901cc963bd8819c13ebcd2f0ba7a9429`.

## Verificação do conjunto do repositório

Antes do commit do conjunto de alterações, passaram os 166 testes V2, os quatro testes nativos do preparador de exemplos, os 22 testes da página pública, os 25 testes de roteamento/retry/telemetria/transcrição e os 33 testes de perfis, prompts e contratos de handoff/reconstrução. Também passaram build, typecheck, arquitetura, verificação de segredos, baseline de migrations e lint, este último com dois avisos preexistentes. Os testes da página foram atualizados para os controles e perfis da nova interface; arquivos gerados e testes nativos do Node foram separados da descoberta do Vitest.

A suíte geral encontrou 26 falhas alheias ao diff em 14 arquivos. Todas foram reproduzidas em um worktree isolado do commit-base `26d8933d`, com as mesmas variáveis públicas de teste. A checagem Deno ampliada encontrou 209 diagnósticos preexistentes nas outras functions, reproduzidos no mesmo commit-base, sem novos diagnósticos. A checagem Deno do worker V2 passou separadamente. Portanto, a suíte geral do repositório ainda não está integralmente verde.

O dry-run remoto confirmou que não havia migrations pendentes nesta revisão. A conferência das dependências identificou 12 outras functions que importam o roteador compartilhado alterado. A autorização de publicação não muda a abrangência do piloto descrita acima.

## Rollback e acompanhamento

Para pausar a V2 sem remover memória ou migrar conversas de volta ao motor antigo:

```powershell
supabase secrets set AUTONOMOUS_ATTENDANCE_V2_PAUSED=true --project-ref eaxvvhamkmovkoqssahj
```

Conferir o endpoint de saúde e os jobs após a pausa. Conversas já migradas devem ser assumidas por humano; não restaurar diretamente o binário 149 sobre estados V2 ativos. Não apagar estados, liberar chaves de entrega incertas nem reverter migrations históricas.

As consultas em `docs/operations/autonomous-v2-health.sql` permitem revisar decisões, falhas e conclusões inválidas sem copiar conteúdo de clientes. Revisar os primeiros atendimentos reais antes de aumentar a abrangência. Qualificação concluída, envio aceito, proposta e venda continuam sendo resultados distintos.
