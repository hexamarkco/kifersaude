/*
  # Communication WhatsApp campaigns MVP

  Adds the first campaign/disparo foundation aligned with the current
  comm_whatsapp inbox stack. This migration intentionally keeps sending
  orchestration out of the database: the worker will consume queued targets
  through Edge Functions in the next phase.
*/

BEGIN;

CREATE TABLE IF NOT EXISTS public.comm_whatsapp_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  objective text,
  status text NOT NULL DEFAULT 'draft',
  audience_source text NOT NULL DEFAULT 'crm',
  audience_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  message_text text NOT NULL DEFAULT '',
  scheduled_at timestamptz,
  pacing_per_minute integer NOT NULL DEFAULT 12,
  send_window_start time,
  send_window_end time,
  stop_on_reply boolean NOT NULL DEFAULT true,
  create_leads_from_csv boolean NOT NULL DEFAULT false,
  total_targets integer NOT NULL DEFAULT 0,
  valid_targets integer NOT NULL DEFAULT 0,
  invalid_targets integer NOT NULL DEFAULT 0,
  pending_targets integer NOT NULL DEFAULT 0,
  sent_targets integer NOT NULL DEFAULT 0,
  failed_targets integer NOT NULL DEFAULT 0,
  responded_targets integer NOT NULL DEFAULT 0,
  stopped_targets integer NOT NULL DEFAULT 0,
  last_error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comm_whatsapp_campaigns_status_check
    CHECK (status IN ('draft', 'scheduled', 'queued', 'running', 'paused', 'completed', 'cancelled')),
  CONSTRAINT comm_whatsapp_campaigns_audience_source_check
    CHECK (audience_source IN ('crm', 'csv', 'manual', 'mixed')),
  CONSTRAINT comm_whatsapp_campaigns_audience_config_is_object
    CHECK (jsonb_typeof(audience_config) = 'object'),
  CONSTRAINT comm_whatsapp_campaigns_pacing_check
    CHECK (pacing_per_minute BETWEEN 1 AND 120),
  CONSTRAINT comm_whatsapp_campaigns_counters_check
    CHECK (
      total_targets >= 0
      AND valid_targets >= 0
      AND invalid_targets >= 0
      AND pending_targets >= 0
      AND sent_targets >= 0
      AND failed_targets >= 0
      AND responded_targets >= 0
      AND stopped_targets >= 0
    )
);

CREATE TABLE IF NOT EXISTS public.comm_whatsapp_campaign_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.comm_whatsapp_campaigns(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  chat_id uuid REFERENCES public.comm_whatsapp_chats(id) ON DELETE SET NULL,
  phone_number text NOT NULL,
  phone_digits text NOT NULL,
  display_name text,
  source_kind text NOT NULL DEFAULT 'crm',
  source_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  current_step_index integer NOT NULL DEFAULT 0,
  next_send_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  responded_at timestamptz,
  stopped_at timestamptz,
  stopped_reason text,
  error_message text,
  external_message_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comm_whatsapp_campaign_targets_status_check
    CHECK (status IN ('pending', 'scheduled', 'sending', 'sent', 'responded', 'stopped', 'failed', 'invalid', 'cancelled')),
  CONSTRAINT comm_whatsapp_campaign_targets_source_kind_check
    CHECK (source_kind IN ('crm', 'csv', 'manual')),
  CONSTRAINT comm_whatsapp_campaign_targets_source_payload_is_object
    CHECK (jsonb_typeof(source_payload) = 'object'),
  CONSTRAINT comm_whatsapp_campaign_targets_attempts_check
    CHECK (attempts >= 0),
  CONSTRAINT comm_whatsapp_campaign_targets_campaign_phone_unique
    UNIQUE (campaign_id, phone_digits)
);

CREATE TABLE IF NOT EXISTS public.comm_whatsapp_opt_outs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  phone_digits text NOT NULL,
  phone_number text,
  status text NOT NULL DEFAULT 'blocked',
  reason text,
  source text NOT NULL DEFAULT 'manual',
  source_campaign_id uuid REFERENCES public.comm_whatsapp_campaigns(id) ON DELETE SET NULL,
  source_chat_id uuid REFERENCES public.comm_whatsapp_chats(id) ON DELETE SET NULL,
  source_message_id uuid REFERENCES public.comm_whatsapp_messages(id) ON DELETE SET NULL,
  ai_suggestion_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comm_whatsapp_opt_outs_status_check
    CHECK (status IN ('blocked', 'allowed')),
  CONSTRAINT comm_whatsapp_opt_outs_source_check
    CHECK (source IN ('manual', 'ai_suggestion', 'import', 'system')),
  CONSTRAINT comm_whatsapp_opt_outs_phone_digits_unique
    UNIQUE (phone_digits)
);

CREATE TABLE IF NOT EXISTS public.comm_whatsapp_ai_intent_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid REFERENCES public.comm_whatsapp_chats(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.comm_whatsapp_messages(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.comm_whatsapp_campaigns(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  phone_digits text,
  intent text NOT NULL,
  confidence numeric(4, 3) NOT NULL DEFAULT 0,
  recommended_action text NOT NULL DEFAULT 'review',
  reason text,
  evidence text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comm_whatsapp_ai_intent_suggestions_intent_check
    CHECK (intent IN ('opt_out', 'negative_interest', 'angry_or_complaint', 'wrong_number', 'continue_conversation', 'unclear')),
  CONSTRAINT comm_whatsapp_ai_intent_suggestions_confidence_check
    CHECK (confidence >= 0 AND confidence <= 1),
  CONSTRAINT comm_whatsapp_ai_intent_suggestions_recommended_action_check
    CHECK (recommended_action IN ('suggest_block_whatsapp_campaigns', 'keep_active', 'review')),
  CONSTRAINT comm_whatsapp_ai_intent_suggestions_status_check
    CHECK (status IN ('pending', 'accepted', 'dismissed'))
);

CREATE TABLE IF NOT EXISTS public.comm_whatsapp_campaign_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.comm_whatsapp_campaigns(id) ON DELETE CASCADE,
  target_id uuid REFERENCES public.comm_whatsapp_campaign_targets(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comm_whatsapp_campaign_events_payload_is_object
    CHECK (jsonb_typeof(payload) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_campaigns_status_created
  ON public.comm_whatsapp_campaigns (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_campaign_targets_campaign_status
  ON public.comm_whatsapp_campaign_targets (campaign_id, status, next_send_at);

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_campaign_targets_phone_digits
  ON public.comm_whatsapp_campaign_targets (phone_digits);

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_opt_outs_phone_blocked
  ON public.comm_whatsapp_opt_outs (phone_digits)
  WHERE status = 'blocked';

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_ai_intent_suggestions_status
  ON public.comm_whatsapp_ai_intent_suggestions (status, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_comm_whatsapp_campaign_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_comm_whatsapp_campaigns_updated_at ON public.comm_whatsapp_campaigns;
CREATE TRIGGER trg_comm_whatsapp_campaigns_updated_at
  BEFORE UPDATE ON public.comm_whatsapp_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.set_comm_whatsapp_campaign_updated_at();

DROP TRIGGER IF EXISTS trg_comm_whatsapp_campaign_targets_updated_at ON public.comm_whatsapp_campaign_targets;
CREATE TRIGGER trg_comm_whatsapp_campaign_targets_updated_at
  BEFORE UPDATE ON public.comm_whatsapp_campaign_targets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_comm_whatsapp_campaign_updated_at();

DROP TRIGGER IF EXISTS trg_comm_whatsapp_opt_outs_updated_at ON public.comm_whatsapp_opt_outs;
CREATE TRIGGER trg_comm_whatsapp_opt_outs_updated_at
  BEFORE UPDATE ON public.comm_whatsapp_opt_outs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_comm_whatsapp_campaign_updated_at();

DROP TRIGGER IF EXISTS trg_comm_whatsapp_ai_intent_suggestions_updated_at ON public.comm_whatsapp_ai_intent_suggestions;
CREATE TRIGGER trg_comm_whatsapp_ai_intent_suggestions_updated_at
  BEFORE UPDATE ON public.comm_whatsapp_ai_intent_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_comm_whatsapp_campaign_updated_at();

ALTER TABLE public.comm_whatsapp_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comm_whatsapp_campaign_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comm_whatsapp_opt_outs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comm_whatsapp_ai_intent_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comm_whatsapp_campaign_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view comm whatsapp campaigns"
  ON public.comm_whatsapp_campaigns FOR SELECT TO authenticated
  USING (public.current_user_can_view_comm_whatsapp());

CREATE POLICY "Users can edit comm whatsapp campaigns"
  ON public.comm_whatsapp_campaigns FOR ALL TO authenticated
  USING (public.current_user_can_edit_comm_whatsapp())
  WITH CHECK (public.current_user_can_edit_comm_whatsapp());

CREATE POLICY "Service role can manage comm whatsapp campaigns"
  ON public.comm_whatsapp_campaigns FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users can view comm whatsapp campaign targets"
  ON public.comm_whatsapp_campaign_targets FOR SELECT TO authenticated
  USING (public.current_user_can_view_comm_whatsapp());

CREATE POLICY "Users can edit comm whatsapp campaign targets"
  ON public.comm_whatsapp_campaign_targets FOR ALL TO authenticated
  USING (public.current_user_can_edit_comm_whatsapp())
  WITH CHECK (public.current_user_can_edit_comm_whatsapp());

CREATE POLICY "Service role can manage comm whatsapp campaign targets"
  ON public.comm_whatsapp_campaign_targets FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users can view comm whatsapp opt outs"
  ON public.comm_whatsapp_opt_outs FOR SELECT TO authenticated
  USING (public.current_user_can_view_comm_whatsapp());

CREATE POLICY "Users can edit comm whatsapp opt outs"
  ON public.comm_whatsapp_opt_outs FOR ALL TO authenticated
  USING (public.current_user_can_edit_comm_whatsapp())
  WITH CHECK (public.current_user_can_edit_comm_whatsapp());

CREATE POLICY "Service role can manage comm whatsapp opt outs"
  ON public.comm_whatsapp_opt_outs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users can view comm whatsapp ai intent suggestions"
  ON public.comm_whatsapp_ai_intent_suggestions FOR SELECT TO authenticated
  USING (public.current_user_can_view_comm_whatsapp());

CREATE POLICY "Users can edit comm whatsapp ai intent suggestions"
  ON public.comm_whatsapp_ai_intent_suggestions FOR ALL TO authenticated
  USING (public.current_user_can_edit_comm_whatsapp())
  WITH CHECK (public.current_user_can_edit_comm_whatsapp());

CREATE POLICY "Service role can manage comm whatsapp ai intent suggestions"
  ON public.comm_whatsapp_ai_intent_suggestions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users can view comm whatsapp campaign events"
  ON public.comm_whatsapp_campaign_events FOR SELECT TO authenticated
  USING (public.current_user_can_view_comm_whatsapp());

CREATE POLICY "Users can insert comm whatsapp campaign events"
  ON public.comm_whatsapp_campaign_events FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_edit_comm_whatsapp());

CREATE POLICY "Service role can manage comm whatsapp campaign events"
  ON public.comm_whatsapp_campaign_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

INSERT INTO public.profile_permissions (role, module, can_view, can_edit)
VALUES ('admin', 'whatsapp-campaigns', true, true)
ON CONFLICT (role, module) DO UPDATE
SET can_view = EXCLUDED.can_view,
    can_edit = EXCLUDED.can_edit,
    updated_at = now();

COMMIT;
