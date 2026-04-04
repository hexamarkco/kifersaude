/*
  # Expand Cotador catalog hierarchy

  Evolves the Cotador model to support:
  - operadora -> linha -> produto -> tabela -> precos por faixa etaria
  - variacoes por MEI / nao MEI
  - variacoes por coparticipacao
  - tabelas segmentadas por faixa de vidas
*/

BEGIN;

CREATE TABLE IF NOT EXISTS public.cotador_linhas_produto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operadora_id uuid NOT NULL REFERENCES public.operadoras(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (operadora_id, nome)
);

CREATE INDEX IF NOT EXISTS idx_cotador_linhas_produto_operadora
  ON public.cotador_linhas_produto (operadora_id);

CREATE INDEX IF NOT EXISTS idx_cotador_linhas_produto_ativo
  ON public.cotador_linhas_produto (ativo);

DROP TRIGGER IF EXISTS trg_cotador_linhas_produto_updated_at ON public.cotador_linhas_produto;
CREATE TRIGGER trg_cotador_linhas_produto_updated_at
  BEFORE UPDATE ON public.cotador_linhas_produto
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.cotador_produtos
  ADD COLUMN IF NOT EXISTS linha_id uuid REFERENCES public.cotador_linhas_produto(id) ON DELETE RESTRICT;

INSERT INTO public.cotador_linhas_produto (operadora_id, nome, ativo, observacoes)
SELECT DISTINCT
  cp.operadora_id,
  o.nome,
  true,
  'Linha criada automaticamente a partir do backfill inicial do Cotador.'
FROM public.cotador_produtos cp
JOIN public.operadoras o ON o.id = cp.operadora_id
WHERE cp.operadora_id IS NOT NULL
ON CONFLICT (operadora_id, nome) DO NOTHING;

UPDATE public.cotador_produtos cp
SET linha_id = cl.id
FROM public.cotador_linhas_produto cl
JOIN public.operadoras o ON o.id = cp.operadora_id
WHERE cp.linha_id IS NULL
  AND cl.operadora_id = cp.operadora_id
  AND cl.nome = o.nome;

CREATE INDEX IF NOT EXISTS idx_cotador_produtos_linha
  ON public.cotador_produtos (linha_id);

CREATE TABLE IF NOT EXISTS public.cotador_tabelas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid NOT NULL REFERENCES public.cotador_produtos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  codigo text,
  modalidade text NOT NULL CHECK (modalidade IN ('PF', 'ADESAO', 'PME')),
  perfil_empresarial text NOT NULL DEFAULT 'todos'
    CHECK (perfil_empresarial IN ('todos', 'mei', 'nao_mei')),
  coparticipacao text NOT NULL DEFAULT 'sem'
    CHECK (coparticipacao IN ('sem', 'parcial', 'total')),
  vidas_min integer CHECK (vidas_min IS NULL OR vidas_min >= 1),
  vidas_max integer CHECK (vidas_max IS NULL OR vidas_max >= 1),
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (vidas_min IS NULL OR vidas_max IS NULL OR vidas_min <= vidas_max)
);

CREATE INDEX IF NOT EXISTS idx_cotador_tabelas_produto
  ON public.cotador_tabelas (produto_id);

CREATE INDEX IF NOT EXISTS idx_cotador_tabelas_modalidade
  ON public.cotador_tabelas (modalidade, perfil_empresarial, coparticipacao);

CREATE INDEX IF NOT EXISTS idx_cotador_tabelas_vidas
  ON public.cotador_tabelas (vidas_min, vidas_max);

CREATE INDEX IF NOT EXISTS idx_cotador_tabelas_ativo
  ON public.cotador_tabelas (ativo);

DROP TRIGGER IF EXISTS trg_cotador_tabelas_updated_at ON public.cotador_tabelas;
CREATE TRIGGER trg_cotador_tabelas_updated_at
  BEFORE UPDATE ON public.cotador_tabelas
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.cotador_tabela_faixas_preco (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela_id uuid NOT NULL REFERENCES public.cotador_tabelas(id) ON DELETE CASCADE,
  age_range text NOT NULL CHECK (age_range IN ('0-18', '19-23', '24-28', '29-33', '34-38', '39-43', '44-48', '49-53', '54-58', '59+')),
  valor numeric(10,2) NOT NULL DEFAULT 0 CHECK (valor >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tabela_id, age_range)
);

CREATE INDEX IF NOT EXISTS idx_cotador_tabela_faixas_preco_tabela
  ON public.cotador_tabela_faixas_preco (tabela_id);

DROP TRIGGER IF EXISTS trg_cotador_tabela_faixas_preco_updated_at ON public.cotador_tabela_faixas_preco;
CREATE TRIGGER trg_cotador_tabela_faixas_preco_updated_at
  BEFORE UPDATE ON public.cotador_tabela_faixas_preco
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.cotador_quote_items
  ADD COLUMN IF NOT EXISTS cotador_linha_id uuid REFERENCES public.cotador_linhas_produto(id) ON DELETE SET NULL;

ALTER TABLE public.cotador_quote_items
  ADD COLUMN IF NOT EXISTS cotador_tabela_id uuid REFERENCES public.cotador_tabelas(id) ON DELETE SET NULL;

ALTER TABLE public.cotador_quote_items
  ADD COLUMN IF NOT EXISTS linha_nome_snapshot text;

ALTER TABLE public.cotador_quote_items
  ADD COLUMN IF NOT EXISTS tabela_nome_snapshot text;

ALTER TABLE public.cotador_quote_items
  ADD COLUMN IF NOT EXISTS codigo_tabela_snapshot text;

ALTER TABLE public.cotador_quote_items
  ADD COLUMN IF NOT EXISTS perfil_empresarial_snapshot text;

ALTER TABLE public.cotador_quote_items
  ADD COLUMN IF NOT EXISTS coparticipacao_snapshot text;

ALTER TABLE public.cotador_quote_items
  ADD COLUMN IF NOT EXISTS vidas_min_snapshot integer;

ALTER TABLE public.cotador_quote_items
  ADD COLUMN IF NOT EXISTS vidas_max_snapshot integer;

ALTER TABLE public.cotador_quote_items
  ADD COLUMN IF NOT EXISTS precos_faixa_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.cotador_quote_items
  ADD COLUMN IF NOT EXISTS mensalidade_total_snapshot numeric(10,2);

DROP INDEX IF EXISTS idx_cotador_quote_items_quote;
CREATE INDEX IF NOT EXISTS idx_cotador_quote_items_quote
  ON public.cotador_quote_items (quote_id, ordem);

CREATE INDEX IF NOT EXISTS idx_cotador_quote_items_linha
  ON public.cotador_quote_items (cotador_linha_id);

CREATE INDEX IF NOT EXISTS idx_cotador_quote_items_tabela
  ON public.cotador_quote_items (cotador_tabela_id);

ALTER TABLE public.cotador_quote_items
  DROP CONSTRAINT IF EXISTS cotador_quote_items_source_check;

ALTER TABLE public.cotador_quote_items
  ADD CONSTRAINT cotador_quote_items_source_check
  CHECK (source IN ('cotador_tabela', 'cotador_produto', 'legacy_produto', 'operadora'));

UPDATE public.cotador_quote_items qi
SET
  cotador_linha_id = cp.linha_id,
  linha_nome_snapshot = COALESCE(qi.linha_nome_snapshot, cl.nome)
FROM public.cotador_produtos cp
JOIN public.cotador_linhas_produto cl ON cl.id = cp.linha_id
WHERE qi.cotador_produto_id = cp.id
  AND (qi.cotador_linha_id IS NULL OR qi.linha_nome_snapshot IS NULL);

ALTER TABLE public.cotador_linhas_produto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotador_tabelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotador_tabela_faixas_preco ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view cotador linhas" ON public.cotador_linhas_produto;
CREATE POLICY "Authenticated users can view cotador linhas"
  ON public.cotador_linhas_produto
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Managers can insert cotador linhas" ON public.cotador_linhas_produto;
CREATE POLICY "Managers can insert cotador linhas"
  ON public.cotador_linhas_produto
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_can_manage_system_catalog());

DROP POLICY IF EXISTS "Managers can update cotador linhas" ON public.cotador_linhas_produto;
CREATE POLICY "Managers can update cotador linhas"
  ON public.cotador_linhas_produto
  FOR UPDATE
  TO authenticated
  USING (public.current_user_can_manage_system_catalog())
  WITH CHECK (public.current_user_can_manage_system_catalog());

DROP POLICY IF EXISTS "Managers can delete cotador linhas" ON public.cotador_linhas_produto;
CREATE POLICY "Managers can delete cotador linhas"
  ON public.cotador_linhas_produto
  FOR DELETE
  TO authenticated
  USING (public.current_user_can_manage_system_catalog());

DROP POLICY IF EXISTS "Authenticated users can view cotador tabelas" ON public.cotador_tabelas;
CREATE POLICY "Authenticated users can view cotador tabelas"
  ON public.cotador_tabelas
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Managers can insert cotador tabelas" ON public.cotador_tabelas;
CREATE POLICY "Managers can insert cotador tabelas"
  ON public.cotador_tabelas
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_can_manage_system_catalog());

DROP POLICY IF EXISTS "Managers can update cotador tabelas" ON public.cotador_tabelas;
CREATE POLICY "Managers can update cotador tabelas"
  ON public.cotador_tabelas
  FOR UPDATE
  TO authenticated
  USING (public.current_user_can_manage_system_catalog())
  WITH CHECK (public.current_user_can_manage_system_catalog());

DROP POLICY IF EXISTS "Managers can delete cotador tabelas" ON public.cotador_tabelas;
CREATE POLICY "Managers can delete cotador tabelas"
  ON public.cotador_tabelas
  FOR DELETE
  TO authenticated
  USING (public.current_user_can_manage_system_catalog());

DROP POLICY IF EXISTS "Authenticated users can view cotador tabela faixas" ON public.cotador_tabela_faixas_preco;
CREATE POLICY "Authenticated users can view cotador tabela faixas"
  ON public.cotador_tabela_faixas_preco
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Managers can insert cotador tabela faixas" ON public.cotador_tabela_faixas_preco;
CREATE POLICY "Managers can insert cotador tabela faixas"
  ON public.cotador_tabela_faixas_preco
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_can_manage_system_catalog());

DROP POLICY IF EXISTS "Managers can update cotador tabela faixas" ON public.cotador_tabela_faixas_preco;
CREATE POLICY "Managers can update cotador tabela faixas"
  ON public.cotador_tabela_faixas_preco
  FOR UPDATE
  TO authenticated
  USING (public.current_user_can_manage_system_catalog())
  WITH CHECK (public.current_user_can_manage_system_catalog());

DROP POLICY IF EXISTS "Managers can delete cotador tabela faixas" ON public.cotador_tabela_faixas_preco;
CREATE POLICY "Managers can delete cotador tabela faixas"
  ON public.cotador_tabela_faixas_preco
  FOR DELETE
  TO authenticated
  USING (public.current_user_can_manage_system_catalog());

COMMIT;
