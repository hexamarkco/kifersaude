BEGIN;

CREATE OR REPLACE FUNCTION public.upsert_cotador_quote_share(
  p_quote_id uuid,
  p_include_network_compare boolean DEFAULT true,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_share public.cotador_quote_shares%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  IF NOT public.current_user_can_edit_cotador() THEN
    RAISE EXCEPTION 'Permissao insuficiente para compartilhar cotacoes do Cotador';
  END IF;

  IF p_quote_id IS NULL THEN
    RAISE EXCEPTION 'Cotacao nao informada';
  END IF;

  IF jsonb_typeof(COALESCE(p_payload, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'Snapshot da cotacao deve ser um objeto JSON';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.cotador_quotes quote_record
    WHERE quote_record.id = p_quote_id
  ) THEN
    RAISE EXCEPTION 'Cotacao nao encontrada';
  END IF;

  INSERT INTO public.cotador_quote_shares (
    quote_id,
    owner_user_id,
    token,
    include_network_compare,
    payload
  )
  VALUES (
    p_quote_id,
    auth.uid(),
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
    COALESCE(p_include_network_compare, true),
    COALESCE(p_payload, '{}'::jsonb)
  )
  ON CONFLICT (quote_id, owner_user_id, include_network_compare)
  DO UPDATE SET
    payload = EXCLUDED.payload,
    updated_at = now()
  RETURNING * INTO v_share;

  RETURN jsonb_build_object(
    'id', v_share.id,
    'quote_id', v_share.quote_id,
    'token', v_share.token,
    'include_network_compare', v_share.include_network_compare,
    'payload', v_share.payload,
    'created_at', v_share.created_at,
    'updated_at', v_share.updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_cotador_quote_share(uuid, boolean, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_cotador_quote_share(uuid, boolean, jsonb) TO authenticated;

COMMIT;
