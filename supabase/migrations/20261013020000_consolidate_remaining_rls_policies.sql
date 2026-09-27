BEGIN;

-- Several tables had a permissive FOR ALL policy for editors plus a second
-- permissive SELECT policy for readers. Split mutation commands and combine
-- the read conditions so PostgreSQL evaluates one policy per role/action.
-- The effective rules remain unchanged:
--   SELECT: can_edit OR can_view
--   INSERT/UPDATE/DELETE: can_edit

DROP POLICY IF EXISTS "Contract editors can manage contract holders"
  ON public.contract_holders;
DROP POLICY IF EXISTS "Module users can view contract holders"
  ON public.contract_holders;
CREATE POLICY "Module users can view or edit contract holders"
  ON public.contract_holders FOR SELECT TO authenticated
  USING (
    public.current_user_can_edit_any_module(ARRAY['contracts'::text])
    OR public.current_user_can_view_any_module(ARRAY['contracts'::text, 'dashboard'::text])
  );
CREATE POLICY "Contract editors can insert contract holders"
  ON public.contract_holders FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_edit_any_module(ARRAY['contracts'::text]));
CREATE POLICY "Contract editors can update contract holders"
  ON public.contract_holders FOR UPDATE TO authenticated
  USING (public.current_user_can_edit_any_module(ARRAY['contracts'::text]))
  WITH CHECK (public.current_user_can_edit_any_module(ARRAY['contracts'::text]));
CREATE POLICY "Contract editors can delete contract holders"
  ON public.contract_holders FOR DELETE TO authenticated
  USING (public.current_user_can_edit_any_module(ARRAY['contracts'::text]));

DROP POLICY IF EXISTS "Contract editors can manage contract value adjustments"
  ON public.contract_value_adjustments;
DROP POLICY IF EXISTS "Module users can view contract value adjustments"
  ON public.contract_value_adjustments;
CREATE POLICY "Module users can view or edit contract value adjustments"
  ON public.contract_value_adjustments FOR SELECT TO authenticated
  USING (
    public.current_user_can_edit_any_module(ARRAY['contracts'::text])
    OR public.current_user_can_view_any_module(ARRAY['contracts'::text, 'dashboard'::text])
  );
CREATE POLICY "Contract editors can insert contract value adjustments"
  ON public.contract_value_adjustments FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_edit_any_module(ARRAY['contracts'::text]));
CREATE POLICY "Contract editors can update contract value adjustments"
  ON public.contract_value_adjustments FOR UPDATE TO authenticated
  USING (public.current_user_can_edit_any_module(ARRAY['contracts'::text]))
  WITH CHECK (public.current_user_can_edit_any_module(ARRAY['contracts'::text]));
CREATE POLICY "Contract editors can delete contract value adjustments"
  ON public.contract_value_adjustments FOR DELETE TO authenticated
  USING (public.current_user_can_edit_any_module(ARRAY['contracts'::text]));

DROP POLICY IF EXISTS "Contract editors can manage contracts"
  ON public.contracts;
DROP POLICY IF EXISTS "Module users can view contracts"
  ON public.contracts;
CREATE POLICY "Module users can view or edit contracts"
  ON public.contracts FOR SELECT TO authenticated
  USING (
    public.current_user_can_edit_any_module(ARRAY['contracts'::text])
    OR public.current_user_can_view_any_module(ARRAY[
      'contracts'::text, 'dashboard'::text, 'leads'::text, 'reminders'::text,
      'financeiro-agenda'::text, 'agenda'::text, 'whatsapp-inbox'::text,
      'financeiro-comissoes'::text
    ])
  );
CREATE POLICY "Contract editors can insert contracts"
  ON public.contracts FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_edit_any_module(ARRAY['contracts'::text]));
CREATE POLICY "Contract editors can update contracts"
  ON public.contracts FOR UPDATE TO authenticated
  USING (public.current_user_can_edit_any_module(ARRAY['contracts'::text]))
  WITH CHECK (public.current_user_can_edit_any_module(ARRAY['contracts'::text]));
CREATE POLICY "Contract editors can delete contracts"
  ON public.contracts FOR DELETE TO authenticated
  USING (public.current_user_can_edit_any_module(ARRAY['contracts'::text]));

DROP POLICY IF EXISTS "Contract editors can manage dependents"
  ON public.dependents;
DROP POLICY IF EXISTS "Module users can view dependents"
  ON public.dependents;
CREATE POLICY "Module users can view or edit dependents"
  ON public.dependents FOR SELECT TO authenticated
  USING (
    public.current_user_can_edit_any_module(ARRAY['contracts'::text])
    OR public.current_user_can_view_any_module(ARRAY['contracts'::text, 'dashboard'::text])
  );
CREATE POLICY "Contract editors can insert dependents"
  ON public.dependents FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_edit_any_module(ARRAY['contracts'::text]));
CREATE POLICY "Contract editors can update dependents"
  ON public.dependents FOR UPDATE TO authenticated
  USING (public.current_user_can_edit_any_module(ARRAY['contracts'::text]))
  WITH CHECK (public.current_user_can_edit_any_module(ARRAY['contracts'::text]));
CREATE POLICY "Contract editors can delete dependents"
  ON public.dependents FOR DELETE TO authenticated
  USING (public.current_user_can_edit_any_module(ARRAY['contracts'::text]));

DROP POLICY IF EXISTS "Contract editors can manage documents"
  ON public.documents;
DROP POLICY IF EXISTS "Module users can view documents"
  ON public.documents;
CREATE POLICY "Module users can view or edit documents"
  ON public.documents FOR SELECT TO authenticated
  USING (
    public.current_user_can_edit_any_module(ARRAY['contracts'::text])
    OR public.current_user_can_view_any_module(ARRAY['contracts'::text, 'dashboard'::text])
  );
CREATE POLICY "Contract editors can insert documents"
  ON public.documents FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_edit_any_module(ARRAY['contracts'::text]));
CREATE POLICY "Contract editors can update documents"
  ON public.documents FOR UPDATE TO authenticated
  USING (public.current_user_can_edit_any_module(ARRAY['contracts'::text]))
  WITH CHECK (public.current_user_can_edit_any_module(ARRAY['contracts'::text]));
CREATE POLICY "Contract editors can delete documents"
  ON public.documents FOR DELETE TO authenticated
  USING (public.current_user_can_edit_any_module(ARRAY['contracts'::text]));

DROP POLICY IF EXISTS "Module editors can manage interactions"
  ON public.interactions;
DROP POLICY IF EXISTS "Module users can view interactions"
  ON public.interactions;
CREATE POLICY "Module users can view or edit interactions"
  ON public.interactions FOR SELECT TO authenticated
  USING (
    public.current_user_can_edit_any_module(ARRAY[
      'leads'::text, 'contracts'::text, 'reminders'::text,
      'financeiro-agenda'::text, 'agenda'::text, 'whatsapp-inbox'::text
    ])
    OR public.current_user_can_view_any_module(ARRAY[
      'leads'::text, 'contracts'::text, 'dashboard'::text,
      'config-automation'::text, 'reminders'::text, 'financeiro-agenda'::text,
      'agenda'::text, 'whatsapp-inbox'::text
    ])
  );
CREATE POLICY "Module editors can insert interactions"
  ON public.interactions FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_edit_any_module(ARRAY[
    'leads'::text, 'contracts'::text, 'reminders'::text,
    'financeiro-agenda'::text, 'agenda'::text, 'whatsapp-inbox'::text
  ]));
CREATE POLICY "Module editors can update interactions"
  ON public.interactions FOR UPDATE TO authenticated
  USING (public.current_user_can_edit_any_module(ARRAY[
    'leads'::text, 'contracts'::text, 'reminders'::text,
    'financeiro-agenda'::text, 'agenda'::text, 'whatsapp-inbox'::text
  ]))
  WITH CHECK (public.current_user_can_edit_any_module(ARRAY[
    'leads'::text, 'contracts'::text, 'reminders'::text,
    'financeiro-agenda'::text, 'agenda'::text, 'whatsapp-inbox'::text
  ]));
CREATE POLICY "Module editors can delete interactions"
  ON public.interactions FOR DELETE TO authenticated
  USING (public.current_user_can_edit_any_module(ARRAY[
    'leads'::text, 'contracts'::text, 'reminders'::text,
    'financeiro-agenda'::text, 'agenda'::text, 'whatsapp-inbox'::text
  ]));

DROP POLICY IF EXISTS "Module editors can manage leads"
  ON public.leads;
DROP POLICY IF EXISTS "Module users can view leads"
  ON public.leads;
CREATE POLICY "Module users can view or edit leads"
  ON public.leads FOR SELECT TO authenticated
  USING (
    public.current_user_can_edit_any_module(ARRAY[
      'leads'::text, 'contracts'::text, 'reminders'::text,
      'financeiro-agenda'::text, 'agenda'::text, 'whatsapp-inbox'::text,
      'whatsapp-campaigns'::text
    ])
    OR public.current_user_can_view_any_module(ARRAY[
      'leads'::text, 'dashboard'::text, 'contracts'::text, 'cotador'::text,
      'reminders'::text, 'financeiro-agenda'::text, 'agenda'::text,
      'whatsapp-inbox'::text, 'whatsapp-campaigns'::text
    ])
  );
CREATE POLICY "Module editors can insert leads"
  ON public.leads FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_edit_any_module(ARRAY[
    'leads'::text, 'contracts'::text, 'reminders'::text,
    'financeiro-agenda'::text, 'agenda'::text, 'whatsapp-inbox'::text,
    'whatsapp-campaigns'::text
  ]));
CREATE POLICY "Module editors can update leads"
  ON public.leads FOR UPDATE TO authenticated
  USING (public.current_user_can_edit_any_module(ARRAY[
    'leads'::text, 'contracts'::text, 'reminders'::text,
    'financeiro-agenda'::text, 'agenda'::text, 'whatsapp-inbox'::text,
    'whatsapp-campaigns'::text
  ]))
  WITH CHECK (public.current_user_can_edit_any_module(ARRAY[
    'leads'::text, 'contracts'::text, 'reminders'::text,
    'financeiro-agenda'::text, 'agenda'::text, 'whatsapp-inbox'::text,
    'whatsapp-campaigns'::text
  ]));
CREATE POLICY "Module editors can delete leads"
  ON public.leads FOR DELETE TO authenticated
  USING (public.current_user_can_edit_any_module(ARRAY[
    'leads'::text, 'contracts'::text, 'reminders'::text,
    'financeiro-agenda'::text, 'agenda'::text, 'whatsapp-inbox'::text,
    'whatsapp-campaigns'::text
  ]));

DROP POLICY IF EXISTS "Module editors can manage reminders"
  ON public.reminders;
DROP POLICY IF EXISTS "Module users can view reminders"
  ON public.reminders;
CREATE POLICY "Module users can view or edit reminders"
  ON public.reminders FOR SELECT TO authenticated
  USING (
    public.current_user_can_edit_any_module(ARRAY[
      'reminders'::text, 'financeiro-agenda'::text, 'agenda'::text,
      'leads'::text, 'contracts'::text, 'dashboard'::text, 'whatsapp-inbox'::text
    ])
    OR public.current_user_can_view_any_module(ARRAY[
      'reminders'::text, 'financeiro-agenda'::text, 'agenda'::text,
      'leads'::text, 'contracts'::text, 'dashboard'::text, 'whatsapp-inbox'::text
    ])
  );
CREATE POLICY "Module editors can insert reminders"
  ON public.reminders FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_edit_any_module(ARRAY[
    'reminders'::text, 'financeiro-agenda'::text, 'agenda'::text,
    'leads'::text, 'contracts'::text, 'dashboard'::text, 'whatsapp-inbox'::text
  ]));
CREATE POLICY "Module editors can update reminders"
  ON public.reminders FOR UPDATE TO authenticated
  USING (public.current_user_can_edit_any_module(ARRAY[
    'reminders'::text, 'financeiro-agenda'::text, 'agenda'::text,
    'leads'::text, 'contracts'::text, 'dashboard'::text, 'whatsapp-inbox'::text
  ]))
  WITH CHECK (public.current_user_can_edit_any_module(ARRAY[
    'reminders'::text, 'financeiro-agenda'::text, 'agenda'::text,
    'leads'::text, 'contracts'::text, 'dashboard'::text, 'whatsapp-inbox'::text
  ]));
CREATE POLICY "Module editors can delete reminders"
  ON public.reminders FOR DELETE TO authenticated
  USING (public.current_user_can_edit_any_module(ARRAY[
    'reminders'::text, 'financeiro-agenda'::text, 'agenda'::text,
    'leads'::text, 'contracts'::text, 'dashboard'::text, 'whatsapp-inbox'::text
  ]));

-- These policies express two independent ways to manage the same action.
-- Combining them with OR preserves the manager/admin union exactly.
DROP POLICY IF EXISTS "Managers can delete profile permissions"
  ON public.profile_permissions;
DROP POLICY IF EXISTS "Only admins delete profile permissions"
  ON public.profile_permissions;
DROP POLICY IF EXISTS "Managers can insert profile permissions"
  ON public.profile_permissions;
DROP POLICY IF EXISTS "Only admins insert profile permissions"
  ON public.profile_permissions;
DROP POLICY IF EXISTS "Managers can update profile permissions"
  ON public.profile_permissions;
DROP POLICY IF EXISTS "Only admins update profile permissions"
  ON public.profile_permissions;
CREATE POLICY "Managers or admins can delete profile permissions"
  ON public.profile_permissions FOR DELETE TO authenticated
  USING (public.current_user_can_manage_access_profiles() OR public.current_user_is_access_admin());
CREATE POLICY "Managers or admins can insert profile permissions"
  ON public.profile_permissions FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_manage_access_profiles() OR public.current_user_is_access_admin());
CREATE POLICY "Managers or admins can update profile permissions"
  ON public.profile_permissions FOR UPDATE TO authenticated
  USING (public.current_user_can_manage_access_profiles() OR public.current_user_is_access_admin())
  WITH CHECK (public.current_user_can_manage_access_profiles() OR public.current_user_is_access_admin());

-- The unrestricted authenticated profile-read policy already covers the
-- narrower own-profile policy, so keeping both only duplicates evaluation.
DROP POLICY IF EXISTS "Users can view own profile"
  ON public.user_profiles;

-- Public content is readable by anonymous users when published/active and by
-- administrators regardless of publication state. One public-role policy
-- preserves both cases for anonymous and authenticated sessions.
DROP POLICY IF EXISTS "Admins can view all form steps"
  ON public.public_form_steps;
DROP POLICY IF EXISTS "Anyone can view steps of published forms"
  ON public.public_form_steps;
CREATE POLICY "Public or admins can view form steps"
  ON public.public_form_steps FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1
      FROM public.public_forms
      WHERE public.public_forms.id = public.public_form_steps.form_id
        AND public.public_forms.is_published = true
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE public.user_profiles.id = (SELECT auth.uid())
        AND public.user_profiles.role = 'admin'::text
    )
  );

DROP POLICY IF EXISTS "Admins can view all forms"
  ON public.public_forms;
DROP POLICY IF EXISTS "Anyone can view published forms"
  ON public.public_forms;
CREATE POLICY "Public or admins can view forms"
  ON public.public_forms FOR SELECT TO public
  USING (
    public.public_forms.is_published = true
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE public.user_profiles.id = (SELECT auth.uid())
        AND public.user_profiles.role = 'admin'::text
    )
  );

DROP POLICY IF EXISTS "Admins can view all link items"
  ON public.public_link_items;
DROP POLICY IF EXISTS "Anyone can view active link items"
  ON public.public_link_items;
CREATE POLICY "Public or admins can view link items"
  ON public.public_link_items FOR SELECT TO public
  USING (
    public.public_link_items.is_active = true
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE public.user_profiles.id = (SELECT auth.uid())
        AND public.user_profiles.role = 'admin'::text
    )
  );

DROP POLICY IF EXISTS "Admins can view all link page settings"
  ON public.public_link_page_settings;
DROP POLICY IF EXISTS "Anyone can view published link page settings"
  ON public.public_link_page_settings;
CREATE POLICY "Public or admins can view link page settings"
  ON public.public_link_page_settings FOR SELECT TO public
  USING (
    public.public_link_page_settings.is_published = true
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE public.user_profiles.id = (SELECT auth.uid())
        AND public.user_profiles.role = 'admin'::text
    )
  );

NOTIFY pgrst, 'reload schema';

COMMIT;
