BEGIN;

CREATE OR REPLACE FUNCTION public.merge_cotador_hospitais(
  p_target_id uuid,
  p_source_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target public.cotador_hospitais%ROWTYPE;
  v_source public.cotador_hospitais%ROWTYPE;
  v_auth_role text := auth.role();
BEGIN
  IF auth.uid() IS NULL AND COALESCE(v_auth_role, '') <> 'service_role' THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  IF COALESCE(v_auth_role, '') <> 'service_role' AND NOT public.current_user_can_manage_system_catalog() THEN
    RAISE EXCEPTION 'Permissao insuficiente para mesclar hospitais do Cotador';
  END IF;

  IF p_target_id IS NULL OR p_source_id IS NULL OR p_target_id = p_source_id THEN
    RAISE EXCEPTION 'Hospitais de origem e destino invalidos para merge';
  END IF;

  SELECT * INTO v_target FROM public.cotador_hospitais WHERE id = p_target_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hospital alvo nao encontrado';
  END IF;

  SELECT * INTO v_source FROM public.cotador_hospitais WHERE id = p_source_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hospital de origem nao encontrado';
  END IF;

  INSERT INTO public.cotador_hospital_aliases (hospital_id, alias_nome)
  VALUES
    (p_target_id, v_target.nome),
    (p_target_id, v_source.nome)
  ON CONFLICT (hospital_id, alias_nome_normalizado) DO NOTHING;

  INSERT INTO public.cotador_hospital_aliases (hospital_id, alias_nome)
  SELECT p_target_id, alias.alias_nome
  FROM public.cotador_hospital_aliases alias
  WHERE alias.hospital_id = p_source_id
  ON CONFLICT (hospital_id, alias_nome_normalizado) DO NOTHING;

  INSERT INTO public.cotador_produto_hospitais (
    produto_id,
    hospital_id,
    atendimentos,
    observacoes,
    ordem
  )
  SELECT
    source_link.produto_id,
    p_target_id,
    source_link.atendimentos,
    source_link.observacoes,
    source_link.ordem
  FROM public.cotador_produto_hospitais source_link
  WHERE source_link.hospital_id = p_source_id
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

  UPDATE public.cotador_hospitais
  SET cidade = COALESCE(NULLIF(v_target.cidade, ''), v_source.cidade),
      regiao = COALESCE(NULLIF(v_target.regiao, ''), v_source.regiao),
      bairro = COALESCE(NULLIF(v_target.bairro, ''), v_source.bairro),
      ativo = COALESCE(v_target.ativo, false) OR COALESCE(v_source.ativo, false),
      updated_at = now()
  WHERE id = p_target_id;

  DELETE FROM public.cotador_hospital_aliases WHERE hospital_id = p_source_id;
  DELETE FROM public.cotador_produto_hospitais WHERE hospital_id = p_source_id;
  DELETE FROM public.cotador_hospitais WHERE id = p_source_id;

  RETURN p_target_id;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_cotador_hospitais(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_cotador_hospitais(uuid, uuid) TO authenticated, service_role;

COMMIT;
