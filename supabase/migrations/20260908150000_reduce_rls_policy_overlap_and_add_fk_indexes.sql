/*
  # Reduce overlapping RLS policies and add missing FK indexes

  ## What this migration does
  - Consolidates permissive SELECT policies that were causing
    `multiple_permissive_policies` warnings
  - Splits admin `FOR ALL` policies into write-only policies where reads are
    already covered by a dedicated authenticated SELECT policy
  - Adds the foreign key indexes reported by the linter

  ## Notes
  - `unused_index` findings were intentionally not changed here because index
    removal should be based on production query history, not a single snapshot.
*/

DROP POLICY IF EXISTS "Anyone can view published blog posts"
  ON public.blog_posts;
DROP POLICY IF EXISTS "Admins can view all blog posts"
  ON public.blog_posts;
CREATE POLICY "Read blog posts"
  ON public.blog_posts
  FOR SELECT
  USING (
    published = true
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Only admins manage lead tipos contratacao"
  ON public.lead_tipos_contratacao;
CREATE POLICY "Only admins insert lead tipos contratacao"
  ON public.lead_tipos_contratacao
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'admin'
    )
  );
CREATE POLICY "Only admins update lead tipos contratacao"
  ON public.lead_tipos_contratacao
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'admin'
    )
  );
CREATE POLICY "Only admins delete lead tipos contratacao"
  ON public.lead_tipos_contratacao
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Only admins manage lead responsaveis"
  ON public.lead_responsaveis;
CREATE POLICY "Only admins insert lead responsaveis"
  ON public.lead_responsaveis
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'admin'
    )
  );
CREATE POLICY "Only admins update lead responsaveis"
  ON public.lead_responsaveis
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'admin'
    )
  );
CREATE POLICY "Only admins delete lead responsaveis"
  ON public.lead_responsaveis
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Only admins manage contract status"
  ON public.contract_status_config;
CREATE POLICY "Only admins insert contract status"
  ON public.contract_status_config
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'admin'
    )
  );
CREATE POLICY "Only admins update contract status"
  ON public.contract_status_config
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'admin'
    )
  );
CREATE POLICY "Only admins delete contract status"
  ON public.contract_status_config
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Only admins manage contract modalidades"
  ON public.contract_modalidades;
CREATE POLICY "Only admins insert contract modalidades"
  ON public.contract_modalidades
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'admin'
    )
  );
CREATE POLICY "Only admins update contract modalidades"
  ON public.contract_modalidades
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'admin'
    )
  );
CREATE POLICY "Only admins delete contract modalidades"
  ON public.contract_modalidades
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Only admins manage contract abrangencias"
  ON public.contract_abrangencias;
CREATE POLICY "Only admins insert contract abrangencias"
  ON public.contract_abrangencias
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'admin'
    )
  );
CREATE POLICY "Only admins update contract abrangencias"
  ON public.contract_abrangencias
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'admin'
    )
  );
CREATE POLICY "Only admins delete contract abrangencias"
  ON public.contract_abrangencias
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Only admins manage contract acomodacoes"
  ON public.contract_acomodacoes;
CREATE POLICY "Only admins insert contract acomodacoes"
  ON public.contract_acomodacoes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'admin'
    )
  );
CREATE POLICY "Only admins update contract acomodacoes"
  ON public.contract_acomodacoes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'admin'
    )
  );
CREATE POLICY "Only admins delete contract acomodacoes"
  ON public.contract_acomodacoes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Only admins manage contract carencias"
  ON public.contract_carencias;
CREATE POLICY "Only admins insert contract carencias"
  ON public.contract_carencias
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'admin'
    )
  );
CREATE POLICY "Only admins update contract carencias"
  ON public.contract_carencias
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'admin'
    )
  );
CREATE POLICY "Only admins delete contract carencias"
  ON public.contract_carencias
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Only admins can manage profile permissions"
  ON public.profile_permissions;
CREATE POLICY "Only admins insert profile permissions"
  ON public.profile_permissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'admin'
    )
  );
CREATE POLICY "Only admins update profile permissions"
  ON public.profile_permissions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'admin'
    )
  );
CREATE POLICY "Only admins delete profile permissions"
  ON public.profile_permissions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Allow authenticated users to view configurations"
  ON public.system_configurations;
DROP POLICY IF EXISTS "Only admins manage system configurations"
  ON public.system_configurations;
CREATE POLICY "Only admins insert system configurations"
  ON public.system_configurations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'admin'
    )
  );
CREATE POLICY "Only admins update system configurations"
  ON public.system_configurations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'admin'
    )
  );
CREATE POLICY "Only admins delete system configurations"
  ON public.system_configurations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can view own profile"
  ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile"
  ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can update any profile"
  ON public.user_profiles;
CREATE POLICY "Users can update own profile or admins can update any profile"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    (select auth.uid()) = id
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = (select auth.uid())
        AND up.role = 'admin'
    )
  )
  WITH CHECK (
    (select auth.uid()) = id
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = (select auth.uid())
        AND up.role = 'admin'
    )
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'blog_posts'
      AND column_name = 'author_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_blog_posts_author_id ON public.blog_posts (author_id)';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'contract_holders'
      AND column_name = 'contract_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_contract_holders_contract_id ON public.contract_holders (contract_id)';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'origem'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_leads_origem ON public.leads (origem)';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'tipo_contratacao'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_leads_tipo_contratacao ON public.leads (tipo_contratacao)';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'status'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads (status)';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'responsavel'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_leads_responsavel ON public.leads (responsavel)';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'whatsapp_campaign_targets'
      AND column_name = 'lead_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_whatsapp_campaign_targets_lead_id ON public.whatsapp_campaign_targets (lead_id)';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'whatsapp_campaigns'
      AND column_name = 'created_by'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_whatsapp_campaigns_created_by ON public.whatsapp_campaigns (created_by)';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'whatsapp_quick_replies'
      AND column_name = 'created_by'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_whatsapp_quick_replies_created_by ON public.whatsapp_quick_replies (created_by)';
  END IF;
END $$;

DO $$
DECLARE
  fk record;
  column_list text;
  index_name text;
BEGIN
  FOR fk IN
    SELECT
      c.conname,
      ns.nspname AS schema_name,
      tbl.relname AS table_name,
      c.conkey,
      c.conrelid
    FROM pg_constraint c
    JOIN pg_class tbl
      ON tbl.oid = c.conrelid
    JOIN pg_namespace ns
      ON ns.oid = tbl.relnamespace
    WHERE c.contype = 'f'
      AND ns.nspname = 'public'
      AND (
        (tbl.relname = 'leads' AND c.conname IN (
          'fk_leads_origem',
          'fk_leads_tipo_contratacao',
          'fk_leads_status',
          'fk_leads_responsavel'
        ))
        OR (tbl.relname = 'blog_posts' AND c.conname = 'blog_posts_author_id_fkey')
        OR (tbl.relname = 'contract_holders' AND c.conname = 'contract_holders_contract_id_fkey')
        OR (tbl.relname = 'whatsapp_campaign_targets' AND c.conname = 'whatsapp_campaign_targets_lead_id_fkey')
        OR (tbl.relname = 'whatsapp_campaigns' AND c.conname = 'whatsapp_campaigns_created_by_fkey')
        OR (tbl.relname = 'whatsapp_quick_replies' AND c.conname = 'whatsapp_quick_replies_created_by_fkey')
      )
  LOOP
    SELECT string_agg(format('%I', a.attname), ', ' ORDER BY ord.pos)
    INTO column_list
    FROM unnest(fk.conkey) WITH ORDINALITY AS ord(attnum, pos)
    JOIN pg_attribute a
      ON a.attrelid = fk.conrelid
     AND a.attnum = ord.attnum;

    IF column_list IS NULL OR column_list = '' THEN
      CONTINUE;
    END IF;

    index_name := left('idx_' || fk.table_name || '_' || fk.conname, 63);

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I.%I (%s)',
      index_name,
      fk.schema_name,
      fk.table_name,
      column_list
    );
  END LOOP;
END $$;
