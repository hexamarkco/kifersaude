BEGIN;

ALTER TABLE public.cotador_produtos
  DROP CONSTRAINT IF EXISTS cotador_produtos_linha_id_fkey;

ALTER TABLE public.cotador_produtos
  ADD CONSTRAINT cotador_produtos_linha_id_fkey
  FOREIGN KEY (linha_id)
  REFERENCES public.cotador_linhas_produto(id)
  ON DELETE CASCADE;

COMMIT;
