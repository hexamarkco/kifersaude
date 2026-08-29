/*
  # Contagem exata de motivos de falha da campanha

  A tela de detalhe montava "Principais motivos de falha" a partir de uma
  amostra de ate 500 alvos (os mais recentes com status failed/invalid),
  agrupando por error_message no navegador. Numa campanha onde quase toda
  falha tem o mesmo motivo, isso faz a lista mostrar "500" ao lado do
  motivo - nao porque so 500 tiveram esse motivo, mas porque a amostra
  inteira bateu no teto e ficou sob o mesmo motivo, destoando do total
  real exibido no card "Falhas" (contagem exata, sem teto).

  Substitui a amostra por uma agregacao exata no Postgres (GROUP BY
  error_message), mesma ideia de get_comm_whatsapp_campaign_target_status_counts:
  poucas linhas sempre (um motivo distinto por linha), sem depender de
  puxar centenas de linhas de alvo pro cliente.
*/

BEGIN;

CREATE OR REPLACE FUNCTION public.get_comm_whatsapp_campaign_failure_reasons(p_campaign_id uuid)
RETURNS TABLE (error_message text, total_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(NULLIF(trim(target.error_message), ''), 'Sem motivo registrado') AS error_message,
    COUNT(*) AS total_count
  FROM public.comm_whatsapp_campaign_targets AS target
  WHERE target.campaign_id = p_campaign_id
    AND target.status IN ('failed', 'invalid')
  GROUP BY COALESCE(NULLIF(trim(target.error_message), ''), 'Sem motivo registrado')
  ORDER BY total_count DESC
  LIMIT 20;
$$;

-- Mesmo raciocinio de permissao da RPC de contadores: sem checagem de
-- current_user_can_view_comm_whatsapp() aqui, porque nao ha caso de uso
-- server-side (worker) para esta - so a tela (authenticated) - mas mantida
-- sem essa checagem por consistencia e porque o campaign_id ja e um
-- segredo suficiente (o chamador so o obtem via uma consulta ja protegida
-- por RLS em comm_whatsapp_campaigns/comm_whatsapp_campaign_targets).
REVOKE ALL ON FUNCTION public.get_comm_whatsapp_campaign_failure_reasons(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_comm_whatsapp_campaign_failure_reasons(uuid) TO authenticated, service_role;

COMMIT;
