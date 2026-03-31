BEGIN;

ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS timezone text;

UPDATE public.system_settings
SET timezone = 'America/Sao_Paulo'
WHERE timezone IS NULL OR btrim(timezone) = '';

ALTER TABLE public.system_settings
  ALTER COLUMN timezone SET DEFAULT 'America/Sao_Paulo',
  ALTER COLUMN timezone SET NOT NULL;

COMMIT;
