
INSERT INTO public.system_configurations(config_key,config_value,description,category)
SELECT
  'followup_lead_created_cutover_at',
  to_jsonb('2026-11-09T03:00:00Z'::text),
  'Data minima de criacao do lead para os follow-ups automaticos de Contato Inicial e Atendimento: 09/11/2026 00h America/Sao_Paulo. Leads anteriores ficam fora destes fluxos.',
  category
FROM public.system_configurations
WHERE config_key='inactivity_enrollment_cutover_at'
ON CONFLICT (config_key) DO UPDATE
  SET config_value=EXCLUDED.config_value,
      description=EXCLUDED.description,
      updated_at=now();

DO $migration$
DECLARE v_definition text;
BEGIN
  SELECT pg_get_functiondef('public.check_auto_contact_inactivity_triggers()'::regprocedure)
    INTO v_definition;

  IF strpos(v_definition, '  v_cutover_at timestamptz;') = 0
     OR strpos(v_definition, '    FOR v_flow IN') = 0
     OR strpos(v_definition, '          AND (v_cutover_at IS NULL OR latest.last_message_at >= v_cutover_at)') = 0
     OR strpos(v_definition, 'v_followup_lead_created_cutover_at') > 0
  THEN
    RAISE EXCEPTION 'Schema do monitor de inatividade inesperado; nenhuma alteracao aplicada';
  END IF;

  v_definition := replace(
    v_definition,
    '  v_cutover_at timestamptz;',
    E'  v_cutover_at timestamptz;\n  v_followup_lead_created_cutover_at timestamptz;'
  );

  v_definition := replace(
    v_definition,
    '    FOR v_flow IN',
    E'    SELECT (config_value #>> ''{}'')::timestamptz\n'
    || E'    INTO v_followup_lead_created_cutover_at\n'
    || E'    FROM public.system_configurations\n'
    || E'    WHERE config_key = ''followup_lead_created_cutover_at''\n'
    || E'    LIMIT 1;\n\n'
    || '    FOR v_flow IN'
  );

  v_definition := replace(
    v_definition,
    '          AND (v_cutover_at IS NULL OR latest.last_message_at >= v_cutover_at)',
    E'          AND (v_cutover_at IS NULL OR latest.last_message_at >= v_cutover_at)\n'
    || E'          AND (\n'
    || E'            v_flow->>''id'' NOT IN (''flow-inatividade-contato-inicial'', ''flow-inatividade-em-atendimento'')\n'
    || E'            OR (\n'
    || E'              v_followup_lead_created_cutover_at IS NOT NULL\n'
    || E'              AND l.created_at >= v_followup_lead_created_cutover_at\n'
    || E'            )\n'
    || E'          )'
  );

  EXECUTE v_definition;
END
$migration$;

