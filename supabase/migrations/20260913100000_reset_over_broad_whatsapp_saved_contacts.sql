/*
  # Corrige "Contatos salvos" listando todos os chats, nao so contatos salvos

  A funcao extractWhapiContactSaved() (supabase/functions/_shared/comm-whatsapp.ts)
  marcava saved = true tambem quando a Whapi retornava saved: true, mas esse campo
  reflete qualquer contato com quem ja houve troca de mensagens, nao apenas os
  contatos realmente salvos na agenda (phonebook: true). Isso populou
  comm_whatsapp_phone_contacts_cache com saved = true para todo mundo com quem o
  numero ja conversou, fazendo a aba "Contatos salvos" do modal Novo chat listar
  todos os chats em vez dos contatos de fato salvos.

  A funcao ja foi corrigida para considerar apenas phonebook: true. Esta migracao
  zera o saved das linhas sincronizadas da Whapi (contact_id sem prefixo manual:
  ou chat:) para que a lista pare de mostrar contatos incorretos imediatamente,
  sem esperar a proxima sincronizacao. O proximo sync repopula saved = true
  apenas para os contatos realmente salvos na agenda.

  Linhas manual: (contato salvo manualmente pelo app) e chat: (nome derivado de
  chat, ja sempre saved = false) nao sao afetadas.
*/

BEGIN;

UPDATE public.comm_whatsapp_phone_contacts_cache
SET saved = false,
    updated_at = now()
WHERE saved = true
  AND contact_id NOT LIKE 'manual:%'
  AND contact_id NOT LIKE 'chat:%';

COMMIT;
