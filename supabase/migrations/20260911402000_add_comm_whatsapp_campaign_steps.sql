/*
  # Add multi-step WhatsApp campaign sequences

  Campaigns can now send a package of messages with a configurable delay before
  each follow-up step. Targets already had runtime fields prepared for this
  (`current_step_index` and `next_send_at`).
*/

CREATE TABLE IF NOT EXISTS public.comm_whatsapp_campaign_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.comm_whatsapp_campaigns(id) ON DELETE CASCADE,
  step_index integer NOT NULL,
  message_text text NOT NULL,
  delay_amount integer NOT NULL DEFAULT 0,
  delay_unit text NOT NULL DEFAULT 'minutes',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comm_whatsapp_campaign_steps_index_check CHECK (step_index >= 0),
  CONSTRAINT comm_whatsapp_campaign_steps_message_check CHECK (length(btrim(message_text)) > 0),
  CONSTRAINT comm_whatsapp_campaign_steps_delay_amount_check CHECK (delay_amount >= 0),
  CONSTRAINT comm_whatsapp_campaign_steps_delay_unit_check CHECK (delay_unit IN ('seconds', 'minutes', 'hours', 'days')),
  CONSTRAINT comm_whatsapp_campaign_steps_campaign_index_key UNIQUE (campaign_id, step_index)
);

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_campaign_steps_campaign_index
  ON public.comm_whatsapp_campaign_steps (campaign_id, step_index);

DROP TRIGGER IF EXISTS trg_comm_whatsapp_campaign_steps_updated_at ON public.comm_whatsapp_campaign_steps;
CREATE TRIGGER trg_comm_whatsapp_campaign_steps_updated_at
  BEFORE UPDATE ON public.comm_whatsapp_campaign_steps
  FOR EACH ROW
  EXECUTE FUNCTION public.set_comm_whatsapp_campaign_updated_at();

ALTER TABLE public.comm_whatsapp_campaign_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view comm whatsapp campaign steps"
  ON public.comm_whatsapp_campaign_steps FOR SELECT TO authenticated
  USING (public.current_user_can_view_comm_whatsapp());

CREATE POLICY "Users can edit comm whatsapp campaign steps"
  ON public.comm_whatsapp_campaign_steps FOR ALL TO authenticated
  USING (public.current_user_can_edit_comm_whatsapp())
  WITH CHECK (public.current_user_can_edit_comm_whatsapp());

CREATE POLICY "Service role can manage comm whatsapp campaign steps"
  ON public.comm_whatsapp_campaign_steps FOR ALL TO service_role
  USING (true) WITH CHECK (true);

INSERT INTO public.comm_whatsapp_campaign_steps (campaign_id, step_index, message_text, delay_amount, delay_unit)
SELECT c.id, 0, c.message_text, 0, 'minutes'
FROM public.comm_whatsapp_campaigns c
WHERE length(btrim(COALESCE(c.message_text, ''))) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.comm_whatsapp_campaign_steps s
    WHERE s.campaign_id = c.id
  );
