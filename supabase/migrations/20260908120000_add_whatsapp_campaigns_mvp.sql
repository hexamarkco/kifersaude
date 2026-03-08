/*
  # WhatsApp campaigns MVP

  Adds campaign and target tables for WhatsApp mass sending,
  with admin-only access and a cron to process the queue.
*/

CREATE TABLE IF NOT EXISTS public.whatsapp_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  audience_filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_targets integer NOT NULL DEFAULT 0,
  pending_targets integer NOT NULL DEFAULT 0,
  sent_targets integer NOT NULL DEFAULT 0,
  failed_targets integer NOT NULL DEFAULT 0,
  invalid_targets integer NOT NULL DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  last_error text,
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_campaigns
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS message text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS audience_filter jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS total_targets integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_targets integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sent_targets integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_targets integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invalid_targets integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'whatsapp_campaigns'
      AND constraint_name = 'whatsapp_campaigns_created_by_fkey'
  ) THEN
    ALTER TABLE public.whatsapp_campaigns
      ADD CONSTRAINT whatsapp_campaigns_created_by_fkey
      FOREIGN KEY (created_by)
      REFERENCES public.user_profiles(id)
      ON DELETE SET NULL;
  END IF;
END $$;

UPDATE public.whatsapp_campaigns
SET
  name = COALESCE(NULLIF(btrim(name), ''), 'Campanha WhatsApp'),
  message = COALESCE(message, ''),
  status = CASE
    WHEN status IN ('draft', 'running', 'paused', 'completed', 'cancelled') THEN status
    WHEN status = 'scheduled' THEN 'draft'
    ELSE 'draft'
  END,
  audience_filter = COALESCE(audience_filter, '{}'::jsonb),
  total_targets = COALESCE(total_targets, 0),
  pending_targets = COALESCE(pending_targets, 0),
  sent_targets = COALESCE(sent_targets, 0),
  failed_targets = COALESCE(failed_targets, 0),
  invalid_targets = COALESCE(invalid_targets, 0),
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, now());

ALTER TABLE public.whatsapp_campaigns
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN message SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'draft',
  ALTER COLUMN audience_filter SET NOT NULL,
  ALTER COLUMN audience_filter SET DEFAULT '{}'::jsonb,
  ALTER COLUMN total_targets SET NOT NULL,
  ALTER COLUMN total_targets SET DEFAULT 0,
  ALTER COLUMN pending_targets SET NOT NULL,
  ALTER COLUMN pending_targets SET DEFAULT 0,
  ALTER COLUMN sent_targets SET NOT NULL,
  ALTER COLUMN sent_targets SET DEFAULT 0,
  ALTER COLUMN failed_targets SET NOT NULL,
  ALTER COLUMN failed_targets SET DEFAULT 0,
  ALTER COLUMN invalid_targets SET NOT NULL,
  ALTER COLUMN invalid_targets SET DEFAULT 0,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'whatsapp_campaigns_status_check'
      AND conrelid = 'public.whatsapp_campaigns'::regclass
  ) THEN
    ALTER TABLE public.whatsapp_campaigns
      DROP CONSTRAINT whatsapp_campaigns_status_check;
  END IF;
END $$;

ALTER TABLE public.whatsapp_campaigns
  ADD CONSTRAINT whatsapp_campaigns_status_check
  CHECK (status IN ('draft', 'running', 'paused', 'completed', 'cancelled'));

CREATE TABLE IF NOT EXISTS public.whatsapp_campaign_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.whatsapp_campaigns(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  phone text NOT NULL,
  chat_id text,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  error_message text,
  sent_at timestamptz,
  last_attempt_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_campaign_targets
  ADD COLUMN IF NOT EXISTS campaign_id uuid,
  ADD COLUMN IF NOT EXISTS lead_id uuid,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS chat_id text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS attempts integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'whatsapp_campaign_targets'
      AND constraint_name = 'whatsapp_campaign_targets_campaign_id_fkey'
  ) THEN
    ALTER TABLE public.whatsapp_campaign_targets
      ADD CONSTRAINT whatsapp_campaign_targets_campaign_id_fkey
      FOREIGN KEY (campaign_id)
      REFERENCES public.whatsapp_campaigns(id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'whatsapp_campaign_targets'
      AND constraint_name = 'whatsapp_campaign_targets_lead_id_fkey'
  ) THEN
    ALTER TABLE public.whatsapp_campaign_targets
      ADD CONSTRAINT whatsapp_campaign_targets_lead_id_fkey
      FOREIGN KEY (lead_id)
      REFERENCES public.leads(id)
      ON DELETE SET NULL;
  END IF;
END $$;

UPDATE public.whatsapp_campaign_targets
SET
  status = CASE
    WHEN status IN ('pending', 'processing', 'sent', 'failed', 'invalid', 'cancelled') THEN status
    WHEN status = 'completed' THEN 'sent'
    WHEN status = 'in_progress' THEN 'processing'
    WHEN status IN ('waiting', 'paused') THEN 'pending'
    ELSE 'failed'
  END,
  attempts = COALESCE(attempts, 0),
  phone = COALESCE(NULLIF(btrim(phone), ''), 'sem-telefone-' || replace(id::text, '-', '')),
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, now());

ALTER TABLE public.whatsapp_campaign_targets
  ALTER COLUMN campaign_id SET NOT NULL,
  ALTER COLUMN phone SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'pending',
  ALTER COLUMN attempts SET NOT NULL,
  ALTER COLUMN attempts SET DEFAULT 0,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'whatsapp_campaign_targets_status_check'
      AND conrelid = 'public.whatsapp_campaign_targets'::regclass
  ) THEN
    ALTER TABLE public.whatsapp_campaign_targets
      DROP CONSTRAINT whatsapp_campaign_targets_status_check;
  END IF;
END $$;

ALTER TABLE public.whatsapp_campaign_targets
  ADD CONSTRAINT whatsapp_campaign_targets_status_check
  CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'invalid', 'cancelled'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_campaign_targets_campaign_phone_unique
  ON public.whatsapp_campaign_targets (campaign_id, phone);

CREATE INDEX IF NOT EXISTS idx_whatsapp_campaigns_status
  ON public.whatsapp_campaigns (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_campaign_targets_campaign_status
  ON public.whatsapp_campaign_targets (campaign_id, status);

CREATE INDEX IF NOT EXISTS idx_whatsapp_campaign_targets_pending
  ON public.whatsapp_campaign_targets (status, created_at)
  WHERE status IN ('pending', 'processing');

CREATE OR REPLACE FUNCTION public.set_whatsapp_campaigns_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_whatsapp_campaign_targets_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_whatsapp_campaigns_updated_at
  ON public.whatsapp_campaigns;

CREATE TRIGGER trg_whatsapp_campaigns_updated_at
BEFORE UPDATE ON public.whatsapp_campaigns
FOR EACH ROW
EXECUTE FUNCTION public.set_whatsapp_campaigns_updated_at();

DROP TRIGGER IF EXISTS trg_whatsapp_campaign_targets_updated_at
  ON public.whatsapp_campaign_targets;

CREATE TRIGGER trg_whatsapp_campaign_targets_updated_at
BEFORE UPDATE ON public.whatsapp_campaign_targets
FOR EACH ROW
EXECUTE FUNCTION public.set_whatsapp_campaign_targets_updated_at();

ALTER TABLE public.whatsapp_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_campaign_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read WhatsApp campaigns" ON public.whatsapp_campaigns;
DROP POLICY IF EXISTS "Admins can insert WhatsApp campaigns" ON public.whatsapp_campaigns;
DROP POLICY IF EXISTS "Admins can update WhatsApp campaigns" ON public.whatsapp_campaigns;
DROP POLICY IF EXISTS "Admins can delete WhatsApp campaigns" ON public.whatsapp_campaigns;
DROP POLICY IF EXISTS "Service role can manage WhatsApp campaigns" ON public.whatsapp_campaigns;

DROP POLICY IF EXISTS "Admins can read WhatsApp campaign targets" ON public.whatsapp_campaign_targets;
DROP POLICY IF EXISTS "Admins can insert WhatsApp campaign targets" ON public.whatsapp_campaign_targets;
DROP POLICY IF EXISTS "Admins can update WhatsApp campaign targets" ON public.whatsapp_campaign_targets;
DROP POLICY IF EXISTS "Admins can delete WhatsApp campaign targets" ON public.whatsapp_campaign_targets;
DROP POLICY IF EXISTS "Service role can manage WhatsApp campaign targets" ON public.whatsapp_campaign_targets;

CREATE POLICY "Admins can read WhatsApp campaigns"
  ON public.whatsapp_campaigns
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert WhatsApp campaigns"
  ON public.whatsapp_campaigns
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update WhatsApp campaigns"
  ON public.whatsapp_campaigns
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete WhatsApp campaigns"
  ON public.whatsapp_campaigns
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Service role can manage WhatsApp campaigns"
  ON public.whatsapp_campaigns
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can read WhatsApp campaign targets"
  ON public.whatsapp_campaign_targets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert WhatsApp campaign targets"
  ON public.whatsapp_campaign_targets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update WhatsApp campaign targets"
  ON public.whatsapp_campaign_targets
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete WhatsApp campaign targets"
  ON public.whatsapp_campaign_targets
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Service role can manage WhatsApp campaign targets"
  ON public.whatsapp_campaign_targets
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

INSERT INTO public.profile_permissions (role, module, can_view, can_edit)
VALUES
  ('admin', 'whatsapp', true, true),
  ('observer', 'whatsapp', false, false)
ON CONFLICT (role, module) DO UPDATE
SET
  can_view = EXCLUDED.can_view,
  can_edit = EXCLUDED.can_edit,
  updated_at = now();

DO $$
DECLARE
  function_url text;
  service_role_key text;
  has_label boolean := false;
  has_value boolean := false;
  has_config_key boolean := false;
  has_config_value boolean := false;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RAISE NOTICE 'cron.job table not found, skipping WhatsApp campaign scheduler setup.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'net'
      AND p.proname = 'http_post'
  ) THEN
    RAISE NOTICE 'net.http_post not available, skipping WhatsApp campaign scheduler setup.';
    RETURN;
  END IF;

  BEGIN
    function_url := current_setting('app.settings.supabase_url', true);
  EXCEPTION WHEN OTHERS THEN
    function_url := NULL;
  END;

  BEGIN
    service_role_key := current_setting('app.settings.supabase_service_role_key', true);
  EXCEPTION WHEN OTHERS THEN
    service_role_key := NULL;
  END;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'system_configurations'
      AND column_name = 'label'
  ) INTO has_label;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'system_configurations'
      AND column_name = 'value'
  ) INTO has_value;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'system_configurations'
      AND column_name = 'config_key'
  ) INTO has_config_key;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'system_configurations'
      AND column_name = 'config_value'
  ) INTO has_config_value;

  IF function_url IS NULL AND has_label AND has_value THEN
    SELECT value INTO function_url
    FROM public.system_configurations
    WHERE label = 'supabase_url'
    LIMIT 1;
  END IF;

  IF service_role_key IS NULL AND has_label AND has_value THEN
    SELECT value INTO service_role_key
    FROM public.system_configurations
    WHERE label = 'supabase_service_role_key'
    LIMIT 1;
  END IF;

  IF function_url IS NULL AND has_config_key AND has_config_value THEN
    EXECUTE $sql$
      SELECT config_value
      FROM public.system_configurations
      WHERE config_key = 'supabase_url'
      LIMIT 1
    $sql$ INTO function_url;
  END IF;

  IF service_role_key IS NULL AND has_config_key AND has_config_value THEN
    EXECUTE $sql$
      SELECT config_value
      FROM public.system_configurations
      WHERE config_key = 'supabase_service_role_key'
      LIMIT 1
    $sql$ INTO service_role_key;
  END IF;

  IF function_url IS NULL OR service_role_key IS NULL THEN
    RAISE NOTICE 'WhatsApp campaign scheduler not configured (missing supabase_url or service role key).';
    RETURN;
  END IF;

  function_url := rtrim(function_url, '/') || '/functions/v1/whatsapp-broadcast';

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-whatsapp-broadcast-campaigns') THEN
    PERFORM cron.unschedule('process-whatsapp-broadcast-campaigns');
  END IF;

  PERFORM cron.schedule(
    'process-whatsapp-broadcast-campaigns',
    '* * * * *',
    format(
      'SELECT net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'', ''application/json'', ''Authorization'', %L), body := jsonb_build_object(''action'', ''process'', ''source'', ''cron''));',
      function_url,
      'Bearer ' || service_role_key
    )
  );
END $$;
