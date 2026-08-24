/*
  # Public links page (Linktree-style)

  ## Description
  Adds the tables that power a public "linktree" style page at /links and
  its admin CRUD screen at Configurações > Links.

  1. New Tables
    - `public_link_page_settings` (page title/bio/avatar + publish flag)
    - `public_link_items` (individual link buttons, ordered by `position`)

  2. Security
    - Enable RLS on both tables
    - Anyone (anon + authenticated) can read the published settings row and
      active link items — required for the public /links page
    - Only admins can insert/update/delete either table
    - `increment_public_link_click` is a SECURITY DEFINER RPC so the public
      page can record a click without granting broad UPDATE access to anon

  3. Indexes
    - Index on `public_link_items(position)` for the public page's ordering
*/

CREATE TABLE IF NOT EXISTS public_link_page_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'Kifer Saúde',
  bio text,
  avatar_url text,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public_link_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  url text NOT NULL,
  icon text NOT NULL DEFAULT 'link',
  is_active boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  click_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_public_link_items_position ON public_link_items(position);

ALTER TABLE public_link_page_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_link_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published link page settings"
  ON public_link_page_settings FOR SELECT
  USING (is_published = true);

CREATE POLICY "Admins can view all link page settings"
  ON public_link_page_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert link page settings"
  ON public_link_page_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update link page settings"
  ON public_link_page_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete link page settings"
  ON public_link_page_settings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Anyone can view active link items"
  ON public_link_items FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can view all link items"
  ON public_link_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert link items"
  ON public_link_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update link items"
  ON public_link_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete link items"
  ON public_link_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE OR REPLACE FUNCTION set_public_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_public_link_page_settings_updated_at ON public_link_page_settings;
CREATE TRIGGER trg_public_link_page_settings_updated_at
  BEFORE UPDATE ON public_link_page_settings
  FOR EACH ROW
  EXECUTE FUNCTION set_public_links_updated_at();

DROP TRIGGER IF EXISTS trg_public_link_items_updated_at ON public_link_items;
CREATE TRIGGER trg_public_link_items_updated_at
  BEFORE UPDATE ON public_link_items
  FOR EACH ROW
  EXECUTE FUNCTION set_public_links_updated_at();

CREATE OR REPLACE FUNCTION increment_public_link_click(link_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public_link_items
  SET click_count = click_count + 1
  WHERE id = link_id AND is_active = true;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_public_link_click(uuid) TO anon, authenticated;

INSERT INTO public_link_page_settings (title, bio, is_published)
SELECT 'Kifer Saúde', 'Planos de saúde com atendimento humano.', true
WHERE NOT EXISTS (SELECT 1 FROM public_link_page_settings);

INSERT INTO public.profile_permissions (role, module, can_view, can_edit)
VALUES
  ('admin', 'config-links', true, true),
  ('observer', 'config-links', false, false)
ON CONFLICT (role, module) DO UPDATE
SET
  can_view = EXCLUDED.can_view,
  can_edit = EXCLUDED.can_edit,
  updated_at = now();
