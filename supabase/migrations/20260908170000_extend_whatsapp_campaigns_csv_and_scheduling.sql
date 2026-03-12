/*
  # Extend WhatsApp campaigns with CSV audience and scheduling

  Adds campaign audience source/config metadata, schedule support,
  and per-target payload metadata for CSV-based campaigns.
*/

DO $$
BEGIN
  IF to_regclass('public.whatsapp_campaigns') IS NULL OR to_regclass('public.whatsapp_campaign_targets') IS NULL THEN
    RAISE NOTICE 'WhatsApp campaign tables not found, skipping CSV + scheduling migration.';
    RETURN;
  END IF;

  ALTER TABLE public.whatsapp_campaigns
    ADD COLUMN IF NOT EXISTS audience_source text DEFAULT 'filters',
    ADD COLUMN IF NOT EXISTS audience_config jsonb DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;

  UPDATE public.whatsapp_campaigns
  SET
    audience_source = CASE
      WHEN audience_source IN ('filters', 'csv') THEN audience_source
      ELSE 'filters'
    END,
    audience_config = CASE
      WHEN audience_config IS NOT NULL AND jsonb_typeof(audience_config) = 'object' THEN audience_config
      WHEN audience_filter IS NOT NULL AND jsonb_typeof(audience_filter) = 'object' THEN audience_filter
      ELSE '{}'::jsonb
    END;

  ALTER TABLE public.whatsapp_campaigns
    ALTER COLUMN audience_source SET NOT NULL,
    ALTER COLUMN audience_source SET DEFAULT 'filters',
    ALTER COLUMN audience_config SET NOT NULL,
    ALTER COLUMN audience_config SET DEFAULT '{}'::jsonb;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'whatsapp_campaigns_audience_source_check'
      AND conrelid = 'public.whatsapp_campaigns'::regclass
  ) THEN
    ALTER TABLE public.whatsapp_campaigns
      DROP CONSTRAINT whatsapp_campaigns_audience_source_check;
  END IF;

  ALTER TABLE public.whatsapp_campaigns
    ADD CONSTRAINT whatsapp_campaigns_audience_source_check
    CHECK (audience_source IN ('filters', 'csv'));

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'whatsapp_campaigns_audience_config_is_object'
      AND conrelid = 'public.whatsapp_campaigns'::regclass
  ) THEN
    ALTER TABLE public.whatsapp_campaigns
      DROP CONSTRAINT whatsapp_campaigns_audience_config_is_object;
  END IF;

  ALTER TABLE public.whatsapp_campaigns
    ADD CONSTRAINT whatsapp_campaigns_audience_config_is_object
    CHECK (jsonb_typeof(audience_config) = 'object');

  ALTER TABLE public.whatsapp_campaign_targets
    ADD COLUMN IF NOT EXISTS raw_phone text,
    ADD COLUMN IF NOT EXISTS display_name text,
    ADD COLUMN IF NOT EXISTS source_kind text DEFAULT 'lead_filter',
    ADD COLUMN IF NOT EXISTS source_payload jsonb DEFAULT '{}'::jsonb;

  UPDATE public.whatsapp_campaign_targets
  SET
    raw_phone = COALESCE(NULLIF(btrim(raw_phone), ''), NULLIF(btrim(phone), ''), phone),
    display_name = COALESCE(NULLIF(btrim(display_name), ''), NULLIF(btrim(phone), '')),
    source_kind = CASE
      WHEN source_kind IN ('lead_filter', 'csv_import') THEN source_kind
      ELSE 'lead_filter'
    END,
    source_payload = CASE
      WHEN source_payload IS NOT NULL AND jsonb_typeof(source_payload) = 'object' THEN source_payload
      ELSE '{}'::jsonb
    END;

  ALTER TABLE public.whatsapp_campaign_targets
    ALTER COLUMN source_kind SET NOT NULL,
    ALTER COLUMN source_kind SET DEFAULT 'lead_filter',
    ALTER COLUMN source_payload SET NOT NULL,
    ALTER COLUMN source_payload SET DEFAULT '{}'::jsonb;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'whatsapp_campaign_targets_source_kind_check'
      AND conrelid = 'public.whatsapp_campaign_targets'::regclass
  ) THEN
    ALTER TABLE public.whatsapp_campaign_targets
      DROP CONSTRAINT whatsapp_campaign_targets_source_kind_check;
  END IF;

  ALTER TABLE public.whatsapp_campaign_targets
    ADD CONSTRAINT whatsapp_campaign_targets_source_kind_check
    CHECK (source_kind IN ('lead_filter', 'csv_import'));

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'whatsapp_campaign_targets_source_payload_is_object'
      AND conrelid = 'public.whatsapp_campaign_targets'::regclass
  ) THEN
    ALTER TABLE public.whatsapp_campaign_targets
      DROP CONSTRAINT whatsapp_campaign_targets_source_payload_is_object;
  END IF;

  ALTER TABLE public.whatsapp_campaign_targets
    ADD CONSTRAINT whatsapp_campaign_targets_source_payload_is_object
    CHECK (jsonb_typeof(source_payload) = 'object');
END $$;

CREATE INDEX IF NOT EXISTS idx_whatsapp_campaigns_scheduled_draft
  ON public.whatsapp_campaigns (scheduled_at)
  WHERE status = 'draft' AND scheduled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_campaign_targets_campaign_status_attempt
  ON public.whatsapp_campaign_targets (campaign_id, status, last_attempt_at DESC, sent_at DESC);
