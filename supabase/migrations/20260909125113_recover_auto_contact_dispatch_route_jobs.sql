/*
  Recover jobs that failed before the WhatsApp request was made because
  sendAutoContactMessage referenced dispatchRoute before it was initialized.

  Deploy the corresponding leads-api fix before applying this migration. The
  cron will then pick these jobs up normally, re-evaluate their flow guards,
  and only send if they still qualify.
*/

UPDATE public.auto_contact_flow_jobs
SET
  status = 'pending',
  scheduled_at = now(),
  attempts = 0,
  last_error = 'Reagendado após correção de inicialização da rota de envio.'
WHERE status = 'failed'
  AND action_type = 'send_message'
  AND last_error = 'Cannot access ''dispatchRoute'' before initialization';
