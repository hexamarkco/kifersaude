# Kifer Saude no ChatGPT (somente leitura)

O endpoint `chatgpt-mcp` permite que um chat conectado consulte dados atuais do CRM, contratos, automacoes e historico do WhatsApp. Ele nao oferece qualquer ferramenta de criar, editar ou excluir dados.

## Limites de seguranca

- O acesso exige `Authorization: Bearer <KIFER_MCP_ACCESS_TOKEN>`.
- As ferramentas MCP sao anotadas como `readOnlyHint` e nao aceitam SQL, RPC arbitraria ou nomes livres de tabela.
- O servidor usa uma allowlist de tabelas operacionais, pagina respostas e remove valores de chaves que parecam credenciais.
- Segredos, configuracoes de integracao, sessao/autenticacao e arquivos brutos de webhook nao sao expostos.
- Cada consulta e registrada em `chatgpt_mcp_audit_log`, sem armazenar o conteudo retornado ou o termo pesquisado.

"Somente leitura" se aplica aos dados de negocio: a unica escrita tecnica e o log de auditoria.

## Publicacao

1. Aplique a migration do projeto.
2. Gere um token longo e aleatorio, guarde-o em um cofre de senhas e publique-o como secret. Exemplo:

   ```bash
   supabase secrets set KIFER_MCP_ACCESS_TOKEN="<token-longo-e-aleatorio>" KIFER_MCP_ACTOR="nick-chatgpt"
   ```

3. Publique a function:

   ```bash
   supabase functions deploy chatgpt-mcp --no-verify-jwt
   ```

4. No ChatGPT, crie/conecte a app MCP remota apontando para:

   ```text
   https://eaxvvhamkmovkoqssahj.supabase.co/functions/v1/chatgpt-mcp
   ```

   Configure o header `Authorization` com `Bearer <KIFER_MCP_ACCESS_TOKEN>`. Se a sua modalidade do ChatGPT exigir OAuth para apps personalizadas, use um proxy de OAuth em vez de colocar o token manualmente; o endpoint ja aceita o token bearer resultante.

5. Comece por perguntas como:

   - "Mostre o resumo operacional do Kifer."
   - "Busque o lead Maria Silva e resuma o contexto."
   - "Quais automacoes tiveram execucao diferente de ok?"
   - "Traga a conversa de WhatsApp deste lead."

## Revogacao

Para retirar o acesso imediatamente, substitua `KIFER_MCP_ACCESS_TOKEN` por outro valor (ou remova o secret) e redeploy a function. O token nao deve ser salvo em arquivos versionados, prompts compartilhados ou no banco de dados.
