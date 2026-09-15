BEGIN;

-- Keep an opaque, non-PII fingerprint and the small result needed to replay
-- create requests. Raw contract/health data is never copied into this table.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.mcp_contract_write_requests (
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation text NOT NULL CHECK (operation IN (
    'contract.create', 'holder.create', 'dependent.create', 'contract.bundle.create'
  )),
  client_request_id text NOT NULL CHECK (
    char_length(btrim(client_request_id)) BETWEEN 1 AND 128
  ),
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  result_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_id, operation, client_request_id)
);

ALTER TABLE public.mcp_contract_write_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.mcp_contract_write_requests FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public._mcp_assert_active_contract_admin(p_actor_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
BEGIN
  -- Match the MCP OAuth authority check: only a current admin profile with an
  -- email can act. user_profiles.id is FK-cascaded from auth.users.
  IF p_actor_user_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.user_profiles AS profile
    WHERE profile.id = p_actor_user_id
      AND profile.role = 'admin'
      AND NULLIF(btrim(profile.email), '') IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'MCP_ACTOR_NOT_ACTIVE_ADMIN'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public._mcp_assert_contract_payload_keys(
  p_payload jsonb,
  p_allowed_keys text[],
  p_required_keys text[] DEFAULT ARRAY[]::text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'MCP_INVALID_OBJECT_PAYLOAD'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(p_payload) AS supplied(key)
    WHERE NOT supplied.key = ANY(p_allowed_keys)
  ) THEN
    RAISE EXCEPTION 'MCP_UNSUPPORTED_OR_PROTECTED_FIELD'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(p_required_keys) AS required(key)
    WHERE NOT (p_payload ? required.key)
  ) THEN
    RAISE EXCEPTION 'MCP_REQUIRED_FIELD_MISSING'
      USING ERRCODE = '22023';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public._mcp_begin_contract_write_request(
  p_actor_user_id uuid,
  p_operation text,
  p_client_request_id text,
  p_signature jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_fingerprint text;
  v_stored_fingerprint text;
  v_result jsonb;
BEGIN
  IF p_client_request_id IS NULL
     OR char_length(btrim(p_client_request_id)) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'MCP_CLIENT_REQUEST_ID_REQUIRED'
      USING ERRCODE = '22023';
  END IF;

  v_fingerprint := encode(
    extensions.digest(convert_to(p_signature::text, 'UTF8'), 'sha256'),
    'hex'
  );

  INSERT INTO public.mcp_contract_write_requests (
    actor_id, operation, client_request_id, request_fingerprint
  ) VALUES (
    p_actor_user_id, p_operation, btrim(p_client_request_id), v_fingerprint
  )
  ON CONFLICT (actor_id, operation, client_request_id) DO NOTHING;

  SELECT request.request_fingerprint, request.result_payload
    INTO v_stored_fingerprint, v_result
  FROM public.mcp_contract_write_requests AS request
  WHERE request.actor_id = p_actor_user_id
    AND request.operation = p_operation
    AND request.client_request_id = btrim(p_client_request_id)
  FOR UPDATE;

  IF v_stored_fingerprint IS DISTINCT FROM v_fingerprint THEN
    RAISE EXCEPTION 'MCP_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD'
      USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object('replayed', v_result IS NOT NULL, 'result', v_result);
END;
$$;

CREATE OR REPLACE FUNCTION public._mcp_complete_contract_write_request(
  p_actor_user_id uuid,
  p_operation text,
  p_client_request_id text,
  p_result jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE public.mcp_contract_write_requests AS request
  SET result_payload = p_result
  WHERE request.actor_id = p_actor_user_id
    AND request.operation = p_operation
    AND request.client_request_id = btrim(p_client_request_id)
    AND request.result_payload IS NULL;

  IF NOT FOUND AND NOT EXISTS (
    SELECT 1
    FROM public.mcp_contract_write_requests AS request
    WHERE request.actor_id = p_actor_user_id
      AND request.operation = p_operation
      AND request.client_request_id = btrim(p_client_request_id)
      AND request.result_payload = p_result
  ) THEN
    RAISE EXCEPTION 'MCP_IDEMPOTENCY_RESULT_NOT_STORED'
      USING ERRCODE = '40001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public._mcp_validate_contract_row(
  p_row jsonb,
  p_previous jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_lives integer;
  v_bonus_lives integer := 0;
  v_commission numeric := COALESCE(NULLIF(p_row->>'comissao_prevista', '')::numeric, 0);
  v_installment_total numeric := 0;
  v_installment_mode text;
  v_item jsonb;
  v_value numeric;
  v_percent numeric;
  v_has_value boolean;
  v_has_percent boolean;
  v_signup_type text := COALESCE(NULLIF(p_row->>'taxa_adesao_tipo', ''), 'nao_cobrar');
  v_is_adesao boolean := lower(COALESCE(p_row->>'modalidade', '')) LIKE '%ades%';
BEGIN
  IF NULLIF(btrim(p_row->>'codigo_contrato'), '') IS NULL
     OR NULLIF(btrim(p_row->>'status'), '') IS NULL
     OR NULLIF(btrim(p_row->>'modalidade'), '') IS NULL
     OR NULLIF(btrim(p_row->>'operadora'), '') IS NULL
     OR NULLIF(btrim(p_row->>'produto_plano'), '') IS NULL
     OR NULLIF(btrim(p_row->>'responsavel'), '') IS NULL THEN
    RAISE EXCEPTION 'MCP_REQUIRED_CONTRACT_FIELD_MISSING'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (SELECT 1 FROM public.contract_status_config AS configured WHERE configured.ativo IS TRUE)
     AND NOT EXISTS (
    SELECT 1 FROM public.contract_status_config AS option
    WHERE option.ativo IS TRUE AND lower(btrim(option.value)) = lower(btrim(p_row->>'status'))
  ) AND p_previous->>'status' IS DISTINCT FROM p_row->>'status' THEN
    RAISE EXCEPTION 'MCP_CONTRACT_STATUS_NOT_ACTIVE'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (SELECT 1 FROM public.contract_modalidades AS configured WHERE configured.ativo IS TRUE)
     AND NOT EXISTS (
    SELECT 1 FROM public.contract_modalidades AS option
    WHERE option.ativo IS TRUE AND lower(btrim(option.value)) = lower(btrim(p_row->>'modalidade'))
  ) AND p_previous->>'modalidade' IS DISTINCT FROM p_row->>'modalidade' THEN
    RAISE EXCEPTION 'MCP_CONTRACT_MODALITY_NOT_ACTIVE'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.operadoras AS operator
    WHERE operator.ativo IS TRUE
      AND lower(btrim(operator.nome)) = lower(btrim(p_row->>'operadora'))
  ) AND p_previous->>'operadora' IS DISTINCT FROM p_row->>'operadora' THEN
    RAISE EXCEPTION 'MCP_CONTRACT_OPERATOR_NOT_ACTIVE'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (SELECT 1 FROM public.lead_responsaveis AS configured WHERE configured.ativo IS TRUE)
     AND NOT EXISTS (
    SELECT 1 FROM public.lead_responsaveis AS option
    WHERE option.ativo IS TRUE AND lower(btrim(option.value)) = lower(btrim(p_row->>'responsavel'))
  ) AND p_previous->>'responsavel' IS DISTINCT FROM p_row->>'responsavel' THEN
    RAISE EXCEPTION 'MCP_CONTRACT_RESPONSIBLE_NOT_ACTIVE'
      USING ERRCODE = '22023';
  END IF;

  IF NULLIF(btrim(p_row->>'abrangencia'), '') IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.contract_abrangencias AS configured WHERE configured.ativo IS TRUE)
     AND NOT EXISTS (
       SELECT 1 FROM public.contract_abrangencias AS option
       WHERE option.ativo IS TRUE AND lower(btrim(option.value)) = lower(btrim(p_row->>'abrangencia'))
     ) AND p_previous->>'abrangencia' IS DISTINCT FROM p_row->>'abrangencia' THEN
    RAISE EXCEPTION 'MCP_CONTRACT_COVERAGE_NOT_ACTIVE'
      USING ERRCODE = '22023';
  END IF;

  IF NULLIF(btrim(p_row->>'acomodacao'), '') IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.contract_acomodacoes AS configured WHERE configured.ativo IS TRUE)
     AND NOT EXISTS (
       SELECT 1 FROM public.contract_acomodacoes AS option
       WHERE option.ativo IS TRUE AND lower(btrim(option.value)) = lower(btrim(p_row->>'acomodacao'))
     ) AND p_previous->>'acomodacao' IS DISTINCT FROM p_row->>'acomodacao' THEN
    RAISE EXCEPTION 'MCP_CONTRACT_ACCOMMODATION_NOT_ACTIVE'
      USING ERRCODE = '22023';
  END IF;

  IF NULLIF(btrim(p_row->>'carencia'), '') IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.contract_carencias AS configured WHERE configured.ativo IS TRUE)
     AND NOT EXISTS (
       SELECT 1 FROM public.contract_carencias AS option
       WHERE option.ativo IS TRUE AND lower(btrim(option.value)) = lower(btrim(p_row->>'carencia'))
     ) AND p_previous->>'carencia' IS DISTINCT FROM p_row->>'carencia' THEN
    RAISE EXCEPTION 'MCP_CONTRACT_WAITING_PERIOD_NOT_ACTIVE'
      USING ERRCODE = '22023';
  END IF;

  IF NULLIF(p_row->>'lead_id', '') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.leads AS lead
      WHERE lead.id = (p_row->>'lead_id')::uuid
        AND (
          p_previous->>'lead_id' = p_row->>'lead_id'
          OR (
            lead.arquivado IS FALSE
            AND (
              NOT EXISTS (SELECT 1 FROM public.lead_status_config AS status WHERE status.ativo IS TRUE)
              OR EXISTS (
                SELECT 1 FROM public.lead_status_config AS status
                WHERE status.ativo IS TRUE AND status.nome = lead.status
              )
            )
          )
        )
    ) THEN
      RAISE EXCEPTION 'MCP_CONTRACT_LEAD_NOT_AVAILABLE'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  v_lives := COALESCE(NULLIF(p_row->>'vidas', '')::integer, 1);
  IF v_lives < 1 THEN
    RAISE EXCEPTION 'MCP_CONTRACT_LIVES_MUST_BE_POSITIVE'
      USING ERRCODE = '22023';
  END IF;

  IF COALESCE(NULLIF(p_row->>'mes_reajuste', '')::integer, 0) NOT BETWEEN 0 AND 12 THEN
    RAISE EXCEPTION 'MCP_CONTRACT_ADJUSTMENT_MONTH_INVALID'
      USING ERRCODE = '22023';
  END IF;

  IF COALESCE(NULLIF(p_row->>'mensalidade_total', '')::numeric, 0) < 0
     OR v_commission < 0 THEN
    RAISE EXCEPTION 'MCP_CONTRACT_VALUES_MUST_NOT_BE_NEGATIVE'
      USING ERRCODE = '22023';
  END IF;

  IF COALESCE(NULLIF(p_row->>'comissao_multiplicador', '')::numeric, 2.8) NOT BETWEEN 0 AND 10 THEN
    RAISE EXCEPTION 'MCP_CONTRACT_COMMISSION_MULTIPLIER_INVALID'
      USING ERRCODE = '22023';
  END IF;

  IF v_signup_type NOT IN ('nao_cobrar', 'percentual_mensalidade', 'valor_fixo') THEN
    RAISE EXCEPTION 'MCP_CONTRACT_SIGNUP_FEE_TYPE_INVALID'
      USING ERRCODE = '22023';
  END IF;

  IF p_previous IS NULL
     OR p_previous->>'taxa_adesao_tipo' IS DISTINCT FROM p_row->>'taxa_adesao_tipo'
     OR p_previous->>'taxa_adesao_percentual' IS DISTINCT FROM p_row->>'taxa_adesao_percentual'
     OR p_previous->>'taxa_adesao_valor' IS DISTINCT FROM p_row->>'taxa_adesao_valor'
     OR p_previous->>'modalidade' IS DISTINCT FROM p_row->>'modalidade' THEN
    IF NOT v_is_adesao AND v_signup_type <> 'nao_cobrar' THEN
      RAISE EXCEPTION 'MCP_SIGNUP_FEE_ONLY_ALLOWED_FOR_ADHESION_MODALITY'
        USING ERRCODE = '22023';
    END IF;

    IF v_signup_type = 'percentual_mensalidade'
       AND COALESCE(NULLIF(p_row->>'taxa_adesao_percentual', '')::numeric, -1) < 0 THEN
      RAISE EXCEPTION 'MCP_CONTRACT_SIGNUP_PERCENTAGE_INVALID'
        USING ERRCODE = '22023';
    END IF;

    IF v_signup_type = 'valor_fixo'
       AND COALESCE(NULLIF(p_row->>'taxa_adesao_valor', '')::numeric, -1) < 0 THEN
      RAISE EXCEPTION 'MCP_CONTRACT_SIGNUP_AMOUNT_INVALID'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  IF jsonb_typeof(p_row->'comissao_parcelas') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'MCP_CONTRACT_COMMISSION_INSTALLMENTS_INVALID'
      USING ERRCODE = '22023';
  END IF;

  IF COALESCE((p_row->>'comissao_recebimento_adiantado')::boolean, false) IS FALSE THEN
    IF jsonb_array_length(p_row->'comissao_parcelas') = 0 OR v_commission <= 0 THEN
      RAISE EXCEPTION 'MCP_CONTRACT_COMMISSION_INSTALLMENTS_REQUIRED'
        USING ERRCODE = '22023';
    END IF;

    FOR v_item IN SELECT value FROM jsonb_array_elements(p_row->'comissao_parcelas') AS entry(value)
    LOOP
      PERFORM public._mcp_assert_contract_payload_keys(
        v_item,
        ARRAY['valor', 'percentual', 'data_pagamento'],
        ARRAY['data_pagamento']
      );
      IF NULLIF(btrim(v_item->>'data_pagamento'), '') IS NULL THEN
        RAISE EXCEPTION 'MCP_CONTRACT_COMMISSION_INSTALLMENT_DATE_REQUIRED'
          USING ERRCODE = '22023';
      END IF;

      v_value := COALESCE(NULLIF(v_item->>'valor', '')::numeric, 0);
      v_percent := COALESCE(NULLIF(v_item->>'percentual', '')::numeric, 0);
      v_has_value := v_value > 0;
      v_has_percent := v_percent > 0;

      IF v_value < 0 OR v_percent < 0 OR v_has_value = v_has_percent THEN
        RAISE EXCEPTION 'MCP_CONTRACT_COMMISSION_INSTALLMENT_VALUE_INVALID'
          USING ERRCODE = '22023';
      END IF;

      IF v_has_value THEN
        IF v_installment_mode IS NULL THEN v_installment_mode := 'value'; END IF;
        IF v_installment_mode <> 'value' THEN
          RAISE EXCEPTION 'MCP_CONTRACT_COMMISSION_INSTALLMENT_MODES_MIXED'
            USING ERRCODE = '22023';
        END IF;
        v_installment_total := v_installment_total + v_value;
      ELSE
        IF v_installment_mode IS NULL THEN v_installment_mode := 'percentage'; END IF;
        IF v_installment_mode <> 'percentage' THEN
          RAISE EXCEPTION 'MCP_CONTRACT_COMMISSION_INSTALLMENT_MODES_MIXED'
            USING ERRCODE = '22023';
        END IF;
      END IF;
    END LOOP;

    IF v_installment_mode = 'value' AND v_installment_total > v_commission THEN
      RAISE EXCEPTION 'MCP_CONTRACT_COMMISSION_INSTALLMENTS_EXCEED_TOTAL'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  IF COALESCE((p_row->>'bonus_por_vida_aplicado')::boolean, false) THEN
    IF jsonb_typeof(p_row->'bonus_por_vida_configuracoes') IS DISTINCT FROM 'array'
       OR jsonb_array_length(p_row->'bonus_por_vida_configuracoes') = 0 THEN
      RAISE EXCEPTION 'MCP_CONTRACT_BONUS_CONFIGURATION_REQUIRED'
        USING ERRCODE = '22023';
    END IF;

    FOR v_item IN SELECT value FROM jsonb_array_elements(p_row->'bonus_por_vida_configuracoes') AS entry(value)
    LOOP
      PERFORM public._mcp_assert_contract_payload_keys(
        v_item,
        ARRAY['id', 'quantidade', 'valor'],
        ARRAY['quantidade', 'valor']
      );
      IF COALESCE(NULLIF(v_item->>'quantidade', '')::integer, 0) <= 0
         OR COALESCE(NULLIF(v_item->>'valor', '')::numeric, 0) <= 0 THEN
        RAISE EXCEPTION 'MCP_CONTRACT_BONUS_CONFIGURATION_INVALID'
          USING ERRCODE = '22023';
      END IF;
      v_bonus_lives := v_bonus_lives + (v_item->>'quantidade')::integer;
    END LOOP;

    IF v_bonus_lives > v_lives THEN
      RAISE EXCEPTION 'MCP_CONTRACT_BONUS_LIVES_EXCEED_TOTAL'
        USING ERRCODE = '22023';
    END IF;

    IF NULLIF(p_row->>'vidas_elegiveis_bonus', '') IS NOT NULL
       AND (p_row->>'vidas_elegiveis_bonus')::integer <> v_bonus_lives THEN
      RAISE EXCEPTION 'MCP_CONTRACT_BONUS_ELIGIBLE_LIVES_MISMATCH'
        USING ERRCODE = '22023';
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public._mcp_validate_holder_payload(
  p_payload jsonb,
  p_require_required_fields boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  PERFORM public._mcp_assert_contract_payload_keys(
    p_payload,
    ARRAY[
      'nome_completo', 'cpf', 'rg', 'data_nascimento', 'sexo', 'estado_civil',
      'telefone', 'email', 'cep', 'endereco', 'numero', 'complemento', 'bairro',
      'cidade', 'estado', 'cns', 'cnpj', 'razao_social', 'nome_fantasia',
      'percentual_societario', 'data_abertura_cnpj', 'bonus_por_vida_aplicado'
    ]
  );

  IF p_require_required_fields AND (
     NULLIF(btrim(p_payload->>'nome_completo'), '') IS NULL
     OR NULLIF(btrim(p_payload->>'cpf'), '') IS NULL
     OR NULLIF(btrim(p_payload->>'data_nascimento'), '') IS NULL
     OR NULLIF(btrim(p_payload->>'telefone'), '') IS NULL
  ) THEN
    RAISE EXCEPTION 'MCP_REQUIRED_HOLDER_FIELD_MISSING'
      USING ERRCODE = '22023';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public._mcp_validate_dependent_payload(p_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  PERFORM public._mcp_assert_contract_payload_keys(
    p_payload,
    ARRAY[
      'nome_completo', 'cpf', 'data_nascimento', 'relacao', 'elegibilidade',
      'valor_individual', 'carencia_individual', 'bonus_por_vida_aplicado'
    ]
  );

  IF NULLIF(btrim(p_payload->>'nome_completo'), '') IS NULL
     OR NULLIF(btrim(p_payload->>'data_nascimento'), '') IS NULL
     OR NULLIF(btrim(p_payload->>'relacao'), '') IS NULL THEN
    RAISE EXCEPTION 'MCP_REQUIRED_DEPENDENT_FIELD_MISSING'
      USING ERRCODE = '22023';
  END IF;

  IF COALESCE(NULLIF(p_payload->>'valor_individual', '')::numeric, 0) < 0 THEN
    RAISE EXCEPTION 'MCP_DEPENDENT_VALUE_MUST_NOT_BE_NEGATIVE'
      USING ERRCODE = '22023';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public._mcp_insert_contract(p_payload jsonb)
RETURNS public.contracts
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_data public.contracts;
  v_saved public.contracts;
BEGIN
  PERFORM public._mcp_assert_contract_payload_keys(
    p_payload,
    ARRAY[
      'codigo_contrato', 'lead_id', 'status', 'modalidade', 'operadora', 'produto_plano',
      'abrangencia', 'acomodacao', 'data_inicio', 'data_renovacao', 'mes_reajuste',
      'carencia', 'mensalidade_total', 'comissao_prevista', 'comissao_multiplicador',
      'taxa_adesao_tipo', 'taxa_adesao_percentual', 'taxa_adesao_valor',
      'comissao_recebimento_adiantado', 'comissao_parcelas', 'previsao_recebimento_comissao',
      'previsao_pagamento_bonificacao', 'vidas', 'vidas_elegiveis_bonus',
      'bonus_por_vida_configuracoes', 'bonus_por_vida_valor', 'bonus_por_vida_aplicado',
      'responsavel', 'observacoes_internas', 'cnpj', 'razao_social', 'nome_fantasia',
      'endereco_empresa'
    ],
    ARRAY['codigo_contrato', 'status', 'modalidade', 'operadora', 'produto_plano', 'responsavel']
  );

  SELECT * INTO v_data FROM jsonb_populate_record(NULL::public.contracts, p_payload);
  v_data.comissao_multiplicador := COALESCE(v_data.comissao_multiplicador, 2.8);
  v_data.taxa_adesao_tipo := COALESCE(v_data.taxa_adesao_tipo, 'nao_cobrar');
  v_data.comissao_recebimento_adiantado := COALESCE(v_data.comissao_recebimento_adiantado, false);
  v_data.comissao_parcelas := COALESCE(v_data.comissao_parcelas, '[]'::jsonb);
  v_data.vidas := COALESCE(v_data.vidas, 1);
  v_data.bonus_por_vida_aplicado := COALESCE(v_data.bonus_por_vida_aplicado, false);
  v_data.bonus_por_vida_configuracoes := COALESCE(v_data.bonus_por_vida_configuracoes, '[]'::jsonb);
  IF v_data.comissao_recebimento_adiantado THEN
    v_data.comissao_parcelas := '[]'::jsonb;
  END IF;
  IF NOT v_data.bonus_por_vida_aplicado THEN
    v_data.vidas_elegiveis_bonus := NULL;
    v_data.bonus_por_vida_configuracoes := '[]'::jsonb;
    v_data.bonus_por_vida_valor := NULL;
  END IF;

  PERFORM public._mcp_validate_contract_row(to_jsonb(v_data));

  INSERT INTO public.contracts (
    codigo_contrato, lead_id, status, modalidade, operadora, produto_plano,
    abrangencia, acomodacao, data_inicio, data_renovacao, mes_reajuste, carencia,
    mensalidade_total, comissao_prevista, comissao_multiplicador, taxa_adesao_tipo,
    taxa_adesao_percentual, taxa_adesao_valor, comissao_recebimento_adiantado,
    comissao_parcelas, previsao_recebimento_comissao, previsao_pagamento_bonificacao,
    vidas, vidas_elegiveis_bonus, bonus_por_vida_configuracoes, bonus_por_vida_valor,
    bonus_por_vida_aplicado, responsavel, observacoes_internas, cnpj, razao_social,
    nome_fantasia, endereco_empresa
  ) VALUES (
    v_data.codigo_contrato, v_data.lead_id, v_data.status, v_data.modalidade,
    v_data.operadora, v_data.produto_plano, v_data.abrangencia, v_data.acomodacao,
    v_data.data_inicio, v_data.data_renovacao, v_data.mes_reajuste, v_data.carencia,
    v_data.mensalidade_total, v_data.comissao_prevista, v_data.comissao_multiplicador,
    v_data.taxa_adesao_tipo, v_data.taxa_adesao_percentual, v_data.taxa_adesao_valor,
    v_data.comissao_recebimento_adiantado, v_data.comissao_parcelas,
    v_data.previsao_recebimento_comissao, v_data.previsao_pagamento_bonificacao,
    v_data.vidas, v_data.vidas_elegiveis_bonus, v_data.bonus_por_vida_configuracoes,
    v_data.bonus_por_vida_valor, v_data.bonus_por_vida_aplicado, v_data.responsavel,
    v_data.observacoes_internas, v_data.cnpj, v_data.razao_social, v_data.nome_fantasia,
    v_data.endereco_empresa
  ) RETURNING * INTO v_saved;

  RETURN v_saved;
END;
$$;

CREATE OR REPLACE FUNCTION public._mcp_insert_holder(p_contract_id uuid, p_payload jsonb)
RETURNS public.contract_holders
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_data public.contract_holders;
  v_saved public.contract_holders;
BEGIN
  PERFORM public._mcp_validate_holder_payload(p_payload);

  PERFORM 1 FROM public.contracts AS contract
  WHERE contract.id = p_contract_id
  FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MCP_CONTRACT_NOT_FOUND'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_data FROM jsonb_populate_record(NULL::public.contract_holders, p_payload);
  v_data.bonus_por_vida_aplicado := COALESCE(v_data.bonus_por_vida_aplicado, false);

  INSERT INTO public.contract_holders (
    contract_id, nome_completo, cpf, rg, data_nascimento, sexo, estado_civil,
    telefone, email, cep, endereco, numero, complemento, bairro, cidade, estado,
    cns, cnpj, razao_social, nome_fantasia, percentual_societario,
    data_abertura_cnpj, bonus_por_vida_aplicado
  ) VALUES (
    p_contract_id, v_data.nome_completo, v_data.cpf, v_data.rg, v_data.data_nascimento,
    v_data.sexo, v_data.estado_civil, v_data.telefone, v_data.email, v_data.cep,
    v_data.endereco, v_data.numero, v_data.complemento, v_data.bairro, v_data.cidade,
    v_data.estado, v_data.cns, v_data.cnpj, v_data.razao_social, v_data.nome_fantasia,
    v_data.percentual_societario, v_data.data_abertura_cnpj, v_data.bonus_por_vida_aplicado
  ) RETURNING * INTO v_saved;

  RETURN v_saved;
END;
$$;

CREATE OR REPLACE FUNCTION public._mcp_insert_dependent(
  p_contract_id uuid,
  p_holder_id uuid,
  p_payload jsonb
)
RETURNS public.dependents
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_data public.dependents;
  v_saved public.dependents;
BEGIN
  PERFORM public._mcp_validate_dependent_payload(p_payload);

  PERFORM 1 FROM public.contract_holders AS holder
  WHERE holder.id = p_holder_id AND holder.contract_id = p_contract_id
  FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MCP_HOLDER_NOT_IN_CONTRACT'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_data FROM jsonb_populate_record(NULL::public.dependents, p_payload);
  v_data.bonus_por_vida_aplicado := COALESCE(v_data.bonus_por_vida_aplicado, false);

  INSERT INTO public.dependents (
    contract_id, holder_id, nome_completo, cpf, data_nascimento, relacao,
    elegibilidade, valor_individual, carencia_individual, bonus_por_vida_aplicado
  ) VALUES (
    p_contract_id, p_holder_id, v_data.nome_completo, v_data.cpf,
    v_data.data_nascimento, v_data.relacao, v_data.elegibilidade,
    v_data.valor_individual, v_data.carencia_individual, v_data.bonus_por_vida_aplicado
  ) RETURNING * INTO v_saved;

  RETURN v_saved;
END;
$$;

CREATE OR REPLACE FUNCTION public.mcp_create_contract(
  p_actor_user_id uuid,
  p_client_request_id text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, extensions
AS $$
DECLARE
  v_request jsonb;
  v_contract public.contracts;
  v_result jsonb;
BEGIN
  PERFORM public._mcp_assert_active_contract_admin(p_actor_user_id);
  v_request := public._mcp_begin_contract_write_request(
    p_actor_user_id, 'contract.create', p_client_request_id,
    jsonb_build_object('payload', p_payload)
  );
  IF (v_request->>'replayed')::boolean THEN
    RETURN (v_request->'result') || jsonb_build_object('replayed', true);
  END IF;

  v_contract := public._mcp_insert_contract(p_payload);
  v_result := jsonb_build_object(
    'contract_id', v_contract.id,
    'updated_at', v_contract.updated_at,
    'client_request_id', btrim(p_client_request_id),
    'replayed', false
  );
  PERFORM public._mcp_complete_contract_write_request(
    p_actor_user_id, 'contract.create', p_client_request_id, v_result
  );
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.mcp_update_contract(
  p_actor_user_id uuid,
  p_contract_id uuid,
  p_expected_updated_at timestamptz,
  p_patch jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_current public.contracts;
  v_next public.contracts;
  v_updated_at timestamptz := clock_timestamp();
BEGIN
  PERFORM public._mcp_assert_active_contract_admin(p_actor_user_id);
  PERFORM public._mcp_assert_contract_payload_keys(
    p_patch,
    ARRAY[
      'codigo_contrato', 'lead_id', 'status', 'modalidade', 'operadora', 'produto_plano',
      'abrangencia', 'acomodacao', 'data_inicio', 'data_renovacao', 'mes_reajuste',
      'carencia', 'mensalidade_total', 'comissao_prevista', 'comissao_multiplicador',
      'taxa_adesao_tipo', 'taxa_adesao_percentual', 'taxa_adesao_valor',
      'comissao_recebimento_adiantado', 'comissao_parcelas', 'previsao_recebimento_comissao',
      'previsao_pagamento_bonificacao', 'vidas', 'vidas_elegiveis_bonus',
      'bonus_por_vida_configuracoes', 'bonus_por_vida_valor', 'bonus_por_vida_aplicado',
      'responsavel', 'observacoes_internas', 'cnpj', 'razao_social', 'nome_fantasia',
      'endereco_empresa'
    ]
  );
  IF p_patch = '{}'::jsonb THEN
    RAISE EXCEPTION 'MCP_EMPTY_PATCH'
      USING ERRCODE = '22023';
  END IF;
  IF p_expected_updated_at IS NULL THEN
    RAISE EXCEPTION 'MCP_EXPECTED_UPDATED_AT_REQUIRED'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_current FROM public.contracts AS contract
  WHERE contract.id = p_contract_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MCP_CONTRACT_NOT_FOUND'
      USING ERRCODE = 'P0002';
  END IF;
  IF v_current.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'MCP_CONCURRENT_UPDATE'
      USING ERRCODE = '40001';
  END IF;

  SELECT * INTO v_next FROM jsonb_populate_record(v_current, p_patch);
  IF p_patch ? 'comissao_recebimento_adiantado'
     AND COALESCE(v_next.comissao_recebimento_adiantado, false) THEN
    v_next.comissao_parcelas := '[]'::jsonb;
  END IF;
  IF p_patch ? 'bonus_por_vida_aplicado'
     AND NOT COALESCE(v_next.bonus_por_vida_aplicado, false) THEN
    v_next.vidas_elegiveis_bonus := NULL;
    v_next.bonus_por_vida_configuracoes := '[]'::jsonb;
    v_next.bonus_por_vida_valor := NULL;
  END IF;
  PERFORM public._mcp_validate_contract_row(to_jsonb(v_next), to_jsonb(v_current));

  UPDATE public.contracts AS contract SET
    codigo_contrato = v_next.codigo_contrato,
    lead_id = v_next.lead_id,
    status = v_next.status,
    modalidade = v_next.modalidade,
    operadora = v_next.operadora,
    produto_plano = v_next.produto_plano,
    abrangencia = v_next.abrangencia,
    acomodacao = v_next.acomodacao,
    data_inicio = v_next.data_inicio,
    data_renovacao = v_next.data_renovacao,
    mes_reajuste = v_next.mes_reajuste,
    carencia = v_next.carencia,
    mensalidade_total = v_next.mensalidade_total,
    comissao_prevista = v_next.comissao_prevista,
    comissao_multiplicador = v_next.comissao_multiplicador,
    taxa_adesao_tipo = v_next.taxa_adesao_tipo,
    taxa_adesao_percentual = v_next.taxa_adesao_percentual,
    taxa_adesao_valor = v_next.taxa_adesao_valor,
    comissao_recebimento_adiantado = v_next.comissao_recebimento_adiantado,
    comissao_parcelas = v_next.comissao_parcelas,
    previsao_recebimento_comissao = v_next.previsao_recebimento_comissao,
    previsao_pagamento_bonificacao = v_next.previsao_pagamento_bonificacao,
    vidas = v_next.vidas,
    vidas_elegiveis_bonus = v_next.vidas_elegiveis_bonus,
    bonus_por_vida_configuracoes = v_next.bonus_por_vida_configuracoes,
    bonus_por_vida_valor = v_next.bonus_por_vida_valor,
    bonus_por_vida_aplicado = v_next.bonus_por_vida_aplicado,
    responsavel = v_next.responsavel,
    observacoes_internas = v_next.observacoes_internas,
    cnpj = v_next.cnpj,
    razao_social = v_next.razao_social,
    nome_fantasia = v_next.nome_fantasia,
    endereco_empresa = v_next.endereco_empresa,
    updated_at = v_updated_at
  WHERE contract.id = p_contract_id
  RETURNING * INTO v_next;

  RETURN jsonb_build_object('contract_id', v_next.id, 'updated_at', v_next.updated_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.mcp_create_contract_holder(
  p_actor_user_id uuid,
  p_contract_id uuid,
  p_client_request_id text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, extensions
AS $$
DECLARE
  v_request jsonb;
  v_holder public.contract_holders;
  v_result jsonb;
BEGIN
  PERFORM public._mcp_assert_active_contract_admin(p_actor_user_id);
  v_request := public._mcp_begin_contract_write_request(
    p_actor_user_id, 'holder.create', p_client_request_id,
    jsonb_build_object('contract_id', p_contract_id, 'payload', p_payload)
  );
  IF (v_request->>'replayed')::boolean THEN
    RETURN (v_request->'result') || jsonb_build_object('replayed', true);
  END IF;

  v_holder := public._mcp_insert_holder(p_contract_id, p_payload);
  v_result := jsonb_build_object(
    'holder_id', v_holder.id,
    'contract_id', v_holder.contract_id,
    'updated_at', v_holder.updated_at,
    'client_request_id', btrim(p_client_request_id),
    'replayed', false
  );
  PERFORM public._mcp_complete_contract_write_request(
    p_actor_user_id, 'holder.create', p_client_request_id, v_result
  );
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.mcp_update_contract_holder(
  p_actor_user_id uuid,
  p_holder_id uuid,
  p_expected_updated_at timestamptz,
  p_patch jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_current public.contract_holders;
  v_next public.contract_holders;
  v_updated_at timestamptz := clock_timestamp();
BEGIN
  PERFORM public._mcp_assert_active_contract_admin(p_actor_user_id);
  PERFORM public._mcp_validate_holder_payload(p_patch, false);
  IF p_patch = '{}'::jsonb THEN
    RAISE EXCEPTION 'MCP_EMPTY_PATCH'
      USING ERRCODE = '22023';
  END IF;
  IF p_expected_updated_at IS NULL THEN
    RAISE EXCEPTION 'MCP_EXPECTED_UPDATED_AT_REQUIRED'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_current FROM public.contract_holders AS holder
  WHERE holder.id = p_holder_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MCP_HOLDER_NOT_FOUND'
      USING ERRCODE = 'P0002';
  END IF;
  IF v_current.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'MCP_CONCURRENT_UPDATE'
      USING ERRCODE = '40001';
  END IF;

  SELECT * INTO v_next FROM jsonb_populate_record(v_current, p_patch);
  PERFORM public._mcp_validate_holder_payload(
    to_jsonb(v_next) - 'id' - 'contract_id' - 'created_at' - 'updated_at'
  );

  UPDATE public.contract_holders AS holder SET
    nome_completo = v_next.nome_completo,
    cpf = v_next.cpf,
    rg = v_next.rg,
    data_nascimento = v_next.data_nascimento,
    sexo = v_next.sexo,
    estado_civil = v_next.estado_civil,
    telefone = v_next.telefone,
    email = v_next.email,
    cep = v_next.cep,
    endereco = v_next.endereco,
    numero = v_next.numero,
    complemento = v_next.complemento,
    bairro = v_next.bairro,
    cidade = v_next.cidade,
    estado = v_next.estado,
    cns = v_next.cns,
    cnpj = v_next.cnpj,
    razao_social = v_next.razao_social,
    nome_fantasia = v_next.nome_fantasia,
    percentual_societario = v_next.percentual_societario,
    data_abertura_cnpj = v_next.data_abertura_cnpj,
    bonus_por_vida_aplicado = v_next.bonus_por_vida_aplicado,
    updated_at = v_updated_at
  WHERE holder.id = p_holder_id
  RETURNING * INTO v_next;

  RETURN jsonb_build_object(
    'holder_id', v_next.id,
    'contract_id', v_next.contract_id,
    'updated_at', v_next.updated_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mcp_create_contract_dependent(
  p_actor_user_id uuid,
  p_contract_id uuid,
  p_holder_id uuid,
  p_client_request_id text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, extensions
AS $$
DECLARE
  v_request jsonb;
  v_dependent public.dependents;
  v_result jsonb;
BEGIN
  PERFORM public._mcp_assert_active_contract_admin(p_actor_user_id);
  v_request := public._mcp_begin_contract_write_request(
    p_actor_user_id, 'dependent.create', p_client_request_id,
    jsonb_build_object(
      'contract_id', p_contract_id, 'holder_id', p_holder_id, 'payload', p_payload
    )
  );
  IF (v_request->>'replayed')::boolean THEN
    RETURN (v_request->'result') || jsonb_build_object('replayed', true);
  END IF;

  v_dependent := public._mcp_insert_dependent(p_contract_id, p_holder_id, p_payload);
  v_result := jsonb_build_object(
    'dependent_id', v_dependent.id,
    'contract_id', v_dependent.contract_id,
    'holder_id', v_dependent.holder_id,
    'updated_at', v_dependent.updated_at,
    'client_request_id', btrim(p_client_request_id),
    'replayed', false
  );
  PERFORM public._mcp_complete_contract_write_request(
    p_actor_user_id, 'dependent.create', p_client_request_id, v_result
  );
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.mcp_update_contract_dependent(
  p_actor_user_id uuid,
  p_dependent_id uuid,
  p_expected_updated_at timestamptz,
  p_patch jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_current public.dependents;
  v_next public.dependents;
  v_updated_at timestamptz := clock_timestamp();
BEGIN
  PERFORM public._mcp_assert_active_contract_admin(p_actor_user_id);
  PERFORM public._mcp_assert_contract_payload_keys(
    p_patch,
    ARRAY[
      'holder_id', 'nome_completo', 'cpf', 'data_nascimento', 'relacao',
      'elegibilidade', 'valor_individual', 'carencia_individual', 'bonus_por_vida_aplicado'
    ]
  );
  IF p_patch = '{}'::jsonb THEN
    RAISE EXCEPTION 'MCP_EMPTY_PATCH'
      USING ERRCODE = '22023';
  END IF;
  IF p_expected_updated_at IS NULL THEN
    RAISE EXCEPTION 'MCP_EXPECTED_UPDATED_AT_REQUIRED'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_current FROM public.dependents AS dependent
  WHERE dependent.id = p_dependent_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MCP_DEPENDENT_NOT_FOUND'
      USING ERRCODE = 'P0002';
  END IF;
  IF v_current.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'MCP_CONCURRENT_UPDATE'
      USING ERRCODE = '40001';
  END IF;

  SELECT * INTO v_next FROM jsonb_populate_record(v_current, p_patch);
  PERFORM public._mcp_validate_dependent_payload(
    (to_jsonb(v_next) - 'id' - 'contract_id' - 'holder_id' - 'created_at' - 'updated_at')
  );

  PERFORM 1 FROM public.contract_holders AS holder
  WHERE holder.id = v_next.holder_id AND holder.contract_id = v_current.contract_id
  FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MCP_HOLDER_NOT_IN_CONTRACT'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.dependents AS dependent SET
    holder_id = v_next.holder_id,
    nome_completo = v_next.nome_completo,
    cpf = v_next.cpf,
    data_nascimento = v_next.data_nascimento,
    relacao = v_next.relacao,
    elegibilidade = v_next.elegibilidade,
    valor_individual = v_next.valor_individual,
    carencia_individual = v_next.carencia_individual,
    bonus_por_vida_aplicado = v_next.bonus_por_vida_aplicado,
    updated_at = v_updated_at
  WHERE dependent.id = p_dependent_id
  RETURNING * INTO v_next;

  RETURN jsonb_build_object(
    'dependent_id', v_next.id,
    'contract_id', v_next.contract_id,
    'holder_id', v_next.holder_id,
    'updated_at', v_next.updated_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mcp_create_contract_bundle(
  p_actor_user_id uuid,
  p_client_request_id text,
  p_contract jsonb,
  p_holder jsonb,
  p_dependents jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, extensions
AS $$
DECLARE
  v_request jsonb;
  v_contract public.contracts;
  v_holder public.contract_holders;
  v_dependent public.dependents;
  v_dependent_ids jsonb := '[]'::jsonb;
  v_dependent_updated_ats jsonb := '[]'::jsonb;
  v_item jsonb;
  v_result jsonb;
BEGIN
  PERFORM public._mcp_assert_active_contract_admin(p_actor_user_id);
  IF p_dependents IS NULL OR jsonb_typeof(p_dependents) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_dependents) > 100 THEN
    RAISE EXCEPTION 'MCP_BUNDLE_DEPENDENTS_INVALID'
      USING ERRCODE = '22023';
  END IF;

  v_request := public._mcp_begin_contract_write_request(
    p_actor_user_id, 'contract.bundle.create', p_client_request_id,
    jsonb_build_object('contract', p_contract, 'holder', p_holder, 'dependents', p_dependents)
  );
  IF (v_request->>'replayed')::boolean THEN
    RETURN (v_request->'result') || jsonb_build_object('replayed', true);
  END IF;

  v_contract := public._mcp_insert_contract(p_contract);
  v_holder := public._mcp_insert_holder(v_contract.id, p_holder);

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_dependents) AS entry(value)
  LOOP
    v_dependent := public._mcp_insert_dependent(v_contract.id, v_holder.id, v_item);
    v_dependent_ids := v_dependent_ids || jsonb_build_array(v_dependent.id);
    v_dependent_updated_ats := v_dependent_updated_ats || jsonb_build_array(v_dependent.updated_at);
  END LOOP;

  v_result := jsonb_build_object(
    'contract_id', v_contract.id,
    'contract_updated_at', v_contract.updated_at,
    'holder_id', v_holder.id,
    'holder_updated_at', v_holder.updated_at,
    'dependent_ids', v_dependent_ids,
    'dependent_updated_ats', v_dependent_updated_ats,
    'client_request_id', btrim(p_client_request_id),
    'replayed', false
  );
  PERFORM public._mcp_complete_contract_write_request(
    p_actor_user_id, 'contract.bundle.create', p_client_request_id, v_result
  );
  RETURN v_result;
END;
$$;

-- All public entrypoints are service-role callable only. MCP actor identity is
-- separately revalidated inside every entrypoint against user_profiles.
REVOKE ALL ON FUNCTION public._mcp_assert_active_contract_admin(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._mcp_assert_contract_payload_keys(jsonb, text[], text[]) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._mcp_begin_contract_write_request(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._mcp_complete_contract_write_request(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._mcp_validate_contract_row(jsonb, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._mcp_validate_holder_payload(jsonb, boolean) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._mcp_validate_dependent_payload(jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._mcp_insert_contract(jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._mcp_insert_holder(uuid, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._mcp_insert_dependent(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.mcp_create_contract(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_update_contract(uuid, uuid, timestamptz, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_create_contract_holder(uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_update_contract_holder(uuid, uuid, timestamptz, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_create_contract_dependent(uuid, uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_update_contract_dependent(uuid, uuid, timestamptz, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_create_contract_bundle(uuid, text, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.mcp_create_contract(uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_update_contract(uuid, uuid, timestamptz, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_create_contract_holder(uuid, uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_update_contract_holder(uuid, uuid, timestamptz, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_create_contract_dependent(uuid, uuid, uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_update_contract_dependent(uuid, uuid, timestamptz, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_create_contract_bundle(uuid, text, jsonb, jsonb, jsonb) TO service_role;

COMMENT ON FUNCTION public.mcp_create_contract(uuid, text, jsonb) IS
  'MCP-only contract creation; requires a current admin actor and idempotent client_request_id.';
COMMENT ON FUNCTION public.mcp_update_contract(uuid, uuid, timestamptz, jsonb) IS
  'MCP-only contract update with an explicit field allowlist and expected_updated_at concurrency check.';
COMMENT ON FUNCTION public.mcp_create_contract_holder(uuid, uuid, text, jsonb) IS
  'MCP-only holder creation; contract_id is an explicit argument and request is idempotent.';
COMMENT ON FUNCTION public.mcp_update_contract_holder(uuid, uuid, timestamptz, jsonb) IS
  'MCP-only holder update with an explicit field allowlist and expected_updated_at concurrency check.';
COMMENT ON FUNCTION public.mcp_create_contract_dependent(uuid, uuid, uuid, text, jsonb) IS
  'MCP-only dependent creation; validates that holder_id belongs to contract_id and is idempotent.';
COMMENT ON FUNCTION public.mcp_update_contract_dependent(uuid, uuid, timestamptz, jsonb) IS
  'MCP-only dependent update with an explicit field allowlist, same-contract holder check, and expected_updated_at concurrency check.';
COMMENT ON FUNCTION public.mcp_create_contract_bundle(uuid, text, jsonb, jsonb, jsonb) IS
  'Atomically creates a contract, one holder, and up to 100 dependents. Does not convert or mutate a linked lead.';

COMMIT;
