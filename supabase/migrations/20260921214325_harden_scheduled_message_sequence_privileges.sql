BEGIN;

-- Keep the public RPC surface explicit. Sequence creation and operator controls
-- require an authenticated CRM user; the worker claim RPC is service-role only.
REVOKE ALL ON FUNCTION public.create_scheduled_message_sequence(
  uuid, text, timestamptz, jsonb, uuid, uuid, uuid, uuid, text, boolean
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_scheduled_message_sequence(
  uuid, text, timestamptz, jsonb, uuid, uuid, uuid, uuid, text, boolean
) TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_scheduled_message_sequence(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_scheduled_message_sequence(uuid, text)
  TO authenticated;

REVOKE ALL ON FUNCTION public.retry_scheduled_message_sequence(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.retry_scheduled_message_sequence(uuid)
  TO authenticated;

REVOKE ALL ON FUNCTION public.claim_scheduled_message_sequence_steps(integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_scheduled_message_sequence_steps(integer)
  TO service_role;

-- A SELECT policy remains available to CRM viewers. Management policies are
-- split by command so viewers do not also receive a permissive SELECT policy.
DROP POLICY IF EXISTS "Users can manage scheduled sequences"
  ON public.comm_whatsapp_scheduled_sequences;
CREATE POLICY "Users can insert scheduled sequences"
  ON public.comm_whatsapp_scheduled_sequences
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_edit_comm_whatsapp());
CREATE POLICY "Users can update scheduled sequences"
  ON public.comm_whatsapp_scheduled_sequences
  FOR UPDATE TO authenticated
  USING (public.current_user_can_edit_comm_whatsapp())
  WITH CHECK (public.current_user_can_edit_comm_whatsapp());
CREATE POLICY "Users can delete scheduled sequences"
  ON public.comm_whatsapp_scheduled_sequences
  FOR DELETE TO authenticated
  USING (public.current_user_can_edit_comm_whatsapp());

DROP POLICY IF EXISTS "Users can manage scheduled sequence steps"
  ON public.comm_whatsapp_scheduled_sequence_steps;
CREATE POLICY "Users can insert scheduled sequence steps"
  ON public.comm_whatsapp_scheduled_sequence_steps
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_edit_comm_whatsapp());
CREATE POLICY "Users can update scheduled sequence steps"
  ON public.comm_whatsapp_scheduled_sequence_steps
  FOR UPDATE TO authenticated
  USING (public.current_user_can_edit_comm_whatsapp())
  WITH CHECK (public.current_user_can_edit_comm_whatsapp());
CREATE POLICY "Users can delete scheduled sequence steps"
  ON public.comm_whatsapp_scheduled_sequence_steps
  FOR DELETE TO authenticated
  USING (public.current_user_can_edit_comm_whatsapp());

DROP POLICY IF EXISTS "Users can manage scheduled sequence actions"
  ON public.comm_whatsapp_scheduled_sequence_actions;
CREATE POLICY "Users can insert scheduled sequence actions"
  ON public.comm_whatsapp_scheduled_sequence_actions
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_edit_comm_whatsapp());
CREATE POLICY "Users can update scheduled sequence actions"
  ON public.comm_whatsapp_scheduled_sequence_actions
  FOR UPDATE TO authenticated
  USING (public.current_user_can_edit_comm_whatsapp())
  WITH CHECK (public.current_user_can_edit_comm_whatsapp());
CREATE POLICY "Users can delete scheduled sequence actions"
  ON public.comm_whatsapp_scheduled_sequence_actions
  FOR DELETE TO authenticated
  USING (public.current_user_can_edit_comm_whatsapp());

COMMIT;
