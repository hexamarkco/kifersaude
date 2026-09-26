BEGIN;

-- Esta funcao atualiza a identidade persistida de um chat e deve ser usada
-- apenas por workers e funcoes internas com privilegios do sistema.
REVOKE ALL ON FUNCTION public.comm_whatsapp_refresh_chat_identity(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_refresh_chat_identity(uuid)
  TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
