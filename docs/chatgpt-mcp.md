# Kifer Saude no ChatGPT (somente leitura)

O endpoint `chatgpt-mcp` permite que um chat conectado consulte dados atuais do CRM, contratos, automacoes e historico do WhatsApp. Ele nao oferece qualquer ferramenta de criar, editar ou excluir dados.

## Limites de segurança

- O acesso do ChatGPT exige OAuth com PKCE S256 e uma conta com perfil `admin` no CRM.
- Tokens de autorização, acesso e renovação são armazenados somente como hashes, têm validade limitada e são invalidados quando a conta deixa de ser administradora.
- As ferramentas MCP sao anotadas como `readOnlyHint` e nao aceitam SQL, RPC arbitraria ou nomes livres de tabela.
- O servidor usa uma allowlist de tabelas operacionais, pagina respostas e remove valores de chaves que parecam credenciais.
- Segredos, configuracoes de integracao, sessao/autenticacao e arquivos brutos de webhook nao sao expostos.
- Cada consulta e registrada em `chatgpt_mcp_audit_log`, sem armazenar o conteudo retornado ou o termo pesquisado.

"Somente leitura" se aplica aos dados de negocio: a unica escrita tecnica e o log de auditoria.

## Publicação e reativação

1. Aplique as migrations, publique a function e a página `public/mcp-oauth-authorize.html` junto com o site. A página de autorização é pública, mas só emite um código OAuth depois de validar a sessão de um administrador.
2. Configure os secrets abaixo no Supabase. A URL de retorno deve ser copiada exatamente do modal do ChatGPT.

   ```bash
   supabase secrets set \
     KIFER_MCP_OAUTH_CLIENT_ID="chatgpt-kifer" \
     KIFER_MCP_OAUTH_REDIRECT_URI="<url-de-retorno-exibida-pelo-chatgpt>" \
     KIFER_MCP_OAUTH_UI_URL="https://www.kifersaude.com.br/mcp-oauth-authorize.html"
   ```

3. Publique a function:

   ```bash
   supabase functions deploy chatgpt-mcp --no-verify-jwt
   ```

4. Verifique os metadados OAuth e o desafio MCP. Uma chamada não autenticada ao MCP deve retornar `401` com `resource_metadata`; o ChatGPT então inicia o OAuth automaticamente.

## Configuracao no ChatGPT

O endpoint oferece OAuth com login do próprio CRM. Somente usuários com o perfil `admin` conseguem autorizar o ChatGPT; a senha é validada pelo Supabase Auth e nunca é enviada ao ChatGPT.

```text
https://eaxvvhamkmovkoqssahj.supabase.co/functions/v1/chatgpt-mcp
```

Preencha o modal do ChatGPT assim:

| Campo | Valor |
| --- | --- |
| Nome | `CRM Kifer Saude` |
| Descricao | `Consultas somente leitura ao CRM Kifer Saude.` |
| Conexao | `URL do servidor` |
| URL | `https://eaxvvhamkmovkoqssahj.supabase.co/functions/v1/chatgpt-mcp` |
| Autenticacao | `OAuth` |
| Registro de cliente | `Cliente OAuth definido pelo usuario` |
| ID do cliente OAuth | `chatgpt-kifer` |
| Segredo do cliente OAuth | deixe em branco |
| Autenticacao do endpoint de token | `Nenhuma` / `none` |
| Escopos | `openid offline_access kifer.read` |

Em **Configuracoes avancadas de OAuth**, mantenha a URL de retorno exibida pelo ChatGPT. O servidor ja aceita essa URL e anuncia automaticamente os endpoints OAuth. Se a tela pedir os enderecos manualmente, use:

```text
Autorizacao: https://eaxvvhamkmovkoqssahj.supabase.co/functions/v1/chatgpt-mcp/oauth/authorize
Token: https://eaxvvhamkmovkoqssahj.supabase.co/functions/v1/chatgpt-mcp/oauth/token
```

Depois clique em **Verificar ferramentas**. A página `www.kifersaude.com.br/mcp-oauth-authorize.html` pedirá o e-mail e a senha da conta administradora. Clique em **Autorizar consultas** e aguarde o retorno automático ao ChatGPT. Então teste somente uma consulta de leitura e publique o plugin apenas para o grupo autorizado.

> A URL de retorno fica vinculada a este plugin do ChatGPT. Nao descarte este rascunho nem crie outro plugin antes de finalizar. Se for necessario recria-lo, atualize tambem o secret `KIFER_MCP_OAUTH_REDIRECT_URI` com a nova URL mostrada pelo ChatGPT e publique a function novamente.

5. Comece por perguntas como:

   - "Mostre o resumo operacional do Kifer."
   - "Busque o lead Maria Silva e resuma o contexto."
   - "Quais automacoes tiveram execucao diferente de ok?"
   - "Traga a conversa de WhatsApp deste lead."

## Revogacao

Para interromper novas conexões, remova `KIFER_MCP_OAUTH_REDIRECT_URI` e publique a function novamente. Para revogar conexões existentes, revogue os tokens OAuth no banco ou retire o perfil `admin` da conta autorizadora; o servidor revalida essa permissão a cada chamada.
