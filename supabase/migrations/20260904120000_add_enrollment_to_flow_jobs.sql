-- Migration: Enrollment-based architecture for inactivity flows
-- Adds enrollment_id, trigger_message_id, trigger_message_at to auto_contact_flow_jobs
-- Replaces sticky predicate with enrollment-scoped lifecycle
--
-- CUTOVER PROTECTION: A new system_configurations key
-- 'inactivity_enrollment_cutover_at' defines when the new architecture activates.
-- The cron only creates enrollments for outbounds AFTER this timestamp.
-- Historical outbounds (before cutover) are NOT auto-enrolled.

-- 1. Add enrollment columns
ALTER TABLE public.auto_contact_flow_jobs
  ADD COLUMN IF NOT EXISTS enrollment_id uuid,
  ADD COLUMN IF NOT EXISTS trigger_message_id text,
  ADD COLUMN IF NOT EXISTS trigger_message_at timestamptz;

-- 2. Unique constraint: same enrollment cannot have duplicate step_order
CREATE UNIQUE INDEX IF NOT EXISTS idx_acfj_enrollment_step
  ON public.auto_contact_flow_jobs (enrollment_id, step_order)
  WHERE enrollment_id IS NOT NULL;

-- 3. Dedup index: prevent creating multiple enrollments for the same trigger message
CREATE UNIQUE INDEX IF NOT EXISTS idx_acfj_dedup_trigger
  ON public.auto_contact_flow_jobs (lead_id, flow_id, trigger_message_id)
  WHERE trigger_message_id IS NOT NULL AND status IN ('pending', 'processing');

-- 4. Fast lookup: find active enrollment for a lead+flow
CREATE INDEX IF NOT EXISTS idx_acfj_active_enrollment
  ON public.auto_contact_flow_jobs (lead_id, flow_id, enrollment_id)
  WHERE status IN ('pending', 'processing') AND enrollment_id IS NOT NULL;

-- 5. Register cutover timestamp (set to now on deploy)
DO $$
DECLARE
  has_normalized boolean;
  has_legacy boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'system_configurations'
      AND column_name = 'category'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'system_configurations'
      AND column_name = 'label'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'system_configurations'
      AND column_name = 'value'
  ) INTO has_normalized;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'system_configurations'
      AND column_name = 'config_key'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'system_configurations'
      AND column_name = 'config_value'
  ) INTO has_legacy;

  IF has_normalized THEN
    INSERT INTO public.system_configurations (category, label, value, description)
    VALUES ('automation', 'inactivity_enrollment_cutover_at', now()::text,
            'Cutover timestamp for enrollment-based inactivity architecture. Outbounds before this date are not auto-enrolled.')
    ON CONFLICT (category, label) DO NOTHING;
  ELSIF has_legacy THEN
    INSERT INTO public.system_configurations (category, config_key, config_value, description)
    VALUES ('automation', 'inactivity_enrollment_cutover_at', to_jsonb(now()::text),
            'Cutover timestamp for enrollment-based inactivity architecture. Outbounds before this date are not auto-enrolled.')
    ON CONFLICT (config_key) DO NOTHING;
  END IF;
END $$;

-- 6. Existing jobs keep enrollment_id = NULL (legacy, not affected by new logic)
-- No backfill needed.
