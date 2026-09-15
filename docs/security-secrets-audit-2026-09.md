# Auditoria de credenciais — 15/09/2026

## Resultado

Foram encontrados dois segredos reais ou prováveis em código versionado e um conjunto de chaves públicas de exemplo. Os valores foram deliberadamente omitidos deste relatório e dos logs do gate.

| Classificação | Achado | Estado no checkout atual | Ação administrativa |
|---|---|---|---|
| Segredo real, crítico | Chave Supabase `service_role` em scripts operacionais atuais e legados; a mesma chave também estava em `.env.local` e no bundle local ignorado `dist`. | Os literais dos scripts foram substituídos por `process.env.SUPABASE_SERVICE_ROLE_KEY`; o uso de `VITE_SUPABASE_SERVICE_ROLE_KEY` foi removido dos scripts; a entrada local de service role foi retirada. O próximo build regenera `dist` sem o bundle antigo. | **Rotacionar a chave `service_role` do projeto Supabase** e atualizar todos os ambientes de servidor que a utilizam. Nunca configurá-la com prefixo `VITE_`. |
| Provável segredo real, alto | Chave Google API usada pelo Tenor, embutida em `WhatsAppMediaDrawer.tsx` e no bundle local. | Removida do frontend. A nova Edge Function `tenor-media` lê `TENOR_API_KEY` exclusivamente do ambiente de servidor e exige usuário autenticado com permissão de visualização do Inbox. | **Rotacionar a chave Google API usada pelo Tenor**, restringi-la à API necessária e configurar `TENOR_API_KEY` nos secrets das Edge Functions. |
| Exemplo/documentação; não é segredo | Chaves Supabase com role `anon` em `api_examples/README.md`, `api_examples/csv_import.py`, `api_examples/curl_examples.sh`, `api_examples/python_client.py` e `api_examples/simple_example.py`. Há também uma anon key no `.env.local` local. | Mantidas como chaves públicas de cliente/exemplo; o gate reconhece tokens com role `anon` como públicos. | Não rotacionar por esta auditoria. Manter RLS e permissões do banco restritas. |
| Falso positivo | Referências a nomes como `SUPABASE_SERVICE_ROLE_KEY`, parâmetros `tokenParameter`, nomes de headers de segredo e funções que leem `Deno.env`. | São nomes de configuração ou leituras de ambiente, sem valor secreto literal. | Nenhuma. |

Não foram identificadas outras chaves de provedores, tokens de acesso, senhas em connection strings ou chaves privadas nos arquivos textuais examinados. A auditoria local inicial examinou 1.171 arquivos textuais, além de verificar especificamente os bundles em `dist`. Arquivos binários sem conteúdo textual útil não foram submetidos a heurística de entropia.

## Exposição no histórico Git

A chave Supabase foi encontrada em objetos versionados de scripts entre os commits `d491e1bd90a2` (04/09/2026) e `29ced571be01` (11/09/2026). A chave Google API/Tenor aparece desde `b38d5311d4fc` (31/03/2026). Limpar o checkout atual não remove essas cópias históricas; ambas as credenciais devem ser tratadas como comprometidas mesmo após rotação.

Os 39 caminhos com o literal `service_role` confirmado em `HEAD` eram:

- Scripts operacionais: `scripts/buscar-leads-porto.js:4`, `scripts/gerar-csv-porto.js:5`, `scripts/leads-cnpj-porto.js:4` e `scripts/verificar-vidas-leads.js:4`.
- `scripts/legacy/database-audit/`: `apply-audit-functions.mjs:4`, `audit-final-report.mjs:2`, `audit-investigate.mjs:2`, `audit-results-check.mjs:2`, `audit-validate-all.mjs:2`, `audit-validate-final.mjs:2`, `check-audit-functions.mjs:2`, `execute-apply.mjs:3`, `materialize-apply.mjs:2`, `run-audit-dry-run.mjs:2`, `run-audit-v2.mjs:2`, `run-audit-v3.mjs:2` e `test-batch-fk.mjs:2`.
- `scripts/legacy/function-inspection/`: `check-func-source.mjs:2`, `get-func-source-v3.mjs:2`, `get-func-source.mjs:2`, `get-func-v2.mjs:2`, `print-func-end.mjs:2` e `trace-func.mjs:2`.
- `scripts/legacy/whatsapp-identity/`: `check-lead-chat-matching.mjs:2`, `check-perdido-chat.mjs:2`, `check-run-completeness.mjs:2`, `check-statuses.mjs:2`, `count-perdido-chat.mjs:2`, `debug-classify-errors.mjs:2`, `debug-historico.mjs:2`, `debug-perdido-leads.mjs:2`, `debug-phone-lookup.mjs:2`, `fix-classify-final.mjs:2`, `fix-classify-min-uuid.mjs:2`, `fix-classify-phone-match.mjs:2`, `fix-normalize.mjs:2`, `test-all-matches.mjs:2`, `test-classify-with-chat.mjs:2` e `test-phone-overlap.mjs:2`.

Além dos 39 literais, seis scripts também aceitavam `VITE_SUPABASE_SERVICE_ROLE_KEY` como fallback de ambiente: `scripts/reconcile-whatsapp-identities.mjs`, `scripts/recover-whatsapp-messages.mjs`, `scripts/spread-existing-leads.mjs`, `scripts/verify-automations.mjs`, `scripts/legacy/campaigns/repair-campaign-immediate-stop-replies.mjs` e `scripts/legacy/whatsapp-identity/force-reconcile-lid-chats.mjs`. Esses fallbacks foram removidos; os scripts atuais usam exclusivamente `SUPABASE_SERVICE_ROLE_KEY` no ambiente de processo.

Não reescrevi o histórico. Para uma limpeza coordenada, primeiro rotacione as duas credenciais, combine a janela de manutenção com os demais colaboradores e faça o rewrite num clone espelho descartável, nunca no checkout de trabalho. Os comandos abaixo redigem qualquer JWT cujo claim seja `service_role` e qualquer chave Google API com o prefixo correspondente sem imprimir os valores:

```powershell
# Execute fora do checkout de trabalho, com git-filter-repo instalado.
git clone --mirror <URL_DO_REMOTE> kifersaude-history-clean.git
Set-Location kifersaude-history-clean.git
$origin = git remote get-url origin
$callback = @'
import base64
import json
import re

def redact_service_role(match):
    token = match.group(0)
    try:
        payload = token.split(b".")[1]
        payload += b"=" * ((4 - len(payload) % 4) % 4)
        claims = json.loads(base64.urlsafe_b64decode(payload))
        return b"***REMOVED***" if claims.get("role") == "service_role" else token
    except Exception:
        return token

blob.data = re.sub(rb"eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}", redact_service_role, blob.data)
blob.data = re.sub(rb"AIza[0-9A-Za-z_-]{30,}", b"***REMOVED***", blob.data)
'@
git filter-repo --blob-callback $callback --force
if ($LASTEXITCODE -ne 0) { throw 'git-filter-repo falhou; não force o push.' }
git remote add origin $origin
git push --force --mirror origin
```

Depois do rewrite, os colaboradores devem descartar clones/ref locais antigos e clonar novamente. Repositórios hospedados podem manter referências de pull requests ou caches; solicite a remoção dessas referências ao provedor. Proteções de branch podem precisar de uma janela administrativa para aceitar o push espelho.

## Gate automatizado

`npm run secrets:check` verifica arquivos rastreados e arquivos novos não ignorados, sem imprimir valores. `npm run build` executa o gate antes de construir. O scanner identifica service-role JWTs, chaves de provedores comuns, chaves privadas, tokens Bearer literais, connection strings com senha e atribuições literais a configurações sensíveis; anon JWTs públicos e placeholders documentados são excluídos.

## Configuração pendente da Edge Function

O código do proxy Tenor está local e não foi implantado nesta tarefa. Depois de rotacionar a credencial, configure o secret `TENOR_API_KEY` no projeto Supabase e implante `tenor-media` junto com os arquivos aprovados. Até esse deploy, a busca de GIFs/figurinhas responderá como indisponível; a chave não deve voltar ao frontend.
