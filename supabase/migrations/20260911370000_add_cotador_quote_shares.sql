BEGIN;

CREATE TABLE IF NOT EXISTS public.cotador_quote_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.cotador_quotes(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  include_network_compare boolean NOT NULL DEFAULT true,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cotador_quote_shares_quote_owner_network
  ON public.cotador_quote_shares (quote_id, owner_user_id, include_network_compare);

CREATE INDEX IF NOT EXISTS idx_cotador_quote_shares_token
  ON public.cotador_quote_shares (token);

DROP TRIGGER IF EXISTS trg_cotador_quote_shares_updated_at ON public.cotador_quote_shares;
CREATE TRIGGER trg_cotador_quote_shares_updated_at
  BEFORE UPDATE ON public.cotador_quote_shares
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.cotador_quote_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cotador_quote_shares_select_authenticated ON public.cotador_quote_shares;
CREATE POLICY cotador_quote_shares_select_authenticated
  ON public.cotador_quote_shares
  FOR SELECT
  TO authenticated
  USING (
    owner_user_id = auth.uid()
    AND public.current_user_can_view_cotador()
  );

DROP POLICY IF EXISTS cotador_quote_shares_insert_authenticated ON public.cotador_quote_shares;
CREATE POLICY cotador_quote_shares_insert_authenticated
  ON public.cotador_quote_shares
  FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_user_id = auth.uid()
    AND public.current_user_can_edit_cotador()
  );

DROP POLICY IF EXISTS cotador_quote_shares_update_authenticated ON public.cotador_quote_shares;
CREATE POLICY cotador_quote_shares_update_authenticated
  ON public.cotador_quote_shares
  FOR UPDATE
  TO authenticated
  USING (
    owner_user_id = auth.uid()
    AND public.current_user_can_edit_cotador()
  )
  WITH CHECK (
    owner_user_id = auth.uid()
    AND public.current_user_can_edit_cotador()
  );

DROP POLICY IF EXISTS cotador_quote_shares_delete_authenticated ON public.cotador_quote_shares;
CREATE POLICY cotador_quote_shares_delete_authenticated
  ON public.cotador_quote_shares
  FOR DELETE
  TO authenticated
  USING (
    owner_user_id = auth.uid()
    AND public.current_user_can_edit_cotador()
  );

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

CREATE OR REPLACE FUNCTION public.get_public_cotador_quote_share(
  p_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_share public.cotador_quote_shares%ROWTYPE;
BEGIN
  SELECT *
  INTO v_share
  FROM public.cotador_quote_shares
  WHERE token = NULLIF(btrim(COALESCE(p_token, '')), '')
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

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

REVOKE ALL ON FUNCTION public.get_public_cotador_quote_share(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_cotador_quote_share(text) TO anon, authenticated;

COMMIT;
