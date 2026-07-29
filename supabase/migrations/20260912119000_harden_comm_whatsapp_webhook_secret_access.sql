BEGIN;

-- The Inbox consumes sanitized channel state through SECURITY DEFINER RPCs.
-- A direct table policy exposes webhook_secret alongside otherwise safe fields.
DROP POLICY IF EXISTS "Authenticated users can view comm whatsapp channels"
  ON public.comm_whatsapp_channels;

NOTIFY pgrst, 'reload schema';

COMMIT;
