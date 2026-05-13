BEGIN;

CREATE OR REPLACE FUNCTION public.schedule_follow_up_reminder(
  p_lead_id uuid,
  p_title text,
  p_description text,
  p_due_at timestamptz,
  p_priority text DEFAULT 'normal'
)
RETURNS TABLE(
  reminder_id uuid,
  inserted boolean,
  proximo_retorno timestamptz
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_title text := NULLIF(btrim(COALESCE(p_title, '')), '');
  v_description text := NULLIF(btrim(COALESCE(p_description, '')), '');
  v_priority text := NULLIF(btrim(COALESCE(p_priority, 'normal')), '');
  v_reminder_id uuid;
  v_inserted boolean := false;
  v_next_return timestamptz;
  v_lock_key text;
BEGIN
  IF p_lead_id IS NULL THEN
    RAISE EXCEPTION 'Lead obrigatório para agendar follow-up.';
  END IF;

  IF v_title IS NULL THEN
    RAISE EXCEPTION 'Título obrigatório para agendar follow-up.';
  END IF;

  IF p_due_at IS NULL THEN
    RAISE EXCEPTION 'Data obrigatória para agendar follow-up.';
  END IF;

  v_lock_key := p_lead_id::text || '|Follow-up|' || p_due_at::text || '|' || lower(v_title);
  PERFORM pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));

  SELECT r.id
  INTO v_reminder_id
  FROM public.reminders r
  WHERE r.lead_id = p_lead_id
    AND r.contract_id IS NULL
    AND r.tipo = 'Follow-up'
    AND r.titulo = v_title
    AND r.data_lembrete = p_due_at
    AND COALESCE(r.lido, false) = false
  ORDER BY r.created_at ASC, r.id ASC
  LIMIT 1;

  IF v_reminder_id IS NULL THEN
    INSERT INTO public.reminders (
      lead_id,
      tipo,
      titulo,
      descricao,
      data_lembrete,
      lido,
      prioridade
    ) VALUES (
      p_lead_id,
      'Follow-up',
      v_title,
      v_description,
      p_due_at,
      false,
      COALESCE(v_priority, 'normal')
    )
    RETURNING id INTO v_reminder_id;

    v_inserted := true;
  END IF;

  SELECT r.data_lembrete
  INTO v_next_return
  FROM public.reminders r
  WHERE r.lead_id = p_lead_id
    AND COALESCE(r.lido, false) = false
    AND r.data_lembrete >= now()
  ORDER BY r.data_lembrete ASC, r.id ASC
  LIMIT 1;

  UPDATE public.leads
  SET proximo_retorno = v_next_return
  WHERE id = p_lead_id;

  RETURN QUERY SELECT v_reminder_id, v_inserted, v_next_return;
END;
$$;

GRANT EXECUTE ON FUNCTION public.schedule_follow_up_reminder(uuid, text, text, timestamptz, text) TO authenticated;

COMMIT;
