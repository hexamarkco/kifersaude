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

## Safe Cleanup Strategy

- Keep old migration filenames unchanged if they were ever applied.
- Avoid moving files out of `supabase/migrations` in this repository.
- If historical cleanup is needed, do it in a separate migration history repository or on a fresh project bootstrap path.
