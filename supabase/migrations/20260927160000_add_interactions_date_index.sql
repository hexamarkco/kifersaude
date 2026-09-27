BEGIN;

-- O Dashboard pagina o histórico de interações em ordem decrescente. Sem
-- este índice, cada abertura precisa ordenar a tabela inteira antes de
-- devolver a primeira página.
CREATE INDEX IF NOT EXISTS idx_interactions_data_interacao
  ON public.interactions (data_interacao DESC);

COMMIT;
