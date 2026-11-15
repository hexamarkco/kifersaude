-- Local-only residence guard. No remote application or data rewrite.
BEGIN;

CREATE OR REPLACE FUNCTION public.ai_autonomous_qualification_can_complete(p_state jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_q jsonb; v_f jsonb; v_lives jsonb; v_life jsonb; v_count integer; v_field text;
  v_intent text; v_company text; v_current text; v_required text[]; v_city text; v_uf text;
BEGIN
  IF p_state ? 'attendanceV2' THEN
    v_q := p_state->'attendanceV2'; v_f := v_q->'facts';
    IF v_q->>'version' IS DISTINCT FROM '2' OR COALESCE(v_q->>'policyVersion','') NOT IN ('2026-11-14','2026-11-14.1')
      OR jsonb_typeof(v_f) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
    v_intent := v_f->'intent'->>'value';
    IF v_intent IS NOT NULL AND v_intent NOT IN ('first_plan','replace_operator','reduce_cost','expand_network',
      'upgrade','downgrade','pf_to_mei','add_dependents','portability','defined_choice','guided_choice') THEN RETURN false; END IF;
    -- Product-specific eligibility/network/portability is never authorized by an LLM.
    IF v_intent IN ('pf_to_mei','portability','expand_network') OR v_f->'companyPresence'->>'value' = 'yes'
      OR v_f->'targetModality'->>'value' IN ('mei','company') THEN RETURN false; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_each(v_f) AS facts WHERE facts.value->>'status' = 'conflict') THEN RETURN false; END IF;
    IF jsonb_typeof(v_f->'preferences'->'value') = 'array' AND jsonb_array_length(v_f->'preferences'->'value') > 0 THEN RETURN false; END IF;
    v_required := ARRAY['beneficiaryCount','beneficiaries','city','state','companyPresence'];
    v_city := regexp_replace(lower(trim(translate(v_f->'city'->>'value', 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'))), '\s+', ' ', 'g');
    SELECT uf INTO v_uf FROM (VALUES
      ('rio','RJ'),('rio de janeiro','RJ'),('rio branco','AC'),('maceio','AL'),('macapa','AP'),('manaus','AM'),
      ('salvador','BA'),('fortaleza','CE'),('brasilia','DF'),('vitoria','ES'),('goiania','GO'),('sao luis','MA'),
      ('cuiaba','MT'),('campo grande','MS'),('belo horizonte','MG'),('belem','PA'),('joao pessoa','PB'),('curitiba','PR'),
      ('recife','PE'),('teresina','PI'),('natal','RN'),('porto alegre','RS'),('porto velho','RO'),('boa vista','RR'),
      ('florianopolis','SC'),('sao paulo','SP'),('aracaju','SE'),('palmas','TO')) capitals(city,uf) WHERE city = v_city;
    IF v_uf IS NOT NULL THEN
      v_required := v_required || ARRAY['neighborhood'];
      IF v_f->'state'->>'value' IS DISTINCT FROM v_uf OR jsonb_typeof(v_f->'neighborhood'->'value') IS DISTINCT FROM 'string'
        OR length(trim(COALESCE(v_f->'neighborhood'->>'value',''))) = 0 THEN RETURN false; END IF;
    END IF;
    v_current := v_f->'hasCurrentPlan'->>'value';
    v_lives := v_f->'beneficiaries'->'value';
    IF jsonb_typeof(v_lives) IS DISTINCT FROM 'array' OR jsonb_typeof(v_f->'beneficiaryCount'->'value') IS DISTINCT FROM 'number' THEN RETURN false; END IF;
    v_count := (v_f->'beneficiaryCount'->>'value')::integer;
    IF v_count < 1 OR v_count > 100 OR jsonb_array_length(v_lives) <> v_count THEN RETURN false; END IF;
    IF (SELECT count(DISTINCT life->>'id') FROM jsonb_array_elements(v_lives) life) <> v_count THEN RETURN false; END IF;
    FOR v_life IN SELECT value FROM jsonb_array_elements(v_lives) LOOP
      IF jsonb_typeof(v_life->'age') IS DISTINCT FROM 'number' OR (v_life->>'age')::numeric <> trunc((v_life->>'age')::numeric)
        OR (v_life->>'age')::integer NOT BETWEEN 0 AND 120 OR length(trim(COALESCE(v_life->>'id',''))) = 0
        OR length(trim(COALESCE(v_life->>'label',''))) = 0 THEN RETURN false; END IF;
      IF (v_life->>'age')::integer >= 18 THEN v_required := v_required || ARRAY['companyPresence']; END IF;
      IF v_count = 1 AND (v_life->>'age')::integer < 12 THEN RETURN false; END IF;
    END LOOP;
    FOREACH v_field IN ARRAY v_required LOOP
      IF v_f->v_field->>'status' IS DISTINCT FROM 'confirmed' OR v_f->v_field->'value' IS NULL
        OR v_f->v_field->'value' = 'null'::jsonb THEN RETURN false; END IF;
    END LOOP;
    IF length(trim(COALESCE(v_f->'city'->>'value',''))) = 0 THEN RETURN false; END IF;
    IF v_f->'state'->>'value' IS NULL OR v_f->'state'->>'value' NOT IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO') THEN RETURN false; END IF;
    v_company := v_f->'companyPresence'->>'value';
    IF 'companyPresence' = ANY(v_required) AND v_company IS DISTINCT FROM 'no' THEN RETURN false; END IF;
    IF 'currentOperator' = ANY(v_required) AND length(trim(COALESCE(v_f->'currentOperator'->>'value',''))) = 0 THEN RETURN false; END IF;
    RETURN true;
  END IF;
  -- Backwards-compatible snapshots still require actual data, not just a status/tag.
  v_q := COALESCE(p_state->'qualification', p_state);
  IF v_q->>'status' IS DISTINCT FROM 'complete' OR v_q->'missingRequiredFields' IS DISTINCT FROM '[]'::jsonb
    OR v_q->>'compositionValid' IS DISTINCT FROM 'true' THEN RETURN false; END IF;
  v_count := (v_q->'lives'->>'count')::integer;
  v_lives := v_q->'lives'->'items';
  IF v_count IS NULL OR v_count < 1 OR jsonb_typeof(v_lives) IS DISTINCT FROM 'array' OR jsonb_array_length(v_lives) <> v_count THEN RETURN false; END IF;
  FOR v_life IN SELECT value FROM jsonb_array_elements(v_lives) LOOP
    IF v_life->>'ageStatus' IS DISTINCT FROM 'known' OR jsonb_typeof(v_life->'age') IS DISTINCT FROM 'number'
      OR (v_life->>'age')::numeric <> trunc((v_life->>'age')::numeric) OR (v_life->>'age')::integer NOT BETWEEN 0 AND 120 THEN RETURN false; END IF;
    IF v_count = 1 AND (v_life->>'age')::integer < 12 THEN RETURN false; END IF;
    IF (v_life->>'age')::integer >= 18 AND (v_q->'company'->>'answerStatus' IS DISTINCT FROM 'known'
      OR COALESCE(v_q->'company'->>'hasCnpjOrMei','') NOT IN ('yes','no')) THEN RETURN false; END IF;
  END LOOP;
  RETURN COALESCE(v_q->'location'->>'cityStatus' = 'known' AND length(trim(v_q->'location'->>'city')) > 0
    AND v_q->'location'->>'state' IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')
    AND v_q->'currentHealthPlan'->>'answerStatus' = 'known'
    AND v_q->'currentHealthPlan'->>'hasPlan' IN ('yes','no'), false);
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.ai_autonomous_qualification_can_complete(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_autonomous_qualification_can_complete(jsonb) TO service_role;
COMMIT;
