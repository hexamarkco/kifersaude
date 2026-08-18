-- O preview de status na lista de chats (comm_whatsapp_list_chats) sempre
-- recalculou "qual o status da ultima mensagem" na hora, com um DISTINCT ON
-- sobre comm_whatsapp_messages a cada chamada. Isso tem dois problemas:
--
-- 1) Eficiencia: repete essa consulta a cada poll da lista (8-60s) para
--    todo chat retornado, mesmo quando nada mudou.
-- 2) Consistencia: como o valor nunca existiu como coluna real da tabela
--    comm_whatsapp_chats, ele nunca aparece no realtime dessa tabela — um
--    evento UPDATE em comm_whatsapp_chats sempre chega com
--    last_message_delivery_status ausente, entao o preview da lista so
--    e atualizado pelo polling. Enquanto isso, a bolha de mensagem aberta
--    le o status direto de comm_whatsapp_messages via realtime dedicado
--    e atualiza quase instantaneamente. Resultado: bolha e preview podem
--    mostrar status diferentes por ate ~60s (o intervalo do poll).
--
-- Este migration adiciona colunas reais na tabela chats e um trigger que as
-- mantem sincronizadas sempre que a mensagem mais recente do chat tem seu
-- delivery_status alterado (por webhook, pelo refresh manual ou no insert
-- inicial). Com isso a mudanca de status passa a disparar um UPDATE real em
-- comm_whatsapp_chats, que o realtime ja existente da lista propaga na hora,
-- igualando as duas telas a mesma fonte de verdade.

BEGIN;

ALTER TABLE public.comm_whatsapp_chats
  ADD COLUMN IF NOT EXISTS last_message_delivery_status text,
  ADD COLUMN IF NOT EXISTS last_message_status_updated_at timestamptz;

-- Backfill: status da mensagem mais recente de cada chat, usando o mesmo
-- criterio de ordenacao ja usado pelo preview (message_at, created_at, id).
WITH latest AS (
  SELECT DISTINCT ON (m.chat_id)
    m.chat_id,
    m.delivery_status,
    m.status_updated_at
  FROM public.comm_whatsapp_messages m
  ORDER BY m.chat_id, m.message_at DESC, m.created_at DESC, m.id DESC
)
UPDATE public.comm_whatsapp_chats c
SET
  last_message_delivery_status = latest.delivery_status,
  last_message_status_updated_at = latest.status_updated_at
FROM latest
WHERE latest.chat_id = c.id
  AND c.last_message_delivery_status IS DISTINCT FROM latest.delivery_status;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_sync_chat_last_message_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_latest_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.delivery_status IS NOT DISTINCT FROM OLD.delivery_status THEN
    RETURN NULL;
  END IF;

  SELECT m.id
  INTO v_latest_id
  FROM public.comm_whatsapp_messages m
  WHERE m.chat_id = NEW.chat_id
  ORDER BY m.message_at DESC, m.created_at DESC, m.id DESC
  LIMIT 1;

  IF v_latest_id IS DISTINCT FROM NEW.id THEN
    RETURN NULL;
  END IF;

  UPDATE public.comm_whatsapp_chats
  SET
    last_message_delivery_status = NEW.delivery_status,
    last_message_status_updated_at = NEW.status_updated_at
  WHERE id = NEW.chat_id
    AND last_message_delivery_status IS DISTINCT FROM NEW.delivery_status;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_comm_whatsapp_sync_chat_last_message_status ON public.comm_whatsapp_messages;
CREATE TRIGGER trg_comm_whatsapp_sync_chat_last_message_status
  AFTER INSERT OR UPDATE OF delivery_status ON public.comm_whatsapp_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.comm_whatsapp_sync_chat_last_message_status();

REVOKE ALL ON FUNCTION public.comm_whatsapp_sync_chat_last_message_status() FROM PUBLIC;

COMMIT;
