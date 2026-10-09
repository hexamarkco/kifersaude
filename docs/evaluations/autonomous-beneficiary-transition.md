# Inclusão de adulto em cotação infantil — 09/10/2026

## Problema e correção

Uma cotação inicialmente destinada ao filho passou a incluir a esposa, após aceite do interlocutor. O validador interpretava uma menção ao plano atual do casal como composição da nova cotação e rejeitava a pergunta de CNPJ dirigida à esposa. O extrator também substituía a idade da criança pela idade do adulto incluído.

A extração agora preserva a idade da criança ao acrescentar o adulto confirmado. Correções de idade mantêm as outras vidas, referências repetidas à mesma criança não aumentam a contagem e famílias com dois adultos e uma criança preservam as três vidas.

A regra de elegibilidade infantil também usa o estado da composição, em vez de uma expressão separada sobre todo o texto. Menções ao bom atendimento do plano atual do casal não confirmam adultos na cotação infantil. Uma oferta de avaliar a inclusão de adulto é distinta de afirmar que essa inclusão é obrigatória.

A validação usa o caso de um único adulto com menores antes da expressão histórica de múltiplos beneficiários e direciona a pergunta ao adulto identificado. Ela avalia a pergunta de identificação empresarial, em vez de qualquer mensagem que mencione CNPJ. Uma orientação como “podemos cotar sem CNPJ” seguida de uma pergunta sobre plano atual não é uma nova coleta de CNPJ.

O prompt compartilhado reforça a distinção entre plano atual e nova cotação. A configuração remota v24, o modelo e os parâmetros de geração permanecem preservados.

## Recuperação de falhas

O worker mantém quatro tentativas e os intervalos existentes. Quando esgota tentativas de geração, usa o handoff existente `PRECISA_HUMANO`, registra o motivo interno e preserva o status comercial. Não envia fallback nem marca qualificação completa. Permissões de contato, atendimento desativado e envio ambíguo mantêm seus bloqueios.

## Validação

As regressões locais importam a implementação de produção e usam uma conversa sintética. Cobrem inclusão posterior da esposa, preservação das idades, correções, participação do interlocutor, dois adultos com criança, direcionamento empresarial e orientação sem CNPJ seguida de pergunta sobre plano atual. A política de falhas cobre retry, handoff, bloqueios terminais e envio ambíguo. Testes com mocks e verificações de contrato não comprovam a qualidade das gerações.

A primeira simulação real passou pela pergunta correta à esposa e revelou o segundo falso positivo na resposta seguinte. Esse histórico foi usado para adicionar a regressão da menção contextual a CNPJ. As repetições finais usam somente `ai-sandbox-run-scenario`, com personagem fictício, sem conexão de envio WhatsApp.

Após corrigir o bloqueio, as três simulações chegaram ao fechamento, mas duas receberam ressalva do juiz por coletar cidade ou operadora antes de resolver a objeção à inclusão de adulto. A orientação compartilhada foi reforçada para confirmar essa decisão antes da coleta. Os vereditos dessa rodada estão preservados no arquivo `autonomous-tone-beneficiary-transition-initial.json`.

A suíte completa final passou com 1.382 testes. Typecheck, lint, architecture check e build passaram; após alinhar a elegibilidade ao estado atual, os 105 testes específicos de tom, helpers, qualificação e transição passaram. Os contratos de handoff e a política de falhas foram cobertos na suíte completa. Os commits de código são `62f5da64`, `9416d212`, `c253f747` e `31508788`, publicados em `main`. Worker e dois sandboxes receberam deploy.

As três simulações finais passaram pelo juiz e pela revisão das mensagens. Todas confirmaram a decisão de avaliar a inclusão de adulto antes da coleta, direcionaram CNPJ à esposa e chegaram a `QUALIFICACAO_COMPLETA` sem bloqueio. O fechamento conectou a cotação à pediatria e ao orçamento, sem garantir preço ou disponibilidade. Essa amostra valida o cenário observado, não qualidade universal em produção.

Os vereditos finais estão em `autonomous-tone-beneficiary-transition.json`. O arquivo `autonomous-beneficiary-transition-transcripts.json` preserva nove conversas sintéticas de diagnóstico e validação, inclusive as duas execuções interrompidas por falsos positivos e as três execuções finais aprovadas. A primeira interrupção envolvia CNPJ mencionado numa orientação; a segunda envolvia a leitura do plano existente como composição da cotação infantil. Ambas produziram regressões locais.

O atendimento real afetado já tinha esgotado as quatro tentativas antes da publicação. Ele foi encaminhado pela RPC existente para `PRECISA_HUMANO`, com registro de recuperação do job histórico. A operação foi condicionada ao mesmo turno inbound ainda pendente, ao atendimento ativo e ao último job falho, para preservar intervenções posteriores. Não houve envio de mensagem nem mudança do status comercial.

Para repetir a avaliação, com a CLI Supabase autenticada:

```bash
node scripts/evaluate-autonomous-tone.mjs beneficiary-transition
```

O script executa três simulações e registra os vereditos. A revisão também precisa examinar as mensagens, pois o juiz pode errar. Nenhuma migration foi criada. O dry-run confirmou que o banco está atualizado; `migrations:check` continua apontando a duplicidade histórica de slug já documentada.
