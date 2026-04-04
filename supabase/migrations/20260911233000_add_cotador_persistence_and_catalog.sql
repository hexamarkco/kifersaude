/*
  # Add Cotador persistence and normalized catalog

  - creates normalized tables for administradoras, entidades de classe e produtos do Cotador
  - creates quote persistence tables separated from contracts
  - backfills catalog products from legacy `produtos_planos`
  - adds RLS helpers for Cotador access and system catalog management
  - seeds the `cotador` module permission for existing profiles
*/

BEGIN;

CREATE OR REPLACE FUNCTION public.current_user_can_manage_system_catalog()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT (
    public.current_user_is_access_admin()
    OR EXISTS (
      SELECT 1
      FROM public.profile_permissions pp
      WHERE pp.role = public.current_user_access_role()
        AND pp.module IN ('config-system', 'config')
        AND pp.can_edit = true
    )
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_can_manage_system_catalog() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_can_manage_system_catalog() TO authenticated;

CREATE OR REPLACE FUNCTION public.current_user_can_view_cotador()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT (
    public.current_user_is_access_admin()
    OR EXISTS (
      SELECT 1
      FROM public.profile_permissions pp
      WHERE pp.role = public.current_user_access_role()
        AND pp.module = 'cotador'
        AND (pp.can_view = true OR pp.can_edit = true)
    )
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_can_view_cotador() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_can_view_cotador() TO authenticated;

CREATE OR REPLACE FUNCTION public.current_user_can_edit_cotador()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT (
    public.current_user_is_access_admin()
    OR EXISTS (
      SELECT 1
      FROM public.profile_permissions pp
      WHERE pp.role = public.current_user_access_role()
        AND pp.module = 'cotador'
        AND pp.can_edit = true
    )
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_can_edit_cotador() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_can_edit_cotador() TO authenticated;

CREATE TABLE IF NOT EXISTS public.cotador_administradoras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cotador_administradoras_ativo
  ON public.cotador_administradoras (ativo);

DROP TRIGGER IF EXISTS trg_cotador_administradoras_updated_at ON public.cotador_administradoras;
CREATE TRIGGER trg_cotador_administradoras_updated_at
  BEFORE UPDATE ON public.cotador_administradoras
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.cotador_entidades_classe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cotador_entidades_classe_ativo
  ON public.cotador_entidades_classe (ativo);

DROP TRIGGER IF EXISTS trg_cotador_entidades_classe_updated_at ON public.cotador_entidades_classe;
CREATE TRIGGER trg_cotador_entidades_classe_updated_at
  BEFORE UPDATE ON public.cotador_entidades_classe
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.cotador_produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operadora_id uuid NOT NULL REFERENCES public.operadoras(id) ON DELETE CASCADE,
  administradora_id uuid REFERENCES public.cotador_administradoras(id) ON DELETE SET NULL,
  legacy_produto_plano_id uuid UNIQUE REFERENCES public.produtos_planos(id) ON DELETE SET NULL,
  nome text NOT NULL,
  modalidade text,
  abrangencia text,
  acomodacao text,
  comissao_sugerida numeric(5,2),
  bonus_por_vida_valor numeric(10,2),
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cotador_produtos_operadora
  ON public.cotador_produtos (operadora_id);

CREATE INDEX IF NOT EXISTS idx_cotador_produtos_administradora
  ON public.cotador_produtos (administradora_id);

CREATE INDEX IF NOT EXISTS idx_cotador_produtos_ativo
  ON public.cotador_produtos (ativo);

DROP TRIGGER IF EXISTS trg_cotador_produtos_updated_at ON public.cotador_produtos;
CREATE TRIGGER trg_cotador_produtos_updated_at
  BEFORE UPDATE ON public.cotador_produtos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.cotador_produto_entidades (
  produto_id uuid NOT NULL REFERENCES public.cotador_produtos(id) ON DELETE CASCADE,
  entidade_id uuid NOT NULL REFERENCES public.cotador_entidades_classe(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (produto_id, entidade_id)
);

CREATE INDEX IF NOT EXISTS idx_cotador_produto_entidades_entidade
  ON public.cotador_produto_entidades (entidade_id);

CREATE TABLE IF NOT EXISTS public.cotador_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  modalidade text NOT NULL CHECK (modalidade IN ('PF', 'ADESAO', 'PME')),
  total_vidas integer NOT NULL DEFAULT 0 CHECK (total_vidas >= 0),
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cotador_quotes_updated_at
  ON public.cotador_quotes (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_cotador_quotes_modalidade
  ON public.cotador_quotes (modalidade);

DROP TRIGGER IF EXISTS trg_cotador_quotes_updated_at ON public.cotador_quotes;
CREATE TRIGGER trg_cotador_quotes_updated_at
  BEFORE UPDATE ON public.cotador_quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.cotador_quote_beneficiaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.cotador_quotes(id) ON DELETE CASCADE,
  age_range text NOT NULL CHECK (age_range IN ('0-18', '19-23', '24-28', '29-33', '34-38', '39-43', '44-48', '49-53', '54-58', '59+')),
  quantidade integer NOT NULL CHECK (quantidade >= 0),
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quote_id, age_range)
);

CREATE INDEX IF NOT EXISTS idx_cotador_quote_beneficiaries_quote
  ON public.cotador_quote_beneficiaries (quote_id, ordem);

CREATE TABLE IF NOT EXISTS public.cotador_quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.cotador_quotes(id) ON DELETE CASCADE,
  cotador_produto_id uuid REFERENCES public.cotador_produtos(id) ON DELETE SET NULL,
  legacy_produto_plano_id uuid REFERENCES public.produtos_planos(id) ON DELETE SET NULL,
  operadora_id uuid REFERENCES public.operadoras(id) ON DELETE SET NULL,
  administradora_id uuid REFERENCES public.cotador_administradoras(id) ON DELETE SET NULL,
  catalog_item_key text NOT NULL,
  source text NOT NULL CHECK (source IN ('cotador_produto', 'legacy_produto', 'operadora')),
  titulo_snapshot text NOT NULL,
  subtitulo_snapshot text,
  operadora_nome_snapshot text NOT NULL,
  administradora_nome_snapshot text,
  entidade_nomes_snapshot text[] NOT NULL DEFAULT ARRAY[]::text[],
  modalidade_snapshot text,
  abrangencia_snapshot text,
  acomodacao_snapshot text,
  comissao_sugerida_snapshot numeric(5,2),
  bonus_por_vida_valor_snapshot numeric(10,2),
  observacoes_snapshot text,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quote_id, catalog_item_key)
);

CREATE INDEX IF NOT EXISTS idx_cotador_quote_items_quote
  ON public.cotador_quote_items (quote_id, ordem);

INSERT INTO public.cotador_produtos (
  operadora_id,
  legacy_produto_plano_id,
  nome,
  modalidade,
  abrangencia,
  acomodacao,
  comissao_sugerida,
  bonus_por_vida_valor,
  observacoes,
  ativo
)
SELECT
  p.operadora_id,
  p.id,
  p.nome,
  NULLIF(btrim(p.modalidade), ''),
  NULLIF(btrim(p.abrangencia), ''),
  NULLIF(btrim(p.acomodacao), ''),
  p.comissao_sugerida,
  p.bonus_por_vida_valor,
  NULL,
  COALESCE(p.ativo, true)
FROM public.produtos_planos p
WHERE NOT EXISTS (
  SELECT 1
  FROM public.cotador_produtos cp
  WHERE cp.legacy_produto_plano_id = p.id
);

ALTER TABLE public.cotador_administradoras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotador_entidades_classe ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotador_produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotador_produto_entidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotador_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotador_quote_beneficiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotador_quote_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view cotador administradoras" ON public.cotador_administradoras;
CREATE POLICY "Authenticated users can view cotador administradoras"
  ON public.cotador_administradoras
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Managers can insert cotador administradoras" ON public.cotador_administradoras;
CREATE POLICY "Managers can insert cotador administradoras"
  ON public.cotador_administradoras
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_can_manage_system_catalog());

DROP POLICY IF EXISTS "Managers can update cotador administradoras" ON public.cotador_administradoras;
CREATE POLICY "Managers can update cotador administradoras"
  ON public.cotador_administradoras
  FOR UPDATE
  TO authenticated
  USING (public.current_user_can_manage_system_catalog())
  WITH CHECK (public.current_user_can_manage_system_catalog());

DROP POLICY IF EXISTS "Managers can delete cotador administradoras" ON public.cotador_administradoras;
CREATE POLICY "Managers can delete cotador administradoras"
  ON public.cotador_administradoras
  FOR DELETE
  TO authenticated
  USING (public.current_user_can_manage_system_catalog());

DROP POLICY IF EXISTS "Authenticated users can view cotador entidades" ON public.cotador_entidades_classe;
CREATE POLICY "Authenticated users can view cotador entidades"
  ON public.cotador_entidades_classe
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Managers can insert cotador entidades" ON public.cotador_entidades_classe;
CREATE POLICY "Managers can insert cotador entidades"
  ON public.cotador_entidades_classe
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_can_manage_system_catalog());

DROP POLICY IF EXISTS "Managers can update cotador entidades" ON public.cotador_entidades_classe;
CREATE POLICY "Managers can update cotador entidades"
  ON public.cotador_entidades_classe
  FOR UPDATE
  TO authenticated
  USING (public.current_user_can_manage_system_catalog())
  WITH CHECK (public.current_user_can_manage_system_catalog());

DROP POLICY IF EXISTS "Managers can delete cotador entidades" ON public.cotador_entidades_classe;
CREATE POLICY "Managers can delete cotador entidades"
  ON public.cotador_entidades_classe
  FOR DELETE
  TO authenticated
  USING (public.current_user_can_manage_system_catalog());

DROP POLICY IF EXISTS "Authenticated users can view cotador produtos" ON public.cotador_produtos;
CREATE POLICY "Authenticated users can view cotador produtos"
  ON public.cotador_produtos
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Managers can insert cotador produtos" ON public.cotador_produtos;
CREATE POLICY "Managers can insert cotador produtos"
  ON public.cotador_produtos
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_can_manage_system_catalog());

DROP POLICY IF EXISTS "Managers can update cotador produtos" ON public.cotador_produtos;
CREATE POLICY "Managers can update cotador produtos"
  ON public.cotador_produtos
  FOR UPDATE
  TO authenticated
  USING (public.current_user_can_manage_system_catalog())
  WITH CHECK (public.current_user_can_manage_system_catalog());

DROP POLICY IF EXISTS "Managers can delete cotador produtos" ON public.cotador_produtos;
CREATE POLICY "Managers can delete cotador produtos"
  ON public.cotador_produtos
  FOR DELETE
  TO authenticated
  USING (public.current_user_can_manage_system_catalog());

DROP POLICY IF EXISTS "Authenticated users can view cotador produto entidades" ON public.cotador_produto_entidades;
CREATE POLICY "Authenticated users can view cotador produto entidades"
  ON public.cotador_produto_entidades
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Managers can insert cotador produto entidades" ON public.cotador_produto_entidades;
CREATE POLICY "Managers can insert cotador produto entidades"
  ON public.cotador_produto_entidades
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_can_manage_system_catalog());

DROP POLICY IF EXISTS "Managers can delete cotador produto entidades" ON public.cotador_produto_entidades;
CREATE POLICY "Managers can delete cotador produto entidades"
  ON public.cotador_produto_entidades
  FOR DELETE
  TO authenticated
  USING (public.current_user_can_manage_system_catalog());

DROP POLICY IF EXISTS "Users can view cotador quotes" ON public.cotador_quotes;
CREATE POLICY "Users can view cotador quotes"
  ON public.cotador_quotes
  FOR SELECT
  TO authenticated
  USING (public.current_user_can_view_cotador());

DROP POLICY IF EXISTS "Users can insert cotador quotes" ON public.cotador_quotes;
CREATE POLICY "Users can insert cotador quotes"
  ON public.cotador_quotes
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_can_edit_cotador());

DROP POLICY IF EXISTS "Users can update cotador quotes" ON public.cotador_quotes;
CREATE POLICY "Users can update cotador quotes"
  ON public.cotador_quotes
  FOR UPDATE
  TO authenticated
  USING (public.current_user_can_edit_cotador())
  WITH CHECK (public.current_user_can_edit_cotador());

DROP POLICY IF EXISTS "Users can delete cotador quotes" ON public.cotador_quotes;
CREATE POLICY "Users can delete cotador quotes"
  ON public.cotador_quotes
  FOR DELETE
  TO authenticated
  USING (public.current_user_can_edit_cotador());

DROP POLICY IF EXISTS "Users can view cotador quote beneficiaries" ON public.cotador_quote_beneficiaries;
CREATE POLICY "Users can view cotador quote beneficiaries"
  ON public.cotador_quote_beneficiaries
  FOR SELECT
  TO authenticated
  USING (public.current_user_can_view_cotador());

DROP POLICY IF EXISTS "Users can insert cotador quote beneficiaries" ON public.cotador_quote_beneficiaries;
CREATE POLICY "Users can insert cotador quote beneficiaries"
  ON public.cotador_quote_beneficiaries
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_can_edit_cotador());

DROP POLICY IF EXISTS "Users can update cotador quote beneficiaries" ON public.cotador_quote_beneficiaries;
CREATE POLICY "Users can update cotador quote beneficiaries"
  ON public.cotador_quote_beneficiaries
  FOR UPDATE
  TO authenticated
  USING (public.current_user_can_edit_cotador())
  WITH CHECK (public.current_user_can_edit_cotador());

DROP POLICY IF EXISTS "Users can delete cotador quote beneficiaries" ON public.cotador_quote_beneficiaries;
CREATE POLICY "Users can delete cotador quote beneficiaries"
  ON public.cotador_quote_beneficiaries
  FOR DELETE
  TO authenticated
  USING (public.current_user_can_edit_cotador());

DROP POLICY IF EXISTS "Users can view cotador quote items" ON public.cotador_quote_items;
CREATE POLICY "Users can view cotador quote items"
  ON public.cotador_quote_items
  FOR SELECT
  TO authenticated
  USING (public.current_user_can_view_cotador());

DROP POLICY IF EXISTS "Users can insert cotador quote items" ON public.cotador_quote_items;
CREATE POLICY "Users can insert cotador quote items"
  ON public.cotador_quote_items
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_can_edit_cotador());

DROP POLICY IF EXISTS "Users can update cotador quote items" ON public.cotador_quote_items;
CREATE POLICY "Users can update cotador quote items"
  ON public.cotador_quote_items
  FOR UPDATE
  TO authenticated
  USING (public.current_user_can_edit_cotador())
  WITH CHECK (public.current_user_can_edit_cotador());

DROP POLICY IF EXISTS "Users can delete cotador quote items" ON public.cotador_quote_items;
CREATE POLICY "Users can delete cotador quote items"
  ON public.cotador_quote_items
  FOR DELETE
  TO authenticated
  USING (public.current_user_can_edit_cotador());

INSERT INTO public.profile_permissions (role, module, can_view, can_edit)
VALUES
  ('admin', 'cotador', true, true),
  ('observer', 'cotador', false, false)
ON CONFLICT (role, module) DO UPDATE
SET
  can_view = EXCLUDED.can_view,
  can_edit = EXCLUDED.can_edit,
  updated_at = now();

INSERT INTO public.profile_permissions (role, module, can_view, can_edit)
SELECT ap.slug, 'cotador', false, false
FROM public.access_profiles ap
WHERE ap.slug NOT IN ('admin', 'observer')
ON CONFLICT (role, module) DO NOTHING;

COMMIT;
