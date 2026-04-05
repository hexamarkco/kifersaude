ALTER TABLE public.cotador_produtos
  ADD COLUMN IF NOT EXISTS carencias text,
  ADD COLUMN IF NOT EXISTS documentos_necessarios text,
  ADD COLUMN IF NOT EXISTS reembolso text,
  ADD COLUMN IF NOT EXISTS informacoes_importantes text;

ALTER TABLE public.cotador_quote_items
  ADD COLUMN IF NOT EXISTS carencias_snapshot text,
  ADD COLUMN IF NOT EXISTS documentos_necessarios_snapshot text,
  ADD COLUMN IF NOT EXISTS reembolso_snapshot text,
  ADD COLUMN IF NOT EXISTS informacoes_importantes_snapshot text;
