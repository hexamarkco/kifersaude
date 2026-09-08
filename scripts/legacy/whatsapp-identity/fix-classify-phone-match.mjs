import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://eaxvvhamkmovkoqssahj.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheHZ2aGFta21vdmtvcXNzYWhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzMTY3MywiZXhwIjoyMDc3NDA3NjczfQ.RpbKiLFtqXGrWAP1oI6UxHS7B184DAebAMEDAnbn3V8');

const sql = `CREATE OR REPLACE FUNCTION public.audit_classify_single_lead(
  p_lead_id uuid,
  p_perdido_id uuid,
  p_reativacao_id uuid
)
RETURNS TABLE (
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
LANGUAGE plpgsql
STABLE
AS $body$
DECLARE
  v_lead RECORD;
  v_chat_id uuid := NULL;
  v_chat_method text := 'none';
  v_msg_count integer := 0;
  v_inbound_count integer := 0;
  v_last_inbound timestamptz := NULL;
  v_last_outbound timestamptz := NULL;
  v_last_dir text := NULL;
  v_last_msg_text text := NULL;
  v_furthest_stage text := NULL;
  v_has_contract boolean := false;
  v_had_converted boolean := false;
  v_has_opt_out boolean := false;
  v_invalid_number boolean := false;
  v_recusa_explicita boolean := false;
  v_last_client_texts text[] := ARRAY[]::text[];
  v_i integer := 0;
  v_normalized text;
  v_best_stage text := 'Novo';
  v_best_order integer := 0;
  v_hist RECORD;
  v_has_interactions boolean;
  v_has_reminders boolean;
  v_match_count integer;
  v_matched_chat_id uuid;
BEGIN
  SELECT l.* INTO v_lead
  FROM public.leads l
  WHERE l.id = p_lead_id;

  IF NOT FOUND THEN
    classification := 'HISTORICO_INSUFICIENTE';
    confidence := 0.10;
    reason_code := 'LEAD_NAO_ENCONTRADO';
    reason_text := 'Lead nao encontrado na tabela leads.';
    has_conversation := false;
    message_count := 0;
    last_inbound_at := NULL;
    last_outbound_at := NULL;
    last_message_direction := NULL;
    furthest_stage := NULL;
    do_not_reactivate := false;
    evidence_snippet := NULL;
    chat_resolution_method := 'none';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.lead_id = p_lead_id
      AND c.status IN ('Emitido', 'Ativo', 'Em analise', 'Proposta enviada', 'Documentos pendentes', 'Aguardando assinatura')
  ) INTO v_has_contract;

  IF v_has_contract THEN
    classification := 'STATUS_POSSIVELMENTE_INCONSISTENTE';
    confidence := 0.95;
    reason_code := 'CONTRATO_ATIVO';
    reason_text := 'Lead possui contrato ativo ou em processamento associado.';
    has_conversation := false;
    message_count := 0;
    last_inbound_at := NULL;
    last_outbound_at := NULL;
    last_message_direction := NULL;
    furthest_stage := NULL;
    do_not_reactivate := false;
    evidence_snippet := NULL;
    chat_resolution_method := 'none';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.lead_status_history h
    WHERE h.lead_id = p_lead_id
      AND public.audit_normalize_text(h.status_novo) = 'convertido'
  ) INTO v_had_converted;

  IF v_had_converted THEN
    classification := 'STATUS_POSSIVELMENTE_INCONSISTENTE';
    confidence := 0.90;
    reason_code := 'STATUS_CONVERTIDO_HISTORICO';
    reason_text := 'Lead ja passou pelo status Convertido anteriormente.';
    has_conversation := false;
    message_count := 0;
    last_inbound_at := NULL;
    last_outbound_at := NULL;
    last_message_direction := NULL;
    furthest_stage := NULL;
    do_not_reactivate := false;
    evidence_snippet := NULL;
    chat_resolution_method := 'none';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.comm_whatsapp_opt_outs o
    WHERE (o.lead_id = p_lead_id
           OR (o.phone_digits IS NOT NULL AND v_lead.telefone IS NOT NULL
               AND public.comm_whatsapp_phone_lookup_keys(o.phone_digits)
                   && public.comm_whatsapp_phone_lookup_keys(v_lead.telefone)))
      AND o.status = 'blocked'
  ) INTO v_has_opt_out;

  IF v_has_opt_out THEN
    classification := 'MANTER_PERDIDO';
    confidence := 0.95;
    reason_code := 'NAO_QUER_CONTATO';
    reason_text := 'Lead possui opt-out registrado no sistema.';
    has_conversation := false;
    message_count := 0;
    last_inbound_at := NULL;
    last_outbound_at := NULL;
    last_message_direction := NULL;
    furthest_stage := NULL;
    do_not_reactivate := true;
    evidence_snippet := NULL;
    chat_resolution_method := 'none';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.auto_contact_flow_jobs j
    WHERE j.lead_id = p_lead_id
      AND j.last_error LIKE 'invalid_number%'
      AND j.updated_at > now() - interval '90 days'
  ) INTO v_invalid_number;

  IF v_invalid_number THEN
    classification := 'MANTER_PERDIDO';
    confidence := 0.85;
    reason_code := 'NUMERO_INVALIDO';
    reason_text := 'Automacao anterior registrou erro de numero invalido.';
    has_conversation := false;
    message_count := 0;
    last_inbound_at := NULL;
    last_outbound_at := NULL;
    last_message_direction := NULL;
    furthest_stage := NULL;
    do_not_reactivate := false;
    evidence_snippet := NULL;
    chat_resolution_method := 'none';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT c.id INTO v_chat_id
  FROM public.comm_whatsapp_chats c
  WHERE c.lead_id = p_lead_id
    AND c.deleted_at IS NULL
  ORDER BY c.last_message_at DESC NULLS LAST
  LIMIT 1;

  IF v_chat_id IS NOT NULL THEN
    v_chat_method := 'fk_direct';
  ELSIF v_lead.telefone IS NOT NULL AND v_lead.telefone <> '' THEN
    SELECT count(*) INTO v_match_count
    FROM public.comm_whatsapp_chats c
    WHERE c.deleted_at IS NULL
      AND public.comm_whatsapp_phone_lookup_keys(c.phone_digits)
          && public.comm_whatsapp_phone_lookup_keys(v_lead.telefone);

    IF v_match_count = 1 THEN
      SELECT c.id INTO v_matched_chat_id
      FROM public.comm_whatsapp_chats c
      WHERE c.deleted_at IS NULL
        AND public.comm_whatsapp_phone_lookup_keys(c.phone_digits)
            && public.comm_whatsapp_phone_lookup_keys(v_lead.telefone)
      ORDER BY c.last_message_at DESC NULLS LAST
      LIMIT 1;
      v_chat_id := v_matched_chat_id;
      v_chat_method := 'phone_match';
    ELSIF v_match_count > 1 THEN
      v_chat_method := 'ambiguous';
    END IF;
  END IF;

  IF v_chat_id IS NOT NULL AND v_chat_method IN ('fk_direct', 'phone_match') THEN
    SELECT
      count(*)::integer,
      count(*) FILTER (WHERE m.direction = 'inbound')::integer,
      max(m.message_at) FILTER (WHERE m.direction = 'inbound'),
      max(m.message_at) FILTER (WHERE m.direction = 'outbound'),
      (SELECT m2.direction FROM public.comm_whatsapp_messages m2
       WHERE m2.chat_id = v_chat_id
         AND public.comm_whatsapp_message_preview_text(m2.media_caption, m2.text_content, m2.message_type) IS NOT NULL
       ORDER BY m2.message_at DESC LIMIT 1)
    INTO v_msg_count, v_inbound_count, v_last_inbound, v_last_outbound, v_last_dir
    FROM public.comm_whatsapp_messages m
    WHERE m.chat_id = v_chat_id;

    SELECT array_agg(sub.txt ORDER BY sub.message_at DESC)
    INTO v_last_client_texts
    FROM (
      SELECT m.text_content AS txt, m.message_at
      FROM public.comm_whatsapp_messages m
      WHERE m.chat_id = v_chat_id
        AND m.direction = 'inbound'
        AND public.comm_whatsapp_message_preview_text(m.media_caption, m.text_content, m.message_type) IS NOT NULL
      ORDER BY m.message_at DESC
      LIMIT 5
    ) sub;

    SELECT m.text_content INTO v_last_msg_text
    FROM public.comm_whatsapp_messages m
    WHERE m.chat_id = v_chat_id
      AND public.comm_whatsapp_message_preview_text(m.media_caption, m.text_content, m.message_type) IS NOT NULL
    ORDER BY m.message_at DESC
    LIMIT 1;
  ELSIF v_chat_method = 'ambiguous' THEN
    SELECT count(*)::integer INTO v_msg_count
    FROM public.comm_whatsapp_messages m
    JOIN public.comm_whatsapp_chats c ON c.id = m.chat_id
    WHERE c.deleted_at IS NULL
      AND public.comm_whatsapp_phone_lookup_keys(c.phone_digits)
          && public.comm_whatsapp_phone_lookup_keys(v_lead.telefone);
  END IF;

  IF v_chat_method = 'ambiguous' THEN
    classification := 'HISTORICO_INSUFICIENTE';
    confidence := 0.30;
    reason_code := 'CHAT_AMBIGUO';
    reason_text := 'Telefone do lead corresponde a multiplos chats.';
    has_conversation := true;
    message_count := v_msg_count;
    last_inbound_at := NULL;
    last_outbound_at := NULL;
    last_message_direction := NULL;
    furthest_stage := NULL;
    do_not_reactivate := false;
    evidence_snippet := 'Multiplos chats associados ao telefone.';
    chat_resolution_method := 'ambiguous';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_last_client_texts IS NOT NULL AND array_length(v_last_client_texts, 1) > 0 THEN
    FOR v_i IN 1 .. array_length(v_last_client_texts, 1)
    LOOP
      v_normalized := public.audit_normalize_text(v_last_client_texts[v_i]);

      IF v_normalized ~ 'nao (tenho |quero |preciso |aceito |vou )?(interesse|plano|nada|nenhum|mais)'
         OR v_normalized ~ 'pode (cancelar|parar|encerrar|excluir)'
         OR v_normalized ~ 'nao vou (fazer|contratar|continuar|assinar)'
         OR v_normalized ~ 'nao obrigad[ao]'
         OR v_normalized ~ 'tir(e|ar) (meu|da minha) (nome|numero)'
         OR v_normalized ~ 'nao (me )?ligue'
         OR v_normalized ~ 'ja (contratei|fechei|tive|resolvi|assinei)'
         OR v_normalized ~ 'vou (com|fechar com) (outro|outra|concorrente|diferente)'
         OR v_normalized ~ 'ja estou (com|no|em) (outro|outra|plano|empresa)'
         OR v_normalized ~ 'f(ez|echou) (com|por) (outro|outra|concorrente)'
         OR v_normalized ~ 'nao quero mais'
         OR v_normalized ~ 'cancel(e|ar|ei|ou)'
         OR v_normalized ~ 'desist(i|ir|i)'
      THEN
        v_recusa_explicita := true;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  IF v_recusa_explicita THEN
    classification := 'MANTER_PERDIDO';
    confidence := 0.90;
    reason_code := 'RECUSA_EXPLICITA';
    reason_text := 'Mensagem inequivoca de recusa nas ultimas mensagens do cliente.';
    has_conversation := (v_chat_id IS NOT NULL);
    message_count := v_msg_count;
    last_inbound_at := v_last_inbound;
    last_outbound_at := v_last_outbound;
    last_message_direction := v_last_dir;
    furthest_stage := NULL;
    do_not_reactivate := false;
    evidence_snippet := left(COALESCE(v_last_msg_text, ''), 300);
    chat_resolution_method := v_chat_method;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_chat_id IS NULL AND v_chat_method <> 'ambiguous' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.interactions i WHERE i.lead_id = p_lead_id
    ) INTO v_has_interactions;

    SELECT EXISTS (
      SELECT 1 FROM public.reminders r WHERE r.lead_id = p_lead_id
    ) INTO v_has_reminders;

    IF NOT v_has_interactions AND NOT v_has_reminders THEN
      classification := 'HISTORICO_INSUFICIENTE';
      confidence := 0.20;
      reason_code := 'HISTORICO_INSUFICIENTE';
      reason_text := 'Sem conversa no Inbox, sem interacoes registradas, sem lembretes.';
      has_conversation := false;
      message_count := 0;
      last_inbound_at := NULL;
      last_outbound_at := NULL;
      last_message_direction := NULL;
      furthest_stage := NULL;
      do_not_reactivate := false;
      evidence_snippet := 'Lead sem nenhum registro de atividade no CRM.';
      chat_resolution_method := 'none';
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  v_best_stage := 'Novo';
  v_best_order := 0;

  FOR v_hist IN
    SELECT DISTINCT public.audit_normalize_text(h.status_novo) AS sn
    FROM public.lead_status_history h
    WHERE h.lead_id = p_lead_id
  LOOP
    CASE v_hist.sn
      WHEN 'novo' THEN IF 1 > v_best_order THEN v_best_order := 1; v_best_stage := 'Novo'; END IF;
      WHEN 'contato inicial' THEN IF 2 > v_best_order THEN v_best_order := 2; v_best_stage := 'Contato Inicial'; END IF;
      WHEN 'atendimento' THEN IF 3 > v_best_order THEN v_best_order := 3; v_best_stage := 'Atendimento'; END IF;
      WHEN 'em atendimento' THEN IF 3 > v_best_order THEN v_best_order := 3; v_best_stage := 'Atendimento'; END IF;
      WHEN 'em analise' THEN IF 3 > v_best_order THEN v_best_order := 3; v_best_stage := 'Em Analise'; END IF;
      WHEN 'aguardando cotacao' THEN IF 4 > v_best_order THEN v_best_order := 4; v_best_stage := 'Aguardando cotacao'; END IF;
      WHEN 'proposta enviada' THEN IF 5 > v_best_order THEN v_best_order := 5; v_best_stage := 'Proposta Enviada'; END IF;
      WHEN 'negociacao' THEN IF 5 > v_best_order THEN v_best_order := 5; v_best_stage := 'Negociacao'; END IF;
      WHEN 'decisao' THEN IF 6 > v_best_order THEN v_best_order := 6; v_best_stage := 'Decisao'; END IF;
      WHEN 'contratacao' THEN IF 7 > v_best_order THEN v_best_order := 7; v_best_stage := 'Contratacao'; END IF;
      WHEN 'convertido' THEN IF 8 > v_best_order THEN v_best_order := 8; v_best_stage := 'Convertido'; END IF;
      ELSE NULL;
    END CASE;
  END LOOP;

  v_furthest_stage := v_best_stage;

  IF v_chat_id IS NULL AND v_chat_method <> 'ambiguous' THEN
    classification := 'HISTORICO_INSUFICIENTE';
    confidence := 0.25;
    reason_code := 'HISTORICO_INSUFICIENTE';
    reason_text := 'Lead possui registros no CRM mas sem conversa no Inbox para analise.';
    has_conversation := false;
    message_count := 0;
    last_inbound_at := NULL;
    last_outbound_at := NULL;
    last_message_direction := NULL;
    furthest_stage := v_furthest_stage;
    do_not_reactivate := false;
    evidence_snippet := 'Atendimento provavelmente realizado antes da criacao do Inbox.';
    chat_resolution_method := 'none';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_msg_count = 0 THEN
    classification := 'HISTORICO_INSUFICIENTE';
    confidence := 0.25;
    reason_code := 'HISTORICO_INSUFICIENTE';
    reason_text := 'Chat encontrado mas sem mensagens registradas.';
    has_conversation := true;
    message_count := 0;
    last_inbound_at := NULL;
    last_outbound_at := NULL;
    last_message_direction := NULL;
    furthest_stage := v_furthest_stage;
    do_not_reactivate := false;
    evidence_snippet := NULL;
    chat_resolution_method := v_chat_method;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_inbound_count = 0 THEN
    classification := 'MOVER_PARA_REATIVACAO';
    confidence := 0.85;
    reason_code := 'NUNCA_ENGAJOU';
    reason_text := 'Lead possui chat com mensagens enviadas mas nenhuma resposta recebida.';
    has_conversation := true;
    message_count := v_msg_count;
    last_inbound_at := NULL;
    last_outbound_at := v_last_outbound;
    last_message_direction := 'outbound';
    furthest_stage := v_furthest_stage;
    do_not_reactivate := false;
    evidence_snippet := left(COALESCE(v_last_msg_text, ''), 300);
    chat_resolution_method := v_chat_method;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_last_inbound IS NOT NULL
     AND (v_last_outbound IS NULL OR v_last_inbound > v_last_outbound)
  THEN
    classification := 'STATUS_POSSIVELMENTE_INCONSISTENTE';
    confidence := 0.80;
    reason_code := 'CLIENTE_AGUARDANDO_RETORNO';
    reason_text := 'Ultima mensagem e do cliente. Pode estar aguardando retorno nosso.';
    has_conversation := true;
    message_count := v_msg_count;
    last_inbound_at := v_last_inbound;
    last_outbound_at := v_last_outbound;
    last_message_direction := 'inbound';
    furthest_stage := v_furthest_stage;
    do_not_reactivate := false;
    evidence_snippet := left(COALESCE(v_last_msg_text, ''), 300);
    chat_resolution_method := v_chat_method;
    RETURN NEXT;
    RETURN;
  END IF;

  CASE
    WHEN v_furthest_stage IN ('Contratacao') THEN
      classification := 'MOVER_PARA_REATIVACAO';
      confidence := 0.80;
      reason_code := 'CONTRATACAO_INTERROMPIDA';
      reason_text := 'Lead alcancou estagio de Contratacao mas nao respondeu as ultimas mensagens.';
    WHEN v_furthest_stage IN ('Decisao') THEN
      classification := 'MOVER_PARA_REATIVACAO';
      confidence := 0.80;
      reason_code := 'SUMIU_EM_DECISAO';
      reason_text := 'Lead alcancou estagio de Decisao mas nao respondeu as ultimas mensagens.';
    WHEN v_furthest_stage IN ('Proposta Enviada', 'Negociacao') THEN
      classification := 'MOVER_PARA_REATIVACAO';
      confidence := 0.80;
      reason_code := 'SUMIU_APOS_COTACAO';
      reason_text := 'Lead recebeu proposta/cotacao mas nao respondeu as ultimas mensagens.';
    WHEN v_furthest_stage IN ('Aguardando cotacao') THEN
      classification := 'STATUS_POSSIVELMENTE_INCONSISTENTE';
      confidence := 0.70;
      reason_code := 'COTACAO_PENDENTE_OU_STATUS_DESATUALIZADO';
      reason_text := 'Lead estava aguardando cotacao e parou de responder. Status pode estar defasado.';
    WHEN v_furthest_stage IN ('Atendimento', 'Em Analise', 'Contato Inicial') THEN
      classification := 'MOVER_PARA_REATIVACAO';
      confidence := 0.75;
      reason_code := 'ATENDIMENTO_INTERROMPIDO';
      reason_text := 'Lead estava em atendimento/qualificacao mas parou de responder.';
    ELSE
      classification := 'MOVER_PARA_REATIVACAO';
      confidence := 0.70;
      reason_code := 'NUNCA_ENGAJOU';
      reason_text := 'Lead nao respondeu as primeiras abordagens.';
  END CASE;

  has_conversation := true;
  message_count := v_msg_count;
  last_inbound_at := v_last_inbound;
  last_outbound_at := v_last_outbound;
  last_message_direction := 'outbound';
  do_not_reactivate := false;
  evidence_snippet := left(COALESCE(v_last_msg_text, ''), 300);
  chat_resolution_method := v_chat_method;
  RETURN NEXT;
  RETURN;
END;
$body$;`;

console.log('Fixing audit_classify_single_lead (phone match bug)...');
const { error } = await supabase.rpc('audit_exec_sql', { p_sql: sql });
if (error) { console.error('Error:', error.message); process.exit(1); }
console.log('Fixed!');

// Test with a lead that should match via phone
const { data: test } = await supabase.rpc('audit_classify_single_lead', {
  p_lead_id: 'cef27b30-ac85-4f7b-8d74-bafef4e9bfca',
  p_perdido_id: 'e6dfc1b0-720d-446a-8ed1-d773f781bbba',
  p_reativacao_id: 'c6131bfc-9d6a-430e-af7c-44f5d6731186'
});
if (test?.length) console.log('Test result:', JSON.stringify(test[0], null, 2));

// Test with Lais (should have phone match)
const { data: lais } = await supabase.from('leads').select('id').eq('nome_completo', 'Lais').eq('telefone', '22981807634').limit(1);
if (lais?.length) {
  const { data: r } = await supabase.rpc('audit_classify_single_lead', {
    p_lead_id: lais[0].id,
    p_perdido_id: 'e6dfc1b0-720d-446a-8ed1-d773f781bbba',
    p_reativacao_id: 'c6131bfc-9d6a-430e-af7c-44f5d6731186'
  });
  if (r?.length) console.log('Lais result:', JSON.stringify(r[0], null, 2));
}
