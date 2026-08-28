/*
  # Contadores de campanha por agregacao no banco (sem puxar linhas pro cliente)

  `recomputeCampaignCounters` (worker) fazia
  `SELECT status, responded_at FROM comm_whatsapp_campaign_targets WHERE campaign_id = ...`
  sem paginacao nenhuma, e a tela de detalhe calculava taxa de resposta/falha
  e o resumo A/B do mesmo jeito, buscando ate 500 linhas de alvos e
  agregando no navegador. Para campanhas de ate algumas centenas de alvos
  isso nunca deu problema, mas o Supabase/PostgREST tem um teto padrao de
  linhas por resposta (tipicamente 1000) - numa campanha CSV de 71 mil
  contatos, a consulta do worker silenciosamente truncava em ~1000 linhas e
  todos os contadores da campanha (total_targets, pending_targets,
  sent_targets, failed_targets etc.) refletiam so essa fatia arbitraria,
  nunca a campanha inteira. Pior: a checagem de "campanha concluida"
  (`pending === 0`) usava essa mesma amostra truncada, entao uma campanha
  grande podia ser marcada como concluida (e o worker parar de processa-la)
  com milhares de alvos ainda pendentes de verdade. Na tela, com 500 de 71 mil
  linhas, os percentuais e o resumo A/B ficavam praticamente aleatorios.

  Substitui isso por uma agregacao feita no proprio Postgres
  (GROUP BY status, ab_variant), que devolve poucas linhas sempre
  (no maximo status x variante), independente de a campanha ter 10 ou 100
  mil alvos - usada tanto pelo worker (contadores/conclusao) quanto pela
  tela de detalhe (taxas e resumo A/B), sem paginar nada em nenhum dos dois.
*/

BEGIN;

CREATE OR REPLACE FUNCTION public.get_comm_whatsapp_campaign_target_status_counts(p_campaign_id uuid)
RETURNS TABLE (status text, ab_variant text, total_count bigint, responded_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    target.status,
    target.ab_variant,
    COUNT(*) AS total_count,
    COUNT(*) FILTER (WHERE target.responded_at IS NOT NULL) AS responded_count
  FROM public.comm_whatsapp_campaign_targets AS target
  WHERE target.campaign_id = p_campaign_id
  GROUP BY target.status, target.ab_variant;
$$;

-- Sem checagem de current_user_can_view_comm_whatsapp() aqui de proposito:
-- essa funcao e chamada tanto pelo worker (service_role, sem auth.uid(), a
-- checagem sempre daria falso e zeraria os contadores) quanto pela tela de
-- detalhe (authenticated). So devolve contagens agregadas (sem telefone,
-- nome ou conteudo de mensagem) para um campaign_id que o chamador precisa
-- ja conhecer - a mesma visibilidade que a tela ja exige via RLS em
-- comm_whatsapp_campaigns/comm_whatsapp_campaign_targets para descobrir
-- esse id em primeiro lugar.

REVOKE ALL ON FUNCTION public.get_comm_whatsapp_campaign_target_status_counts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_comm_whatsapp_campaign_target_status_counts(uuid) TO service_role, authenticated;

COMMIT;
