BEGIN;

CREATE OR REPLACE FUNCTION public.current_user_is_access_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    JOIN public.access_profiles ap ON ap.slug = up.role
    WHERE (up.id = auth.uid() OR lower(up.email) = lower(NULLIF(auth.jwt()->>'email', '')))
      AND ap.is_admin = true
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_can_view_comm_whatsapp()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      JOIN public.access_profiles ap ON ap.slug = up.role
      WHERE (up.id = auth.uid() OR lower(up.email) = lower(NULLIF(auth.jwt()->>'email', '')))
        AND ap.is_admin = true
    )
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
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      JOIN public.access_profiles ap ON ap.slug = up.role
      WHERE (up.id = auth.uid() OR lower(up.email) = lower(NULLIF(auth.jwt()->>'email', '')))
        AND ap.is_admin = true
    )
    OR EXISTS (
      SELECT 1
      FROM public.profile_permissions pp
      WHERE pp.role = public.current_user_access_role()
        AND pp.module IN ('whatsapp-inbox', 'whatsapp')
        AND pp.can_edit = true
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_can_view_any_module(module_ids text[])
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      JOIN public.access_profiles ap ON ap.slug = up.role
      WHERE (up.id = auth.uid() OR lower(up.email) = lower(NULLIF(auth.jwt()->>'email', '')))
        AND ap.is_admin = true
    )
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
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      JOIN public.access_profiles ap ON ap.slug = up.role
      WHERE (up.id = auth.uid() OR lower(up.email) = lower(NULLIF(auth.jwt()->>'email', '')))
        AND ap.is_admin = true
    )
    OR EXISTS (
      SELECT 1
      FROM public.profile_permissions permission
      WHERE permission.role = public.current_user_access_role()
        AND permission.module = ANY(module_ids)
        AND permission.can_edit = true
    )
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_is_access_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_is_access_admin() TO authenticated;

REVOKE ALL ON FUNCTION public.current_user_can_view_comm_whatsapp() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_can_view_comm_whatsapp() TO authenticated;

REVOKE ALL ON FUNCTION public.current_user_can_edit_comm_whatsapp() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_can_edit_comm_whatsapp() TO authenticated;

REVOKE ALL ON FUNCTION public.current_user_can_view_any_module(text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_can_edit_any_module(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_can_view_any_module(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_can_edit_any_module(text[]) TO authenticated;

COMMIT;
