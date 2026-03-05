/*
  # Global WhatsApp quick replies

  Stores quick replies in database so they are shared across devices.
*/

CREATE TABLE IF NOT EXISTS public.whatsapp_quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  text text NOT NULL,
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_quick_replies
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS text text,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'whatsapp_quick_replies'
      AND constraint_name = 'whatsapp_quick_replies_created_by_fkey'
  ) THEN
    ALTER TABLE public.whatsapp_quick_replies
      ADD CONSTRAINT whatsapp_quick_replies_created_by_fkey
      FOREIGN KEY (created_by)
      REFERENCES public.user_profiles(id)
      ON DELETE SET NULL;
  END IF;
END $$;

UPDATE public.whatsapp_quick_replies
SET
  title = COALESCE(NULLIF(btrim(title), ''), 'Resposta rapida'),
  text = COALESCE(text, ''),
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, now());

ALTER TABLE public.whatsapp_quick_replies
  ALTER COLUMN title SET NOT NULL,
  ALTER COLUMN text SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_quick_replies_updated_at
  ON public.whatsapp_quick_replies (updated_at DESC);

CREATE OR REPLACE FUNCTION public.set_whatsapp_quick_replies_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_whatsapp_quick_replies_updated_at
  ON public.whatsapp_quick_replies;

CREATE TRIGGER trg_whatsapp_quick_replies_updated_at
BEFORE UPDATE ON public.whatsapp_quick_replies
FOR EACH ROW
EXECUTE FUNCTION public.set_whatsapp_quick_replies_updated_at();

ALTER TABLE public.whatsapp_quick_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read whatsapp quick replies"
  ON public.whatsapp_quick_replies;
DROP POLICY IF EXISTS "Authenticated users can insert whatsapp quick replies"
  ON public.whatsapp_quick_replies;
DROP POLICY IF EXISTS "Authenticated users can update whatsapp quick replies"
  ON public.whatsapp_quick_replies;
DROP POLICY IF EXISTS "Authenticated users can delete whatsapp quick replies"
  ON public.whatsapp_quick_replies;

CREATE POLICY "Authenticated users can read whatsapp quick replies"
  ON public.whatsapp_quick_replies
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert whatsapp quick replies"
  ON public.whatsapp_quick_replies
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update whatsapp quick replies"
  ON public.whatsapp_quick_replies
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete whatsapp quick replies"
  ON public.whatsapp_quick_replies
  FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);
