# Supabase Migrations

This directory is intentionally flat because `supabase db push` reads SQL files directly from `supabase/migrations`.

## Naming Convention

- Format: `YYYYMMDDHHMMSS_description.sql`
- Use UTC timestamp in the filename prefix
- Use lowercase snake_case in the description

Example:

- `20260905160000_add_global_whatsapp_quick_replies.sql`

## Important Rules

- Do not edit old migrations already applied in shared environments.
- Do not change migration version prefixes once a migration was executed.
- Prefer new corrective migrations over rewriting old files.

## Inventory / Audit

Use the report script to inspect duplicate names, wrapped legacy files, and month distribution:

```bash
npm run migrations:report
```

To regenerate `supabase/migrations/INDEX.md`:

```bash
npm run migrations:report:write
```

To save the current repository state as baseline (one-time, or when intentionally accepted):

```bash
npm run migrations:baseline:write
```

To check that no new migration debt was introduced (new wrapped files, new duplicate slugs, new exact duplicates):

```bash
npm run migrations:check
```

## Troubleshooting: `duplicate key value violates unique constraint "schema_migrations_pkey"`

This happens when `supabase db push` (usually with `--include-all`, after being
told a local file is "before the last migration on remote") tries to insert a
version into `supabase_migrations.schema_migrations` that is already there.
The `NOTICE ... already exists, skipping` lines right before the error are the
tell: the migration's DDL is idempotent (`ADD COLUMN IF NOT EXISTS`,
`CREATE OR REPLACE FUNCTION`, `DROP TRIGGER IF EXISTS`, ...) and re-ran
harmlessly, but the final bookkeeping `INSERT` into `schema_migrations`
conflicts because that version was already recorded as applied in an earlier
push. The CLI's pending-migration diff didn't pick that up before prompting.

Fix — tell the CLI's history table to match reality instead of re-running the
file:

```bash
supabase migration repair --status applied <version>
```

Then re-run `supabase db push` (add `--include-all` again if other
out-of-order local files remain). Only use `--status reverted` instead if you
have verified the migration's changes are genuinely NOT on the remote
database — don't guess; check the affected tables/columns/functions first.

- Keep old migration filenames unchanged if they were ever applied.
- Avoid moving files out of `supabase/migrations` in this repository.
- If historical cleanup is needed, do it in a separate migration history repository or on a fresh project bootstrap path.
