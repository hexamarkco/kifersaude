/*
  # Codigo de handoff fixo no sandbox de IA

  Ate agora o handoff da IA (playbook autonomous_attendance) guardava so um
  texto livre explicando o motivo. Para poder automatizar a mudanca de
  status do lead no CRM quando isso for ligado no inbox real, o motivo
  passa a vir tambem como um codigo fixo (QUALIFICACAO_COMPLETA,
  RECUSOU_COTACAO, FORA_DE_ESCOPO ou PRECISA_HUMANO), com o texto livre
  virando so uma nota curta complementar.

  handoff_reason continua existindo com a nota curta (renomeado em uso,
  nao em schema, para nao quebrar leituras existentes).
*/

BEGIN;

ALTER TABLE public.ai_sandbox_messages
  ADD COLUMN IF NOT EXISTS handoff_code text
    CHECK (handoff_code IS NULL OR handoff_code IN ('QUALIFICACAO_COMPLETA', 'RECUSOU_COTACAO', 'FORA_DE_ESCOPO', 'PRECISA_HUMANO'));

ALTER TABLE public.ai_sandbox_test_runs
  ADD COLUMN IF NOT EXISTS handoff_code text
    CHECK (handoff_code IS NULL OR handoff_code IN ('QUALIFICACAO_COMPLETA', 'RECUSOU_COTACAO', 'FORA_DE_ESCOPO', 'PRECISA_HUMANO'));

COMMIT;
