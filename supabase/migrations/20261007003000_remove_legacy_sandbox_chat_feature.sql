/*
  # Remove legacy Chat Sandbox AI feature

  The interactive sandbox runs the same attendant as production through
  `autonomous.reply`. The former `sandbox.chat` record is unused and exposed
  an independent model/prompt configuration that could never affect /chat.

  `ai_feature_configs` is removed by its foreign-key cascade. Version
  snapshots are keyed by text rather than a foreign key, so they are removed
  explicitly as well.
*/

BEGIN;

DELETE FROM public.ai_config_versions
WHERE scope = 'feature'
  AND scope_key = 'sandbox.chat';

DELETE FROM public.ai_features
WHERE key = 'sandbox.chat';

COMMIT;
