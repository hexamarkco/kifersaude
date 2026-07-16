BEGIN;

INSERT INTO public.access_profiles (slug, name, description, is_system, is_admin)
VALUES (
  'admin',
  'Administrador',
  'Acesso total ao sistema.',
  true,
  true
)
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_system = true,
  is_admin = true,
  updated_at = now();

COMMIT;
