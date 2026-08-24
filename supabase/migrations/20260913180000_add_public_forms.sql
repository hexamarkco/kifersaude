/*
  # Public lead-capture forms (multi-step, multiple-choice style)

  ## Description
  Adds the tables that power configurable public lead-capture forms at
  /forms/:slug and their admin builder at Configurações > Formulários.

  1. New Tables
    - `public_forms` (form settings: slug, title, success copy, whether it
      requests geolocation, publish flag, denormalized submission_count)
    - `public_form_steps` (ordered questions: single choice, multiple
      choice, short text or the fixed final "contact" step, with an
      optional `field_key` mapping the answer onto a Lead column)
    - `public_form_submissions` (raw answers + contact info + geolocation
      captured from the browser, linked to the Lead created from it)

  2. Security
    - Enable RLS on all three tables
    - Anyone (anon + authenticated) can read a published form and its steps
      — required for the public /forms/:slug page
    - Only admins can manage forms/steps or read submissions; the public
      submit flow always goes through the `public-form-submit` Edge
      Function (service role), never direct table access
    - `increment_public_form_submission_count` keeps `submission_count` in
      sync via trigger whenever a submission is inserted

  3. Indexes
    - `public_form_steps(form_id, position)` for ordered rendering
    - `public_form_submissions(form_id, created_at desc)` for the admin list
*/

CREATE TABLE IF NOT EXISTS public_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) BETWEEN 2 AND 80),
  title text NOT NULL,
  description text,
  success_headline text NOT NULL DEFAULT 'Recebemos sua solicitação!',
  success_message text NOT NULL DEFAULT 'Nossa equipe vai entrar em contato em breve.',
  whatsapp_redirect boolean NOT NULL DEFAULT false,
  whatsapp_message_template text,
  request_geolocation boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT false,
  submission_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public_form_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public_forms(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  step_type text NOT NULL CHECK (step_type IN ('single_choice', 'multi_choice', 'short_text', 'contact')),
  title text NOT NULL,
  description text,
  placeholder text,
  is_required boolean NOT NULL DEFAULT true,
  field_key text CHECK (field_key IN ('cidade', 'tipo_contratacao') OR field_key IS NULL),
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_public_form_steps_form_position ON public_form_steps(form_id, position);

CREATE TABLE IF NOT EXISTS public_form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public_forms(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  contact_name text NOT NULL,
  contact_phone text NOT NULL,
  contact_email text,
  latitude double precision,
  longitude double precision,
  geo_accuracy_m double precision,
  geo_permission text NOT NULL DEFAULT 'not_requested'
    CHECK (geo_permission IN ('granted', 'denied', 'unavailable', 'not_requested')),
  user_agent text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_public_form_submissions_form ON public_form_submissions(form_id, created_at DESC);

ALTER TABLE public_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_form_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_form_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published forms"
  ON public_forms FOR SELECT
  USING (is_published = true);

CREATE POLICY "Admins can view all forms"
  ON public_forms FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert forms"
  ON public_forms FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update forms"
  ON public_forms FOR UPDATE
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

CREATE POLICY "Admins can delete forms"
  ON public_forms FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Anyone can view steps of published forms"
  ON public_form_steps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public_forms
      WHERE public_forms.id = public_form_steps.form_id
      AND public_forms.is_published = true
    )
  );

CREATE POLICY "Admins can view all form steps"
  ON public_form_steps FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert form steps"
  ON public_form_steps FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update form steps"
  ON public_form_steps FOR UPDATE
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

CREATE POLICY "Admins can delete form steps"
  ON public_form_steps FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can view form submissions"
  ON public_form_submissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE OR REPLACE FUNCTION set_public_forms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_public_forms_updated_at ON public_forms;
CREATE TRIGGER trg_public_forms_updated_at
  BEFORE UPDATE ON public_forms
  FOR EACH ROW
  EXECUTE FUNCTION set_public_forms_updated_at();

DROP TRIGGER IF EXISTS trg_public_form_steps_updated_at ON public_form_steps;
CREATE TRIGGER trg_public_form_steps_updated_at
  BEFORE UPDATE ON public_form_steps
  FOR EACH ROW
  EXECUTE FUNCTION set_public_forms_updated_at();

CREATE OR REPLACE FUNCTION increment_public_form_submission_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public_forms
  SET submission_count = submission_count + 1
  WHERE id = NEW.form_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_public_form_submissions_increment_count ON public_form_submissions;
CREATE TRIGGER trg_public_form_submissions_increment_count
  AFTER INSERT ON public_form_submissions
  FOR EACH ROW
  EXECUTE FUNCTION increment_public_form_submission_count();

INSERT INTO public.profile_permissions (role, module, can_view, can_edit)
VALUES
  ('admin', 'config-forms', true, true),
  ('observer', 'config-forms', false, false)
ON CONFLICT (role, module) DO UPDATE
SET
  can_view = EXCLUDED.can_view,
  can_edit = EXCLUDED.can_edit,
  updated_at = now();
