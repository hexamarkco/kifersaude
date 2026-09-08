# Kifer Saúde

Aplicação web da Kifer Saúde: site público, formulários de captação e CRM comercial com leads, contratos, agenda, configurações, IA e comunicação por WhatsApp.

## Stack

- React 18, TypeScript e Vite
- Supabase: Postgres, Auth, Realtime, Storage e Edge Functions
- Vitest, ESLint e Tailwind/PostCSS

## Requisitos

- Node.js 20 ou superior
- npm
- Um projeto Supabase para usar autenticação, dados e Edge Functions

## Configuração

Copie `.env.example` para `.env.local` e preencha:

```env
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_FUNCTIONS_URL=https://<project>.supabase.co/functions/v1
VITE_SUPABASE_ANON_KEY=<anon-key>
```

`SUPABASE_SERVICE_ROLE_KEY` é exclusiva de servidor, scripts protegidos e secrets das Edge Functions. Nunca use prefixo `VITE_` nessa chave.

## Desenvolvimento

```bash
npm install
npm run dev
```

O Vite informa a URL local, normalmente `http://localhost:5173`.

## Validação

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run migrations:check
npm run audit:visual
```

Para conferir se os tipos persistidos correspondem ao projeto Supabase vinculado:

```bash
npm run types:supabase:check
```

Use `npm run types:supabase` somente quando uma mudança de banco intencional exigir regenerar `src/infrastructure/supabase/database.generated.ts`.

## Organização

- `src/features`: implementação organizada por domínio
- `src/infrastructure/supabase`: fronteira tipada do frontend com Supabase
- `src/design-system`: tokens, estilos e componentes visuais
- `supabase/functions`: Edge Functions e módulos Deno compartilhados
- `supabase/migrations`: histórico append-only do banco
- `scripts`: ferramentas operacionais suportadas; `scripts/legacy` contém apenas referências históricas

Leia [AGENTS.md](AGENTS.md) para convenções de contribuição e [docs/architecture.md](docs/architecture.md) para a visão arquitetural.

## Banco e deploy

Não edite migrations já aplicadas; crie uma nova migration corretiva. `deploy.bat` aplica migrations e chama o deploy incremental de functions em Windows; `deploy-functions.bat` usa `supabase.local.ini` e o Supabase CLI. Esses comandos alteram o ambiente remoto e só devem ser executados de forma intencional.

Após um deploy autorizado de automações, execute:

```bash
npm run verify:automations
```
