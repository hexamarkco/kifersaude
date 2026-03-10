/*
  # Fix Supabase security and performance lints

  ## What this migration does
  - Enables RLS for `auto_contact_flow_executions`
  - Recreates flagged RLS policies with `(select auth.uid())`
  - Fixes mutable `search_path` on flagged public functions

  ## Notes
  - `multiple_permissive_policies` warnings were left unchanged because they
    document intentional OR-style access patterns in existing policies.
  - Dashboard-only findings such as compromised password protection and
    relocating `pg_net` are operational settings, not repo-managed SQL.
*/

ALTER TABLE public.auto_contact_flow_executions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage auto contact flow executions"
  ON public.auto_contact_flow_executions;
CREATE POLICY "Service role can manage auto contact flow executions"
  ON public.auto_contact_flow_executions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can view whatsapp contact photos"
  ON public.whatsapp_contact_photos;
CREATE POLICY "Authenticated users can view whatsapp contact photos"
  ON public.whatsapp_contact_photos
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Admins can read WhatsApp chats"
  ON public.whatsapp_chats;
CREATE POLICY "Admins can read WhatsApp chats"
  ON public.whatsapp_chats
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can insert WhatsApp chats"
  ON public.whatsapp_chats;
CREATE POLICY "Admins can insert WhatsApp chats"
  ON public.whatsapp_chats
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

DROP POLICY IF EXISTS "Admins can update WhatsApp chats"
  ON public.whatsapp_chats;
CREATE POLICY "Admins can update WhatsApp chats"
  ON public.whatsapp_chats
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

DROP POLICY IF EXISTS "Admins can read WhatsApp messages"
  ON public.whatsapp_messages;
CREATE POLICY "Admins can read WhatsApp messages"
  ON public.whatsapp_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can insert WhatsApp messages"
  ON public.whatsapp_messages;
CREATE POLICY "Admins can insert WhatsApp messages"
  ON public.whatsapp_messages
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

DROP POLICY IF EXISTS "Admins can update WhatsApp messages"
  ON public.whatsapp_messages;
CREATE POLICY "Admins can update WhatsApp messages"
  ON public.whatsapp_messages
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

DROP POLICY IF EXISTS "Authenticated users can read own whatsapp message reads"
  ON public.whatsapp_message_reads;
CREATE POLICY "Authenticated users can read own whatsapp message reads"
  ON public.whatsapp_message_reads
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Authenticated users can insert own whatsapp message reads"
  ON public.whatsapp_message_reads;
CREATE POLICY "Authenticated users can insert own whatsapp message reads"
  ON public.whatsapp_message_reads
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Authenticated users can update own whatsapp message reads"
  ON public.whatsapp_message_reads;
CREATE POLICY "Authenticated users can update own whatsapp message reads"
  ON public.whatsapp_message_reads
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Admins can view all blog posts"
  ON public.blog_posts;
CREATE POLICY "Admins can view all blog posts"
  ON public.blog_posts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can insert blog posts"
  ON public.blog_posts;
CREATE POLICY "Admins can insert blog posts"
  ON public.blog_posts
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

DROP POLICY IF EXISTS "Admins can update blog posts"
  ON public.blog_posts;
CREATE POLICY "Admins can update blog posts"
  ON public.blog_posts
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

DROP POLICY IF EXISTS "Admins can delete blog posts"
  ON public.blog_posts;
CREATE POLICY "Admins can delete blog posts"
  ON public.blog_posts
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
CREATE POLICY "Only admins can manage profile permissions"
  ON public.profile_permissions
  FOR ALL
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

DROP POLICY IF EXISTS "Only admins can update system settings"
  ON public.system_settings;
CREATE POLICY "Only admins can update system settings"
  ON public.system_settings
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

DROP POLICY IF EXISTS "Only admins can insert operadoras"
  ON public.operadoras;
CREATE POLICY "Only admins can insert operadoras"
  ON public.operadoras
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

DROP POLICY IF EXISTS "Only admins can update operadoras"
  ON public.operadoras;
CREATE POLICY "Only admins can update operadoras"
  ON public.operadoras
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

DROP POLICY IF EXISTS "Only admins can delete operadoras"
  ON public.operadoras;
CREATE POLICY "Only admins can delete operadoras"
  ON public.operadoras
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

DROP POLICY IF EXISTS "Only admins manage lead tipos contratacao"
  ON public.lead_tipos_contratacao;
CREATE POLICY "Only admins manage lead tipos contratacao"
  ON public.lead_tipos_contratacao
  FOR ALL
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

DROP POLICY IF EXISTS "Only admins manage lead responsaveis"
  ON public.lead_responsaveis;
CREATE POLICY "Only admins manage lead responsaveis"
  ON public.lead_responsaveis
  FOR ALL
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

DROP POLICY IF EXISTS "Only admins manage contract status"
  ON public.contract_status_config;
CREATE POLICY "Only admins manage contract status"
  ON public.contract_status_config
  FOR ALL
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

DROP POLICY IF EXISTS "Authenticated users can read whatsapp quick replies"
  ON public.whatsapp_quick_replies;
CREATE POLICY "Authenticated users can read whatsapp quick replies"
  ON public.whatsapp_quick_replies
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert whatsapp quick replies"
  ON public.whatsapp_quick_replies;
CREATE POLICY "Authenticated users can insert whatsapp quick replies"
  ON public.whatsapp_quick_replies
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update whatsapp quick replies"
  ON public.whatsapp_quick_replies;
CREATE POLICY "Authenticated users can update whatsapp quick replies"
  ON public.whatsapp_quick_replies
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete whatsapp quick replies"
  ON public.whatsapp_quick_replies;
CREATE POLICY "Authenticated users can delete whatsapp quick replies"
  ON public.whatsapp_quick_replies
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Only admins can insert produtos"
  ON public.produtos_planos;
CREATE POLICY "Only admins can insert produtos"
  ON public.produtos_planos
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

DROP POLICY IF EXISTS "Only admins can update produtos"
  ON public.produtos_planos;
CREATE POLICY "Only admins can update produtos"
  ON public.produtos_planos
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

DROP POLICY IF EXISTS "Only admins can delete produtos"
  ON public.produtos_planos;
CREATE POLICY "Only admins can delete produtos"
  ON public.produtos_planos
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

DROP POLICY IF EXISTS "Only admins can insert status config"
  ON public.lead_status_config;
CREATE POLICY "Only admins can insert status config"
  ON public.lead_status_config
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

DROP POLICY IF EXISTS "Only admins can update status config"
  ON public.lead_status_config;
CREATE POLICY "Only admins can update status config"
  ON public.lead_status_config
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

DROP POLICY IF EXISTS "Only admins can delete status config"
  ON public.lead_status_config;
CREATE POLICY "Only admins can delete status config"
  ON public.lead_status_config
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

DROP POLICY IF EXISTS "Only admins can insert origens"
  ON public.lead_origens;
CREATE POLICY "Only admins can insert origens"
  ON public.lead_origens
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

DROP POLICY IF EXISTS "Only admins can update origens"
  ON public.lead_origens;
CREATE POLICY "Only admins can update origens"
  ON public.lead_origens
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

DROP POLICY IF EXISTS "Only admins can delete origens"
  ON public.lead_origens;
CREATE POLICY "Only admins can delete origens"
  ON public.lead_origens
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
CREATE POLICY "Only admins manage contract modalidades"
  ON public.contract_modalidades
  FOR ALL
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

DROP POLICY IF EXISTS "Only admins manage contract abrangencias"
  ON public.contract_abrangencias;
CREATE POLICY "Only admins manage contract abrangencias"
  ON public.contract_abrangencias
  FOR ALL
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

DROP POLICY IF EXISTS "Only admins manage contract acomodacoes"
  ON public.contract_acomodacoes;
CREATE POLICY "Only admins manage contract acomodacoes"
  ON public.contract_acomodacoes
  FOR ALL
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

DROP POLICY IF EXISTS "Only admins manage contract carencias"
  ON public.contract_carencias;
CREATE POLICY "Only admins manage contract carencias"
  ON public.contract_carencias
  FOR ALL
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

DROP POLICY IF EXISTS "Only admins can manage integration settings"
  ON public.integration_settings;
CREATE POLICY "Only admins can manage integration settings"
  ON public.integration_settings
  FOR ALL
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

DROP POLICY IF EXISTS "Admins can read WhatsApp campaigns"
  ON public.whatsapp_campaigns;
CREATE POLICY "Admins can read WhatsApp campaigns"
  ON public.whatsapp_campaigns
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can insert WhatsApp campaigns"
  ON public.whatsapp_campaigns;
CREATE POLICY "Admins can insert WhatsApp campaigns"
  ON public.whatsapp_campaigns
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

DROP POLICY IF EXISTS "Admins can update WhatsApp campaigns"
  ON public.whatsapp_campaigns;
CREATE POLICY "Admins can update WhatsApp campaigns"
  ON public.whatsapp_campaigns
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

DROP POLICY IF EXISTS "Admins can delete WhatsApp campaigns"
  ON public.whatsapp_campaigns;
CREATE POLICY "Admins can delete WhatsApp campaigns"
  ON public.whatsapp_campaigns
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

DROP POLICY IF EXISTS "Admins can read WhatsApp campaign targets"
  ON public.whatsapp_campaign_targets;
CREATE POLICY "Admins can read WhatsApp campaign targets"
  ON public.whatsapp_campaign_targets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can insert WhatsApp campaign targets"
  ON public.whatsapp_campaign_targets;
CREATE POLICY "Admins can insert WhatsApp campaign targets"
  ON public.whatsapp_campaign_targets
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

DROP POLICY IF EXISTS "Admins can update WhatsApp campaign targets"
  ON public.whatsapp_campaign_targets;
CREATE POLICY "Admins can update WhatsApp campaign targets"
  ON public.whatsapp_campaign_targets
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

DROP POLICY IF EXISTS "Admins can delete WhatsApp campaign targets"
  ON public.whatsapp_campaign_targets;
CREATE POLICY "Admins can delete WhatsApp campaign targets"
  ON public.whatsapp_campaign_targets
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

DROP POLICY IF EXISTS "Admins can read WhatsApp webhook events"
  ON public.whatsapp_webhook_events;
CREATE POLICY "Admins can read WhatsApp webhook events"
  ON public.whatsapp_webhook_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Authenticated users can manage dependents"
  ON public.dependents;
CREATE POLICY "Authenticated users can manage dependents"
  ON public.dependents
  FOR ALL
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can manage interactions"
  ON public.interactions;
CREATE POLICY "Authenticated users can manage interactions"
  ON public.interactions
  FOR ALL
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can manage documents"
  ON public.documents;
CREATE POLICY "Authenticated users can manage documents"
  ON public.documents
  FOR ALL
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can manage reminders"
  ON public.reminders;
CREATE POLICY "Authenticated users can manage reminders"
  ON public.reminders
  FOR ALL
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can manage contract value adjustments"
  ON public.contract_value_adjustments;
CREATE POLICY "Authenticated users can manage contract value adjustments"
  ON public.contract_value_adjustments
  FOR ALL
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert lead status history"
  ON public.lead_status_history;
CREATE POLICY "Authenticated users can insert lead status history"
  ON public.lead_status_history
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can view system configurations"
  ON public.system_configurations;
CREATE POLICY "Authenticated users can view system configurations"
  ON public.system_configurations
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Only admins manage system configurations"
  ON public.system_configurations;
CREATE POLICY "Only admins manage system configurations"
  ON public.system_configurations
  FOR ALL
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

DROP POLICY IF EXISTS "Admin users can view cursor"
  ON public.lead_processing_cursor;
CREATE POLICY "Admin users can view cursor"
  ON public.lead_processing_cursor
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admin users can update cursor"
  ON public.lead_processing_cursor;
CREATE POLICY "Admin users can update cursor"
  ON public.lead_processing_cursor
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

DROP POLICY IF EXISTS "Authenticated users can manage leads"
  ON public.leads;
CREATE POLICY "Authenticated users can manage leads"
  ON public.leads
  FOR ALL
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can manage contracts"
  ON public.contracts;
CREATE POLICY "Authenticated users can manage contracts"
  ON public.contracts
  FOR ALL
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can manage contract holders"
  ON public.contract_holders;
CREATE POLICY "Authenticated users can manage contract holders"
  ON public.contract_holders
  FOR ALL
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DO $$
DECLARE
  func record;
BEGIN
  FOR func IN
    SELECT
      p.oid,
      n.nspname,
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'set_whatsapp_quick_replies_updated_at',
        'set_whatsapp_campaigns_updated_at',
        'set_whatsapp_campaign_targets_updated_at',
        'trigger_auto_send_lead_messages',
        'check_status_duration_triggers',
        'enforce_whatsapp_group_chat_name',
        'enforce_group_chat_name',
        'enforce_group_chat_name_canonical',
        'cleanup_logs_7d'
      ])
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %I.%I(%s) SET search_path = public, extensions;',
      func.nspname,
      func.proname,
      func.args
    );
  END LOOP;
END $$;
