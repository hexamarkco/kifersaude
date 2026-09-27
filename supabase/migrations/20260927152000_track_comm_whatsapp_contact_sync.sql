BEGIN;

-- A última sincronização não pode ser inferida a partir das linhas dos
-- contatos: nomes salvos manualmente são protegidos e podem não ser
-- atualizados pelo provedor. O estado separado evita repetir a sincronização
-- completa em toda consulta do Inbox.
CREATE TABLE IF NOT EXISTS public.comm_whatsapp_phone_contacts_sync_state (
  channel_id uuid PRIMARY KEY REFERENCES public.comm_whatsapp_channels(id) ON DELETE CASCADE,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_comm_whatsapp_phone_contacts_sync_state_updated_at
  ON public.comm_whatsapp_phone_contacts_sync_state;
CREATE TRIGGER trg_comm_whatsapp_phone_contacts_sync_state_updated_at
  BEFORE UPDATE ON public.comm_whatsapp_phone_contacts_sync_state
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.comm_whatsapp_phone_contacts_sync_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage comm whatsapp contact sync state"
  ON public.comm_whatsapp_phone_contacts_sync_state;
CREATE POLICY "Service role can manage comm whatsapp contact sync state"
  ON public.comm_whatsapp_phone_contacts_sync_state
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.comm_whatsapp_phone_contacts_sync_state FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.comm_whatsapp_phone_contacts_sync_state TO service_role;

COMMIT;
