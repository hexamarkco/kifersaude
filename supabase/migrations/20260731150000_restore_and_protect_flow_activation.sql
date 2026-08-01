/*
  Restore and protect inactivity flow activation timestamps

  The production frontend (older build) drops triggerActivatedAt when saving
  flow settings, which silently disables inactivity flows (fail-closed cron).
  This migration:

  1. Restores triggerActivatedAt on existing inactivity flows that lost it.
  2. Adds a DB trigger on integration_settings that PREVENTS future wipes:
     - inactivity flows keep their existing activation when settings change
     - brand-new inactivity flows (no prior row) are stamped with now()
     This makes the invariant server-side: no client bug can disable the flow
     silently again.
*/

-- 1. Restore activation timestamps for existing inactivity flows
DO $$
DECLARE
  v_settings jsonb;
  v_flow jsonb;
  v_flow_idx int;
  v_changed boolean := false;
  v_restored integer := 0;
  v_restore_value text := '2026-07-29T15:54:57.1726744Z';
BEGIN
  SELECT settings INTO v_settings
  FROM public.integration_settings
  WHERE slug = 'whatsapp_auto_contact';

  IF v_settings IS NULL THEN
    RETURN;
  END IF;

  FOR v_flow_idx IN 0 .. jsonb_array_length(COALESCE(v_settings->'flows', '[]'::jsonb)) - 1
  LOOP
    v_flow := v_settings->'flows'->v_flow_idx;

    IF v_flow->>'triggerType' <> 'inactivity_duration' THEN
      CONTINUE;
    END IF;

    IF NULLIF(v_flow->>'triggerActivatedAt', '') IS NOT NULL THEN
      CONTINUE;
    END IF;

    v_settings := jsonb_set(
      v_settings,
      ARRAY['flows', v_flow_idx::text, 'triggerActivatedAt'],
      to_jsonb(v_restore_value::text),
      true
    );
    v_changed := true;
    v_restored := v_restored + 1;
  END LOOP;

  IF v_changed THEN
    UPDATE public.integration_settings
    SET settings = v_settings, updated_at = now()
    WHERE slug = 'whatsapp_auto_contact';
    RAISE NOTICE 'Restored triggerActivatedAt on % inactivity flow(s).', v_restored;
  ELSE
    RAISE NOTICE 'No inactivity flow needed activation restore.';
  END IF;
END $$;


-- 2. Server-side protection against activation wipe
CREATE OR REPLACE FUNCTION public.preserve_inactivity_flow_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_flows jsonb;
  v_old_flows jsonb;
  v_new_flow jsonb;
  v_old_flow jsonb;
  v_flow_idx int;
  v_old_idx int;
  v_changed boolean := false;
  v_has_old boolean;
BEGIN
  v_new_flows := COALESCE(NEW.settings->'flows', '[]'::jsonb);
  v_has_old := TG_OP = 'UPDATE' AND OLD.settings IS NOT NULL;
  v_old_flows := COALESCE(OLD.settings->'flows', '[]'::jsonb);

  FOR v_flow_idx IN 0 .. jsonb_array_length(v_new_flows) - 1
  LOOP
    v_new_flow := v_new_flows->v_flow_idx;

    IF v_new_flow->>'triggerType' <> 'inactivity_duration' THEN
      CONTINUE;
    END IF;

    IF NULLIF(v_new_flow->>'triggerActivatedAt', '') IS NOT NULL THEN
      CONTINUE;
    END IF;

    v_old_flow := NULL;
    IF v_has_old THEN
      FOR v_old_idx IN 0 .. jsonb_array_length(v_old_flows) - 1
      LOOP
        IF v_old_flows->v_old_idx->>'id' = v_new_flow->>'id' THEN
          v_old_flow := v_old_flows->v_old_idx;
          EXIT;
        END IF;
      END LOOP;
    END IF;

    IF v_old_flow IS NOT NULL AND NULLIF(v_old_flow->>'triggerActivatedAt', '') IS NOT NULL THEN
      -- existing flow: preserve prior activation
      v_new_flows := jsonb_set(
        v_new_flows,
        ARRAY[v_flow_idx::text, 'triggerActivatedAt'],
        to_jsonb(v_old_flow->>'triggerActivatedAt'),
        true
      );
      v_changed := true;
    ELSE
      -- brand-new inactivity flow (or first save): activation starts now
      v_new_flows := jsonb_set(
        v_new_flows,
        ARRAY[v_flow_idx::text, 'triggerActivatedAt'],
        to_jsonb(now()::text),
        true
      );
      v_changed := true;
    END IF;
  END LOOP;

  IF v_changed THEN
    NEW.settings := jsonb_set(COALESCE(NEW.settings, '{}'::jsonb), ARRAY['flows'], v_new_flows);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_preserve_inactivity_flow_activation ON public.integration_settings;

CREATE TRIGGER trg_preserve_inactivity_flow_activation
  BEFORE INSERT OR UPDATE OF settings ON public.integration_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.preserve_inactivity_flow_activation();
