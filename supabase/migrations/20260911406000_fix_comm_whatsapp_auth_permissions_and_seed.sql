BEGIN;

-- Keep legacy `whatsapp` permissions and the newer `whatsapp-inbox` module
-- equivalent for the operational inbox/dashboard RPCs.
CREATE OR REPLACE FUNCTION public.current_user_can_view_comm_whatsapp()
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
        AND pp.module IN ('whatsapp-inbox', 'whatsapp')
        AND (pp.can_view = true OR pp.can_edit = true)
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_can_edit_comm_whatsapp()
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
        AND pp.module IN ('whatsapp-inbox', 'whatsapp')
        AND pp.can_edit = true
    )
  );
$$;

INSERT INTO public.profile_permissions (role, module, can_view, can_edit)
VALUES
  ('admin', 'whatsapp', true, true),
  ('admin', 'whatsapp-inbox', true, true),
  ('admin', 'config-automation', true, true),
  ('admin', 'config-integrations', true, true),
  ('observer', 'whatsapp', false, false),
  ('observer', 'whatsapp-inbox', false, false),
  ('observer', 'config-automation', false, false),
  ('observer', 'config-integrations', false, false)
ON CONFLICT (role, module) DO UPDATE
SET
  can_view = EXCLUDED.can_view,
  can_edit = EXCLUDED.can_edit,
  updated_at = now();

INSERT INTO public.integration_settings (slug, name, description, settings)
VALUES (
  'whatsapp_auto_contact',
  'Mensagens automáticas (WhatsApp)',
  'Configurações de envio automático e fluxos de automação via WhatsApp.',
  jsonb_build_object(
    'enabled', false,
    'autoSend', false,
    'apiKey', '',
    'token', '',
    'messageTemplates', '[]'::jsonb,
    'flows', '[]'::jsonb,
    'scheduling', jsonb_build_object(
      'timezone', 'America/Sao_Paulo',
      'startHour', '08:00',
      'endHour', '19:00',
      'allowedWeekdays', jsonb_build_array(1, 2, 3, 4, 5),
      'skipHolidays', true,
      'dailySendLimit', null
    ),
    'monitoring', jsonb_build_object(
      'realtimeEnabled', true,
      'refreshSeconds', 30
    ),
    'logging', jsonb_build_object(
      'enabled', true,
      'retentionDays', 30,
      'includePayloads', false
    )
  )
)
ON CONFLICT (slug) DO NOTHING;

REVOKE ALL ON FUNCTION public.current_user_can_view_comm_whatsapp() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_can_view_comm_whatsapp() TO authenticated;

REVOKE ALL ON FUNCTION public.current_user_can_edit_comm_whatsapp() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_can_edit_comm_whatsapp() TO authenticated;

COMMIT;
