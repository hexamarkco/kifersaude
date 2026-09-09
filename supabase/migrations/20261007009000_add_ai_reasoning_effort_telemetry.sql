/*
  Registra o esforço de raciocínio solicitado pela Feature e o valor
  efetivamente enviado pelo adapter do provider em cada tentativa de IA.
*/

ALTER TABLE public.ai_call_attempts
  ADD COLUMN requested_reasoning_effort text,
  ADD COLUMN applied_reasoning_effort text;

ALTER TABLE public.ai_call_attempts
  ADD CONSTRAINT ai_call_attempts_requested_reasoning_effort_check
    CHECK (
      requested_reasoning_effort IS NULL
      OR requested_reasoning_effort IN ('none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max')
    ),
  ADD CONSTRAINT ai_call_attempts_applied_reasoning_effort_check
    CHECK (
      applied_reasoning_effort IS NULL
      OR applied_reasoning_effort IN ('none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max')
    );

COMMENT ON COLUMN public.ai_call_attempts.requested_reasoning_effort IS
  'Esforço solicitado pela configuração ativa da Feature; NULL significa automático.';

COMMENT ON COLUMN public.ai_call_attempts.applied_reasoning_effort IS
  'Último reasoning_effort efetivamente incluído no payload HTTP desta tentativa; NULL significa parâmetro omitido.';
