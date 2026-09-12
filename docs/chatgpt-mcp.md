# Kifer Saude no ChatGPT (somente leitura)

O endpoint `chatgpt-mcp` permite que um chat conectado consulte dados atuais do CRM, contratos, automacoes e historico do WhatsApp. Ele nao oferece qualquer ferramenta de criar, editar ou excluir dados.

## Limites de seguranca

- O acesso exige `Authorization: Bearer <KIFER_MCP_ACCESS_TOKEN>`.
- As ferramentas MCP sao anotadas como `readOnlyHint` e nao aceitam SQL, RPC arbitraria ou nomes livres de tabela.
- O servidor usa uma allowlist de tabelas operacionais, pagina respostas e remove valores de chaves que parecam credenciais.
- Segredos, configuracoes de integracao, sessao/autenticacao e arquivos brutos de webhook nao sao expostos.
- Cada consulta e registrada em `chatgpt_mcp_audit_log`, sem armazenar o conteudo retornado ou o termo pesquisado.

"Somente leitura" se aplica aos dados de negocio: a unica escrita tecnica e o log de auditoria.

## Publicacao e reativacao

1. Aplique a migration do projeto.
2. Gere um token longo e aleatorio, guarde-o em um cofre de senhas e publique-o como secret. Nunca o grave neste repositorio, em um prompt ou na configuracao do ChatGPT. Exemplo:

   ```bash
   supabase secrets set KIFER_MCP_ACCESS_TOKEN="<token-longo-e-aleatorio>" KIFER_MCP_ACTOR="nick-chatgpt"
   ```

3. Publique a function:

   ```bash
   supabase functions deploy chatgpt-mcp --no-verify-jwt
   ```

4. Verifique o handshake sem revelar o token. Uma resposta `200` ao metodo MCP `initialize` confirma que a function e o secret estao ativos.

## Configuracao no ChatGPT

O endpoint agora oferece OAuth diretamente, com login do proprio CRM. Somente usuarios com o perfil `admin` conseguem autorizar o ChatGPT; a senha e validada pelo Supabase Auth e nunca e enviada ao ChatGPT.

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

Depois clique em **Verificar ferramentas**. Uma pagina segura do CRM pedira o seu e-mail/usuario e senha de administrador. Ao concluir, teste somente uma consulta de leitura e publique o plugin apenas para o grupo autorizado.

> A URL de retorno fica vinculada a este plugin do ChatGPT. Nao descarte este rascunho nem crie outro plugin antes de finalizar. Se for necessario recria-lo, atualize tambem o secret `KIFER_MCP_OAUTH_REDIRECT_URI` com a nova URL mostrada pelo ChatGPT e publique a function novamente.

5. Comece por perguntas como:

   - "Mostre o resumo operacional do Kifer."
   - "Busque o lead Maria Silva e resuma o contexto."
   - "Quais automacoes tiveram execucao diferente de ok?"
   - "Traga a conversa de WhatsApp deste lead."

## Revogacao

Para retirar o acesso imediatamente, substitua `KIFER_MCP_ACCESS_TOKEN` por outro valor (ou remova o secret) e redeploy a function. O token nao deve ser salvo em arquivos versionados, prompts compartilhados ou no banco de dados.
