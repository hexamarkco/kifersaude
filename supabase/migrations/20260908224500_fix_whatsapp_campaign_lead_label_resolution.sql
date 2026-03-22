/*
  # Fix WhatsApp campaign lead label resolution

  Stops WhatsApp campaign audience resolution from depending on legacy
  denormalized text columns on `leads` (`status`, `origem`, `responsavel`).
  Some environments already rely only on the `*_id` columns, which caused
  preview and filtered campaign creation to fail with `column leads.origem does not exist`.
*/

CREATE OR REPLACE FUNCTION public.resolve_whatsapp_campaign_filter_leads(
  p_audience_filter jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(
  lead_id uuid,
  nome_completo text,
  telefone text,
  status text,
  origem text,
  responsavel text,
  canal text,
  status_id uuid,
  origem_id uuid,
  responsavel_id uuid,
  normalized_phone text
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH normalized_filter AS (
    SELECT CASE
      WHEN p_audience_filter IS NOT NULL AND jsonb_typeof(p_audience_filter) = 'object' THEN p_audience_filter
      ELSE '{}'::jsonb
    END AS audience_filter
  ),
  filtered_leads AS (
    SELECT
      l.id AS lead_id,
      l.nome_completo,
      l.telefone,
      NULLIF(btrim(COALESCE(status_config.nome, '')), '') AS status,
      NULLIF(btrim(COALESCE(origem_config.nome, '')), '') AS origem,
      NULLIF(btrim(COALESCE(responsavel_config.label, responsavel_config.value, '')), '') AS responsavel,
      l.canal,
      l.status_id,
      l.origem_id,
      l.responsavel_id,
      public.normalize_whatsapp_campaign_phone(l.telefone) AS normalized_phone,
      row_number() OVER (
        PARTITION BY public.normalize_whatsapp_campaign_phone(l.telefone)
        ORDER BY COALESCE(l.updated_at, l.created_at, l.data_criacao) DESC NULLS LAST, l.id DESC
      ) AS phone_rank
    FROM public.leads l
    LEFT JOIN public.lead_status_config status_config
      ON status_config.id = l.status_id
    LEFT JOIN public.lead_origens origem_config
      ON origem_config.id = l.origem_id
    LEFT JOIN public.lead_responsaveis responsavel_config
      ON responsavel_config.id = l.responsavel_id
    CROSS JOIN normalized_filter f
    WHERE COALESCE(l.arquivado, false) = false
      AND NULLIF(btrim(COALESCE(l.telefone, '')), '') IS NOT NULL
      AND (
        NULLIF(btrim(COALESCE(f.audience_filter ->> 'status_id', '')), '') IS NULL
        OR l.status_id = (f.audience_filter ->> 'status_id')::uuid
      )
      AND (
        NULLIF(btrim(COALESCE(f.audience_filter ->> 'responsavel_id', '')), '') IS NULL
        OR l.responsavel_id = (f.audience_filter ->> 'responsavel_id')::uuid
      )
      AND (
        NULLIF(btrim(COALESCE(f.audience_filter ->> 'origem_id', '')), '') IS NULL
        OR l.origem_id = (f.audience_filter ->> 'origem_id')::uuid
      )
      AND (
        NULLIF(btrim(COALESCE(f.audience_filter ->> 'canal', '')), '') IS NULL
        OR COALESCE(l.canal, '') = f.audience_filter ->> 'canal'
      )
  )
  SELECT
    lead_id,
    nome_completo,
    telefone,
    status,
    origem,
    responsavel,
    canal,
    status_id,
    origem_id,
    responsavel_id,
    normalized_phone
  FROM filtered_leads
  WHERE phone_rank = 1
    AND normalized_phone <> '';
$$;

REVOKE ALL ON FUNCTION public.resolve_whatsapp_campaign_filter_leads(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_whatsapp_campaign_filter_leads(jsonb) TO authenticated;
