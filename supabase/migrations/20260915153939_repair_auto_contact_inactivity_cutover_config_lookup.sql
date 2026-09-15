-- The existing system_configurations table uses config_key/config_value for
-- this setting. Repair only the affected lookup fragments in the deployed
-- automation routines, preserving the rest of their current definitions.
DO $repair$
DECLARE
  v_function_oid oid;
  v_definition text;
  v_old_select constant text := 'SELECT value::timestamptz INTO v_cutover_at';
  v_new_select constant text := 'SELECT NULLIF(trim(both ''"'' FROM config_value::text), '''')::timestamptz INTO v_cutover_at';
  v_old_filter constant text := 'WHERE category = ''automation'' AND label = ''inactivity_enrollment_cutover_at''';
  v_new_filter constant text := 'WHERE config_key = ''inactivity_enrollment_cutover_at''';
BEGIN
  FOR v_function_oid IN
    SELECT to_regprocedure(signature)::oid
    FROM (VALUES
      ('public.automation_flows_health()'),
      ('public.check_auto_contact_inactivity_triggers()')
    ) AS functions(signature)
  LOOP
    IF v_function_oid IS NULL THEN
      RAISE EXCEPTION 'Required inactivity automation function is missing';
    END IF;

    v_definition := pg_get_functiondef(v_function_oid);

    IF position(v_old_select IN v_definition) = 0
       OR position(v_old_filter IN v_definition) = 0 THEN
      IF position(v_new_select IN v_definition) > 0
         AND position(v_new_filter IN v_definition) > 0 THEN
        CONTINUE;
      END IF;
      RAISE EXCEPTION 'Unexpected cutover lookup in function %', v_function_oid::regprocedure;
    END IF;

    v_definition := replace(v_definition, v_old_select, v_new_select);
    v_definition := replace(v_definition, v_old_filter, v_new_filter);
    EXECUTE v_definition;
  END LOOP;
END;
$repair$;
