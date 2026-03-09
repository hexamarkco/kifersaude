/*
  # Add flow steps to WhatsApp campaigns

  Stores multi-step campaign sequences (text, image, video, audio, document)
  in JSON format for React Flow builder + worker processing.
*/

DO $$
BEGIN
  IF to_regclass('public.whatsapp_campaigns') IS NULL THEN
    RAISE NOTICE 'public.whatsapp_campaigns not found, skipping flow steps migration.';
    RETURN;
  END IF;

  ALTER TABLE public.whatsapp_campaigns
    ADD COLUMN IF NOT EXISTS flow_steps jsonb DEFAULT '[]'::jsonb;

  UPDATE public.whatsapp_campaigns
  SET flow_steps = CASE
    WHEN flow_steps IS NOT NULL
      AND jsonb_typeof(flow_steps) = 'array'
      AND jsonb_array_length(flow_steps) > 0
    THEN flow_steps
    ELSE jsonb_build_array(
      jsonb_build_object(
        'id', 'step-1',
        'type', 'text',
        'text', COALESCE(message, ''),
        'order', 0
      )
    )
  END;

  ALTER TABLE public.whatsapp_campaigns
    ALTER COLUMN flow_steps SET DEFAULT '[]'::jsonb,
    ALTER COLUMN flow_steps SET NOT NULL;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'whatsapp_campaigns_flow_steps_is_array'
      AND conrelid = 'public.whatsapp_campaigns'::regclass
  ) THEN
    ALTER TABLE public.whatsapp_campaigns
      DROP CONSTRAINT whatsapp_campaigns_flow_steps_is_array;
  END IF;

  ALTER TABLE public.whatsapp_campaigns
    ADD CONSTRAINT whatsapp_campaigns_flow_steps_is_array
    CHECK (jsonb_typeof(flow_steps) = 'array');
END $$;
