/*
  # Harden security defaults

  - Remove overly permissive RLS policies
  - Require authenticated users for core CRM tables
  - Restrict system configuration writes to admins
  - Restrict follow-up execution writes to service role
  - Force SECURITY INVOKER on monitoring views
  - Fix mutable search_path on functions
*/

-- Ensure monitoring views run with invoker privileges
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'v_pending_leads_summary' AND c.relkind = 'v'
  ) THEN
    EXECUTE 'ALTER VIEW public.v_pending_leads_summary SET (security_invoker = true)';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'v_cron_job_runs' AND c.relkind = 'v'
  ) THEN
    EXECUTE 'ALTER VIEW public.v_cron_job_runs SET (security_invoker = true)';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'v_system_status' AND c.relkind = 'v'
  ) THEN
    EXECUTE 'ALTER VIEW public.v_system_status SET (security_invoker = true)';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'v_lead_processing_dashboard' AND c.relkind = 'v'
  ) THEN
    EXECUTE 'ALTER VIEW public.v_lead_processing_dashboard SET (security_invoker = true)';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'v_cron_jobs' AND c.relkind = 'v'
  ) THEN
    EXECUTE 'ALTER VIEW public.v_cron_jobs SET (security_invoker = true)';
  END IF;
END $$;

-- Fix mutable search_path on functions
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
        'set_web_push_subscription_updated_at',
        'normalize_cpf',
        'update_auto_contact_flow_jobs_updated_at',
        'normalize_person_name',
        'is_leap_year',
        'safe_make_date',
        'build_holder_pessoa_chave',
        'build_dependent_pessoa_chave',
        'compute_next_adjustment_date',
        'generate_adjustment_reminders_for_year',
        'sync_lead_status',
        'trigger_auto_send_lead_messages',
        'generate_birthdays_for_year',
        'sync_birthday_holder',
        'sync_birthday_dependent',
        'sync_contract_adjustment_reminder',
        'update_cursor_timestamp',
        'invoke_process_pending_leads',
        'trigger_lead_processing_now',
        'update_secrets_timestamp'
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

-- Harden RLS policies (require authenticated users)
DROP POLICY IF EXISTS "Permitir todas as operações em leads" ON public.leads;
DROP POLICY IF EXISTS "Usuários autenticados podem ver todos os leads" ON public.leads;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir leads" ON public.leads;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar leads" ON public.leads;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar leads" ON public.leads;
CREATE POLICY "Authenticated users can manage leads"
  ON public.leads FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Permitir todas as operações em contratos" ON public.contracts;
DROP POLICY IF EXISTS "Usuários autenticados podem ver todos os contratos" ON public.contracts;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir contratos" ON public.contracts;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar contratos" ON public.contracts;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar contratos" ON public.contracts;
CREATE POLICY "Authenticated users can manage contracts"
  ON public.contracts FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Permitir todas as operações em titulares" ON public.contract_holders;
DROP POLICY IF EXISTS "Usuários autenticados podem ver titulares" ON public.contract_holders;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir titulares" ON public.contract_holders;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar titulares" ON public.contract_holders;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar titulares" ON public.contract_holders;
CREATE POLICY "Authenticated users can manage contract holders"
  ON public.contract_holders FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Permitir todas as operações em dependentes" ON public.dependents;
DROP POLICY IF EXISTS "Usuários autenticados podem ver dependentes" ON public.dependents;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir dependentes" ON public.dependents;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar dependentes" ON public.dependents;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar dependentes" ON public.dependents;
CREATE POLICY "Authenticated users can manage dependents"
  ON public.dependents FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Permitir todas as operações em interações" ON public.interactions;
DROP POLICY IF EXISTS "Usuários autenticados podem ver interações" ON public.interactions;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir interações" ON public.interactions;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar interações" ON public.interactions;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar interações" ON public.interactions;
CREATE POLICY "Authenticated users can manage interactions"
  ON public.interactions FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Permitir todas as operações em documentos" ON public.documents;
DROP POLICY IF EXISTS "Usuários autenticados podem ver documentos" ON public.documents;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir documentos" ON public.documents;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar documentos" ON public.documents;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar documentos" ON public.documents;
CREATE POLICY "Authenticated users can manage documents"
  ON public.documents FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Permitir todas as operações em lembretes" ON public.reminders;
DROP POLICY IF EXISTS "Usuários autenticados podem ver lembretes" ON public.reminders;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir lembretes" ON public.reminders;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar lembretes" ON public.reminders;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar lembretes" ON public.reminders;
CREATE POLICY "Authenticated users can manage reminders"
  ON public.reminders FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Permitir todas as operações em ajustes de valor" ON public.contract_value_adjustments;
DROP POLICY IF EXISTS "Usuários autenticados podem ver ajustes" ON public.contract_value_adjustments;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir ajustes" ON public.contract_value_adjustments;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar ajustes" ON public.contract_value_adjustments;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar ajustes" ON public.contract_value_adjustments;
CREATE POLICY "Authenticated users can manage contract value adjustments"
  ON public.contract_value_adjustments FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Permitir inserção de histórico de status" ON public.lead_status_history;
CREATE POLICY "Authenticated users can insert lead status history"
  ON public.lead_status_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated users to delete configurations" ON public.system_configurations;
DROP POLICY IF EXISTS "Allow authenticated users to insert configurations" ON public.system_configurations;
DROP POLICY IF EXISTS "Allow authenticated users to update configurations" ON public.system_configurations;
DROP POLICY IF EXISTS "Authenticated users can view system configurations" ON public.system_configurations;
DROP POLICY IF EXISTS "Only admins manage system configurations" ON public.system_configurations;
CREATE POLICY "Authenticated users can view system configurations"
  ON public.system_configurations FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Only admins manage system configurations"
  ON public.system_configurations FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Allow system to insert follow-up execution" ON public.whatsapp_followup_execution;
DROP POLICY IF EXISTS "Allow system to update follow-up execution" ON public.whatsapp_followup_execution;
CREATE POLICY "Service role can insert follow-up execution"
  ON public.whatsapp_followup_execution FOR INSERT TO service_role
  WITH CHECK (true);
CREATE POLICY "Service role can update follow-up execution"
  ON public.whatsapp_followup_execution FOR UPDATE TO service_role
  USING (true)
  WITH CHECK (true);
