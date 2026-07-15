BEGIN;

CREATE OR REPLACE FUNCTION public.current_user_can_view_any_module(module_ids text[])
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
      FROM public.profile_permissions permission
      WHERE permission.role = public.current_user_access_role()
        AND permission.module = ANY(module_ids)
        AND (permission.can_view = true OR permission.can_edit = true)
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_can_edit_any_module(module_ids text[])
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
      FROM public.profile_permissions permission
      WHERE permission.role = public.current_user_access_role()
        AND permission.module = ANY(module_ids)
        AND permission.can_edit = true
    )
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_can_view_any_module(text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_can_edit_any_module(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_can_view_any_module(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_can_edit_any_module(text[]) TO authenticated;

DROP POLICY IF EXISTS "Authenticated users can manage leads" ON public.leads;
CREATE POLICY "Module users can view leads"
  ON public.leads FOR SELECT TO authenticated
  USING (public.current_user_can_view_any_module(ARRAY[
    'leads', 'dashboard', 'contracts', 'cotador', 'reminders', 'financeiro-agenda',
    'agenda', 'whatsapp-inbox', 'whatsapp-campaigns'
  ]));
CREATE POLICY "Module editors can manage leads"
  ON public.leads FOR ALL TO authenticated
  USING (public.current_user_can_edit_any_module(ARRAY[
    'leads', 'contracts', 'reminders', 'financeiro-agenda', 'agenda',
    'whatsapp-inbox', 'whatsapp-campaigns'
  ]))
  WITH CHECK (public.current_user_can_edit_any_module(ARRAY[
    'leads', 'contracts', 'reminders', 'financeiro-agenda', 'agenda',
    'whatsapp-inbox', 'whatsapp-campaigns'
  ]));

DROP POLICY IF EXISTS "Authenticated users can manage contracts" ON public.contracts;
CREATE POLICY "Module users can view contracts"
  ON public.contracts FOR SELECT TO authenticated
  USING (public.current_user_can_view_any_module(ARRAY[
    'contracts', 'dashboard', 'leads', 'reminders', 'financeiro-agenda',
    'agenda', 'whatsapp-inbox', 'financeiro-comissoes'
  ]));
CREATE POLICY "Contract editors can manage contracts"
  ON public.contracts FOR ALL TO authenticated
  USING (public.current_user_can_edit_any_module(ARRAY['contracts']))
  WITH CHECK (public.current_user_can_edit_any_module(ARRAY['contracts']));

DROP POLICY IF EXISTS "Authenticated users can manage contract holders" ON public.contract_holders;
CREATE POLICY "Module users can view contract holders"
  ON public.contract_holders FOR SELECT TO authenticated
  USING (public.current_user_can_view_any_module(ARRAY['contracts', 'dashboard']));
CREATE POLICY "Contract editors can manage contract holders"
  ON public.contract_holders FOR ALL TO authenticated
  USING (public.current_user_can_edit_any_module(ARRAY['contracts']))
  WITH CHECK (public.current_user_can_edit_any_module(ARRAY['contracts']));

DROP POLICY IF EXISTS "Authenticated users can manage dependents" ON public.dependents;
CREATE POLICY "Module users can view dependents"
  ON public.dependents FOR SELECT TO authenticated
  USING (public.current_user_can_view_any_module(ARRAY['contracts', 'dashboard']));
CREATE POLICY "Contract editors can manage dependents"
  ON public.dependents FOR ALL TO authenticated
  USING (public.current_user_can_edit_any_module(ARRAY['contracts']))
  WITH CHECK (public.current_user_can_edit_any_module(ARRAY['contracts']));

DROP POLICY IF EXISTS "Authenticated users can manage interactions" ON public.interactions;
CREATE POLICY "Module users can view interactions"
  ON public.interactions FOR SELECT TO authenticated
  USING (public.current_user_can_view_any_module(ARRAY[
    'leads', 'contracts', 'dashboard', 'config-automation', 'reminders',
    'financeiro-agenda', 'agenda', 'whatsapp-inbox'
  ]));
CREATE POLICY "Module editors can manage interactions"
  ON public.interactions FOR ALL TO authenticated
  USING (public.current_user_can_edit_any_module(ARRAY[
    'leads', 'contracts', 'reminders', 'financeiro-agenda', 'agenda', 'whatsapp-inbox'
  ]))
  WITH CHECK (public.current_user_can_edit_any_module(ARRAY[
    'leads', 'contracts', 'reminders', 'financeiro-agenda', 'agenda', 'whatsapp-inbox'
  ]));

DROP POLICY IF EXISTS "Authenticated users can manage documents" ON public.documents;
CREATE POLICY "Module users can view documents"
  ON public.documents FOR SELECT TO authenticated
  USING (public.current_user_can_view_any_module(ARRAY['contracts', 'dashboard']));
CREATE POLICY "Contract editors can manage documents"
  ON public.documents FOR ALL TO authenticated
  USING (public.current_user_can_edit_any_module(ARRAY['contracts']))
  WITH CHECK (public.current_user_can_edit_any_module(ARRAY['contracts']));

DROP POLICY IF EXISTS "Authenticated users can manage reminders" ON public.reminders;
CREATE POLICY "Module users can view reminders"
  ON public.reminders FOR SELECT TO authenticated
  USING (public.current_user_can_view_any_module(ARRAY[
    'reminders', 'financeiro-agenda', 'agenda', 'leads', 'contracts', 'dashboard', 'whatsapp-inbox'
  ]));
CREATE POLICY "Module editors can manage reminders"
  ON public.reminders FOR ALL TO authenticated
  USING (public.current_user_can_edit_any_module(ARRAY[
    'reminders', 'financeiro-agenda', 'agenda', 'leads', 'contracts', 'dashboard', 'whatsapp-inbox'
  ]))
  WITH CHECK (public.current_user_can_edit_any_module(ARRAY[
    'reminders', 'financeiro-agenda', 'agenda', 'leads', 'contracts', 'dashboard', 'whatsapp-inbox'
  ]));

DROP POLICY IF EXISTS "Authenticated users can manage contract value adjustments" ON public.contract_value_adjustments;
CREATE POLICY "Module users can view contract value adjustments"
  ON public.contract_value_adjustments FOR SELECT TO authenticated
  USING (public.current_user_can_view_any_module(ARRAY['contracts', 'dashboard']));
CREATE POLICY "Contract editors can manage contract value adjustments"
  ON public.contract_value_adjustments FOR ALL TO authenticated
  USING (public.current_user_can_edit_any_module(ARRAY['contracts']))
  WITH CHECK (public.current_user_can_edit_any_module(ARRAY['contracts']));

DROP POLICY IF EXISTS "Authenticated users can insert lead status history" ON public.lead_status_history;
DROP POLICY IF EXISTS "Permitir leitura de histórico de status" ON public.lead_status_history;
CREATE POLICY "Module users can view lead status history"
  ON public.lead_status_history FOR SELECT TO authenticated
  USING (public.current_user_can_view_any_module(ARRAY[
    'leads', 'dashboard', 'contracts', 'reminders', 'financeiro-agenda', 'agenda', 'whatsapp-inbox'
  ]));
CREATE POLICY "Module editors can insert lead status history"
  ON public.lead_status_history FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_edit_any_module(ARRAY[
    'leads', 'contracts', 'reminders', 'financeiro-agenda', 'agenda', 'whatsapp-inbox'
  ]));

COMMIT;
