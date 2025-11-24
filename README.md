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

Sem esses valores a aba de WhatsApp não consegue montar as URLs das funções.

## Desenvolvimento

```bash
npm install
npm run dev
```

Após configurar as variáveis e instalar as dependências, acesse o endereço informado pelo Vite (normalmente `http://localhost:5173`).
