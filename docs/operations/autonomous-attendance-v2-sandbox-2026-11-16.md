# Chat de testes com a V2 — 16/11/2026

O `/chat` usa o mesmo motor, perfil e biblioteca de estilo do atendimento autônomo no WhatsApp. Tanto o chat manual quanto os cenários automáticos chamam `generateSandboxReply`, que utiliza `generateAttendanceTurn`. O núcleo compartilhado fica em `supabase/functions/_shared/autonomous-attendance-v2/`. A mudança de pasta não alterou as regras de qualificação nem a abrangência de 100% dos atendimentos autônomos, sem filtro de DDD.

O perfil permanece `kifer-v2-2026-11-15.3`, GPT-6 Luna com raciocínio medium, biblioteca `kifer-human-546c3e1ad04e`. A abordagem inicial vem do fluxo autorizado; não é uma resposta inventada por um prompt de abertura. O nome da corretora segue a mesma configuração autorizada do worker.

## Isolamento e continuidade

A migration aditiva `20261116003815_sandbox_autonomous_v2_memory.sql` acrescenta `attendance_state` às conversas de teste. Nenhum histórico foi apagado. Conversas antigas do sandbox que ainda não encerraram podem continuar com os dados recuperados da transcrição; conversas já transferidas permanecem encerradas. O histórico é paginado por inteiro, enquanto o motor controla sua janela de contexto e conserva os fatos na memória persistente.

`commit_ai_sandbox_turn` publica todas as bolhas e avança a memória em uma única transação. Ela confere a mensagem que originou a geração, o snapshot anterior e o encerramento da conversa. Uma nova mensagem durante a geração descarta a resposta antiga; chamadas repetidas não duplicam mensagens ou contadores de perguntas. A conclusão também passa pela mesma guarda SQL dos campos essenciais usada na operação real.

O sandbox escreve somente em `ai_sandbox_*` e na telemetria técnica de IA. Não chama transporte WhatsApp, não cria jobs de atendimento e não altera chats, leads, status comerciais ou eventos reais. IDs de teste não são usados como IDs de leads/chats na telemetria. A RPC é `SECURITY INVOKER`, com caminho de busca explícito, e execução restrita a `service_role`; a função HTTP mantém a autenticação existente.

## Publicação e evidências

- `ai-autonomous-reply-worker` versão 157, usando o núcleo compartilhado.
- `ai-sandbox-chat` versão 148.
- `ai-sandbox-run-scenario` versão 143.
- Código dos três pacotes remotos conferido e autenticação preservada.
- 179 testes V2 e quatro testes nativos do preparador de estilo passaram. Outros 21 testes cobriram prompts, contratos e Realtime.
- Build, typecheck, lint, arquitetura, baseline de migrations, geração de tipos Supabase e Deno das três functions passaram. O lint mantém os dois avisos preexistentes já documentados na publicação anterior.

O teste na própria função publicada, com o modelo real, criou duas conversas sintéticas identificadas como validação V2. A primeira recebeu uma abordagem configurada e duas mensagens consecutivas com todos os dados, concluindo a qualificação com idade 35, Niterói e ausência de CNPJ/MEI. Repetir a chamada não publicou novas mensagens. A segunda retomou uma transcrição anterior com as idades 35/33 e Niterói, recebeu uma resposta sobre MEI, preservou os fatos e perguntou apenas sobre plano atual, sem repetir essenciais.

Evidência privada e sem credenciais em `local-artifacts/release-20261115/sandbox-cloud-1794838560489.json`. As conversas sintéticas foram mantidas para auditoria. Nenhum WhatsApp real foi enviado por essa validação. Backups anteriores das functions ficam no mesmo diretório local ignorado pelo Git.

O resultado comprova a integração com o modelo real e a persistência do sandbox. As garantias de concorrência e descarte de respostas obsoletas foram verificadas com testes automatizados da transação; não se trata de uma medição de qualidade em leads reais.

## Recuperação

Se houver problema no sandbox, preservar as conversas e o estado e restaurar a versão anterior da função de teste a partir do backup. Não remover a coluna nem apagar mensagens para fazer rollback. A pausa do atendimento real continua independente e não é acionada por testes no `/chat`.
