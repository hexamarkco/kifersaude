BEGIN;

CREATE TEMP TABLE tmp_cotador_hospital_merge ON COMMIT DROP AS
WITH ranked AS (
  SELECT
    id,
    first_value(id) OVER (
      PARTITION BY nome_normalizado, cidade_normalizada, bairro_normalizado
      ORDER BY ativo DESC, updated_at DESC, created_at DESC, id
    ) AS canonical_id
  FROM public.cotador_hospitais
)
SELECT id AS duplicate_id, canonical_id
FROM ranked
WHERE id <> canonical_id;

INSERT INTO public.cotador_hospital_aliases (hospital_id, alias_nome)
SELECT merge.canonical_id, hospital.nome
FROM tmp_cotador_hospital_merge merge
JOIN public.cotador_hospitais hospital ON hospital.id = merge.duplicate_id
WHERE NULLIF(btrim(hospital.nome), '') IS NOT NULL
ON CONFLICT (hospital_id, alias_nome_normalizado) DO NOTHING;

INSERT INTO public.cotador_hospital_aliases (hospital_id, alias_nome)
SELECT merge.canonical_id, alias.alias_nome
FROM tmp_cotador_hospital_merge merge
JOIN public.cotador_hospital_aliases alias ON alias.hospital_id = merge.duplicate_id
WHERE NULLIF(btrim(alias.alias_nome), '') IS NOT NULL
ON CONFLICT (hospital_id, alias_nome_normalizado) DO NOTHING;

INSERT INTO public.cotador_produto_hospitais (
  produto_id,
  hospital_id,
  atendimentos,
  observacoes,
  ordem
)
SELECT
  link.produto_id,
  merge.canonical_id,
  link.atendimentos,
  link.observacoes,
  link.ordem
FROM tmp_cotador_hospital_merge merge
JOIN public.cotador_produto_hospitais link ON link.hospital_id = merge.duplicate_id
ON CONFLICT (produto_id, hospital_id) DO UPDATE
SET atendimentos = (
      SELECT COALESCE(
        ARRAY(
          SELECT DISTINCT btrim(item)
          FROM unnest(
            COALESCE(public.cotador_produto_hospitais.atendimentos, ARRAY[]::text[])
            || COALESCE(EXCLUDED.atendimentos, ARRAY[]::text[])
          ) AS item
          WHERE btrim(item) <> ''
          ORDER BY btrim(item)
        ),
        ARRAY[]::text[]
      )
    ),
    observacoes = COALESCE(public.cotador_produto_hospitais.observacoes, EXCLUDED.observacoes),
    ordem = LEAST(public.cotador_produto_hospitais.ordem, EXCLUDED.ordem),
    updated_at = now();

DELETE FROM public.cotador_hospitais
WHERE id IN (SELECT duplicate_id FROM tmp_cotador_hospital_merge);

DROP INDEX IF EXISTS public.idx_cotador_hospitais_cidade;
CREATE INDEX IF NOT EXISTS idx_cotador_hospitais_cidade
  ON public.cotador_hospitais (cidade_normalizada, bairro_normalizado);

DROP INDEX IF EXISTS public.idx_cotador_hospitais_identity;
CREATE UNIQUE INDEX IF NOT EXISTS idx_cotador_hospitais_identity
  ON public.cotador_hospitais (nome_normalizado, cidade_normalizada, bairro_normalizado);

CREATE OR REPLACE FUNCTION public.replace_cotador_produto_rede_hospitalar(
  p_produto_id uuid,
  p_entries jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entries jsonb := COALESCE(p_entries, '[]'::jsonb);
  v_entry jsonb;
  v_hospital_id uuid;
  v_previous_hospital_name text;
  v_hospital_nome text;
  v_cidade text;
  v_regiao text;
  v_bairro text;
  v_observacoes text;
  v_atendimentos text[];
  v_alias text;
  v_order integer := 0;
  v_has_explicit_hospital_id boolean;
BEGIN
  IF NOT public.current_user_can_manage_system_catalog() THEN
    RAISE EXCEPTION 'Permissao negada para editar a rede do Cotador.';
  END IF;

  IF jsonb_typeof(v_entries) <> 'array' THEN
    RAISE EXCEPTION 'A rede hospitalar deve ser enviada como um array JSON.';
  END IF;

  PERFORM 1
  FROM public.cotador_produtos
  WHERE id = p_produto_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto do Cotador nao encontrado.';
  END IF;

  DELETE FROM public.cotador_produto_hospitais
  WHERE produto_id = p_produto_id;

  FOR v_entry IN SELECT value FROM jsonb_array_elements(v_entries) LOOP
    IF jsonb_typeof(v_entry) <> 'object' THEN
      CONTINUE;
    END IF;

    v_hospital_nome := NULLIF(btrim(COALESCE(v_entry ->> 'hospital', '')), '');
    v_cidade := NULLIF(btrim(COALESCE(v_entry ->> 'cidade', '')), '');
    v_regiao := NULLIF(btrim(COALESCE(v_entry ->> 'regiao', '')), '');
    v_bairro := NULLIF(btrim(COALESCE(v_entry ->> 'bairro', '')), '');
    v_observacoes := NULLIF(btrim(COALESCE(v_entry ->> 'observacoes', '')), '');
    v_has_explicit_hospital_id := false;

    IF v_hospital_nome IS NULL OR v_cidade IS NULL THEN
      CONTINUE;
    END IF;

    v_atendimentos := COALESCE(
      ARRAY(
        SELECT DISTINCT btrim(service.value)
        FROM jsonb_array_elements_text(
          CASE
            WHEN jsonb_typeof(COALESCE(v_entry -> 'atendimentos', '[]'::jsonb)) = 'array' THEN COALESCE(v_entry -> 'atendimentos', '[]'::jsonb)
            ELSE '[]'::jsonb
          END
        ) AS service(value)
        WHERE btrim(service.value) <> ''
        ORDER BY btrim(service.value)
      ),
      ARRAY[]::text[]
    );

    v_hospital_id := NULL;

    IF NULLIF(COALESCE(v_entry ->> 'hospitalId', ''), '') IS NOT NULL THEN
      BEGIN
        v_hospital_id := (v_entry ->> 'hospitalId')::uuid;
        v_has_explicit_hospital_id := true;
      EXCEPTION WHEN invalid_text_representation THEN
        v_hospital_id := NULL;
        v_has_explicit_hospital_id := false;
      END;
    END IF;

    IF v_hospital_id IS NOT NULL THEN
      PERFORM 1
      FROM public.cotador_hospitais
      WHERE id = v_hospital_id;

      IF NOT FOUND THEN
        v_hospital_id := NULL;
        v_has_explicit_hospital_id := false;
      END IF;
    END IF;

    IF v_hospital_id IS NULL AND v_bairro IS NOT NULL THEN
      SELECT h.id
      INTO v_hospital_id
      FROM public.cotador_hospitais h
      WHERE h.nome_normalizado = COALESCE(public.normalize_cotador_hospital_term(v_hospital_nome), '')
        AND h.cidade_normalizada = COALESCE(public.normalize_cotador_hospital_term(v_cidade), '')
        AND h.bairro_normalizado = COALESCE(public.normalize_cotador_hospital_term(v_bairro), '')
      ORDER BY h.updated_at DESC
      LIMIT 1;
    END IF;

    IF v_hospital_id IS NULL AND v_bairro IS NOT NULL THEN
      SELECT h.id
      INTO v_hospital_id
      FROM public.cotador_hospital_aliases ha
      JOIN public.cotador_hospitais h ON h.id = ha.hospital_id
      WHERE ha.alias_nome_normalizado = COALESCE(public.normalize_cotador_hospital_term(v_hospital_nome), '')
        AND h.cidade_normalizada = COALESCE(public.normalize_cotador_hospital_term(v_cidade), '')
        AND h.bairro_normalizado = COALESCE(public.normalize_cotador_hospital_term(v_bairro), '')
      ORDER BY h.updated_at DESC
      LIMIT 1;
    END IF;

    IF v_hospital_id IS NULL AND v_bairro IS NOT NULL THEN
      INSERT INTO public.cotador_hospitais (
        nome,
        cidade,
        regiao,
        bairro,
        ativo
      )
      VALUES (
        v_hospital_nome,
        v_cidade,
        v_regiao,
        v_bairro,
        true
      )
      RETURNING id INTO v_hospital_id;
    END IF;

    IF v_hospital_id IS NULL THEN
      CONTINUE;
    END IF;

    SELECT nome
    INTO v_previous_hospital_name
    FROM public.cotador_hospitais
    WHERE id = v_hospital_id;

    IF v_previous_hospital_name IS NOT NULL
       AND public.normalize_cotador_hospital_term(v_previous_hospital_name) IS DISTINCT FROM public.normalize_cotador_hospital_term(v_hospital_nome) THEN
      INSERT INTO public.cotador_hospital_aliases (hospital_id, alias_nome)
      VALUES (v_hospital_id, v_previous_hospital_name)
      ON CONFLICT (hospital_id, alias_nome_normalizado) DO NOTHING;
    END IF;

    UPDATE public.cotador_hospitais
    SET nome = v_hospital_nome,
        cidade = v_cidade,
        regiao = COALESCE(v_regiao, regiao),
        bairro = COALESCE(v_bairro, bairro),
        ativo = true,
        updated_at = now()
    WHERE id = v_hospital_id;

    INSERT INTO public.cotador_hospital_aliases (hospital_id, alias_nome)
    VALUES (v_hospital_id, v_hospital_nome)
    ON CONFLICT (hospital_id, alias_nome_normalizado) DO NOTHING;

    FOR v_alias IN
      SELECT DISTINCT btrim(alias_value.value)
      FROM jsonb_array_elements_text(
        CASE
          WHEN jsonb_typeof(COALESCE(v_entry -> 'aliases', '[]'::jsonb)) = 'array' THEN COALESCE(v_entry -> 'aliases', '[]'::jsonb)
          ELSE '[]'::jsonb
        END
      ) AS alias_value(value)
      WHERE btrim(alias_value.value) <> ''
    LOOP
      INSERT INTO public.cotador_hospital_aliases (hospital_id, alias_nome)
      VALUES (v_hospital_id, v_alias)
      ON CONFLICT (hospital_id, alias_nome_normalizado) DO NOTHING;
    END LOOP;

    INSERT INTO public.cotador_produto_hospitais (
      produto_id,
      hospital_id,
      atendimentos,
      observacoes,
      ordem
    )
    VALUES (
      p_produto_id,
      v_hospital_id,
      v_atendimentos,
      v_observacoes,
      v_order
    )
    ON CONFLICT (produto_id, hospital_id) DO UPDATE
    SET atendimentos = EXCLUDED.atendimentos,
        observacoes = EXCLUDED.observacoes,
        ordem = LEAST(public.cotador_produto_hospitais.ordem, EXCLUDED.ordem),
        updated_at = now();

    v_order := v_order + 1;
  END LOOP;

  UPDATE public.cotador_produtos
  SET rede_hospitalar = v_entries,
      updated_at = now()
  WHERE id = p_produto_id;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_cotador_produto_rede_hospitalar(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_cotador_produto_rede_hospitalar(uuid, jsonb) TO authenticated;

COMMIT;
