/*
  # Disparos WhatsApp: midia, modelos salvos, recorrencia e teste A/B

  - Etapas de campanha podem anexar midia (imagem, documento ou video) e podem
    ter uma variante alternativa (A/B) para a mensagem inicial.
  - Nova tabela de modelos salvos para reaproveitar pacotes de mensagens.
  - Campanhas ganham configuracao de teste A/B e de recorrencia (repetir a
    campanha periodicamente para o mesmo publico de CRM).
  - Alvos ganham a variante A/B efetivamente sorteada para eles.
*/

BEGIN;

-- Midia nas etapas -----------------------------------------------------

ALTER TABLE public.comm_whatsapp_campaign_steps
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_type text,
  ADD COLUMN IF NOT EXISTS media_filename text,
  ADD COLUMN IF NOT EXISTS variant_label text NOT NULL DEFAULT 'ANY';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'comm_whatsapp_campaign_steps_message_check'
      AND conrelid = 'public.comm_whatsapp_campaign_steps'::regclass
  ) THEN
    ALTER TABLE public.comm_whatsapp_campaign_steps
      DROP CONSTRAINT comm_whatsapp_campaign_steps_message_check;
  END IF;
END $$;

-- Mensagem pode ficar vazia quando a etapa e midia-only (legenda opcional).
ALTER TABLE public.comm_whatsapp_campaign_steps
  ADD CONSTRAINT comm_whatsapp_campaign_steps_message_or_media_check
  CHECK (length(btrim(message_text)) > 0 OR media_url IS NOT NULL);

ALTER TABLE public.comm_whatsapp_campaign_steps
  ADD CONSTRAINT comm_whatsapp_campaign_steps_media_type_check
  CHECK (media_type IS NULL OR media_type IN ('image', 'document', 'video'));

ALTER TABLE public.comm_whatsapp_campaign_steps
  ADD CONSTRAINT comm_whatsapp_campaign_steps_variant_label_check
  CHECK (variant_label IN ('ANY', 'A', 'B'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'comm_whatsapp_campaign_steps_campaign_index_key'
      AND conrelid = 'public.comm_whatsapp_campaign_steps'::regclass
  ) THEN
    ALTER TABLE public.comm_whatsapp_campaign_steps
      DROP CONSTRAINT comm_whatsapp_campaign_steps_campaign_index_key;
  END IF;
END $$;

ALTER TABLE public.comm_whatsapp_campaign_steps
  ADD CONSTRAINT comm_whatsapp_campaign_steps_campaign_index_variant_key
  UNIQUE (campaign_id, step_index, variant_label);

-- Teste A/B e recorrencia na campanha -----------------------------------

ALTER TABLE public.comm_whatsapp_campaigns
  ADD COLUMN IF NOT EXISTS ab_test_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ab_split_percent integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS recurrence_rule text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS recurrence_interval integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS recurrence_end_at timestamptz,
  ADD COLUMN IF NOT EXISTS recurrence_next_run_at timestamptz,
  ADD COLUMN IF NOT EXISTS recurrence_runs_completed integer NOT NULL DEFAULT 0;

ALTER TABLE public.comm_whatsapp_campaigns
  ADD CONSTRAINT comm_whatsapp_campaigns_ab_split_percent_check
  CHECK (ab_split_percent BETWEEN 1 AND 99);

ALTER TABLE public.comm_whatsapp_campaigns
  ADD CONSTRAINT comm_whatsapp_campaigns_recurrence_rule_check
  CHECK (recurrence_rule IN ('none', 'daily', 'weekly', 'monthly'));

ALTER TABLE public.comm_whatsapp_campaigns
  ADD CONSTRAINT comm_whatsapp_campaigns_recurrence_interval_check
  CHECK (recurrence_interval BETWEEN 1 AND 90);

-- Variante A/B efetivamente sorteada por alvo ----------------------------

ALTER TABLE public.comm_whatsapp_campaign_targets
  ADD COLUMN IF NOT EXISTS ab_variant text;

ALTER TABLE public.comm_whatsapp_campaign_targets
  ADD CONSTRAINT comm_whatsapp_campaign_targets_ab_variant_check
  CHECK (ab_variant IS NULL OR ab_variant IN ('A', 'B'));

-- Modelos salvos ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.comm_whatsapp_campaign_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comm_whatsapp_campaign_templates_name_check CHECK (length(btrim(name)) > 0),
  CONSTRAINT comm_whatsapp_campaign_templates_steps_is_array CHECK (jsonb_typeof(steps) = 'array')
);

DROP TRIGGER IF EXISTS trg_comm_whatsapp_campaign_templates_updated_at ON public.comm_whatsapp_campaign_templates;
CREATE TRIGGER trg_comm_whatsapp_campaign_templates_updated_at
  BEFORE UPDATE ON public.comm_whatsapp_campaign_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_comm_whatsapp_campaign_updated_at();

ALTER TABLE public.comm_whatsapp_campaign_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view comm whatsapp campaign templates" ON public.comm_whatsapp_campaign_templates;
DROP POLICY IF EXISTS "Users can edit comm whatsapp campaign templates" ON public.comm_whatsapp_campaign_templates;
DROP POLICY IF EXISTS "Service role can manage comm whatsapp campaign templates" ON public.comm_whatsapp_campaign_templates;

CREATE POLICY "Users can view comm whatsapp campaign templates"
  ON public.comm_whatsapp_campaign_templates FOR SELECT TO authenticated
  USING (public.current_user_can_view_comm_whatsapp());

CREATE POLICY "Users can edit comm whatsapp campaign templates"
  ON public.comm_whatsapp_campaign_templates FOR ALL TO authenticated
  USING (public.current_user_can_edit_comm_whatsapp())
  WITH CHECK (public.current_user_can_edit_comm_whatsapp());

CREATE POLICY "Service role can manage comm whatsapp campaign templates"
  ON public.comm_whatsapp_campaign_templates FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_campaign_templates_created
  ON public.comm_whatsapp_campaign_templates (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_campaigns_recurrence_due
  ON public.comm_whatsapp_campaigns (recurrence_next_run_at)
  WHERE recurrence_rule <> 'none';

COMMIT;
