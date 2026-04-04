/*
  # Add table-level accommodation to Cotador

  - allows each commercial table to define its own accommodation type
  - backfills existing tables from the linked product when possible
*/

BEGIN;

ALTER TABLE public.cotador_tabelas
  ADD COLUMN IF NOT EXISTS acomodacao text;

UPDATE public.cotador_tabelas ct
SET acomodacao = cp.acomodacao
FROM public.cotador_produtos cp
WHERE ct.produto_id = cp.id
  AND ct.acomodacao IS NULL
  AND cp.acomodacao IS NOT NULL;

COMMIT;
