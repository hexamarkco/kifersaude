/*
  # Add AI attendance critique for WhatsApp inbox

  On-demand AI analysis of a WhatsApp attendance (service session), stored
  so past analyses can be reviewed without regenerating them. Written only
  by the comm-whatsapp-critique-attendance edge function via the service
  role client; readable by anyone who can view the WhatsApp inbox.
*/

BEGIN;

CREATE TABLE IF NOT EXISTS public.comm_whatsapp_attendance_critiques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.comm_whatsapp_chats(id) ON DELETE CASCADE,
  generated_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  provider text NOT NULL,
  model text NOT NULL,
  session_started_at timestamptz NOT NULL,
  session_ended_at timestamptz NOT NULL,
  message_count integer NOT NULL DEFAULT 0,
  critique jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_attendance_critiques_chat_generated_at
  ON public.comm_whatsapp_attendance_critiques (chat_id, generated_at DESC);

ALTER TABLE public.comm_whatsapp_attendance_critiques ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view comm whatsapp attendance critiques" ON public.comm_whatsapp_attendance_critiques;
CREATE POLICY "Authenticated users can view comm whatsapp attendance critiques"
  ON public.comm_whatsapp_attendance_critiques
  FOR SELECT
  TO authenticated
  USING (public.current_user_can_view_comm_whatsapp());

COMMIT;
