/*
  # Allow leads to enter the CRM before contract type qualification

  A new lead does not necessarily have enough information to distinguish
  Pessoa Física, PME or Adesão. The contract type is therefore optional at
  lead intake and becomes required only when the commercial context is known.
*/

ALTER TABLE public.leads
  ALTER COLUMN tipo_contratacao_id DROP NOT NULL;
