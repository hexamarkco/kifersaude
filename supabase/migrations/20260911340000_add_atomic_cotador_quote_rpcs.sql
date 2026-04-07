BEGIN;

CREATE OR REPLACE FUNCTION public.upsert_cotador_quote_bundle(
  p_quote_id uuid DEFAULT NULL,
  p_nome text DEFAULT NULL,
  p_modalidade text DEFAULT NULL,
  p_lead_id uuid DEFAULT NULL,
  p_total_vidas integer DEFAULT 0,
  p_beneficiaries jsonb DEFAULT '[]'::jsonb,
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote public.cotador_quotes%ROWTYPE;
  v_auth_role text := auth.role();
BEGIN
  IF auth.uid() IS NULL AND COALESCE(v_auth_role, '') <> 'service_role' THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  IF COALESCE(v_auth_role, '') <> 'service_role' AND NOT public.current_user_can_edit_cotador() THEN
    RAISE EXCEPTION 'Permissao insuficiente para editar cotacoes do Cotador';
  END IF;

  IF NULLIF(btrim(COALESCE(p_nome, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Nome da cotacao e obrigatorio';
  END IF;

  IF p_modalidade NOT IN ('PF', 'ADESAO', 'PME') THEN
    RAISE EXCEPTION 'Modalidade invalida para a cotacao';
  END IF;

  IF jsonb_typeof(COALESCE(p_beneficiaries, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Beneficiarios devem ser enviados como array JSON';
  END IF;

  IF jsonb_typeof(COALESCE(p_items, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Itens da cotacao devem ser enviados como array JSON';
  END IF;

  IF p_quote_id IS NULL THEN
    INSERT INTO public.cotador_quotes (
      nome,
      modalidade,
      lead_id,
      total_vidas
    )
    VALUES (
      btrim(p_nome),
      p_modalidade,
      p_lead_id,
      GREATEST(COALESCE(p_total_vidas, 0), 0)
    )
    RETURNING * INTO v_quote;
  ELSE
    UPDATE public.cotador_quotes
    SET nome = btrim(p_nome),
        modalidade = p_modalidade,
        lead_id = p_lead_id,
        total_vidas = GREATEST(COALESCE(p_total_vidas, 0), 0),
        updated_at = now()
    WHERE id = p_quote_id
    RETURNING * INTO v_quote;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cotacao nao encontrada';
    END IF;
  END IF;

  DELETE FROM public.cotador_quote_beneficiaries
  WHERE quote_id = v_quote.id;

  INSERT INTO public.cotador_quote_beneficiaries (
    quote_id,
    age_range,
    quantidade,
    ordem
  )
  SELECT
    v_quote.id,
    item.age_range,
    item.quantidade,
    COALESCE(item.ordem, 0)
  FROM jsonb_to_recordset(COALESCE(p_beneficiaries, '[]'::jsonb)) AS item(
    age_range text,
    quantidade integer,
    ordem integer
  )
  WHERE item.age_range IN ('0-18', '19-23', '24-28', '29-33', '34-38', '39-43', '44-48', '49-53', '54-58', '59+')
    AND COALESCE(item.quantidade, 0) > 0;

  DELETE FROM public.cotador_quote_items
  WHERE quote_id = v_quote.id;

  INSERT INTO public.cotador_quote_items (
    quote_id,
    cotador_linha_id,
    cotador_tabela_id,
    cotador_produto_id,
    legacy_produto_plano_id,
    operadora_id,
    administradora_id,
    catalog_item_key,
    source,
    titulo_snapshot,
    subtitulo_snapshot,
    linha_nome_snapshot,
    tabela_nome_snapshot,
    codigo_tabela_snapshot,
    operadora_nome_snapshot,
    administradora_nome_snapshot,
    entidade_nomes_snapshot,
    modalidade_snapshot,
    perfil_empresarial_snapshot,
    coparticipacao_snapshot,
    vidas_min_snapshot,
    vidas_max_snapshot,
    precos_faixa_snapshot,
    mensalidade_total_snapshot,
    abrangencia_snapshot,
    acomodacao_snapshot,
    comissao_sugerida_snapshot,
    bonus_por_vida_valor_snapshot,
    carencias_snapshot,
    documentos_necessarios_snapshot,
    reembolso_snapshot,
    informacoes_importantes_snapshot,
    rede_hospitalar_snapshot,
    observacoes_snapshot,
    ordem
  )
  SELECT
    v_quote.id,
    item.cotador_linha_id,
    item.cotador_tabela_id,
    item.cotador_produto_id,
    item.legacy_produto_plano_id,
    item.operadora_id,
    item.administradora_id,
    item.catalog_item_key,
    item.source,
    item.titulo_snapshot,
    item.subtitulo_snapshot,
    item.linha_nome_snapshot,
    item.tabela_nome_snapshot,
    item.codigo_tabela_snapshot,
    item.operadora_nome_snapshot,
    item.administradora_nome_snapshot,
    COALESCE(
      ARRAY(
        SELECT jsonb_array_elements_text(item.entidade_nomes_snapshot)
      ),
      ARRAY[]::text[]
    ),
    item.modalidade_snapshot,
    item.perfil_empresarial_snapshot,
    item.coparticipacao_snapshot,
    item.vidas_min_snapshot,
    item.vidas_max_snapshot,
    item.precos_faixa_snapshot,
    item.mensalidade_total_snapshot,
    item.abrangencia_snapshot,
    item.acomodacao_snapshot,
    item.comissao_sugerida_snapshot,
    item.bonus_por_vida_valor_snapshot,
    item.carencias_snapshot,
    item.documentos_necessarios_snapshot,
    item.reembolso_snapshot,
    item.informacoes_importantes_snapshot,
    item.rede_hospitalar_snapshot,
    item.observacoes_snapshot,
    COALESCE(item.ordem, 0)
  FROM jsonb_to_recordset(COALESCE(p_items, '[]'::jsonb)) AS item(
    cotador_linha_id uuid,
    cotador_tabela_id uuid,
    cotador_produto_id uuid,
    legacy_produto_plano_id uuid,
    operadora_id uuid,
    administradora_id uuid,
    catalog_item_key text,
    source text,
    titulo_snapshot text,
    subtitulo_snapshot text,
    linha_nome_snapshot text,
    tabela_nome_snapshot text,
    codigo_tabela_snapshot text,
    operadora_nome_snapshot text,
    administradora_nome_snapshot text,
    entidade_nomes_snapshot jsonb,
    modalidade_snapshot text,
    perfil_empresarial_snapshot text,
    coparticipacao_snapshot text,
    vidas_min_snapshot integer,
    vidas_max_snapshot integer,
    precos_faixa_snapshot jsonb,
    mensalidade_total_snapshot numeric,
    abrangencia_snapshot text,
    acomodacao_snapshot text,
    comissao_sugerida_snapshot numeric,
    bonus_por_vida_valor_snapshot numeric,
    carencias_snapshot text,
    documentos_necessarios_snapshot text,
    reembolso_snapshot text,
    informacoes_importantes_snapshot text,
    rede_hospitalar_snapshot jsonb,
    observacoes_snapshot text,
    ordem integer
  )
  WHERE NULLIF(item.catalog_item_key, '') IS NOT NULL
    AND NULLIF(item.source, '') IS NOT NULL
    AND NULLIF(item.titulo_snapshot, '') IS NOT NULL
    AND NULLIF(item.operadora_nome_snapshot, '') IS NOT NULL;

  UPDATE public.cotador_quotes
  SET updated_at = now()
  WHERE id = v_quote.id
  RETURNING * INTO v_quote;

  RETURN jsonb_build_object(
    'id', v_quote.id,
    'nome', v_quote.nome,
    'modalidade', v_quote.modalidade,
    'total_vidas', v_quote.total_vidas,
    'lead_id', v_quote.lead_id,
    'created_at', v_quote.created_at,
    'updated_at', v_quote.updated_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.replace_cotador_quote_items(
  p_quote_id uuid,
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_role text := auth.role();
BEGIN
  IF auth.uid() IS NULL AND COALESCE(v_auth_role, '') <> 'service_role' THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  IF COALESCE(v_auth_role, '') <> 'service_role' AND NOT public.current_user_can_edit_cotador() THEN
    RAISE EXCEPTION 'Permissao insuficiente para editar cotacoes do Cotador';
  END IF;

  IF jsonb_typeof(COALESCE(p_items, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Itens da cotacao devem ser enviados como array JSON';
  END IF;

  PERFORM 1 FROM public.cotador_quotes WHERE id = p_quote_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cotacao nao encontrada';
  END IF;

  DELETE FROM public.cotador_quote_items
  WHERE quote_id = p_quote_id;

  INSERT INTO public.cotador_quote_items (
    quote_id,
    cotador_linha_id,
    cotador_tabela_id,
    cotador_produto_id,
    legacy_produto_plano_id,
    operadora_id,
    administradora_id,
    catalog_item_key,
    source,
    titulo_snapshot,
    subtitulo_snapshot,
    linha_nome_snapshot,
    tabela_nome_snapshot,
    codigo_tabela_snapshot,
    operadora_nome_snapshot,
    administradora_nome_snapshot,
    entidade_nomes_snapshot,
    modalidade_snapshot,
    perfil_empresarial_snapshot,
    coparticipacao_snapshot,
    vidas_min_snapshot,
    vidas_max_snapshot,
    precos_faixa_snapshot,
    mensalidade_total_snapshot,
    abrangencia_snapshot,
    acomodacao_snapshot,
    comissao_sugerida_snapshot,
    bonus_por_vida_valor_snapshot,
    carencias_snapshot,
    documentos_necessarios_snapshot,
    reembolso_snapshot,
    informacoes_importantes_snapshot,
    rede_hospitalar_snapshot,
    observacoes_snapshot,
    ordem
  )
  SELECT
    p_quote_id,
    item.cotador_linha_id,
    item.cotador_tabela_id,
    item.cotador_produto_id,
    item.legacy_produto_plano_id,
    item.operadora_id,
    item.administradora_id,
    item.catalog_item_key,
    item.source,
    item.titulo_snapshot,
    item.subtitulo_snapshot,
    item.linha_nome_snapshot,
    item.tabela_nome_snapshot,
    item.codigo_tabela_snapshot,
    item.operadora_nome_snapshot,
    item.administradora_nome_snapshot,
    COALESCE(
      ARRAY(
        SELECT jsonb_array_elements_text(item.entidade_nomes_snapshot)
      ),
      ARRAY[]::text[]
    ),
    item.modalidade_snapshot,
    item.perfil_empresarial_snapshot,
    item.coparticipacao_snapshot,
    item.vidas_min_snapshot,
    item.vidas_max_snapshot,
    item.precos_faixa_snapshot,
    item.mensalidade_total_snapshot,
    item.abrangencia_snapshot,
    item.acomodacao_snapshot,
    item.comissao_sugerida_snapshot,
    item.bonus_por_vida_valor_snapshot,
    item.carencias_snapshot,
    item.documentos_necessarios_snapshot,
    item.reembolso_snapshot,
    item.informacoes_importantes_snapshot,
    item.rede_hospitalar_snapshot,
    item.observacoes_snapshot,
    COALESCE(item.ordem, 0)
  FROM jsonb_to_recordset(COALESCE(p_items, '[]'::jsonb)) AS item(
    cotador_linha_id uuid,
    cotador_tabela_id uuid,
    cotador_produto_id uuid,
    legacy_produto_plano_id uuid,
    operadora_id uuid,
    administradora_id uuid,
    catalog_item_key text,
    source text,
    titulo_snapshot text,
    subtitulo_snapshot text,
    linha_nome_snapshot text,
    tabela_nome_snapshot text,
    codigo_tabela_snapshot text,
    operadora_nome_snapshot text,
    administradora_nome_snapshot text,
    entidade_nomes_snapshot jsonb,
    modalidade_snapshot text,
    perfil_empresarial_snapshot text,
    coparticipacao_snapshot text,
    vidas_min_snapshot integer,
    vidas_max_snapshot integer,
    precos_faixa_snapshot jsonb,
    mensalidade_total_snapshot numeric,
    abrangencia_snapshot text,
    acomodacao_snapshot text,
    comissao_sugerida_snapshot numeric,
    bonus_por_vida_valor_snapshot numeric,
    carencias_snapshot text,
    documentos_necessarios_snapshot text,
    reembolso_snapshot text,
    informacoes_importantes_snapshot text,
    rede_hospitalar_snapshot jsonb,
    observacoes_snapshot text,
    ordem integer
  )
  WHERE NULLIF(item.catalog_item_key, '') IS NOT NULL
    AND NULLIF(item.source, '') IS NOT NULL
    AND NULLIF(item.titulo_snapshot, '') IS NOT NULL
    AND NULLIF(item.operadora_nome_snapshot, '') IS NOT NULL;

  UPDATE public.cotador_quotes
  SET updated_at = now()
  WHERE id = p_quote_id;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_cotador_quote_bundle(uuid, text, text, uuid, integer, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_cotador_quote_bundle(uuid, text, text, uuid, integer, jsonb, jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.replace_cotador_quote_items(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_cotador_quote_items(uuid, jsonb) TO authenticated, service_role;

COMMIT;
