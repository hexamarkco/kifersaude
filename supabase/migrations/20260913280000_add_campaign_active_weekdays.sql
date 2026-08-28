/*
  # Dias da semana em que o disparo pode enviar

  A janela de envio (send_window_start/send_window_end) so controlava o
  horario do dia. Nao havia como excluir dias da semana inteiros (ex.: nao
  enviar aos finais de semana) - a campanha rodava todos os 7 dias dentro
  da janela configurada.

  Adiciona `active_weekdays smallint[]`, com 0 = domingo .. 6 = sabado
  (mesma convencao de `Date.getDay()`/`Intl.DateTimeFormat` usada no worker).
  Default = todos os dias, para nao alterar o comportamento de campanhas
  ja existentes. Novas campanhas criadas pela tela usam segunda a sexta
  como padrao (definido no frontend), mas o campo continua totalmente
  editavel por campanha.
*/

BEGIN;

ALTER TABLE public.comm_whatsapp_campaigns
  ADD COLUMN IF NOT EXISTS active_weekdays smallint[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6]::smallint[];

ALTER TABLE public.comm_whatsapp_campaigns
  ADD CONSTRAINT comm_whatsapp_campaigns_active_weekdays_valid
  CHECK (active_weekdays <@ ARRAY[0,1,2,3,4,5,6]::smallint[] AND cardinality(active_weekdays) > 0);

COMMIT;
