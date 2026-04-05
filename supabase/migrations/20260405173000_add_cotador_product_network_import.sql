ALTER TABLE public.cotador_produtos
  ADD COLUMN IF NOT EXISTS rede_hospitalar jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.cotador_quote_items
  ADD COLUMN IF NOT EXISTS rede_hospitalar_snapshot jsonb;
