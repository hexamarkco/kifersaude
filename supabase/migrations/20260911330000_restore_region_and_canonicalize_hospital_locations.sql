BEGIN;

CREATE OR REPLACE FUNCTION public.format_cotador_hospital_label(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(upper(public.normalize_cotador_hospital_term(value)), '')
$$;

REVOKE ALL ON FUNCTION public.format_cotador_hospital_label(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.format_cotador_hospital_label(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_cotador_hospital_region(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE public.normalize_cotador_hospital_term(value)
    WHEN 'angra dos reis' THEN 'SUL FLUMINENSE'
    WHEN 'aperibe' THEN 'NOROESTE FLUMINENSE'
    WHEN 'araruama' THEN 'REGIAO DOS LAGOS'
    WHEN 'areal' THEN 'REGIAO SERRANA'
    WHEN 'armacao dos buzios' THEN 'REGIAO DOS LAGOS'
    WHEN 'arraial do cabo' THEN 'REGIAO DOS LAGOS'
    WHEN 'barra do pirai' THEN 'SUL FLUMINENSE'
    WHEN 'barra mansa' THEN 'SUL FLUMINENSE'
    WHEN 'belford roxo' THEN 'BAIXADA FLUMINENSE'
    WHEN 'bom jardim' THEN 'REGIAO SERRANA'
    WHEN 'bom jesus do itabapoana' THEN 'NOROESTE FLUMINENSE'
    WHEN 'cabo frio' THEN 'REGIAO DOS LAGOS'
    WHEN 'cachoeiras de macacu' THEN 'LESTE FLUMINENSE'
    WHEN 'cambuci' THEN 'NOROESTE FLUMINENSE'
    WHEN 'campos dos goytacazes' THEN 'NORTE FLUMINENSE'
    WHEN 'cantagalo' THEN 'REGIAO SERRANA'
    WHEN 'carapebus' THEN 'NORTE FLUMINENSE'
    WHEN 'cardoso moreira' THEN 'NOROESTE FLUMINENSE'
    WHEN 'carmo' THEN 'REGIAO SERRANA'
    WHEN 'casimiro de abreu' THEN 'REGIAO DOS LAGOS'
    WHEN 'comendador levy gasparian' THEN 'CENTRO-SUL FLUMINENSE'
    WHEN 'conceicao de macabu' THEN 'NORTE FLUMINENSE'
    WHEN 'cordeiro' THEN 'REGIAO SERRANA'
    WHEN 'duas barras' THEN 'REGIAO SERRANA'
    WHEN 'duque de caxias' THEN 'BAIXADA FLUMINENSE'
    WHEN 'engenheiro paulo de frontin' THEN 'CENTRO-SUL FLUMINENSE'
    WHEN 'guapimirim' THEN 'BAIXADA FLUMINENSE'
    WHEN 'iguaba grande' THEN 'REGIAO DOS LAGOS'
    WHEN 'itaborai' THEN 'LESTE FLUMINENSE'
    WHEN 'itaguai' THEN 'BAIXADA FLUMINENSE'
    WHEN 'italva' THEN 'NOROESTE FLUMINENSE'
    WHEN 'itaocara' THEN 'NOROESTE FLUMINENSE'
    WHEN 'itaperuna' THEN 'NOROESTE FLUMINENSE'
    WHEN 'itatiaia' THEN 'SUL FLUMINENSE'
    WHEN 'japeri' THEN 'BAIXADA FLUMINENSE'
    WHEN 'laje do muriae' THEN 'NOROESTE FLUMINENSE'
    WHEN 'macae' THEN 'NORTE FLUMINENSE'
    WHEN 'macuco' THEN 'REGIAO SERRANA'
    WHEN 'mage' THEN 'BAIXADA FLUMINENSE'
    WHEN 'mangaratiba' THEN 'SUL FLUMINENSE'
    WHEN 'marica' THEN 'LESTE FLUMINENSE'
    WHEN 'mendes' THEN 'CENTRO-SUL FLUMINENSE'
    WHEN 'mesquita' THEN 'BAIXADA FLUMINENSE'
    WHEN 'miguel pereira' THEN 'CENTRO-SUL FLUMINENSE'
    WHEN 'miracema' THEN 'NOROESTE FLUMINENSE'
    WHEN 'natividade' THEN 'NOROESTE FLUMINENSE'
    WHEN 'nilopolis' THEN 'BAIXADA FLUMINENSE'
    WHEN 'niteroi' THEN 'LESTE FLUMINENSE'
    WHEN 'nova friburgo' THEN 'REGIAO SERRANA'
    WHEN 'nova iguacu' THEN 'BAIXADA FLUMINENSE'
    WHEN 'paracambi' THEN 'BAIXADA FLUMINENSE'
    WHEN 'paraiba do sul' THEN 'CENTRO-SUL FLUMINENSE'
    WHEN 'paraty' THEN 'SUL FLUMINENSE'
    WHEN 'paty do alferes' THEN 'CENTRO-SUL FLUMINENSE'
    WHEN 'petropolis' THEN 'REGIAO SERRANA'
    WHEN 'pinheiral' THEN 'SUL FLUMINENSE'
    WHEN 'pirai' THEN 'SUL FLUMINENSE'
    WHEN 'porciuncula' THEN 'NOROESTE FLUMINENSE'
    WHEN 'porto real' THEN 'SUL FLUMINENSE'
    WHEN 'quatis' THEN 'SUL FLUMINENSE'
    WHEN 'queimados' THEN 'BAIXADA FLUMINENSE'
    WHEN 'quissama' THEN 'NORTE FLUMINENSE'
    WHEN 'resende' THEN 'SUL FLUMINENSE'
    WHEN 'rio bonito' THEN 'LESTE FLUMINENSE'
    WHEN 'rio claro' THEN 'SUL FLUMINENSE'
    WHEN 'rio das flores' THEN 'CENTRO-SUL FLUMINENSE'
    WHEN 'rio das ostras' THEN 'REGIAO DOS LAGOS'
    WHEN 'rio de janeiro' THEN 'CAPITAL'
    WHEN 'santa maria madalena' THEN 'REGIAO SERRANA'
    WHEN 'santo antonio de padua' THEN 'NOROESTE FLUMINENSE'
    WHEN 'sao fidelis' THEN 'NORTE FLUMINENSE'
    WHEN 'sao francisco de itabapoana' THEN 'NORTE FLUMINENSE'
    WHEN 'sao goncalo' THEN 'LESTE FLUMINENSE'
    WHEN 'sao joao da barra' THEN 'NORTE FLUMINENSE'
    WHEN 'sao joao de meriti' THEN 'BAIXADA FLUMINENSE'
    WHEN 'sao jose de uba' THEN 'NOROESTE FLUMINENSE'
    WHEN 'sao jose do vale do rio preto' THEN 'REGIAO SERRANA'
    WHEN 'sao pedro da aldeia' THEN 'REGIAO DOS LAGOS'
    WHEN 'sao sebastiao do alto' THEN 'REGIAO SERRANA'
    WHEN 'sapucaia' THEN 'CENTRO-SUL FLUMINENSE'
    WHEN 'saquarema' THEN 'REGIAO DOS LAGOS'
    WHEN 'seropedica' THEN 'BAIXADA FLUMINENSE'
    WHEN 'silva jardim' THEN 'LESTE FLUMINENSE'
    WHEN 'sumidouro' THEN 'REGIAO SERRANA'
    WHEN 'tangua' THEN 'LESTE FLUMINENSE'
    WHEN 'teresopolis' THEN 'REGIAO SERRANA'
    WHEN 'trajano de moraes' THEN 'REGIAO SERRANA'
    WHEN 'tres rios' THEN 'CENTRO-SUL FLUMINENSE'
    WHEN 'valenca' THEN 'CENTRO-SUL FLUMINENSE'
    WHEN 'varre sai' THEN 'NOROESTE FLUMINENSE'
    WHEN 'vassouras' THEN 'CENTRO-SUL FLUMINENSE'
    WHEN 'volta redonda' THEN 'SUL FLUMINENSE'
    ELSE NULL
  END
$$;

REVOKE ALL ON FUNCTION public.resolve_cotador_hospital_region(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_cotador_hospital_region(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.sanitize_cotador_hospital_bairro(
  p_bairro text,
  p_nome text,
  p_cidade text,
  p_regiao text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_bairro text := public.format_cotador_hospital_label(p_bairro);
  v_nome text := public.format_cotador_hospital_label(p_nome);
  v_cidade text := public.format_cotador_hospital_label(p_cidade);
  v_regiao text := public.format_cotador_hospital_label(p_regiao);
BEGIN
  IF v_bairro IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_bairro = v_nome OR v_bairro = v_cidade OR v_bairro = v_regiao THEN
    RETURN NULL;
  END IF;

  IF v_bairro ~ '^(S N|SN|[0-9]+)(\s|-)' THEN
    RETURN NULL;
  END IF;

  RETURN v_bairro;
END;
$$;

REVOKE ALL ON FUNCTION public.sanitize_cotador_hospital_bairro(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sanitize_cotador_hospital_bairro(text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.sync_cotador_hospital_normalized_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.nome := COALESCE(public.format_cotador_hospital_label(NEW.nome), NEW.nome);
  NEW.cidade := COALESCE(public.format_cotador_hospital_label(NEW.cidade), NEW.cidade);
  NEW.regiao := COALESCE(public.resolve_cotador_hospital_region(NEW.cidade), public.format_cotador_hospital_label(NEW.regiao));
  NEW.bairro := public.sanitize_cotador_hospital_bairro(NEW.bairro, NEW.nome, NEW.cidade, NEW.regiao);
  NEW.nome_normalizado := COALESCE(public.normalize_cotador_hospital_term(NEW.nome), '');
  NEW.cidade_normalizada := COALESCE(public.normalize_cotador_hospital_term(NEW.cidade), '');
  NEW.regiao_normalizada := COALESCE(public.normalize_cotador_hospital_term(NEW.regiao), '');
  NEW.bairro_normalizado := COALESCE(public.normalize_cotador_hospital_term(NEW.bairro), '');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_cotador_hospital_alias_normalized_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.alias_nome := COALESCE(public.format_cotador_hospital_label(NEW.alias_nome), NEW.alias_nome);
  NEW.alias_nome_normalizado := COALESCE(public.normalize_cotador_hospital_term(NEW.alias_nome), '');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.canonicalize_cotador_hospital_network_entries(entries jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_entries jsonb := COALESCE(entries, '[]'::jsonb);
BEGIN
  IF jsonb_typeof(v_entries) <> 'array' THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'hospital', public.format_cotador_hospital_label(value ->> 'hospital'),
        'cidade', public.format_cotador_hospital_label(value ->> 'cidade'),
        'regiao', COALESCE(public.resolve_cotador_hospital_region(value ->> 'cidade'), public.format_cotador_hospital_label(value ->> 'regiao')),
        'bairro', public.sanitize_cotador_hospital_bairro(
          value ->> 'bairro',
          value ->> 'hospital',
          value ->> 'cidade',
          COALESCE(public.resolve_cotador_hospital_region(value ->> 'cidade'), value ->> 'regiao')
        ),
        'atendimentos', COALESCE(value -> 'atendimentos', '[]'::jsonb),
        'observacoes', NULLIF(btrim(COALESCE(value ->> 'observacoes', '')), '')
      )
    )
    FROM jsonb_array_elements(v_entries) AS payload(value)
    WHERE jsonb_typeof(value) = 'object'
      AND NULLIF(btrim(COALESCE(value ->> 'hospital', '')), '') IS NOT NULL
      AND NULLIF(btrim(COALESCE(value ->> 'cidade', '')), '') IS NOT NULL
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.canonicalize_cotador_hospital_network_entries(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.canonicalize_cotador_hospital_network_entries(jsonb) TO authenticated;

UPDATE public.cotador_hospitais
SET nome = COALESCE(public.format_cotador_hospital_label(nome), nome),
    cidade = COALESCE(public.format_cotador_hospital_label(cidade), cidade),
    regiao = COALESCE(public.resolve_cotador_hospital_region(cidade), public.format_cotador_hospital_label(regiao)),
    bairro = public.sanitize_cotador_hospital_bairro(bairro, nome, cidade, COALESCE(public.resolve_cotador_hospital_region(cidade), regiao)),
    updated_at = now();

UPDATE public.cotador_hospital_aliases
SET alias_nome = COALESCE(public.format_cotador_hospital_label(alias_nome), alias_nome);

UPDATE public.cotador_produtos
SET rede_hospitalar = public.canonicalize_cotador_hospital_network_entries(rede_hospitalar),
    updated_at = now()
WHERE rede_hospitalar IS NOT NULL;

UPDATE public.cotador_quote_items
SET rede_hospitalar_snapshot = public.canonicalize_cotador_hospital_network_entries(rede_hospitalar_snapshot)
WHERE rede_hospitalar_snapshot IS NOT NULL;

COMMIT;
