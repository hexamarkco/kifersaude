/*
  # Add direction to WhatsApp messages

  ## Description
  Armazena o sentido da mensagem (inbound/outbound) para facilitar
  a exibição no inbox e futuras automações.
*/

ALTER TABLE whatsapp_messages
ADD COLUMN IF NOT EXISTS direction text CHECK (direction IN ('inbound', 'outbound'));
