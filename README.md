# Kifer Saúde Frontend

## Pré-requisitos

- Node.js 18+ e npm

## Configuração de variáveis de ambiente

1. Copie o arquivo de exemplo e crie um arquivo local:

   ```bash
   cp .env.example .env.local
   ```

2. Edite `.env.local` (ou `.env`) e informe os dados do seu projeto Supabase:

   - `VITE_SUPABASE_URL`: normalmente `https://<project>.supabase.co` ou, no Supabase CLI, `http://127.0.0.1:54321`.
   - `VITE_SUPABASE_FUNCTIONS_URL`: use o endpoint das funções (`https://<project>.supabase.co/functions/v1` ou `http://127.0.0.1:54321/functions/v1`).
   - `VITE_SUPABASE_ANON_KEY`: chave anônima (`anon key`) do projeto.
   - `SUPABASE_SERVICE_ROLE_KEY`: apenas para uso em servidor, scripts protegidos ou secrets do Supabase. Nao use prefixo `VITE_` nessa chave.

## Desenvolvimento

```bash
npm install
npm run dev
```

Após configurar as variáveis e instalar as dependências, acesse o endereço informado pelo Vite (normalmente `http://localhost:5173`).

## Scripts Supabase (Windows + WSL)

Os scripts `.bat` executam o Supabase CLI dentro do WSL (Ubuntu).

1. Instale o Supabase CLI no Ubuntu (uma vez):

   ```bash
   wsl -e bash -lc "curl -fsSL https://github.com/supabase/cli/releases/download/v2.75.0/supabase_2.75.0_linux_amd64.deb -o /tmp/supabase.deb && sudo dpkg -i /tmp/supabase.deb"
   ```

2. Crie o arquivo local de configuracao:

   ```bat
   copy supabase.local.ini.example supabase.local.ini
   ```

3. Edite `supabase.local.ini` com:

   - `PROJECT_REF`
   - `DB_PASSWORD`
   - `SUPABASE_ACCESS_TOKEN`

   Esse arquivo e ignorado pelo Git.

Scripts disponiveis:

- `run-migrations.bat`: aplica migrations (`supabase db push`).
- `deploy-functions.bat`: faz deploy de todas as functions em `supabase/functions`.
- `npm run migrations:report`: audita o diretorio `supabase/migrations` (duplicidades, wrappers e distribuicao por mes).
- `npm run migrations:report:write`: atualiza `supabase/migrations/INDEX.md`.
- `npm run migrations:baseline:write`: grava baseline atual da auditoria.
- `npm run migrations:check`: valida que nao surgiram novas duplicidades/wrappers alem do baseline.

Boas praticas para migrations:

- Nao editar migrations antigas ja aplicadas.
- Nao renomear prefixos de versao (`YYYYMMDDHHMMSS`) de migrations existentes.
- Fazer ajustes via nova migration corretiva.

Observacao: os dois scripts pausam no final para voce conseguir ler o resultado ao abrir com duplo clique. Se executar via terminal e quiser sem pausa, use `--no-pause`.
