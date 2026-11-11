/*
  Alternancia de copies A..Z no disparador WhatsApp.
  A/B antigo continua funcionando sem alteracao de dados.
  Cursor em tabela isolada evita atualizar campanhas a cada contato
  (e gerar eventos Realtime excessivos).
*/
BEGIN;

ALTER TABLE public.comm_whatsapp_campaign_steps
  DROP CONSTRAINT IF EXISTS comm_whatsapp_campaign_steps_variant_label_check;

ALTER TABLE public.comm_whatsapp_campaign_steps
  ADD CONSTRAINT comm_whatsapp_campaign_steps_variant_label_check
  CHECK (variant_label = 'ANY' OR variant_label ~ '^[A-Z]$');

ALTER TABLE public.comm_whatsapp_campaign_targets
  DROP CONSTRAINT IF EXISTS comm_whatsapp_campaign_targets_ab_variant_check;

ALTER TABLE public.comm_whatsapp_campaign_targets
  ADD CONSTRAINT comm_whatsapp_campaign_targets_ab_variant_check
  CHECK (ab_variant IS NULL OR ab_variant ~ '^[A-Z]$');

-- Apenas o service_role pode ler e alterar o cursor.
CREATE TABLE IF NOT EXISTS public.comm_whatsapp_campaign_copy_cursors (
  campaign_id uuid PRIMARY KEY REFERENCES public.comm_whatsapp_campaigns(id) ON DELETE CASCADE,
  next_index bigint NOT NULL DEFAULT 0 CHECK (next_index >= 0)
);

ALTER TABLE public.comm_whatsapp_campaign_copy_cursors ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.comm_whatsapp_campaign_copy_cursors FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.comm_whatsapp_campaign_copy_cursors TO service_role;

CREATE OR REPLACE FUNCTION public.assign_comm_whatsapp_campaign_copy(p_target_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_campaign_id uuid;
  v_existing text;
  v_labels text[];
  v_cursor bigint;
  v_assigned text;
BEGIN
  -- Serializa atribuicoes repetidas ao mesmo contato.
  SELECT t.campaign_id, t.ab_variant
    INTO v_campaign_id, v_existing
  FROM public.comm_whatsapp_campaign_targets AS t
  WHERE t.id = p_target_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Alvo de campanha inexistente' USING ERRCODE = 'P0002';
  END IF;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  SELECT array_agg(DISTINCT s.variant_label ORDER BY s.variant_label)
    INTO v_labels
  FROM public.comm_whatsapp_campaign_steps AS s
  WHERE s.campaign_id = v_campaign_id
    AND s.step_index = 0
    AND s.variant_label ~ '^[A-Z]$';

  IF v_labels IS NULL OR cardinality(v_labels) < 2 THEN
    RAISE EXCEPTION 'Campanha sem copies suficientes para alternancia' USING ERRCODE = '22023';
  END IF;

  -- O conflito bloqueia concorrentes nesta campanha e incrementa o cursor
  -- apenas uma vez por alvo. Falhas da transacao nao consomem posicoes.
  INSERT INTO public.comm_whatsapp_campaign_copy_cursors AS cc (campaign_id, next_index)
  VALUES (v_campaign_id, 1)
  ON CONFLICT (campaign_id) DO UPDATE
    SET next_index = cc.next_index + 1
  RETURNING next_index INTO v_cursor;

  v_assigned := v_labels[((v_cursor - 1) % cardinality(v_labels))::integer + 1];

  UPDATE public.comm_whatsapp_campaign_targets
  SET ab_variant = v_assigned
  WHERE id = p_target_id;

  RETURN v_assigned;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_comm_whatsapp_campaign_copy(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_comm_whatsapp_campaign_copy(uuid) TO service_role;

COMMIT;
