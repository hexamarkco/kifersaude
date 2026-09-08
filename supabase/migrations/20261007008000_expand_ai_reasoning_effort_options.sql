-- Allow feature-level reasoning controls supported by current reasoning models.
-- NULL continues to mean "automatic", resolved from provider/model/task.
ALTER TABLE public.ai_feature_configs
  DROP CONSTRAINT IF EXISTS ai_feature_configs_reasoning_effort_check;

ALTER TABLE public.ai_feature_configs
  ADD CONSTRAINT ai_feature_configs_reasoning_effort_check
  CHECK (
    reasoning_effort IS NULL
    OR reasoning_effort IN ('none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max')
  );
