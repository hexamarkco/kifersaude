BEGIN;

-- The integration identifies paid Meta traffic, but does not identify the
-- placement network. Keep Facebook and Instagram together instead of guessing.
INSERT INTO public.lead_origens(nome, ativo)
VALUES ('Facebook / Instagram', true)
ON CONFLICT (nome) DO UPDATE SET ativo = true;

-- Repair the legacy defaults without overwriting a deliberately custom origin.
UPDATE public.integration_settings
SET settings = jsonb_set(settings, '{defaultOrigem}', '"Facebook / Instagram"'::jsonb),
    updated_at = now()
WHERE slug = 'facebook_ads_manager'
  AND settings->>'defaultOrigem' IN ('FBS', 'tráfego pago');

-- Only repair contacts actually created by a confirmed paid Meta import whose
-- origin is still FBS. Existing contacts and other FBS sources retain history.
UPDATE public.leads AS lead
SET origem_id = target.id
FROM public.lead_origens AS previous, public.lead_origens AS target
WHERE lead.origem_id = previous.id
  AND previous.nome = 'FBS'
  AND target.nome = 'Facebook / Instagram'
  AND EXISTS (
    SELECT 1 FROM public.meta_lead_attributions AS attribution
    JOIN public.meta_lead_receipts AS receipt
      ON receipt.leadgen_id = attribution.leadgen_id
      AND receipt.lead_id = attribution.lead_id
    WHERE attribution.lead_id = lead.id
      AND attribution.traffic_type = 'paid'
      AND NOT attribution.matched_existing
      AND attribution.ad_id IS NOT NULL
      AND receipt.status = 'imported'
  );

COMMIT;
