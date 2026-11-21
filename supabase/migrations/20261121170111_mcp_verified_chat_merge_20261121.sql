-- Restricted MCP bridge for existing non-destructive LID/WA-ID reconciliation.
-- Requires two reciprocal verified provider mappings; does not accept user-supplied evidence.
-- The existing core function preserves loser chat as merged_into_chat_id with an audit log.
CREATE OR REPLACE FUNCTION public.mcp_reconcile_verified_whatsapp_lid(
 p_actor_user_id uuid,
 p_lid_chat_id uuid,
 p_phone_chat_id uuid,
 p_expected_lid_updated_at timestamptz,
 p_expected_phone_updated_at timestamptz,
 p_client_request_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $function$
DECLARE
 v_lid public.comm_whatsapp_chats%ROWTYPE;
 v_phone public.comm_whatsapp_chats%ROWTYPE;
 v_result record;
 v_after_lid public.comm_whatsapp_chats%ROWTYPE;
 v_after_phone public.comm_whatsapp_chats%ROWTYPE;
BEGIN
 PERFORM public._mcp_comm_whatsapp_campaign_assert_admin(p_actor_user_id);
 IF p_client_request_id !~ '^[A-Za-z0-9:_-]{1,128}$'
   OR p_lid_chat_id IS NULL OR p_phone_chat_id IS NULL
   OR p_lid_chat_id = p_phone_chat_id
   OR p_expected_lid_updated_at IS NULL OR p_expected_phone_updated_at IS NULL
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='MCP_CHAT_MERGE_INPUT_INVALID'; END IF;

 PERFORM 1 FROM public.comm_whatsapp_chats WHERE id IN (p_lid_chat_id,p_phone_chat_id)
   ORDER BY id FOR UPDATE;
 SELECT * INTO v_lid FROM public.comm_whatsapp_chats WHERE id=p_lid_chat_id;
 SELECT * INTO v_phone FROM public.comm_whatsapp_chats WHERE id=p_phone_chat_id;
 IF v_lid.id IS NULL OR v_phone.id IS NULL
 THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='MCP_CHAT_NOT_FOUND'; END IF;
 IF v_lid.merged_into_chat_id = v_phone.id
 THEN RETURN jsonb_build_object('success',true,'replayed',true,'canonical_chat_id',v_phone.id,'source_chat_id',v_lid.id); END IF;
 IF v_lid.channel_id<>v_phone.channel_id
    OR v_lid.external_chat_id !~* '@lid$'
    OR v_phone.external_chat_id !~* '@s\.whatsapp\.net$'
    OR v_lid.merged_into_chat_id IS NOT NULL
    OR v_phone.merged_into_chat_id IS NOT NULL
    OR v_lid.deleted_at IS NOT NULL
    OR v_phone.deleted_at IS NOT NULL
    OR v_lid.is_group OR v_phone.is_group
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='MCP_CHAT_MERGE_NOT_ALLOWED'; END IF;
 IF v_lid.updated_at IS DISTINCT FROM p_expected_lid_updated_at
    OR v_phone.updated_at IS DISTINCT FROM p_expected_phone_updated_at
 THEN RETURN jsonb_build_object('success',false,'error_code','STALE_WRITE','message','Conversa alterada; consulte novamente.'); END IF;
 IF v_lid.lead_id IS NOT NULL AND v_phone.lead_id IS NOT NULL AND v_lid.lead_id<>v_phone.lead_id
 THEN RETURN jsonb_build_object('success',false,'error_code','LEAD_CONFLICT','message','Conversas associadas a leads diferentes.'); END IF;
 IF EXISTS (SELECT 1 FROM public.comm_whatsapp_identity_conflicts AS c
            WHERE c.status='open' AND c.chat_id IN (v_lid.id,v_phone.id))
 THEN RETURN jsonb_build_object('success',false,'error_code','IDENTITY_CONFLICT','message','Existe conflito de identidade aberto.'); END IF;

 -- Evidence must already be provider-verified, reciprocal and bound to the same channel.
 IF NOT EXISTS (
   SELECT 1 FROM public.comm_whatsapp_chat_identifiers AS i
   WHERE i.channel_id=v_lid.channel_id AND i.chat_id=v_lid.id
      AND i.external_chat_id=v_lid.external_chat_id
      AND i.identifier_kind='lid' AND i.is_verified
      AND i.evidence->>'paired_with'=v_phone.external_chat_id
 ) OR NOT EXISTS (
   SELECT 1 FROM public.comm_whatsapp_chat_identifiers AS i
   WHERE i.channel_id=v_phone.channel_id AND i.chat_id=v_phone.id
      AND i.external_chat_id=v_phone.external_chat_id
      AND i.identifier_kind='wa_id' AND i.is_verified
      AND i.evidence->>'paired_with'=v_lid.external_chat_id
 ) THEN
   RETURN jsonb_build_object('success',false,'error_code','VERIFIED_MAPPING_REQUIRED',
     'message','Não há prova bidirecional suficiente para mesclar estes chats.');
 END IF;

 SELECT r.* INTO v_result
 FROM public.comm_whatsapp_reconcile_lid_identifier(
   v_lid.channel_id,v_lid.external_chat_id,v_phone.external_chat_id,
   jsonb_build_object('round_trip_verified',true,'forward_verified',true,
       'source','mcp_verified_paired_identifiers','actor_user_id',p_actor_user_id)
 ) AS r;
 IF v_result.chat_id IS NULL OR v_result.merged IS DISTINCT FROM true
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='MCP_CHAT_RECONCILE_REJECTED'; END IF;

 SELECT * INTO v_after_lid FROM public.comm_whatsapp_chats WHERE id=v_lid.id;
 SELECT * INTO v_after_phone FROM public.comm_whatsapp_chats WHERE id=v_phone.id;
 IF NOT ((v_after_lid.merged_into_chat_id=v_result.chat_id AND v_after_phone.id=v_result.chat_id)
       OR (v_after_phone.merged_into_chat_id=v_result.chat_id AND v_after_lid.id=v_result.chat_id))
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='MCP_CHAT_RECONCILE_INCOMPLETE'; END IF;
 RETURN jsonb_build_object('success',true,'merged',true,'canonical_chat_id',v_result.chat_id,
    'source_chat_id',CASE WHEN v_after_lid.merged_into_chat_id IS NOT NULL THEN v_after_lid.id ELSE v_after_phone.id END,
    'history_preserved',true,'replayed',false);
END;
$function$;
REVOKE ALL ON FUNCTION public.mcp_reconcile_verified_whatsapp_lid(uuid,uuid,uuid,timestamptz,timestamptz,text)
 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_reconcile_verified_whatsapp_lid(uuid,uuid,uuid,timestamptz,timestamptz,text)
 TO service_role;
