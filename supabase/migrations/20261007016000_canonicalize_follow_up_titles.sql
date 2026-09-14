-- Consolida os títulos comerciais de acompanhamento na nomenclatura canônica
-- exibida pela aplicação: "Follow-up".

UPDATE public.reminders
SET tipo = 'Follow-up'
WHERE lower(btrim(tipo)) IN ('retorno', 'follow up', 'follow-up', 'followup');

UPDATE public.reminders
SET titulo = regexp_replace(
  titulo,
  '^(?:retomar contato|retorno agendado|follow[ -]?up agendado)\s*:',
  'Follow-up:',
  'i'
)
WHERE titulo ~* '^(?:retomar contato|retorno agendado|follow[ -]?up agendado)\s*:';

UPDATE public.reminders
SET titulo = regexp_replace(
  titulo,
  '^(?:retomar )?follow[ -]?up de whatsapp\s*:\s*',
  'Follow-up: ',
  'i'
)
WHERE titulo ~* '^(?:retomar )?follow[ -]?up de whatsapp\s*:\s*';

UPDATE public.reminders
SET titulo = 'Follow-up'
WHERE lower(btrim(titulo)) IN (
  'retomar follow-up de whatsapp',
  'retomar follow up de whatsapp',
  'follow-up de whatsapp',
  'follow up de whatsapp'
);
