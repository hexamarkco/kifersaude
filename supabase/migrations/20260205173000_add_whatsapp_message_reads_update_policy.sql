/*
  # Allow authenticated users to update own whatsapp message reads
*/

DROP POLICY IF EXISTS "Authenticated users can update own whatsapp message reads" ON public.whatsapp_message_reads;
CREATE POLICY "Authenticated users can update own whatsapp message reads"
  ON public.whatsapp_message_reads FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
