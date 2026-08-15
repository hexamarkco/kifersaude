-- Rate limiting por usuário para as Edge Functions de ação do Inbox WhatsApp
-- (send/react/manage-message/retry-message). Antes disso, só o formulário
-- público de captura de lead tinha rate limit (public_lead_rate_limits); as
-- funções de ação autenticadas do Inbox não tinham nenhum, permitindo que uma
-- conta comprometida gerasse volume alto de chamadas à Whapi (risco de
-- throttling/bloqueio do canal). Mesmo padrão de janela fixa com UPSERT
-- atômico já usado em consume_public_lead_rate_limit, agora parametrizado por
-- escopo (uma função por escopo, mesma tabela) e por usuário em vez de IP.
CREATE TABLE IF NOT EXISTS public.comm_whatsapp_action_rate_limits (
  user_id uuid NOT NULL,
  scope text NOT NULL CHECK (scope <> ''),
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 1 CHECK (request_count > 0),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, scope)
);

ALTER TABLE public.comm_whatsapp_action_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.comm_whatsapp_action_rate_limits FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.comm_whatsapp_action_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_comm_whatsapp_action_rate_limit(
  p_user_id uuid,
  p_scope text,
  p_max_requests integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_window interval;
  v_allowed boolean;
BEGIN
  IF p_user_id IS NULL OR p_scope IS NULL OR btrim(p_scope) = '' THEN
    RAISE EXCEPTION 'Parametros invalidos para consume_comm_whatsapp_action_rate_limit';
  END IF;

  IF p_max_requests IS NULL OR p_max_requests < 1 THEN
    RAISE EXCEPTION 'p_max_requests deve ser >= 1';
  END IF;

  IF p_window_seconds IS NULL OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'p_window_seconds deve ser >= 1';
  END IF;

  v_window := make_interval(secs => p_window_seconds);

  INSERT INTO public.comm_whatsapp_action_rate_limits (
    user_id,
    scope,
    window_started_at,
    request_count,
    last_seen_at
  )
  VALUES (p_user_id, p_scope, v_now, 1, v_now)
  ON CONFLICT (user_id, scope) DO UPDATE
  SET
    window_started_at = CASE
      WHEN comm_whatsapp_action_rate_limits.window_started_at <= v_now - v_window THEN v_now
      ELSE comm_whatsapp_action_rate_limits.window_started_at
    END,
    request_count = CASE
      WHEN comm_whatsapp_action_rate_limits.window_started_at <= v_now - v_window THEN 1
      ELSE comm_whatsapp_action_rate_limits.request_count + 1
    END,
    last_seen_at = v_now
  WHERE comm_whatsapp_action_rate_limits.window_started_at <= v_now - v_window
     OR comm_whatsapp_action_rate_limits.request_count < p_max_requests
  RETURNING true INTO v_allowed;

  RETURN COALESCE(v_allowed, false);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_comm_whatsapp_action_rate_limit(uuid, text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_comm_whatsapp_action_rate_limit(uuid, text, integer, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_comm_whatsapp_action_rate_limit(uuid, text, integer, integer) TO service_role;

NOTIFY pgrst, 'reload schema';
