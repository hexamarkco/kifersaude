BEGIN;

ALTER TABLE public.comm_whatsapp_messages
  ADD COLUMN IF NOT EXISTS transcription_text text,
  ADD COLUMN IF NOT EXISTS transcription_status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS transcription_provider text,
  ADD COLUMN IF NOT EXISTS transcription_model text,
  ADD COLUMN IF NOT EXISTS transcription_error text,
  ADD COLUMN IF NOT EXISTS transcription_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS transcription_requested_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;

ALTER TABLE public.comm_whatsapp_messages
  DROP CONSTRAINT IF EXISTS comm_whatsapp_messages_transcription_status_check;

ALTER TABLE public.comm_whatsapp_messages
  ADD CONSTRAINT comm_whatsapp_messages_transcription_status_check
  CHECK (transcription_status IN ('idle', 'pending', 'processing', 'completed', 'failed'));

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_messages_transcription_status
  ON public.comm_whatsapp_messages (transcription_status, message_type, transcription_updated_at DESC, created_at DESC);

COMMENT ON COLUMN public.comm_whatsapp_messages.transcription_text IS
  'Transcricao sob demanda de mensagens de audio/voice do inbox WhatsApp.';

COMMENT ON COLUMN public.comm_whatsapp_messages.transcription_status IS
  'Estado da transcricao do audio/voice: idle, pending, processing, completed ou failed.';

COMMIT;
