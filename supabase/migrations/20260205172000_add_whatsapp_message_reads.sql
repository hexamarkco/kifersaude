/*
  # WhatsApp message read tracking
*/

CREATE TABLE IF NOT EXISTS public.whatsapp_message_reads (
  message_id text NOT NULL REFERENCES public.whatsapp_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

ALTER TABLE public.whatsapp_message_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read own whatsapp message reads" ON public.whatsapp_message_reads;
CREATE POLICY "Authenticated users can read own whatsapp message reads"
  ON public.whatsapp_message_reads FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can insert own whatsapp message reads" ON public.whatsapp_message_reads;
CREATE POLICY "Authenticated users can insert own whatsapp message reads"
  ON public.whatsapp_message_reads FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
