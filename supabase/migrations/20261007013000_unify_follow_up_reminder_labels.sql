-- "Retorno" e "Retomar contato" representam o mesmo acompanhamento comercial.
-- Mantemos uma única categoria e rótulo para que filtros, agenda e automações
-- tratem todos os follow-ups de forma consistente.

UPDATE public.reminders
SET tipo = 'Follow-up'
WHERE lower(btrim(tipo)) = 'retorno';

UPDATE public.reminders
SET titulo = regexp_replace(titulo, '^Retomar contato\s*:', 'Follow-up:', 'i')
WHERE titulo ~* '^Retomar contato\s*:';

UPDATE public.reminders
SET titulo = regexp_replace(titulo, '^Retorno agendado\s*:', 'Follow-up agendado:', 'i')
WHERE titulo ~* '^Retorno agendado\s*:';

UPDATE public.reminders
SET titulo = 'Follow-up de WhatsApp'
WHERE lower(btrim(titulo)) = 'retomar follow-up de whatsapp';
