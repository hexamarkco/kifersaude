/*
  # RLS Performance: Cache permission checks per-transaction

  Refactors the 2 core permission functions to use PL/pgSQL with
  transaction-level caching via set_config/current_setting. This
  eliminates per-row query execution in RLS policy evaluation.

  Also normalizes current_user_can_edit_whatsapp() to use the standard
  access-profile delegation pattern.

  See AGENTS.md 2026-05-25 entry for rationale.
*/

BEGIN;


-- ==========================================================
-- STEP 1: Cache-aware core helper functions
-- ==========================================================

CREATE OR REPLACE FUNCTION public.current_user_access_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  _cached text;
  _result text;
BEGIN
  _cached := current_setting('app.rls_user_role', true);
  IF _cached IS NOT NULL THEN
    RETURN NULLIF(_cached, '');
  END IF;
  SELECT role INTO _result
  FROM public.user_profiles
  WHERE id = auth.uid()
  LIMIT 1;
  PERFORM set_config('app.rls_user_role', COALESCE(_result, ''), true);
  RETURN _result;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_access_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  _cached text;
  _result boolean;
BEGIN
  _cached := current_setting('app.rls_is_admin', true);
  IF _cached IS NOT NULL THEN
    RETURN _cached = 'true';
  END IF;
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    JOIN public.access_profiles ap ON ap.slug = up.role
    WHERE up.id = auth.uid()
      AND ap.is_admin = true
  ) INTO _result;
  PERFORM set_config('app.rls_is_admin', _result::text, true);
  RETURN _result;
END;
$$;


-- ==========================================================
-- STEP 2: Normalize current_user_can_edit_whatsapp()
--   Uses the standard delegation pattern instead of
--   hardcoded role='admin' with LEFT JOIN + COALESCE.
-- ==========================================================

CREATE OR REPLACE FUNCTION public.current_user_can_edit_whatsapp()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT (
    public.current_user_is_access_admin()
    OR EXISTS (
      SELECT 1
      FROM public.profile_permissions pp
      WHERE pp.role = public.current_user_access_role()
        AND pp.module = 'whatsapp'
        AND pp.can_edit = true
    )
  );
$$;


-- ==========================================================
-- STEP 3: Replace inline admin subqueries with function calls
--   in hot-path tables. Each policy previously had:
--     EXISTS (SELECT 1 FROM user_profiles WHERE role = 'admin')
--   Now delegates to the cached current_user_is_access_admin().
--
--   Uses DO blocks with to_regclass checks to safely skip
--   tables that were removed by later migrations.
-- ==========================================================


-- ---------- whatsapp_chats ----------
DO $$ BEGIN
  IF to_regclass('public.whatsapp_chats') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Admins can read WhatsApp chats" ON public.whatsapp_chats;
    CREATE POLICY "Admins can read WhatsApp chats"
      ON public.whatsapp_chats FOR SELECT TO authenticated
      USING (public.current_user_is_access_admin());

    DROP POLICY IF EXISTS "Admins can insert WhatsApp chats" ON public.whatsapp_chats;
    CREATE POLICY "Admins can insert WhatsApp chats"
      ON public.whatsapp_chats FOR INSERT TO authenticated
      WITH CHECK (public.current_user_is_access_admin());

    DROP POLICY IF EXISTS "Admins can update WhatsApp chats" ON public.whatsapp_chats;
    CREATE POLICY "Admins can update WhatsApp chats"
      ON public.whatsapp_chats FOR UPDATE TO authenticated
      USING (public.current_user_is_access_admin())
      WITH CHECK (public.current_user_is_access_admin());
  END IF;
END $$;

-- ---------- whatsapp_messages ----------
DO $$ BEGIN
  IF to_regclass('public.whatsapp_messages') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Admins can read WhatsApp messages" ON public.whatsapp_messages;
    CREATE POLICY "Admins can read WhatsApp messages"
      ON public.whatsapp_messages FOR SELECT TO authenticated
      USING (public.current_user_is_access_admin());

    DROP POLICY IF EXISTS "Admins can insert WhatsApp messages" ON public.whatsapp_messages;
    CREATE POLICY "Admins can insert WhatsApp messages"
      ON public.whatsapp_messages FOR INSERT TO authenticated
      WITH CHECK (public.current_user_is_access_admin());

    DROP POLICY IF EXISTS "Admins can update WhatsApp messages" ON public.whatsapp_messages;
    CREATE POLICY "Admins can update WhatsApp messages"
      ON public.whatsapp_messages FOR UPDATE TO authenticated
      USING (public.current_user_is_access_admin())
      WITH CHECK (public.current_user_is_access_admin());
  END IF;
END $$;

-- ---------- whatsapp_webhook_events ----------
DO $$ BEGIN
  IF to_regclass('public.whatsapp_webhook_events') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Admins can read WhatsApp webhook events" ON public.whatsapp_webhook_events;
    CREATE POLICY "Admins can read WhatsApp webhook events"
      ON public.whatsapp_webhook_events FOR SELECT TO authenticated
      USING (public.current_user_is_access_admin());
  END IF;
END $$;

-- ---------- whatsapp_campaigns ----------
DO $$ BEGIN
  IF to_regclass('public.whatsapp_campaigns') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Admins can read WhatsApp campaigns" ON public.whatsapp_campaigns;
    DROP POLICY IF EXISTS "Admins can insert WhatsApp campaigns" ON public.whatsapp_campaigns;
    DROP POLICY IF EXISTS "Admins can update WhatsApp campaigns" ON public.whatsapp_campaigns;
    DROP POLICY IF EXISTS "Admins can delete WhatsApp campaigns" ON public.whatsapp_campaigns;
  END IF;
END $$;

-- ---------- whatsapp_campaign_targets ----------
DO $$ BEGIN
  IF to_regclass('public.whatsapp_campaign_targets') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Admins can read WhatsApp campaign targets" ON public.whatsapp_campaign_targets;
    DROP POLICY IF EXISTS "Admins can insert WhatsApp campaign targets" ON public.whatsapp_campaign_targets;
    DROP POLICY IF EXISTS "Admins can update WhatsApp campaign targets" ON public.whatsapp_campaign_targets;
    DROP POLICY IF EXISTS "Admins can delete WhatsApp campaign targets" ON public.whatsapp_campaign_targets;
  END IF;
END $$;

-- ---------- whatsapp_campaign_import_jobs ----------
DO $$ BEGIN
  IF to_regclass('public.whatsapp_campaign_import_jobs') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Admins can read WhatsApp campaign import jobs" ON public.whatsapp_campaign_import_jobs;
    CREATE POLICY "Admins can read WhatsApp campaign import jobs"
      ON public.whatsapp_campaign_import_jobs FOR SELECT TO authenticated
      USING (public.current_user_is_access_admin());

    DROP POLICY IF EXISTS "Admins can insert WhatsApp campaign import jobs" ON public.whatsapp_campaign_import_jobs;
    CREATE POLICY "Admins can insert WhatsApp campaign import jobs"
      ON public.whatsapp_campaign_import_jobs FOR INSERT TO authenticated
      WITH CHECK (public.current_user_is_access_admin());

    DROP POLICY IF EXISTS "Admins can update WhatsApp campaign import jobs" ON public.whatsapp_campaign_import_jobs;
    CREATE POLICY "Admins can update WhatsApp campaign import jobs"
      ON public.whatsapp_campaign_import_jobs FOR UPDATE TO authenticated
      USING (public.current_user_is_access_admin())
      WITH CHECK (public.current_user_is_access_admin());

    DROP POLICY IF EXISTS "Admins can delete WhatsApp campaign import jobs" ON public.whatsapp_campaign_import_jobs;
    CREATE POLICY "Admins can delete WhatsApp campaign import jobs"
      ON public.whatsapp_campaign_import_jobs FOR DELETE TO authenticated
      USING (public.current_user_is_access_admin());
  END IF;
END $$;

-- ---------- storage.objects buckets ----------
-- storage.objects always exists; bucket-specific policies are safe to create
DROP POLICY IF EXISTS "Admins can view WhatsApp campaign imports" ON storage.objects;
CREATE POLICY "Admins can view WhatsApp campaign imports"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'whatsapp-campaign-imports'
    AND public.current_user_is_access_admin()
  );

DROP POLICY IF EXISTS "Admins can upload WhatsApp campaign imports" ON storage.objects;
CREATE POLICY "Admins can upload WhatsApp campaign imports"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'whatsapp-campaign-imports'
    AND public.current_user_is_access_admin()
  );

DROP POLICY IF EXISTS "Admins can update WhatsApp campaign imports" ON storage.objects;
CREATE POLICY "Admins can update WhatsApp campaign imports"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'whatsapp-campaign-imports'
    AND public.current_user_is_access_admin()
  );

DROP POLICY IF EXISTS "Admins can delete WhatsApp campaign imports" ON storage.objects;
CREATE POLICY "Admins can delete WhatsApp campaign imports"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'whatsapp-campaign-imports'
    AND public.current_user_is_access_admin()
  );

DROP POLICY IF EXISTS "Admins can view WhatsApp webhook archive" ON storage.objects;
CREATE POLICY "Admins can view WhatsApp webhook archive"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'whatsapp-webhook-archive'
    AND public.current_user_is_access_admin()
  );

DROP POLICY IF EXISTS "Admins can upload WhatsApp campaign media" ON storage.objects;
CREATE POLICY "Admins can upload WhatsApp campaign media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'whatsapp-campaign-media'
    AND public.current_user_is_access_admin()
  );

DROP POLICY IF EXISTS "Admins can update WhatsApp campaign media" ON storage.objects;
CREATE POLICY "Admins can update WhatsApp campaign media"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'whatsapp-campaign-media'
    AND public.current_user_is_access_admin()
  );

DROP POLICY IF EXISTS "Admins can delete WhatsApp campaign media" ON storage.objects;
CREATE POLICY "Admins can delete WhatsApp campaign media"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'whatsapp-campaign-media'
    AND public.current_user_is_access_admin()
  );


-- ---------- blog_posts ----------
DO $$ BEGIN
  IF to_regclass('public.blog_posts') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Admins can view all blog posts" ON public.blog_posts;
    DROP POLICY IF EXISTS "Read blog posts" ON public.blog_posts;
    CREATE POLICY "Read blog posts"
      ON public.blog_posts FOR SELECT
      USING (
        published = true
        OR public.current_user_is_access_admin()
      );

    DROP POLICY IF EXISTS "Admins can insert blog posts" ON public.blog_posts;
    CREATE POLICY "Admins can insert blog posts"
      ON public.blog_posts FOR INSERT TO authenticated
      WITH CHECK (public.current_user_is_access_admin());

    DROP POLICY IF EXISTS "Admins can update blog posts" ON public.blog_posts;
    CREATE POLICY "Admins can update blog posts"
      ON public.blog_posts FOR UPDATE TO authenticated
      USING (public.current_user_is_access_admin())
      WITH CHECK (public.current_user_is_access_admin());

    DROP POLICY IF EXISTS "Admins can delete blog posts" ON public.blog_posts;
    CREATE POLICY "Admins can delete blog posts"
      ON public.blog_posts FOR DELETE TO authenticated
      USING (public.current_user_is_access_admin());
  END IF;
END $$;

-- ---------- operadoras ----------
DO $$ BEGIN
  IF to_regclass('public.operadoras') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Only admins can insert operadoras" ON public.operadoras;
    CREATE POLICY "Only admins can insert operadoras"
      ON public.operadoras FOR INSERT TO authenticated
      WITH CHECK (public.current_user_is_access_admin());

    DROP POLICY IF EXISTS "Only admins can update operadoras" ON public.operadoras;
    CREATE POLICY "Only admins can update operadoras"
      ON public.operadoras FOR UPDATE TO authenticated
      USING (public.current_user_is_access_admin())
      WITH CHECK (public.current_user_is_access_admin());

    DROP POLICY IF EXISTS "Only admins can delete operadoras" ON public.operadoras;
    CREATE POLICY "Only admins can delete operadoras"
      ON public.operadoras FOR DELETE TO authenticated
      USING (public.current_user_is_access_admin());
  END IF;
END $$;

-- ---------- produtos_planos ----------
DO $$ BEGIN
  IF to_regclass('public.produtos_planos') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Only admins can insert produtos" ON public.produtos_planos;
    CREATE POLICY "Only admins can insert produtos"
      ON public.produtos_planos FOR INSERT TO authenticated
      WITH CHECK (public.current_user_is_access_admin());

    DROP POLICY IF EXISTS "Only admins can update produtos" ON public.produtos_planos;
    CREATE POLICY "Only admins can update produtos"
      ON public.produtos_planos FOR UPDATE TO authenticated
      USING (public.current_user_is_access_admin())
      WITH CHECK (public.current_user_is_access_admin());

    DROP POLICY IF EXISTS "Only admins can delete produtos" ON public.produtos_planos;
    CREATE POLICY "Only admins can delete produtos"
      ON public.produtos_planos FOR DELETE TO authenticated
      USING (public.current_user_is_access_admin());
  END IF;
END $$;

-- ---------- lead_status_config ----------
DO $$ BEGIN
  IF to_regclass('public.lead_status_config') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Only admins can insert status config" ON public.lead_status_config;
    CREATE POLICY "Only admins can insert status config"
      ON public.lead_status_config FOR INSERT TO authenticated
      WITH CHECK (public.current_user_is_access_admin());

    DROP POLICY IF EXISTS "Only admins can update status config" ON public.lead_status_config;
    CREATE POLICY "Only admins can update status config"
      ON public.lead_status_config FOR UPDATE TO authenticated
      USING (public.current_user_is_access_admin())
      WITH CHECK (public.current_user_is_access_admin());

    DROP POLICY IF EXISTS "Only admins can delete status config" ON public.lead_status_config;
    CREATE POLICY "Only admins can delete status config"
      ON public.lead_status_config FOR DELETE TO authenticated
      USING (public.current_user_is_access_admin());
  END IF;
END $$;

-- ---------- lead_origens ----------
DO $$ BEGIN
  IF to_regclass('public.lead_origens') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Only admins can insert origens" ON public.lead_origens;
    CREATE POLICY "Only admins can insert origens"
      ON public.lead_origens FOR INSERT TO authenticated
      WITH CHECK (public.current_user_is_access_admin());

    DROP POLICY IF EXISTS "Only admins can update origens" ON public.lead_origens;
    CREATE POLICY "Only admins can update origens"
      ON public.lead_origens FOR UPDATE TO authenticated
      USING (public.current_user_is_access_admin())
      WITH CHECK (public.current_user_is_access_admin());

    DROP POLICY IF EXISTS "Only admins can delete origens" ON public.lead_origens;
    CREATE POLICY "Only admins can delete origens"
      ON public.lead_origens FOR DELETE TO authenticated
      USING (public.current_user_is_access_admin());
  END IF;
END $$;

-- ---------- system_settings ----------
DO $$ BEGIN
  IF to_regclass('public.system_settings') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Only admins can update system settings" ON public.system_settings;
    CREATE POLICY "Only admins can update system settings"
      ON public.system_settings FOR UPDATE TO authenticated
      USING (public.current_user_is_access_admin())
      WITH CHECK (public.current_user_is_access_admin());
  END IF;
END $$;

-- ---------- integration_settings ----------
DO $$ BEGIN
  IF to_regclass('public.integration_settings') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Only admins can manage integration settings" ON public.integration_settings;
    CREATE POLICY "Only admins can manage integration settings"
      ON public.integration_settings FOR ALL TO authenticated
      USING (public.current_user_is_access_admin())
      WITH CHECK (public.current_user_is_access_admin());
  END IF;
END $$;

-- ---------- lead_processing_cursor ----------
DO $$ BEGIN
  IF to_regclass('public.lead_processing_cursor') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Admin users can view cursor" ON public.lead_processing_cursor;
    CREATE POLICY "Admin users can view cursor"
      ON public.lead_processing_cursor FOR SELECT TO authenticated
      USING (public.current_user_is_access_admin());

    DROP POLICY IF EXISTS "Admin users can update cursor" ON public.lead_processing_cursor;
    CREATE POLICY "Admin users can update cursor"
      ON public.lead_processing_cursor FOR UPDATE TO authenticated
      USING (public.current_user_is_access_admin())
      WITH CHECK (public.current_user_is_access_admin());
  END IF;
END $$;

-- ---------- lead_tipos_contratacao ----------
DO $$ BEGIN
  IF to_regclass('public.lead_tipos_contratacao') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Only admins insert lead tipos contratacao" ON public.lead_tipos_contratacao;
    DROP POLICY IF EXISTS "Only admins update lead tipos contratacao" ON public.lead_tipos_contratacao;
    DROP POLICY IF EXISTS "Only admins delete lead tipos contratacao" ON public.lead_tipos_contratacao;
    DROP POLICY IF EXISTS "Only admins manage lead tipos contratacao" ON public.lead_tipos_contratacao;
    CREATE POLICY "Only admins insert lead tipos contratacao"
      ON public.lead_tipos_contratacao FOR INSERT TO authenticated
      WITH CHECK (public.current_user_is_access_admin());
    CREATE POLICY "Only admins update lead tipos contratacao"
      ON public.lead_tipos_contratacao FOR UPDATE TO authenticated
      USING (public.current_user_is_access_admin())
      WITH CHECK (public.current_user_is_access_admin());
    CREATE POLICY "Only admins delete lead tipos contratacao"
      ON public.lead_tipos_contratacao FOR DELETE TO authenticated
      USING (public.current_user_is_access_admin());
  END IF;
END $$;

-- ---------- lead_responsaveis ----------
DO $$ BEGIN
  IF to_regclass('public.lead_responsaveis') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Only admins insert lead responsaveis" ON public.lead_responsaveis;
    DROP POLICY IF EXISTS "Only admins update lead responsaveis" ON public.lead_responsaveis;
    DROP POLICY IF EXISTS "Only admins delete lead responsaveis" ON public.lead_responsaveis;
    DROP POLICY IF EXISTS "Only admins manage lead responsaveis" ON public.lead_responsaveis;
    CREATE POLICY "Only admins insert lead responsaveis"
      ON public.lead_responsaveis FOR INSERT TO authenticated
      WITH CHECK (public.current_user_is_access_admin());
    CREATE POLICY "Only admins update lead responsaveis"
      ON public.lead_responsaveis FOR UPDATE TO authenticated
      USING (public.current_user_is_access_admin())
      WITH CHECK (public.current_user_is_access_admin());
    CREATE POLICY "Only admins delete lead responsaveis"
      ON public.lead_responsaveis FOR DELETE TO authenticated
      USING (public.current_user_is_access_admin());
  END IF;
END $$;

-- ---------- contract_status_config ----------
DO $$ BEGIN
  IF to_regclass('public.contract_status_config') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Only admins insert contract status" ON public.contract_status_config;
    DROP POLICY IF EXISTS "Only admins update contract status" ON public.contract_status_config;
    DROP POLICY IF EXISTS "Only admins delete contract status" ON public.contract_status_config;
    DROP POLICY IF EXISTS "Only admins manage contract status" ON public.contract_status_config;
    CREATE POLICY "Only admins insert contract status"
      ON public.contract_status_config FOR INSERT TO authenticated
      WITH CHECK (public.current_user_is_access_admin());
    CREATE POLICY "Only admins update contract status"
      ON public.contract_status_config FOR UPDATE TO authenticated
      USING (public.current_user_is_access_admin())
      WITH CHECK (public.current_user_is_access_admin());
    CREATE POLICY "Only admins delete contract status"
      ON public.contract_status_config FOR DELETE TO authenticated
      USING (public.current_user_is_access_admin());
  END IF;
END $$;

-- ---------- contract_modalidades ----------
DO $$ BEGIN
  IF to_regclass('public.contract_modalidades') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Only admins insert contract modalidades" ON public.contract_modalidades;
    DROP POLICY IF EXISTS "Only admins update contract modalidades" ON public.contract_modalidades;
    DROP POLICY IF EXISTS "Only admins delete contract modalidades" ON public.contract_modalidades;
    DROP POLICY IF EXISTS "Only admins manage contract modalidades" ON public.contract_modalidades;
    CREATE POLICY "Only admins insert contract modalidades"
      ON public.contract_modalidades FOR INSERT TO authenticated
      WITH CHECK (public.current_user_is_access_admin());
    CREATE POLICY "Only admins update contract modalidades"
      ON public.contract_modalidades FOR UPDATE TO authenticated
      USING (public.current_user_is_access_admin())
      WITH CHECK (public.current_user_is_access_admin());
    CREATE POLICY "Only admins delete contract modalidades"
      ON public.contract_modalidades FOR DELETE TO authenticated
      USING (public.current_user_is_access_admin());
  END IF;
END $$;

-- ---------- contract_abrangencias ----------
DO $$ BEGIN
  IF to_regclass('public.contract_abrangencias') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Only admins insert contract abrangencias" ON public.contract_abrangencias;
    DROP POLICY IF EXISTS "Only admins update contract abrangencias" ON public.contract_abrangencias;
    DROP POLICY IF EXISTS "Only admins delete contract abrangencias" ON public.contract_abrangencias;
    DROP POLICY IF EXISTS "Only admins manage contract abrangencias" ON public.contract_abrangencias;
    CREATE POLICY "Only admins insert contract abrangencias"
      ON public.contract_abrangencias FOR INSERT TO authenticated
      WITH CHECK (public.current_user_is_access_admin());
    CREATE POLICY "Only admins update contract abrangencias"
      ON public.contract_abrangencias FOR UPDATE TO authenticated
      USING (public.current_user_is_access_admin())
      WITH CHECK (public.current_user_is_access_admin());
    CREATE POLICY "Only admins delete contract abrangencias"
      ON public.contract_abrangencias FOR DELETE TO authenticated
      USING (public.current_user_is_access_admin());
  END IF;
END $$;

-- ---------- contract_acomodacoes ----------
DO $$ BEGIN
  IF to_regclass('public.contract_acomodacoes') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Only admins insert contract acomodacoes" ON public.contract_acomodacoes;
    DROP POLICY IF EXISTS "Only admins update contract acomodacoes" ON public.contract_acomodacoes;
    DROP POLICY IF EXISTS "Only admins delete contract acomodacoes" ON public.contract_acomodacoes;
    DROP POLICY IF EXISTS "Only admins manage contract acomodacoes" ON public.contract_acomodacoes;
    CREATE POLICY "Only admins insert contract acomodacoes"
      ON public.contract_acomodacoes FOR INSERT TO authenticated
      WITH CHECK (public.current_user_is_access_admin());
    CREATE POLICY "Only admins update contract acomodacoes"
      ON public.contract_acomodacoes FOR UPDATE TO authenticated
      USING (public.current_user_is_access_admin())
      WITH CHECK (public.current_user_is_access_admin());
    CREATE POLICY "Only admins delete contract acomodacoes"
      ON public.contract_acomodacoes FOR DELETE TO authenticated
      USING (public.current_user_is_access_admin());
  END IF;
END $$;

-- ---------- contract_carencias ----------
DO $$ BEGIN
  IF to_regclass('public.contract_carencias') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Only admins insert contract carencias" ON public.contract_carencias;
    DROP POLICY IF EXISTS "Only admins update contract carencias" ON public.contract_carencias;
    DROP POLICY IF EXISTS "Only admins delete contract carencias" ON public.contract_carencias;
    DROP POLICY IF EXISTS "Only admins manage contract carencias" ON public.contract_carencias;
    CREATE POLICY "Only admins insert contract carencias"
      ON public.contract_carencias FOR INSERT TO authenticated
      WITH CHECK (public.current_user_is_access_admin());
    CREATE POLICY "Only admins update contract carencias"
      ON public.contract_carencias FOR UPDATE TO authenticated
      USING (public.current_user_is_access_admin())
      WITH CHECK (public.current_user_is_access_admin());
    CREATE POLICY "Only admins delete contract carencias"
      ON public.contract_carencias FOR DELETE TO authenticated
      USING (public.current_user_is_access_admin());
  END IF;
END $$;

-- ---------- profile_permissions ----------
DO $$ BEGIN
  IF to_regclass('public.profile_permissions') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Only admins insert profile permissions" ON public.profile_permissions;
    DROP POLICY IF EXISTS "Only admins update profile permissions" ON public.profile_permissions;
    DROP POLICY IF EXISTS "Only admins delete profile permissions" ON public.profile_permissions;
    DROP POLICY IF EXISTS "Only admins can manage profile permissions" ON public.profile_permissions;
    CREATE POLICY "Only admins insert profile permissions"
      ON public.profile_permissions FOR INSERT TO authenticated
      WITH CHECK (public.current_user_is_access_admin());
    CREATE POLICY "Only admins update profile permissions"
      ON public.profile_permissions FOR UPDATE TO authenticated
      USING (public.current_user_is_access_admin())
      WITH CHECK (public.current_user_is_access_admin());
    CREATE POLICY "Only admins delete profile permissions"
      ON public.profile_permissions FOR DELETE TO authenticated
      USING (public.current_user_is_access_admin());
  END IF;
END $$;

-- ---------- system_configurations ----------
DO $$ BEGIN
  IF to_regclass('public.system_configurations') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Only admins insert system configurations" ON public.system_configurations;
    DROP POLICY IF EXISTS "Only admins update system configurations" ON public.system_configurations;
    DROP POLICY IF EXISTS "Only admins delete system configurations" ON public.system_configurations;
    DROP POLICY IF EXISTS "Only admins manage system configurations" ON public.system_configurations;
    CREATE POLICY "Only admins insert system configurations"
      ON public.system_configurations FOR INSERT TO authenticated
      WITH CHECK (public.current_user_is_access_admin());
    CREATE POLICY "Only admins update system configurations"
      ON public.system_configurations FOR UPDATE TO authenticated
      USING (public.current_user_is_access_admin())
      WITH CHECK (public.current_user_is_access_admin());
    CREATE POLICY "Only admins delete system configurations"
      ON public.system_configurations FOR DELETE TO authenticated
      USING (public.current_user_is_access_admin());
  END IF;
END $$;

-- ---------- user_profiles ----------
DO $$ BEGIN
  IF to_regclass('public.user_profiles') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can update own profile or admins can update any profile"
      ON public.user_profiles;
    CREATE POLICY "Users can update own profile or admins can update any profile"
      ON public.user_profiles FOR UPDATE TO authenticated
      USING ((select auth.uid()) = id OR public.current_user_is_access_admin())
      WITH CHECK ((select auth.uid()) = id OR public.current_user_is_access_admin());
  END IF;
END $$;


-- ==========================================================
-- STEP 4: Complementary indexes for index-only scans
-- ==========================================================

CREATE INDEX IF NOT EXISTS idx_access_profiles_slug_admin
  ON public.access_profiles(slug, is_admin);

CREATE INDEX IF NOT EXISTS idx_profile_permissions_role_module_edit_view
  ON public.profile_permissions(role, module, can_edit, can_view);


COMMIT;
