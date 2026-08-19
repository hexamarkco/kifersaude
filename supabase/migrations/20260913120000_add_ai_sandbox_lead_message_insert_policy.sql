/*
  # Allow direct lead-message inserts in the AI sandbox chat

  The sandbox chat now debounces the "lead" (tester) messages client-side
  before asking the IA to reply, so the frontend needs to insert the lead's
  message the instant it's sent (instead of routing it through the edge
  function, which only runs once the debounce window closes). AI replies
  are still written exclusively by the ai-sandbox-chat edge function via
  the service role client.
*/

BEGIN;

DROP POLICY IF EXISTS "Owners can create lead messages in their ai sandbox conversations" ON public.ai_sandbox_messages;
CREATE POLICY "Owners can create lead messages in their ai sandbox conversations"
  ON public.ai_sandbox_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    role = 'lead'
    AND EXISTS (
      SELECT 1 FROM public.ai_sandbox_conversations c
      WHERE c.id = conversation_id AND c.created_by = auth.uid()
    )
  );

COMMIT;
