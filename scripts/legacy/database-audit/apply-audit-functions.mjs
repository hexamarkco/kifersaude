import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eaxvvhamkmovkoqssahj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheHZ2aGFta21vdmtvcXNzYWhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzMTY3MywiZXhwIjoyMDc3NDA3NjczfQ.RpbKiLFtqXGrWAP1oI6UxHS7B184DAebAMEDAnbn3V8';

const supabase = createClient(supabaseUrl, supabaseKey);

const sql = `
CREATE OR REPLACE FUNCTION public.audit_run_dry_run(
  p_run_id uuid,
  p_batch_size integer DEFAULT 500
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_perdido_id uuid;
  v_reativacao_id uuid;
  v_target RECORD;
  v_result RECORD;
  v_total integer := 0;
  v_classification_counts jsonb := '{}'::jsonb;
  v_reason_counts jsonb := '{}'::jsonb;
BEGIN
  SELECT id INTO v_perdido_id
  FROM public.lead_status_config
  WHERE public.audit_normalize_text(nome) = 'perdido';
  IF v_perdido_id IS NULL THEN
    RAISE EXCEPTION 'Status Perdido nao encontrado';
  END IF;
  SELECT id INTO v_reativacao_id
  FROM public.lead_status_config
  WHERE public.audit_normalize_text(nome) = 'reativacao';
  IF NOT EXISTS (
    SELECT 1 FROM public.audit_run_targets t WHERE t.run_id = p_run_id
  ) THEN
    INSERT INTO public.audit_run_targets (run_id, lead_id, ordinal)
    SELECT p_run_id, l.id, ROW_NUMBER() OVER (ORDER BY l.created_at, l.id)
    FROM public.leads l WHERE l.status_id = v_perdido_id;
    UPDATE public.audit_runs
    SET total_leads = (SELECT count(*) FROM public.audit_run_targets WHERE run_id = p_run_id)
    WHERE id = p_run_id;
  END IF;
  FOR v_target IN
    SELECT t.lead_id, t.ordinal FROM public.audit_run_targets t
    WHERE t.run_id = p_run_id AND t.processed_at IS NULL
    ORDER BY t.ordinal LIMIT p_batch_size
  LOOP
    BEGIN
      SELECT * INTO v_result
      FROM public.audit_classify_single_lead(v_target.lead_id, v_perdido_id, v_reativacao_id) LIMIT 1;
      INSERT INTO public.audit_results (
        run_id, lead_id, lead_nome, lead_telefone,
        classification, confidence, reason_code, reason_text,
        has_conversation, message_count,
        last_inbound_at, last_outbound_at, last_message_direction,
        furthest_stage, do_not_reactivate, evidence_snippet, chat_resolution_method
      )
      SELECT p_run_id, l.id, l.nome_completo, l.telefone,
        v_result.classification, v_result.confidence, v_result.reason_code, v_result.reason_text,
        v_result.has_conversation, v_result.message_count,
        v_result.last_inbound_at, v_result.last_outbound_at, v_result.last_message_direction,
        v_result.furthest_stage, v_result.do_not_reactivate, v_result.evidence_snippet,
        v_result.chat_resolution_method
      FROM public.leads l WHERE l.id = v_target.lead_id;
      UPDATE public.audit_run_targets SET processed_at = now()
      WHERE run_id = p_run_id AND lead_id = v_target.lead_id;
      v_total := v_total + 1;
      v_classification_counts := jsonb_set(v_classification_counts, ARRAY[v_result.classification],
        to_jsonb(COALESCE((v_classification_counts->>v_result.classification)::integer, 0) + 1));
      v_reason_counts := jsonb_set(v_reason_counts, ARRAY[v_result.reason_code],
        to_jsonb(COALESCE((v_reason_counts->>v_result.reason_code)::integer, 0) + 1));
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.audit_results (
        run_id, lead_id, lead_nome, lead_telefone,
        classification, confidence, reason_code, reason_text,
        has_conversation, message_count, chat_resolution_method
      )
      SELECT p_run_id, l.id, l.nome_completo, l.telefone,
        'HISTORICO_INSUFICIENTE', 0.10, 'ERRO_CLASSIFICACAO',
        'Erro: ' || SQLERRM, false, 0, 'none'
      FROM public.leads l WHERE l.id = v_target.lead_id;
      UPDATE public.audit_run_targets SET processed_at = now()
      WHERE run_id = p_run_id AND lead_id = v_target.lead_id;
      v_total := v_total + 1;
    END;
  END LOOP;
  UPDATE public.audit_runs SET
    completed_at = CASE WHEN (SELECT count(*) FROM public.audit_run_targets WHERE run_id = p_run_id AND processed_at IS NULL) = 0 THEN now() ELSE completed_at END,
    summary = jsonb_build_object('total_processed', v_total, 'classifications', v_classification_counts, 'reason_codes', v_reason_counts, 'remaining', (SELECT count(*) FROM public.audit_run_targets WHERE run_id = p_run_id AND processed_at IS NULL))
  WHERE id = p_run_id;
END;
$$;
`;

const sql2 = `
CREATE OR REPLACE FUNCTION public.audit_get_summary(p_run_id uuid)
RETURNS TABLE (
  classification text,
  reason_code text,
  count bigint,
  pct numeric(5,2)
)
LANGUAGE sql
STABLE
AS $$
  WITH total AS (
    SELECT count(*) AS t FROM public.audit_results WHERE run_id = p_run_id
  )
  SELECT
    r.classification,
    r.reason_code,
    count(*) AS count,
    round(100.0 * count(*) / NULLIF((SELECT t FROM total), 0), 2) AS pct
  FROM public.audit_results r
  WHERE r.run_id = p_run_id
  GROUP BY r.classification, r.reason_code
  ORDER BY r.classification, count(*) DESC;
$$;
`;

const sql3 = `
CREATE OR REPLACE FUNCTION public.audit_generate_report()
RETURNS TABLE (
  lead_id uuid,
  lead_nome text,
  lead_telefone text,
  current_status text,
  classification text,
  confidence numeric(3,2),
  reason_code text,
  reason_text text,
  has_conversation boolean,
  message_count integer,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  last_message_direction text,
  furthest_stage text,
  do_not_reactivate boolean,
  evidence_snippet text,
  chat_resolution_method text
)
LANGUAGE sql
STABLE
AS $$
  WITH perdido_config AS (
    SELECT id FROM public.lead_status_config
    WHERE public.audit_normalize_text(nome) = 'perdido'
  )
  SELECT
    l.id AS lead_id,
    l.nome_completo AS lead_nome,
    l.telefone AS lead_telefone,
    l.status AS current_status,
    r.classification,
    r.confidence,
    r.reason_code,
    r.reason_text,
    r.has_conversation,
    r.message_count,
    r.last_inbound_at,
    r.last_outbound_at,
    r.last_message_direction,
    r.furthest_stage,
    r.do_not_reactivate,
    r.evidence_snippet,
    r.chat_resolution_method
  FROM public.leads l
  JOIN perdido_config pc ON l.status_id = pc.id
  LEFT JOIN public.audit_results r ON r.lead_id = l.id
  ORDER BY r.classification, r.confidence DESC NULLS LAST, l.nome_completo;
$$;
`;

async function execSql(sqlText) {
  const { data, error } = await supabase.rpc('audit_exec_sql', { p_sql: sqlText });
  if (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
  console.log('OK');
}

async function main() {
  console.log('Creating audit_run_dry_run...');
  await execSql(sql);
  console.log('Creating audit_get_summary...');
  await execSql(sql2);
  console.log('Creating audit_generate_report...');
  await execSql(sql3);
  console.log('All functions created successfully!');
}

main().catch(console.error);
