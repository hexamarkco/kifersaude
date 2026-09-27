BEGIN;

-- The Inbox tables used one authenticated FOR ALL policy for mutations and a
-- second authenticated SELECT policy for reads. PostgreSQL evaluates both
-- permissive policies for SELECT, even when the user only needs to read.
-- Split the mutation policy by command and combine the two read conditions in
-- one SELECT policy. The authorization logic stays identical:
--
--   SELECT: can_edit OR can_view
--   INSERT/UPDATE/DELETE: can_edit
--
-- Keeping one policy per role/action removes the duplicate RLS evaluation
-- without allowing a read-only operator to mutate or delete rows.

DROP POLICY IF EXISTS "Users can edit comm whatsapp ai intent suggestions"
  ON public.comm_whatsapp_ai_intent_suggestions;
DROP POLICY IF EXISTS "Users can view comm whatsapp ai intent suggestions"
  ON public.comm_whatsapp_ai_intent_suggestions;

CREATE POLICY "Users can view or edit comm whatsapp ai intent suggestions"
  ON public.comm_whatsapp_ai_intent_suggestions
  FOR SELECT TO authenticated
  USING (
    public.current_user_can_edit_comm_whatsapp()
    OR public.current_user_can_view_comm_whatsapp()
  );
CREATE POLICY "Users can insert comm whatsapp ai intent suggestions"
  ON public.comm_whatsapp_ai_intent_suggestions
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_edit_comm_whatsapp());
CREATE POLICY "Users can update comm whatsapp ai intent suggestions"
  ON public.comm_whatsapp_ai_intent_suggestions
  FOR UPDATE TO authenticated
  USING (public.current_user_can_edit_comm_whatsapp())
  WITH CHECK (public.current_user_can_edit_comm_whatsapp());
CREATE POLICY "Users can delete comm whatsapp ai intent suggestions"
  ON public.comm_whatsapp_ai_intent_suggestions
  FOR DELETE TO authenticated
  USING (public.current_user_can_edit_comm_whatsapp());

DROP POLICY IF EXISTS "Users can edit comm whatsapp campaign steps"
  ON public.comm_whatsapp_campaign_steps;
DROP POLICY IF EXISTS "Users can view comm whatsapp campaign steps"
  ON public.comm_whatsapp_campaign_steps;

CREATE POLICY "Users can view or edit comm whatsapp campaign steps"
  ON public.comm_whatsapp_campaign_steps
  FOR SELECT TO authenticated
  USING (
    public.current_user_can_edit_comm_whatsapp()
    OR public.current_user_can_view_comm_whatsapp()
  );
CREATE POLICY "Users can insert comm whatsapp campaign steps"
  ON public.comm_whatsapp_campaign_steps
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_edit_comm_whatsapp());
CREATE POLICY "Users can update comm whatsapp campaign steps"
  ON public.comm_whatsapp_campaign_steps
  FOR UPDATE TO authenticated
  USING (public.current_user_can_edit_comm_whatsapp())
  WITH CHECK (public.current_user_can_edit_comm_whatsapp());
CREATE POLICY "Users can delete comm whatsapp campaign steps"
  ON public.comm_whatsapp_campaign_steps
  FOR DELETE TO authenticated
  USING (public.current_user_can_edit_comm_whatsapp());

DROP POLICY IF EXISTS "Users can edit comm whatsapp campaign targets"
  ON public.comm_whatsapp_campaign_targets;
DROP POLICY IF EXISTS "Users can view comm whatsapp campaign targets"
  ON public.comm_whatsapp_campaign_targets;

CREATE POLICY "Users can view or edit comm whatsapp campaign targets"
  ON public.comm_whatsapp_campaign_targets
  FOR SELECT TO authenticated
  USING (
    public.current_user_can_edit_comm_whatsapp()
    OR public.current_user_can_view_comm_whatsapp()
  );
CREATE POLICY "Users can insert comm whatsapp campaign targets"
  ON public.comm_whatsapp_campaign_targets
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_edit_comm_whatsapp());
CREATE POLICY "Users can update comm whatsapp campaign targets"
  ON public.comm_whatsapp_campaign_targets
  FOR UPDATE TO authenticated
  USING (public.current_user_can_edit_comm_whatsapp())
  WITH CHECK (public.current_user_can_edit_comm_whatsapp());
CREATE POLICY "Users can delete comm whatsapp campaign targets"
  ON public.comm_whatsapp_campaign_targets
  FOR DELETE TO authenticated
  USING (public.current_user_can_edit_comm_whatsapp());

DROP POLICY IF EXISTS "Users can edit comm whatsapp campaign templates"
  ON public.comm_whatsapp_campaign_templates;
DROP POLICY IF EXISTS "Users can view comm whatsapp campaign templates"
  ON public.comm_whatsapp_campaign_templates;

CREATE POLICY "Users can view or edit comm whatsapp campaign templates"
  ON public.comm_whatsapp_campaign_templates
  FOR SELECT TO authenticated
  USING (
    public.current_user_can_edit_comm_whatsapp()
    OR public.current_user_can_view_comm_whatsapp()
  );
CREATE POLICY "Users can insert comm whatsapp campaign templates"
  ON public.comm_whatsapp_campaign_templates
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_edit_comm_whatsapp());
CREATE POLICY "Users can update comm whatsapp campaign templates"
  ON public.comm_whatsapp_campaign_templates
  FOR UPDATE TO authenticated
  USING (public.current_user_can_edit_comm_whatsapp())
  WITH CHECK (public.current_user_can_edit_comm_whatsapp());
CREATE POLICY "Users can delete comm whatsapp campaign templates"
  ON public.comm_whatsapp_campaign_templates
  FOR DELETE TO authenticated
  USING (public.current_user_can_edit_comm_whatsapp());

DROP POLICY IF EXISTS "Users can edit comm whatsapp campaigns"
  ON public.comm_whatsapp_campaigns;
DROP POLICY IF EXISTS "Users can view comm whatsapp campaigns"
  ON public.comm_whatsapp_campaigns;

CREATE POLICY "Users can view or edit comm whatsapp campaigns"
  ON public.comm_whatsapp_campaigns
  FOR SELECT TO authenticated
  USING (
    public.current_user_can_edit_comm_whatsapp()
    OR public.current_user_can_view_comm_whatsapp()
  );
CREATE POLICY "Users can insert comm whatsapp campaigns"
  ON public.comm_whatsapp_campaigns
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_edit_comm_whatsapp());
CREATE POLICY "Users can update comm whatsapp campaigns"
  ON public.comm_whatsapp_campaigns
  FOR UPDATE TO authenticated
  USING (public.current_user_can_edit_comm_whatsapp())
  WITH CHECK (public.current_user_can_edit_comm_whatsapp());
CREATE POLICY "Users can delete comm whatsapp campaigns"
  ON public.comm_whatsapp_campaigns
  FOR DELETE TO authenticated
  USING (public.current_user_can_edit_comm_whatsapp());

DROP POLICY IF EXISTS "Users can edit comm whatsapp opt outs"
  ON public.comm_whatsapp_opt_outs;
DROP POLICY IF EXISTS "Users can view comm whatsapp opt outs"
  ON public.comm_whatsapp_opt_outs;

CREATE POLICY "Users can view or edit comm whatsapp opt outs"
  ON public.comm_whatsapp_opt_outs
  FOR SELECT TO authenticated
  USING (
    public.current_user_can_edit_comm_whatsapp()
    OR public.current_user_can_view_comm_whatsapp()
  );
CREATE POLICY "Users can insert comm whatsapp opt outs"
  ON public.comm_whatsapp_opt_outs
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_edit_comm_whatsapp());
CREATE POLICY "Users can update comm whatsapp opt outs"
  ON public.comm_whatsapp_opt_outs
  FOR UPDATE TO authenticated
  USING (public.current_user_can_edit_comm_whatsapp())
  WITH CHECK (public.current_user_can_edit_comm_whatsapp());
CREATE POLICY "Users can delete comm whatsapp opt outs"
  ON public.comm_whatsapp_opt_outs
  FOR DELETE TO authenticated
  USING (public.current_user_can_edit_comm_whatsapp());

DROP POLICY IF EXISTS "Users can manage scheduled messages"
  ON public.comm_whatsapp_scheduled_messages;
DROP POLICY IF EXISTS "Users can view scheduled messages"
  ON public.comm_whatsapp_scheduled_messages;

CREATE POLICY "Users can view or edit scheduled messages"
  ON public.comm_whatsapp_scheduled_messages
  FOR SELECT TO authenticated
  USING (
    public.current_user_can_edit_comm_whatsapp()
    OR public.current_user_can_view_comm_whatsapp()
  );
CREATE POLICY "Users can insert scheduled messages"
  ON public.comm_whatsapp_scheduled_messages
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_edit_comm_whatsapp());
CREATE POLICY "Users can update scheduled messages"
  ON public.comm_whatsapp_scheduled_messages
  FOR UPDATE TO authenticated
  USING (public.current_user_can_edit_comm_whatsapp())
  WITH CHECK (public.current_user_can_edit_comm_whatsapp());
CREATE POLICY "Users can delete scheduled messages"
  ON public.comm_whatsapp_scheduled_messages
  FOR DELETE TO authenticated
  USING (public.current_user_can_edit_comm_whatsapp());

NOTIFY pgrst, 'reload schema';

COMMIT;
