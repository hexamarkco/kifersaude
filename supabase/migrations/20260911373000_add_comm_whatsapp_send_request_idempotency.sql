BEGIN;

CREATE TABLE IF NOT EXISTS public.comm_whatsapp_send_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.comm_whatsapp_channels(id) ON DELETE CASCADE,
  client_request_id text NOT NULL,
  request_kind text NOT NULL DEFAULT 'send',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'sending',
  external_message_id text,
  delivery_status text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_comm_whatsapp_send_requests_client_request
  ON public.comm_whatsapp_send_requests (channel_id, client_request_id);

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_send_requests_updated_at
  ON public.comm_whatsapp_send_requests (updated_at DESC);

ALTER TABLE public.comm_whatsapp_send_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages WhatsApp send requests" ON public.comm_whatsapp_send_requests;
CREATE POLICY "Service role manages WhatsApp send requests"
  ON public.comm_whatsapp_send_requests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comm_whatsapp_send_requests TO service_role;

COMMIT;
