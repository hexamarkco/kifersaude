BEGIN;

DROP POLICY IF EXISTS "Authenticated users can view comm whatsapp channels" ON public.comm_whatsapp_channels;

CREATE POLICY "Authenticated users can view comm whatsapp channels"
  ON public.comm_whatsapp_channels
  FOR SELECT
  TO authenticated
  USING (public.current_user_can_view_comm_whatsapp());

COMMIT;
