BEGIN;

ALTER TABLE public.comm_follow_up_audit_log
  ADD COLUMN IF NOT EXISTS source_reminder_id uuid REFERENCES public.reminders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS batch_id uuid,
  ADD COLUMN IF NOT EXISTS trigger_source text,
  ADD COLUMN IF NOT EXISTS generated_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS current_action text,
  ADD COLUMN IF NOT EXISTS current_action_reason text,
  ADD COLUMN IF NOT EXISTS stage text,
  ADD COLUMN IF NOT EXISTS blocker text,
  ADD COLUMN IF NOT EXISTS goal text,
  ADD COLUMN IF NOT EXISTS commercial_function text,
  ADD COLUMN IF NOT EXISTS next_action_owner text,
  ADD COLUMN IF NOT EXISTS pending_microdecision text,
  ADD COLUMN IF NOT EXISTS last_commercial_commitment text,
  ADD COLUMN IF NOT EXISTS decision_maker text,
  ADD COLUMN IF NOT EXISTS opportunity_recommendation text,
  ADD COLUMN IF NOT EXISTS schedule_action text,
  ADD COLUMN IF NOT EXISTS schedule_suggested_date timestamptz,
  ADD COLUMN IF NOT EXISTS schedule_reason text,
  ADD COLUMN IF NOT EXISTS schedule_confidence text,
  ADD COLUMN IF NOT EXISTS rationale text,
  ADD COLUMN IF NOT EXISTS generated_text text,
  ADD COLUMN IF NOT EXISTS sent_text text,
  ADD COLUMN IF NOT EXISTS sent_at_actual timestamptz,
  ADD COLUMN IF NOT EXISTS schedule_approved boolean,
  ADD COLUMN IF NOT EXISTS schedule_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS schedule_approved_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_schedule_date timestamptz,
  ADD COLUMN IF NOT EXISTS created_reminder_id uuid REFERENCES public.reminders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reminder_origin text;

ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS follow_up_generation_id uuid REFERENCES public.comm_follow_up_audit_log(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS follow_up_batch_id uuid,
  ADD COLUMN IF NOT EXISTS follow_up_origin text,
  ADD COLUMN IF NOT EXISTS follow_up_approved_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS follow_up_suggested_at timestamptz,
  ADD COLUMN IF NOT EXISTS follow_up_approved_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_comm_follow_up_audit_log_chat_sent
  ON public.comm_follow_up_audit_log(chat_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_comm_follow_up_audit_log_generation_context
  ON public.comm_follow_up_audit_log(lead_id, current_action, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_reminders_follow_up_generation
  ON public.reminders(follow_up_generation_id)
  WHERE follow_up_generation_id IS NOT NULL;

DROP POLICY IF EXISTS "Usuarios autenticados podem atualizar auditoria follow-up" ON public.comm_follow_up_audit_log;
CREATE POLICY "Usuarios autenticados podem atualizar auditoria follow-up"
  ON public.comm_follow_up_audit_log FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.schedule_follow_up_reminder_v2(
  p_lead_id uuid,
  p_title text,
  p_description text,
  p_due_at timestamptz,
  p_priority text DEFAULT 'normal',
  p_generation_id uuid DEFAULT NULL,
  p_batch_id uuid DEFAULT NULL,
  p_origin text DEFAULT 'follow_up_v2',
  p_approved_by uuid DEFAULT NULL,
  p_suggested_at timestamptz DEFAULT NULL
)
RETURNS TABLE(reminder_id uuid, inserted boolean, proximo_retorno timestamptz)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_result record;
BEGIN
  SELECT * INTO v_result
  FROM public.schedule_follow_up_reminder(p_lead_id, p_title, p_description, p_due_at, p_priority);

  UPDATE public.reminders
  SET follow_up_generation_id = COALESCE(p_generation_id, follow_up_generation_id),
      follow_up_batch_id = COALESCE(p_batch_id, follow_up_batch_id),
      follow_up_origin = COALESCE(NULLIF(btrim(p_origin), ''), follow_up_origin),
      follow_up_approved_by = COALESCE(p_approved_by, follow_up_approved_by),
      follow_up_suggested_at = COALESCE(p_suggested_at, follow_up_suggested_at),
      follow_up_approved_at = now()
  WHERE id = v_result.reminder_id;

  RETURN QUERY SELECT v_result.reminder_id, v_result.inserted, v_result.proximo_retorno;
END;
$$;

GRANT EXECUTE ON FUNCTION public.schedule_follow_up_reminder_v2(uuid, text, text, timestamptz, text, uuid, uuid, text, uuid, timestamptz) TO authenticated;

COMMIT;

