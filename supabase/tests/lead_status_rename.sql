-- Run as postgres after the migration. All fixtures and changes roll back.
BEGIN;
DO $$
DECLARE
  status_id uuid;
  original_name text := '__status_rename_regression_original__';
  renamed_name text := '__status_rename_regression_renamed__';
  renamed_again text := '__status_rename_regression_final__';
  fixture jsonb;
  actual jsonb;
BEGIN
  INSERT INTO public.lead_status_config(nome) VALUES (original_name) RETURNING id INTO status_id;
  fixture := jsonb_build_object(
    'name', original_name,
    'triggerStatus', original_name,
    'triggerStatuses', jsonb_build_array(original_name),
    'conditions', jsonb_build_array(jsonb_build_object('field', 'status', 'operator', 'equals', 'value', original_name)),
    'exitConditions', jsonb_build_array(jsonb_build_object('field', 'status', 'operator', 'not_equals', 'value', original_name)),
    'steps', jsonb_build_array(jsonb_build_object('statusToSet', original_name, 'customMessage', jsonb_build_object('text', original_name))),
    'flowGraph', jsonb_build_object('nodes', jsonb_build_array(jsonb_build_object('data', jsonb_build_object('triggerStatuses', jsonb_build_array(original_name))))),
    'unrelated', jsonb_build_object('field', 'cidade', 'value', original_name)
  );
  UPDATE public.integration_settings SET settings = jsonb_build_object('flows', jsonb_build_array(fixture))
  WHERE slug = 'whatsapp_auto_contact';
  IF NOT FOUND THEN RAISE EXCEPTION 'Test requires the auto-contact integration row'; END IF;

  UPDATE public.lead_status_config SET nome = renamed_name WHERE id = status_id;
  SELECT settings->'flows'->0 INTO actual FROM public.integration_settings WHERE slug = 'whatsapp_auto_contact';
  IF actual->>'triggerStatus' <> renamed_name
    OR actual #>> '{triggerStatuses,0}' <> renamed_name
    OR actual #>> '{conditions,0,value}' <> renamed_name
    OR actual #>> '{exitConditions,0,value}' <> renamed_name
    OR actual #>> '{steps,0,statusToSet}' <> renamed_name
    OR actual #>> '{flowGraph,nodes,0,data,triggerStatuses,0}' <> renamed_name THEN
    RAISE EXCEPTION 'Rename did not cascade to every operational flow reference';
  END IF;
  IF actual->>'name' <> original_name
    OR actual #>> '{steps,0,customMessage,text}' <> original_name
    OR actual #>> '{unrelated,value}' <> original_name THEN
    RAISE EXCEPTION 'Rename changed free text or unrelated conditions';
  END IF;

  -- Simulate a stale browser saving the original snapshot after rename.
  UPDATE public.integration_settings SET settings = jsonb_build_object('flows', jsonb_build_array(fixture))
  WHERE slug = 'whatsapp_auto_contact';
  SELECT settings #>> '{flows,0,conditions,0,value}' INTO original_name
  FROM public.integration_settings WHERE slug = 'whatsapp_auto_contact';
  IF original_name <> renamed_name THEN RAISE EXCEPTION 'Stale save restored an obsolete label'; END IF;

  UPDATE public.lead_status_config SET nome = renamed_again WHERE id = status_id;
  actual := private.refresh_lead_status_references(fixture);
  IF actual #>> '{conditions,0,value}' <> renamed_again THEN RAISE EXCEPTION 'Multiple renames lost identity'; END IF;
  actual := private.refresh_lead_status_references(jsonb_build_object('field', 'status', 'operator', 'in_list', 'value', renamed_name || ';Perdido'));
  IF actual->>'value' <> renamed_again || ';Perdido' THEN RAISE EXCEPTION 'List membership rename failed'; END IF;
  IF private.refresh_lead_status_references(actual) IS DISTINCT FROM actual THEN RAISE EXCEPTION 'Canonicalization is not idempotent'; END IF;
  IF private.refresh_lead_status_references(NULL) IS NOT NULL THEN RAISE EXCEPTION 'Null document was changed'; END IF;
  BEGIN
    INSERT INTO public.lead_status_config(nome) VALUES (renamed_name);
    RAISE EXCEPTION 'Obsolete label could be assigned to another status';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Obsolete label could be assigned to another status' THEN RAISE; END IF;
  END;
END;
$$;
ROLLBACK;
