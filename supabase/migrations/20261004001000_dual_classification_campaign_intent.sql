/*
  # Dual Classification for Campaign Intent

  ## Description
  Adds contact_permission and commercial_intent columns to
  comm_whatsapp_ai_intent_suggestions, enabling two independent
  classification dimensions instead of a single intent field.

  ## What this does
  1. Adds contact_permission (security/permission) column
  2. Adds commercial_intent (business intent) column
  3. Adds CHECK constraints for both new columns
  4. Maps existing intent values to the new dual classification

  ## Backward compatibility
  The legacy `intent` column is preserved and populated via
  mapContactPermissionToLegacyIntent(cp, ci) in the worker.
*/

-- 1. Add new columns
ALTER TABLE public.comm_whatsapp_ai_intent_suggestions
  ADD COLUMN IF NOT EXISTS contact_permission text,
  ADD COLUMN IF NOT EXISTS commercial_intent text;

-- 2. CHECK constraints
ALTER TABLE public.comm_whatsapp_ai_intent_suggestions
  ADD CONSTRAINT comm_whatsapp_ai_intent_suggestions_contact_permission_check
    CHECK (contact_permission IN (
      'OPT_OUT_EXPLICITO', 'NUMERO_ERRADO', 'DESTINATARIO_INCORRETO',
      'RECLAMACAO_CONTATO', 'AMBIGUO', 'NENHUM_SINAL'
    )),
  ADD CONSTRAINT comm_whatsapp_ai_intent_suggestions_commercial_intent_check
    CHECK (commercial_intent IN (
      'JA_POSSUI_PLANO', 'INTERESSADO', 'SEM_INTERESSE',
      'QUER_SABER_MAIS', 'ADIAR_CONTATO', 'OUTRO'
    ));

-- 3. Map existing records
UPDATE public.comm_whatsapp_ai_intent_suggestions
SET
  contact_permission = CASE intent
    WHEN 'opt_out' THEN 'OPT_OUT_EXPLICITO'
    WHEN 'wrong_number' THEN 'NUMERO_ERRADO'
    WHEN 'angry_or_complaint' THEN 'RECLAMACAO_CONTATO'
    WHEN 'unclear' THEN 'AMBIGUO'
    WHEN 'negative_interest' THEN 'NENHUM_SINAL'
    WHEN 'continue_conversation' THEN 'NENHUM_SINAL'
    ELSE 'NENHUM_SINAL'
  END,
  commercial_intent = CASE
    WHEN intent = 'negative_interest' THEN 'SEM_INTERESSE'
    WHEN intent = 'continue_conversation' THEN 'INTERESSADO'
    WHEN intent = 'opt_out' THEN 'SEM_INTERESSE'
    WHEN intent = 'wrong_number' THEN 'OUTRO'
    WHEN intent = 'angry_or_complaint' THEN 'SEM_INTERESSE'
    WHEN intent = 'unclear' THEN 'OUTRO'
    ELSE 'OUTRO'
  END
WHERE contact_permission IS NULL;
