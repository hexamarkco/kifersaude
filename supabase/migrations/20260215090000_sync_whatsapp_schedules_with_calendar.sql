/*
  # Integração de agendamentos do WhatsApp com o calendário de tarefas

  - Adiciona coluna de vínculo na tabela `reminders` para rastrear o agendamento correspondente.
  - Cria gatilhos para sincronizar automaticamente lembretes/tarefas toda vez que um
    agendamento do WhatsApp for criado, atualizado ou removido.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'reminders'
      AND table_schema = 'public'
      AND column_name = 'whatsapp_schedule_id'
  ) THEN
    ALTER TABLE public.reminders
      ADD COLUMN whatsapp_schedule_id uuid;
  END IF;
END $$;

ALTER TABLE public.reminders
  DROP CONSTRAINT IF EXISTS reminders_whatsapp_schedule_id_fkey;

ALTER TABLE public.reminders
  ADD CONSTRAINT reminders_whatsapp_schedule_id_fkey
  FOREIGN KEY (whatsapp_schedule_id)
  REFERENCES public.whatsapp_scheduled_messages(id)
  ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_reminders_whatsapp_schedule_id
  ON public.reminders(whatsapp_schedule_id);

CREATE UNIQUE INDEX IF NOT EXISTS reminders_whatsapp_schedule_unique
  ON public.reminders(whatsapp_schedule_id)
  WHERE whatsapp_schedule_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_whatsapp_schedule_with_reminder()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_schedule_id uuid := COALESCE(NEW.id, OLD.id);
  schedule_status text := COALESCE(NEW.status, OLD.status, 'pending');
  scheduled_at timestamptz := COALESCE(NEW.scheduled_send_at, OLD.scheduled_send_at);
  chat_identifier text;
  chat_phone text;
  reminder_id uuid;
  reminder_title text;
  reminder_description text;
  normalized_message text := COALESCE(NEW.message, OLD.message, '');
  normalized_error text := COALESCE(NEW.last_error, OLD.last_error, NULL);
  is_completed boolean := schedule_status IN ('sent', 'cancelled');
  reminder_priority text := CASE WHEN schedule_status = 'failed' THEN 'alta' ELSE 'normal' END;
  reminder_tags text[] := ARRAY['whatsapp', 'mensagem-agendada'];
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.reminders WHERE whatsapp_schedule_id = target_schedule_id;
    RETURN OLD;
  END IF;

  IF scheduled_at IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    COALESCE(chat.display_name, chat.chat_name, chat.phone, 'Contato sem nome') AS label,
    chat.phone
  INTO chat_identifier, chat_phone
  FROM public.whatsapp_chats AS chat
  WHERE chat.id = COALESCE(NEW.chat_id, OLD.chat_id);

  reminder_title := FORMAT('WhatsApp: enviar mensagem para %s', COALESCE(chat_identifier, 'contato sem nome'));

  reminder_description := FORMAT(
    'Mensagem agendada no WhatsApp para %s (%s) às %s.\n\nConteúdo previsto:\n%s',
    COALESCE(chat_identifier, 'contato sem nome'),
    COALESCE(chat_phone, 'sem telefone'),
    TO_CHAR(scheduled_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
    normalized_message
  );

  IF schedule_status = 'failed' THEN
    reminder_tags := array_append(reminder_tags, 'erro');
  END IF;

  IF normalized_error IS NOT NULL AND schedule_status = 'failed' THEN
    reminder_description := reminder_description || FORMAT('\n\nÚltimo erro: %s', normalized_error);
  END IF;

  SELECT id INTO reminder_id
  FROM public.reminders
  WHERE whatsapp_schedule_id = target_schedule_id
  LIMIT 1;

  IF reminder_id IS NULL THEN
    INSERT INTO public.reminders (
      tipo,
      titulo,
      descricao,
      data_lembrete,
      lido,
      prioridade,
      tags,
      whatsapp_schedule_id,
      concluido_em
    )
    VALUES (
      'Tarefa',
      reminder_title,
      reminder_description,
      scheduled_at,
      is_completed,
      reminder_priority,
      reminder_tags,
      target_schedule_id,
      CASE WHEN is_completed THEN NOW() ELSE NULL END
    )
    RETURNING id INTO reminder_id;
  ELSE
    UPDATE public.reminders
    SET
      titulo = reminder_title,
      descricao = reminder_description,
      data_lembrete = scheduled_at,
      lido = is_completed,
      prioridade = reminder_priority,
      tags = reminder_tags,
      concluido_em = CASE WHEN is_completed THEN COALESCE(concluido_em, NOW()) ELSE NULL END
    WHERE id = reminder_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS whatsapp_schedule_sync_trigger ON public.whatsapp_scheduled_messages;
DROP TRIGGER IF EXISTS whatsapp_schedule_cleanup_trigger ON public.whatsapp_scheduled_messages;

CREATE TRIGGER whatsapp_schedule_sync_trigger
AFTER INSERT OR UPDATE ON public.whatsapp_scheduled_messages
FOR EACH ROW
EXECUTE FUNCTION public.sync_whatsapp_schedule_with_reminder();

CREATE TRIGGER whatsapp_schedule_cleanup_trigger
AFTER DELETE ON public.whatsapp_scheduled_messages
FOR EACH ROW
EXECUTE FUNCTION public.sync_whatsapp_schedule_with_reminder();
