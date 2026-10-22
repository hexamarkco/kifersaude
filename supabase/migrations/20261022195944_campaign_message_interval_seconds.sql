BEGIN;

-- Preserve the existing HTTP/database field and all configured values. Decimal
-- minutes allow whole-second input without rounding it to a full minute.
ALTER TABLE public.comm_whatsapp_campaigns
  ALTER COLUMN inter_message_interval_minutes TYPE numeric
  USING inter_message_interval_minutes::numeric;

COMMENT ON COLUMN public.comm_whatsapp_campaigns.inter_message_interval_minutes IS
  'Minimum interval between message bubbles, stored as decimal minutes for API compatibility. UI and MCP accept whole seconds; 0 keeps the approximately 3-second sequential default.';

CREATE OR REPLACE FUNCTION public._mcp_comm_whatsapp_campaign_apply_pacing_config()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_pacing jsonb;
  v_contact_interval integer;
  v_message_interval numeric;
BEGIN
  v_pacing := NEW.audience_config->'__mcp_campaign_pacing';
  IF v_pacing IS NULL THEN
    RETURN NEW;
  END IF;
  IF jsonb_typeof(v_pacing) <> 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_PACING_INVALID';
  END IF;

  IF v_pacing ? 'contact_interval_minutes' THEN
    v_contact_interval := CASE
      WHEN jsonb_typeof(v_pacing->'contact_interval_minutes') = 'null' THEN NULL
      ELSE NULLIF(v_pacing->>'contact_interval_minutes', '')::integer
    END;
    IF v_contact_interval IS NOT NULL AND v_contact_interval NOT BETWEEN 1 AND 1440 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_CONTACT_INTERVAL_INVALID';
    END IF;
    NEW.contact_interval_minutes := v_contact_interval;
  END IF;

  IF v_pacing ? 'inter_message_interval_minutes' THEN
    v_message_interval := (v_pacing->>'inter_message_interval_minutes')::numeric;
    IF v_message_interval IS NULL OR v_message_interval NOT BETWEEN 0 AND 1440 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_MESSAGE_INTERVAL_INVALID';
    END IF;
    NEW.inter_message_interval_minutes := v_message_interval;
  END IF;

  NEW.audience_config := NEW.audience_config - '__mcp_campaign_pacing';
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._mcp_comm_whatsapp_campaign_apply_pacing_config() FROM PUBLIC, anon, authenticated;

COMMIT;
