/*
  Limit inbound-response cancellation to inactivity flows.

  The inbound message trigger exists to stop "sem resposta" follow-ups as soon
  as the customer replies. It must not cancel administrative jobs from the
  Abordagem lead_created flow, such as updating the lead to Contato Inicial.
*/

CREATE OR REPLACE FUNCTION public.cancel_auto_contact_jobs_on_inbound_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_id uuid;
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

  UPDATE public.auto_contact_flow_jobs j
  SET status = 'skipped',
      last_error = 'Cliente respondeu; régua automática cancelada',
      updated_at = now()
  WHERE j.lead_id = v_lead_id
    AND j.status = 'pending'
    -- Historical syncs must not cancel a flow created after the message occurred.
    AND COALESCE(NEW.message_at, now()) >= j.created_at
    AND EXISTS (
      SELECT 1
      FROM public.integration_settings settings
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(settings.settings->'flows', '[]'::jsonb)) AS flow(value)
      WHERE settings.slug = 'whatsapp_auto_contact'
        AND flow.value->>'id' = j.flow_id
        AND flow.value->>'triggerType' = 'inactivity_duration'
    );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.cancel_auto_contact_jobs_on_inbound_message()
  IS 'Cancels pending auto-contact jobs when a customer replies, restricted to inactivity_duration flows so lead_created Abordagem status updates are not skipped.';
