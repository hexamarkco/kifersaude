/*
  # Persistencia de transcricao de audio do WhatsApp

  ## Objetivo
  Garante que a transcricao de audios fique armazenada em coluna dedicada,
  permitindo reutilizacao consistente em copiar chat, follow-up com IA e futuras sincronizacoes.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'whatsapp_messages'
      AND column_name = 'transcription_text'
  ) THEN
    ALTER TABLE public.whatsapp_messages
      ADD COLUMN transcription_text text;
  END IF;
END $$;

COMMENT ON COLUMN public.whatsapp_messages.transcription_text IS
  'Transcricao persistida de audios do WhatsApp para reutilizacao em contextos de IA e exportacao de conversa.';
