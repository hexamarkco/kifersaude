/*
  # Dynamic access profiles

  ## Summary
  - Creates `access_profiles` to register roles dynamically
  - Links `user_profiles.role` and `profile_permissions.role` to named profiles
  - Adds helper functions and RLS policies for dynamic access management
  - Seeds built-in admin/observer profiles and backfills existing custom roles
*/

BEGIN;

CREATE TABLE IF NOT EXISTS public.access_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_access_profiles_slug ON public.access_profiles(slug);
CREATE INDEX IF NOT EXISTS idx_access_profiles_is_admin ON public.access_profiles(is_admin);

INSERT INTO public.access_profiles (slug, name, description, is_system, is_admin)
VALUES
  ('admin', 'Administrador', 'Acesso total ao sistema.', true, true),
  ('observer', 'Observador', 'Perfil padrao de consulta e operacao restrita.', true, false)
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_system = EXCLUDED.is_system,
  is_admin = EXCLUDED.is_admin;

INSERT INTO public.access_profiles (slug, name, description, is_system, is_admin)
SELECT
  role,
  initcap(replace(role, '-', ' ')),
  'Perfil migrado automaticamente a partir da base existente.',
  false,
  false
FROM (
  SELECT DISTINCT role FROM public.user_profiles
  UNION
  SELECT DISTINCT role FROM public.profile_permissions
) roles
WHERE role IS NOT NULL
  AND btrim(role) <> ''
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_role_fkey;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_role_fkey
  FOREIGN KEY (role)
  REFERENCES public.access_profiles(slug)
  ON UPDATE CASCADE;

ALTER TABLE public.profile_permissions
  DROP CONSTRAINT IF EXISTS profile_permissions_role_fkey;

ALTER TABLE public.profile_permissions
  ADD CONSTRAINT profile_permissions_role_fkey
  FOREIGN KEY (role)
  REFERENCES public.access_profiles(slug)
  ON UPDATE CASCADE
  ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.current_user_access_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role
  FROM public.user_profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

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
    JOIN public.access_profiles ap
      ON ap.slug = up.role
    WHERE up.id = auth.uid()
      AND ap.is_admin = true
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_can_manage_users()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    public.current_user_is_access_admin()
    OR EXISTS (
      SELECT 1
      FROM public.profile_permissions pp
      WHERE pp.role = public.current_user_access_role()
        AND pp.module IN ('config-users', 'config')
        AND pp.can_edit = true
    );
$$;

CREATE OR REPLACE FUNCTION public.current_user_can_manage_access_profiles()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    public.current_user_is_access_admin()
    OR EXISTS (
      SELECT 1
      FROM public.profile_permissions pp
      WHERE pp.role = public.current_user_access_role()
        AND pp.module IN ('config-access', 'config')
        AND pp.can_edit = true
    );
$$;

ALTER TABLE public.access_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view access profiles" ON public.access_profiles;
CREATE POLICY "Authenticated users can view access profiles"
  ON public.access_profiles
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Managers can insert access profiles" ON public.access_profiles;
CREATE POLICY "Managers can insert access profiles"
  ON public.access_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_can_manage_access_profiles());

DROP POLICY IF EXISTS "Managers can update access profiles" ON public.access_profiles;
CREATE POLICY "Managers can update access profiles"
  ON public.access_profiles
  FOR UPDATE
  TO authenticated
  USING (public.current_user_can_manage_access_profiles())
  WITH CHECK (public.current_user_can_manage_access_profiles());

DROP POLICY IF EXISTS "Managers can delete access profiles" ON public.access_profiles;
CREATE POLICY "Managers can delete access profiles"
  ON public.access_profiles
  FOR DELETE
  TO authenticated
  USING (public.current_user_can_manage_access_profiles() AND is_system = false);

DROP POLICY IF EXISTS "Only admins can manage profile permissions" ON public.profile_permissions;
DROP POLICY IF EXISTS "Only admins insert profile permissions" ON public.profile_permissions;
DROP POLICY IF EXISTS "Only admins update profile permissions" ON public.profile_permissions;
DROP POLICY IF EXISTS "Only admins delete profile permissions" ON public.profile_permissions;

CREATE POLICY "Managers can insert profile permissions"
  ON public.profile_permissions
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_can_manage_access_profiles());

CREATE POLICY "Managers can update profile permissions"
  ON public.profile_permissions
  FOR UPDATE
  TO authenticated
  USING (public.current_user_can_manage_access_profiles())
  WITH CHECK (public.current_user_can_manage_access_profiles());

CREATE POLICY "Managers can delete profile permissions"
  ON public.profile_permissions
  FOR DELETE
  TO authenticated
  USING (public.current_user_can_manage_access_profiles());

CREATE OR REPLACE FUNCTION public.set_access_profiles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_access_profiles_updated_at ON public.access_profiles;
CREATE TRIGGER trg_access_profiles_updated_at
  BEFORE UPDATE ON public.access_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_access_profiles_updated_at();

COMMIT;
