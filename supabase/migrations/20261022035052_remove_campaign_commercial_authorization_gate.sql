-- Campaigns no longer require campaign-level review or per-contact commercial
-- permission/evidence. Explicit global/commercial blocks and recent duplicates
-- continue to suppress individual targets.

BEGIN;

CREATE OR REPLACE FUNCTION public._comm_whatsapp_campaign_target_marketing_reason(
  p_campaign_id uuid,
  p_target_id uuid
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_campaign public.comm_whatsapp_campaigns%ROWTYPE;
  v_target public.comm_whatsapp_campaign_targets%ROWTYPE;
BEGIN
  SELECT * INTO v_campaign
  FROM public.comm_whatsapp_campaigns
  WHERE id = p_campaign_id;
  IF NOT FOUND THEN RETURN 'campaign_not_found'; END IF;

  IF NOT public._comm_whatsapp_campaign_required_image_ready(v_campaign) THEN
    RETURN 'campaign_promotion_image_pending';
  END IF;

  SELECT * INTO v_target
  FROM public.comm_whatsapp_campaign_targets
  WHERE id = p_target_id AND campaign_id = p_campaign_id;
  IF NOT FOUND THEN RETURN 'campaign_target_not_found'; END IF;

  IF EXISTS (
    SELECT 1
    FROM public.contact_permission_policies AS blocked
    WHERE blocked.channel = 'whatsapp'
      AND blocked.endpoint_normalized = v_target.phone_digits
      AND blocked.purpose_scope IN ('global', 'commercial')
      AND blocked.state = 'blocked'
  ) THEN
    RETURN 'contact_permission_blocked';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.comm_whatsapp_campaign_admissions AS prior
    WHERE prior.campaign_id <> p_campaign_id
      AND prior.channel_key = 'whatsapp'
      AND prior.endpoint_hash = encode(extensions.digest(convert_to(v_target.phone_digits, 'UTF8'), 'sha256'), 'hex')
      AND prior.admitted_at >= statement_timestamp() - interval '24 hours'
  ) THEN
    RETURN 'contact_recent_campaign_duplicate';
  END IF;

  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_comm_whatsapp_campaign_marketing_readiness(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_total integer := 0;
  v_eligible integer := 0;
  v_duplicate_targets integer := 0;
  v_blocked_targets integer := 0;
  v_reasons jsonb := '[]'::jsonb;
  v_campaign public.comm_whatsapp_campaigns%ROWTYPE;
BEGIN
  SELECT * INTO v_campaign
  FROM public.comm_whatsapp_campaigns
  WHERE id = p_campaign_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ready', false,
      'reason_codes', jsonb_build_array('campaign_not_found'),
      'total_targets', 0,
      'eligible_targets', 0,
      'pending_targets', 0,
      'duplicate_targets', 0,
      'blocked_targets', 0
    );
  END IF;

  SELECT count(*)::integer,
         count(*) FILTER (WHERE readiness.reason IS NULL)::integer,
         count(*) FILTER (WHERE readiness.reason IN ('contact_recent_campaign_duplicate', 'contact_duplicate_in_campaign'))::integer,
         count(*) FILTER (WHERE readiness.reason = 'contact_permission_blocked')::integer,
         COALESCE(jsonb_agg(DISTINCT readiness.reason) FILTER (WHERE readiness.reason IS NOT NULL), '[]'::jsonb)
  INTO v_total, v_eligible, v_duplicate_targets, v_blocked_targets, v_reasons
  FROM (
    SELECT public._comm_whatsapp_campaign_target_marketing_reason(p_campaign_id, target.id) AS reason
    FROM public.comm_whatsapp_campaign_targets AS target
    WHERE target.campaign_id = p_campaign_id
      AND target.status IN ('pending', 'scheduled', 'sending', 'failed')
  ) AS readiness;

  IF v_total = 0 THEN
    v_reasons := jsonb_build_array('campaign_contacts_required');
    IF NOT public._comm_whatsapp_campaign_required_image_ready(v_campaign) THEN
      v_reasons := v_reasons || jsonb_build_array('campaign_promotion_image_pending');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ready', v_total > 0
      AND v_eligible + v_duplicate_targets + v_blocked_targets = v_total
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(v_reasons) AS blocker(reason_code)
        WHERE blocker.reason_code NOT IN (
          'contact_recent_campaign_duplicate',
          'contact_duplicate_in_campaign',
          'contact_permission_blocked'
        )
      ),
    'total_targets', v_total,
    'eligible_targets', v_eligible,
    'pending_targets', GREATEST(v_total - v_eligible - v_duplicate_targets - v_blocked_targets, 0),
    'duplicate_targets', v_duplicate_targets,
    'blocked_targets', v_blocked_targets,
    'reason_codes', v_reasons
  );
END;
$function$;

REVOKE ALL ON FUNCTION public._comm_whatsapp_campaign_target_marketing_reason(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._comm_whatsapp_campaign_target_marketing_reason(uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.get_comm_whatsapp_campaign_marketing_readiness(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_comm_whatsapp_campaign_marketing_readiness(uuid) TO service_role;

-- The audience_config JSON can retain historical review metadata, but it is no
-- longer required or protected as a prerequisite for activation.
DROP TRIGGER IF EXISTS trg_comm_whatsapp_campaign_preserve_marketing_review ON public.comm_whatsapp_campaigns;
DROP FUNCTION IF EXISTS public._comm_whatsapp_campaign_preserve_marketing_review();
DROP FUNCTION IF EXISTS public._comm_whatsapp_campaign_marketing_review_ready(jsonb);

COMMIT;
