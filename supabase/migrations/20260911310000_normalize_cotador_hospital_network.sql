/*
  # Normalize Cotador hospital network

  - creates shared hospitals, aliases and product network links
  - backfills existing product network JSON without losing current data
  - adds transactional RPC to replace a product network while keeping legacy JSON in sync
*/

BEGIN;

CREATE OR REPLACE FUNCTION public.normalize_cotador_hospital_term(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    trim(
      regexp_replace(
        lower(
          translate(
            COALESCE(value, ''),
            'ÁÀÃÂÄáàãâäÉÈÊËéèêëÍÌÎÏíìîïÓÒÕÔÖóòõôöÚÙÛÜúùûüÇçÑñ',
            'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
          )
        ),
        '[^a-z0-9]+',
        ' ',
        'g'
      )
    ),
    ''
  )
$$;

REVOKE ALL ON FUNCTION public.normalize_cotador_hospital_term(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.normalize_cotador_hospital_term(text) TO authenticated;

CREATE TABLE IF NOT EXISTS public.cotador_hospitais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  nome_normalizado text NOT NULL DEFAULT '',
  cidade text NOT NULL,
  cidade_normalizada text NOT NULL DEFAULT '',
  regiao text,
  regiao_normalizada text NOT NULL DEFAULT '',
  bairro text,
  bairro_normalizado text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cotador_hospitais_cidade
  ON public.cotador_hospitais (cidade_normalizada, regiao_normalizada);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cotador_hospitais_identity
  ON public.cotador_hospitais (nome_normalizado, cidade_normalizada, regiao_normalizada, bairro_normalizado);

CREATE OR REPLACE FUNCTION public.sync_cotador_hospital_normalized_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.nome := btrim(NEW.nome);
  NEW.cidade := btrim(NEW.cidade);
  NEW.regiao := NULLIF(btrim(COALESCE(NEW.regiao, '')), '');
  NEW.bairro := NULLIF(btrim(COALESCE(NEW.bairro, '')), '');
  NEW.nome_normalizado := COALESCE(public.normalize_cotador_hospital_term(NEW.nome), '');
  NEW.cidade_normalizada := COALESCE(public.normalize_cotador_hospital_term(NEW.cidade), '');
  NEW.regiao_normalizada := COALESCE(public.normalize_cotador_hospital_term(NEW.regiao), '');
  NEW.bairro_normalizada := COALESCE(public.normalize_cotador_hospital_term(NEW.bairro), '');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cotador_hospitais_normalized_fields ON public.cotador_hospitais;
CREATE TRIGGER trg_cotador_hospitais_normalized_fields
  BEFORE INSERT OR UPDATE ON public.cotador_hospitais
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_cotador_hospital_normalized_fields();

DROP TRIGGER IF EXISTS trg_cotador_hospitais_updated_at ON public.cotador_hospitais;
CREATE TRIGGER trg_cotador_hospitais_updated_at
  BEFORE UPDATE ON public.cotador_hospitais
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.cotador_hospital_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.cotador_hospitais(id) ON DELETE CASCADE,
  alias_nome text NOT NULL,
  alias_nome_normalizado text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cotador_hospital_aliases_unique
  ON public.cotador_hospital_aliases (hospital_id, alias_nome_normalizado);

CREATE INDEX IF NOT EXISTS idx_cotador_hospital_aliases_lookup
  ON public.cotador_hospital_aliases (alias_nome_normalizado, hospital_id);

CREATE OR REPLACE FUNCTION public.sync_cotador_hospital_alias_normalized_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.alias_nome := btrim(NEW.alias_nome);
  NEW.alias_nome_normalizado := COALESCE(public.normalize_cotador_hospital_term(NEW.alias_nome), '');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cotador_hospital_aliases_normalized_fields ON public.cotador_hospital_aliases;
CREATE TRIGGER trg_cotador_hospital_aliases_normalized_fields
  BEFORE INSERT OR UPDATE ON public.cotador_hospital_aliases
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_cotador_hospital_alias_normalized_fields();

CREATE TABLE IF NOT EXISTS public.cotador_produto_hospitais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid NOT NULL REFERENCES public.cotador_produtos(id) ON DELETE CASCADE,
  hospital_id uuid NOT NULL REFERENCES public.cotador_hospitais(id) ON DELETE CASCADE,
  atendimentos text[] NOT NULL DEFAULT ARRAY[]::text[],
  observacoes text,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cotador_produto_hospitais_unique
  ON public.cotador_produto_hospitais (produto_id, hospital_id);

CREATE INDEX IF NOT EXISTS idx_cotador_produto_hospitais_produto_ordem
  ON public.cotador_produto_hospitais (produto_id, ordem);

CREATE INDEX IF NOT EXISTS idx_cotador_produto_hospitais_hospital
  ON public.cotador_produto_hospitais (hospital_id);

DROP TRIGGER IF EXISTS trg_cotador_produto_hospitais_updated_at ON public.cotador_produto_hospitais;
CREATE TRIGGER trg_cotador_produto_hospitais_updated_at
  BEFORE UPDATE ON public.cotador_produto_hospitais
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.cotador_hospitais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotador_hospital_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotador_produto_hospitais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view cotador hospitais" ON public.cotador_hospitais;
CREATE POLICY "Users can view cotador hospitais"
  ON public.cotador_hospitais
  FOR SELECT
  TO authenticated
  USING (public.current_user_can_view_cotador());

DROP POLICY IF EXISTS "Managers can insert cotador hospitais" ON public.cotador_hospitais;
CREATE POLICY "Managers can insert cotador hospitais"
  ON public.cotador_hospitais
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_can_manage_system_catalog());

DROP POLICY IF EXISTS "Managers can update cotador hospitais" ON public.cotador_hospitais;
CREATE POLICY "Managers can update cotador hospitais"
  ON public.cotador_hospitais
  FOR UPDATE
  TO authenticated
  USING (public.current_user_can_manage_system_catalog())
  WITH CHECK (public.current_user_can_manage_system_catalog());

DROP POLICY IF EXISTS "Managers can delete cotador hospitais" ON public.cotador_hospitais;
CREATE POLICY "Managers can delete cotador hospitais"
  ON public.cotador_hospitais
  FOR DELETE
  TO authenticated
  USING (public.current_user_can_manage_system_catalog());

DROP POLICY IF EXISTS "Users can view cotador hospital aliases" ON public.cotador_hospital_aliases;
CREATE POLICY "Users can view cotador hospital aliases"
  ON public.cotador_hospital_aliases
  FOR SELECT
  TO authenticated
  USING (public.current_user_can_view_cotador());

DROP POLICY IF EXISTS "Managers can insert cotador hospital aliases" ON public.cotador_hospital_aliases;
CREATE POLICY "Managers can insert cotador hospital aliases"
  ON public.cotador_hospital_aliases
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_can_manage_system_catalog());

DROP POLICY IF EXISTS "Managers can update cotador hospital aliases" ON public.cotador_hospital_aliases;
CREATE POLICY "Managers can update cotador hospital aliases"
  ON public.cotador_hospital_aliases
  FOR UPDATE
  TO authenticated
  USING (public.current_user_can_manage_system_catalog())
  WITH CHECK (public.current_user_can_manage_system_catalog());

DROP POLICY IF EXISTS "Managers can delete cotador hospital aliases" ON public.cotador_hospital_aliases;
CREATE POLICY "Managers can delete cotador hospital aliases"
  ON public.cotador_hospital_aliases
  FOR DELETE
  TO authenticated
  USING (public.current_user_can_manage_system_catalog());

DROP POLICY IF EXISTS "Users can view cotador produto hospitais" ON public.cotador_produto_hospitais;
CREATE POLICY "Users can view cotador produto hospitais"
  ON public.cotador_produto_hospitais
  FOR SELECT
  TO authenticated
  USING (public.current_user_can_view_cotador());

DROP POLICY IF EXISTS "Managers can insert cotador produto hospitais" ON public.cotador_produto_hospitais;
CREATE POLICY "Managers can insert cotador produto hospitais"
  ON public.cotador_produto_hospitais
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_can_manage_system_catalog());

DROP POLICY IF EXISTS "Managers can update cotador produto hospitais" ON public.cotador_produto_hospitais;
CREATE POLICY "Managers can update cotador produto hospitais"
  ON public.cotador_produto_hospitais
  FOR UPDATE
  TO authenticated
  USING (public.current_user_can_manage_system_catalog())
  WITH CHECK (public.current_user_can_manage_system_catalog());

DROP POLICY IF EXISTS "Managers can delete cotador produto hospitais" ON public.cotador_produto_hospitais;
CREATE POLICY "Managers can delete cotador produto hospitais"
  ON public.cotador_produto_hospitais
  FOR DELETE
  TO authenticated
  USING (public.current_user_can_manage_system_catalog());

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
  v_matched_by_exact_identity boolean;
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
    v_matched_by_exact_identity := false;

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

    IF v_hospital_id IS NULL THEN
      SELECT h.id
      INTO v_hospital_id
      FROM public.cotador_hospitais h
      WHERE h.nome_normalizado = COALESCE(public.normalize_cotador_hospital_term(v_hospital_nome), '')
        AND h.cidade_normalizada = COALESCE(public.normalize_cotador_hospital_term(v_cidade), '')
        AND h.regiao_normalizada = COALESCE(public.normalize_cotador_hospital_term(v_regiao), '')
        AND h.bairro_normalizada = COALESCE(public.normalize_cotador_hospital_term(v_bairro), '')
      ORDER BY h.updated_at DESC
      LIMIT 1;

      v_matched_by_exact_identity := v_hospital_id IS NOT NULL;
    END IF;

    IF v_hospital_id IS NULL THEN
      SELECT h.id
      INTO v_hospital_id
      FROM public.cotador_hospital_aliases ha
      JOIN public.cotador_hospitais h ON h.id = ha.hospital_id
      WHERE ha.alias_nome_normalizado = COALESCE(public.normalize_cotador_hospital_term(v_hospital_nome), '')
        AND h.cidade_normalizada = COALESCE(public.normalize_cotador_hospital_term(v_cidade), '')
        AND h.regiao_normalizada = COALESCE(public.normalize_cotador_hospital_term(v_regiao), '')
        AND h.bairro_normalizada = COALESCE(public.normalize_cotador_hospital_term(v_bairro), '')
      ORDER BY h.updated_at DESC
      LIMIT 1;
    END IF;

    IF v_hospital_id IS NULL THEN
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

      v_matched_by_exact_identity := true;
    ELSIF v_has_explicit_hospital_id OR v_matched_by_exact_identity THEN
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
          regiao = v_regiao,
          bairro = v_bairro,
          ativo = true,
          updated_at = now()
      WHERE id = v_hospital_id;
    END IF;

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

CREATE TEMP TABLE tmp_cotador_produto_network_entries ON COMMIT DROP AS
SELECT
  cp.id AS produto_id,
  GREATEST((network.ordinality - 1)::integer, 0) AS ordem,
  NULLIF(btrim(network.entry ->> 'hospital'), '') AS hospital,
  NULLIF(btrim(network.entry ->> 'cidade'), '') AS cidade,
  NULLIF(btrim(network.entry ->> 'regiao'), '') AS regiao,
  NULLIF(btrim(network.entry ->> 'bairro'), '') AS bairro,
  COALESCE(
    ARRAY(
      SELECT DISTINCT btrim(service.value)
      FROM jsonb_array_elements_text(
        CASE
          WHEN jsonb_typeof(COALESCE(network.entry -> 'atendimentos', '[]'::jsonb)) = 'array' THEN COALESCE(network.entry -> 'atendimentos', '[]'::jsonb)
          ELSE '[]'::jsonb
        END
      ) AS service(value)
      WHERE btrim(service.value) <> ''
      ORDER BY btrim(service.value)
    ),
    ARRAY[]::text[]
  ) AS atendimentos,
  NULLIF(btrim(network.entry ->> 'observacoes'), '') AS observacoes
FROM public.cotador_produtos cp
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(cp.rede_hospitalar, '[]'::jsonb)) WITH ORDINALITY AS network(entry, ordinality)
WHERE jsonb_typeof(network.entry) = 'object'
  AND NULLIF(btrim(network.entry ->> 'hospital'), '') IS NOT NULL
  AND NULLIF(btrim(network.entry ->> 'cidade'), '') IS NOT NULL;

INSERT INTO public.cotador_hospitais (
  nome,
  cidade,
  regiao,
  bairro,
  ativo
)
SELECT DISTINCT
  tmp.hospital,
  tmp.cidade,
  tmp.regiao,
  tmp.bairro,
  true
FROM tmp_cotador_produto_network_entries tmp
ON CONFLICT (nome_normalizado, cidade_normalizada, regiao_normalizada, bairro_normalizado) DO UPDATE
SET nome = EXCLUDED.nome,
    cidade = EXCLUDED.cidade,
    regiao = EXCLUDED.regiao,
    bairro = EXCLUDED.bairro,
    ativo = true,
    updated_at = now();

INSERT INTO public.cotador_hospital_aliases (hospital_id, alias_nome)
SELECT h.id, h.nome
FROM public.cotador_hospitais h
ON CONFLICT (hospital_id, alias_nome_normalizado) DO NOTHING;

INSERT INTO public.cotador_produto_hospitais (
  produto_id,
  hospital_id,
  atendimentos,
  observacoes,
  ordem
)
SELECT
  tmp.produto_id,
  h.id,
  tmp.atendimentos,
  tmp.observacoes,
  tmp.ordem
FROM tmp_cotador_produto_network_entries tmp
JOIN public.cotador_hospitais h
  ON h.nome_normalizado = COALESCE(public.normalize_cotador_hospital_term(tmp.hospital), '')
 AND h.cidade_normalizada = COALESCE(public.normalize_cotador_hospital_term(tmp.cidade), '')
 AND h.regiao_normalizada = COALESCE(public.normalize_cotador_hospital_term(tmp.regiao), '')
 AND h.bairro_normalizada = COALESCE(public.normalize_cotador_hospital_term(tmp.bairro), '')
ON CONFLICT (produto_id, hospital_id) DO UPDATE
SET atendimentos = EXCLUDED.atendimentos,
    observacoes = EXCLUDED.observacoes,
    ordem = LEAST(public.cotador_produto_hospitais.ordem, EXCLUDED.ordem),
    updated_at = now();

COMMIT;
