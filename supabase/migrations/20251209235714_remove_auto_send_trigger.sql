/*
  # Remove Auto-Send Trigger

  ## Description
  Remove o trigger de banco de dados que tentava enviar mensagens automaticamente.
  A funcionalidade será implementada no frontend para ter acesso correto à API.

  ## Changes
  - Remove o trigger trigger_auto_send_on_lead_insert
  - Remove a função trigger_auto_send_lead_messages
*/

DROP TRIGGER IF EXISTS trigger_auto_send_on_lead_insert ON leads;
DROP FUNCTION IF EXISTS trigger_auto_send_lead_messages();
