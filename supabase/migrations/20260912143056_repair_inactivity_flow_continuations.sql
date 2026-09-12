-- Repair affected inactivity enrollments after the continuation anchor bug.
--
-- The worker used the original trigger timestamp for every later step. Once
-- the first automatic message was sent, its own outbound was interpreted as a
-- newer manual message and step 2 was skipped. Only resume rows where the
-- customer has still not replied and no job is currently active; all other
-- rows remain untouched and are handled by the normal guards.

WITH latest_visible_message AS (
  SELECT DISTINCT ON (c.lead_id)
    c.lead_id,
    m.direction,
    m.message_at
  FROM public.comm_whatsapp_chats c
  JOIN public.comm_whatsapp_messages m ON m.chat_id = c.id
  WHERE c.lead_id IS NOT NULL
    AND public.comm_whatsapp_message_preview_text(m.media_caption, m.text_content, m.message_type) IS NOT NULL
  ORDER BY c.lead_id, m.message_at DESC
), resumable_steps AS (
  SELECT
    skipped.id,
    completed.updated_at AS continuation_anchor_at
  FROM public.auto_contact_flow_jobs skipped
  JOIN public.auto_contact_flow_jobs completed
    ON completed.lead_id = skipped.lead_id
   AND completed.flow_id = skipped.flow_id
   AND completed.enrollment_id = skipped.enrollment_id
   AND completed.step_order = skipped.step_order - 1
   AND completed.status = 'completed'
  JOIN public.leads lead ON lead.id = skipped.lead_id
  JOIN latest_visible_message last_message ON last_message.lead_id = skipped.lead_id
  WHERE skipped.status = 'skipped'
    AND skipped.last_error = 'Nova mensagem enviada após abertura desta janela'
    AND skipped.enrollment_id IS NOT NULL
    AND skipped.step_order > 0
    AND NOT COALESCE(lead.skip_automation, false)
    AND last_message.direction = 'outbound'
    AND NOT EXISTS (
      SELECT 1
      FROM public.auto_contact_flow_jobs active_job
      WHERE active_job.lead_id = skipped.lead_id
        AND active_job.flow_id = skipped.flow_id
        AND active_job.status IN ('pending', 'processing')
    )
)
UPDATE public.auto_contact_flow_jobs job
SET status = 'pending',
    scheduled_at = now(),
    attempts = 0,
    trigger_message_at = resumable_steps.continuation_anchor_at,
    last_error = 'Retomado após correção do encadeamento de inatividade.',
    updated_at = now()
FROM resumable_steps
WHERE job.id = resumable_steps.id;
