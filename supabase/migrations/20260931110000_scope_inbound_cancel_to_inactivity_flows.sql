/*
  Enrollment-scoped inbound cancellation for inactivity flows.

  When a customer replies, cancel only the active enrollment's pending jobs —
  not all jobs for the lead. A new outbound can create a fresh enrollment.
*/

CREATE OR REPLACE FUNCTION public.cancel_auto_contact_jobs_on_inbound_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_id uuid;
  v_active_enrollment uuid;
BEGIN
  IF NEW.direction <> 'inbound'
    OR (TG_OP = 'UPDATE' AND OLD.direction = 'inbound')
  THEN
    RETURN NEW;
  END IF;

  IF public.comm_whatsapp_message_preview_text(NEW.media_caption, NEW.text_content, NEW.message_type) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT lead_id INTO v_lead_id
  FROM public.comm_whatsapp_chats
  WHERE id = NEW.chat_id;

  IF v_lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find the active enrollment (most recent pending/processing job with enrollment_id)
  SELECT j.enrollment_id INTO v_active_enrollment
  FROM public.auto_contact_flow_jobs j
  WHERE j.lead_id = v_lead_id
    AND j.status IN ('pending', 'processing')
    AND j.enrollment_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.integration_settings settings
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(settings.settings->'flows', '[]'::jsonb)) AS flow(value)
      WHERE settings.slug = 'whatsapp_auto_contact'
        AND flow.value->>'id' = j.flow_id
        AND flow.value->>'triggerType' = 'inactivity_duration'
    )
  ORDER BY j.created_at DESC
  LIMIT 1;

  IF v_active_enrollment IS NOT NULL THEN
    -- Cancel all pending jobs in this enrollment
    UPDATE public.auto_contact_flow_jobs j
    SET status = 'skipped',
        last_error = 'Cliente respondeu; execução cancelada',
        updated_at = now()
    WHERE j.lead_id = v_lead_id
      AND j.enrollment_id = v_active_enrollment
      AND j.status = 'pending';
  ELSE
    -- Legacy path: cancel pending jobs without enrollment_id (pre-migration)
    UPDATE public.auto_contact_flow_jobs j
    SET status = 'skipped',
        last_error = 'Cliente respondeu; régua automática cancelada',
        updated_at = now()
    WHERE j.lead_id = v_lead_id
      AND j.status = 'pending'
      AND j.enrollment_id IS NULL
      AND COALESCE(NEW.message_at, now()) >= j.created_at
      AND EXISTS (
        SELECT 1
        FROM public.integration_settings settings
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(settings.settings->'flows', '[]'::jsonb)) AS flow(value)
        WHERE settings.slug = 'whatsapp_auto_contact'
          AND flow.value->>'id' = j.flow_id
          AND flow.value->>'triggerType' = 'inactivity_duration'
      );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.cancel_auto_contact_jobs_on_inbound_message()
  IS 'Enrollment-scoped cancellation: cancels active enrollment jobs when customer replies. Legacy fallback for pre-enrollment jobs.';
