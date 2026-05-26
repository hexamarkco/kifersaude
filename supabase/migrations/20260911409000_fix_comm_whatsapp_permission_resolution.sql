BEGIN;

CREATE OR REPLACE FUNCTION public.current_user_access_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH jwt_profile AS (
    SELECT NULLIF(COALESCE(
      auth.jwt()->'user_metadata'->>'user_management_id',
      auth.jwt()->'user_metadata'->>'user_management_user_id',
      auth.jwt()->'user_metadata'->>'user_id',
      auth.jwt()->'app_metadata'->>'user_management_id',
      auth.jwt()->'app_metadata'->>'user_id'
    ), '')::uuid AS id
  )
  SELECT up.role
  FROM public.user_profiles up
  LEFT JOIN jwt_profile jp ON true
  WHERE up.id = auth.uid()
     OR (jp.id IS NOT NULL AND up.id = jp.id)
     OR up.email = auth.jwt()->>'email'
  ORDER BY
    CASE
      WHEN up.id = auth.uid() THEN 0
      WHEN jp.id IS NOT NULL AND up.id = jp.id THEN 1
      ELSE 2
    END
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_access_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH jwt_profile AS (
    SELECT NULLIF(COALESCE(
      auth.jwt()->'user_metadata'->>'user_management_id',
      auth.jwt()->'user_metadata'->>'user_management_user_id',
      auth.jwt()->'user_metadata'->>'user_id',
      auth.jwt()->'app_metadata'->>'user_management_id',
      auth.jwt()->'app_metadata'->>'user_id'
    ), '')::uuid AS id
  )
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    JOIN public.access_profiles ap ON ap.slug = up.role
    LEFT JOIN jwt_profile jp ON true
    WHERE ap.is_admin = true
      AND (
        up.id = auth.uid()
        OR (jp.id IS NOT NULL AND up.id = jp.id)
        OR up.email = auth.jwt()->>'email'
      )
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

REVOKE ALL ON FUNCTION public.current_user_access_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_access_role() TO authenticated;

REVOKE ALL ON FUNCTION public.current_user_is_access_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_is_access_admin() TO authenticated;

REVOKE ALL ON FUNCTION public.current_user_can_view_comm_whatsapp() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_can_view_comm_whatsapp() TO authenticated;

REVOKE ALL ON FUNCTION public.current_user_can_edit_comm_whatsapp() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_can_edit_comm_whatsapp() TO authenticated;

COMMIT;
