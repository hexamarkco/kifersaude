/*
  # Corrige alvos marcados como invalidos por erro na validacao de WhatsApp

  A primeira versao de `validatePendingWhatsAppTargets` (worker) usava
  `checkWhapiContactIdentity`, que colapsa QUALQUER resposta HTTP nao-ok da
  Whapi (incluindo 429 - rate limit) em "nao existe". Com concorrencia alta
  (15 checagens simultaneas) numa campanha de dezenas de milhares de
  contatos, isso fez a Whapi responder 429 pra boa parte das checagens, e
  esses contatos foram marcados como invalidos (whatsapp_check_status
  ='invalid', status='invalid') sem nenhuma confirmacao real de que o
  numero nao tem WhatsApp - so porque a checagem foi limitada por taxa.

  O worker ja foi corrigido para so marcar invalido numa confirmacao
  explicita (usa checkWhapiContactStatus, que devolve 'unknown' - fica
  pending - em qualquer resposta ambigua ou erro).

  Esta migracao e o reparo dos dados: reverte para 'pending' exatamente os
  alvos que foram invalidados por essa rota com esse texto de erro
  especifico (nunca usado em nenhum outro caminho de invalidacao), para
  serem revalidados do zero com a logica corrigida.
*/

BEGIN;

UPDATE public.comm_whatsapp_campaign_targets
SET whatsapp_check_status = 'pending',
    whatsapp_checked_at = NULL,
    status = 'pending',
    error_message = NULL,
    updated_at = now()
WHERE whatsapp_check_status = 'invalid'
  AND error_message = 'Numero nao possui WhatsApp.';

COMMIT;
