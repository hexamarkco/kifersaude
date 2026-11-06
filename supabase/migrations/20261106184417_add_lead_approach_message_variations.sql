-- Add the two requested alternatives without changing the original packet,
-- scheduling, conditions, status changes, or autonomous attendance activation.
DO $seed_approaches$
DECLARE
  v_integration record;
  v_flow_index integer;
  v_step_index integer;
  v_flow jsonb;
  v_step jsonb;
  v_existing jsonb;
  v_missing jsonb;
  v_variations jsonb;
  v_original_texts jsonb;
  v_nodes jsonb;
  v_seed jsonb := $versions$[
    {
      "id": "abordagem-apresentacao-cotacao-familia-v2",
      "messages": [
        {"custom": {"type": "text", "text": "Olá {{primeiro_nome}}, tudo bem? Aqui é a Luiza Kifer, *especialista em planos de saúde*."}},
        {"custom": {"type": "text", "text": "Recebi seu interesse em uma cotação e vim falar com você por aqui para facilitar a troca das informações. 😊"}},
        {"custom": {"type": "text", "text": "O plano seria apenas para você ou incluiria mais alguém da família?"}}
      ]
    },
    {
      "id": "abordagem-apresentacao-cotacao-familia-v3",
      "messages": [
        {"custom": {"type": "text", "text": "Oi {{primeiro_nome}}! Como você está? Sou a Luiza Kifer, *especialista em planos de saúde*."}},
        {"custom": {"type": "text", "text": "Vi seu interesse em cotar um plano e resolvi entrar em contato por aqui para te ajudar com as informações. 😊"}},
        {"custom": {"type": "text", "text": "Você está procurando um plano para você ou também para alguém da família?"}}
      ]
    }
  ]$versions$::jsonb;
BEGIN
  SELECT id, settings INTO v_integration
  FROM public.integration_settings
  WHERE slug = 'whatsapp_auto_contact'
  FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT (flow.ordinality - 1)::integer INTO v_flow_index
  FROM jsonb_array_elements(COALESCE(v_integration.settings->'flows', '[]'::jsonb))
    WITH ORDINALITY AS flow(value, ordinality)
  WHERE flow.value->>'id' = 'flow-1767987622968';
  IF v_flow_index IS NULL THEN RETURN; END IF;

  v_flow := v_integration.settings->'flows'->v_flow_index;
  SELECT (step.ordinality - 1)::integer INTO v_step_index
  FROM jsonb_array_elements(COALESCE(v_flow->'steps', '[]'::jsonb))
    WITH ORDINALITY AS step(value, ordinality)
  WHERE step.value->>'id' = 'flow-step-1767987622968-f4d5d702433f4';
  IF v_step_index IS NULL OR v_flow->>'triggerType' IS DISTINCT FROM 'lead_created' THEN
    RAISE EXCEPTION 'O fluxo de abordagem mudou. Revise as etapas antes de cadastrar as variações.';
  END IF;

  v_step := v_flow->'steps'->v_step_index;
  v_existing := COALESCE(v_step->'messageVariations', '[]'::jsonb);
  SELECT COALESCE(jsonb_agg(seed.value ORDER BY seed.ordinality), '[]'::jsonb) INTO v_missing
  FROM jsonb_array_elements(v_seed) WITH ORDINALITY AS seed(value, ordinality)
  WHERE NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_existing) AS existing(value)
    WHERE existing.value->>'id' = seed.value->>'id'
  );
  IF jsonb_array_length(v_missing) = 0 THEN RETURN; END IF;

  SELECT jsonb_agg(message.value->'custom'->>'text' ORDER BY message.ordinality) INTO v_original_texts
  FROM jsonb_array_elements(COALESCE(v_step->'messages', '[]'::jsonb))
    WITH ORDINALITY AS message(value, ordinality);
  IF v_step->>'actionType' IS DISTINCT FROM 'send_message' OR v_original_texts IS DISTINCT FROM $original$[
    "Oi {{primeiro_nome}}, tudo bem? Sou a Luiza Kifer, *especialista em planos de saúde*.",
    "Vi que você demonstrou interesse em uma cotação e decidi te chamar por aqui para facilitar o envio das informações. 😊",
    "Você busca um plano só para você ou para mais alguém da família?"
  ]$original$::jsonb THEN
    RAISE EXCEPTION 'A abordagem original mudou. Revise os textos antes de cadastrar as variações.';
  END IF;

  v_variations := v_existing || v_missing;
  v_flow := jsonb_set(v_flow, ARRAY['steps', v_step_index::text, 'messageVariations'], v_variations, true);
  IF jsonb_typeof(v_flow->'flowGraph'->'nodes') = 'array' THEN
    SELECT COALESCE(jsonb_agg(
      CASE WHEN node.value->>'type' = 'action'
        AND node.value->'data'->'step'->>'id' = 'flow-step-1767987622968-f4d5d702433f4'
      THEN jsonb_set(node.value, '{data,step,messageVariations}', v_variations, true)
      ELSE node.value END ORDER BY node.ordinality
    ), '[]'::jsonb) INTO v_nodes
    FROM jsonb_array_elements(v_flow->'flowGraph'->'nodes') WITH ORDINALITY AS node(value, ordinality);
    v_flow := jsonb_set(v_flow, '{flowGraph,nodes}', v_nodes, true);
  END IF;

  UPDATE public.integration_settings
  SET settings = jsonb_set(v_integration.settings, ARRAY['flows', v_flow_index::text], v_flow, false),
      updated_at = now()
  WHERE id = v_integration.id;
END;
$seed_approaches$;
