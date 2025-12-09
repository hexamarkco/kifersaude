/*
  # Restaura coluna status na tabela leads

  1. Mudanças
    - Adiciona coluna 'status' (text) na tabela leads se não existir
    - Popula a coluna 'status' com os nomes dos status baseado em status_id
    - Cria trigger para manter status sincronizado com status_id

  2. Detalhes
    - A coluna status_id continuará existindo para relacionamento FK
    - A coluna status conterá o nome do status para compatibilidade
    - Trigger garante que ambas colunas fiquem sincronizadas

  3. Notas
    - Esta migração mantém compatibilidade com código existente
    - Permite que o sistema funcione com ambos status (text) e status_id (uuid)
*/

-- Adiciona coluna status se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leads' AND column_name = 'status'
  ) THEN
    ALTER TABLE leads ADD COLUMN status text;
    RAISE NOTICE 'Coluna status adicionada à tabela leads.';
  END IF;
END $$;

-- Popula status com base em status_id
UPDATE leads l
SET status = ls.nome
FROM lead_status_config ls
WHERE l.status_id = ls.id
AND l.status IS NULL;

-- Define status padrão para leads sem status
UPDATE leads
SET status = 'Novo'
WHERE status IS NULL;

-- Torna status NOT NULL após popular
DO $$
BEGIN
  ALTER TABLE leads ALTER COLUMN status SET NOT NULL;
  ALTER TABLE leads ALTER COLUMN status SET DEFAULT 'Novo';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Erro ao configurar coluna status: %', SQLERRM;
END $$;

-- Função para sincronizar status com status_id ao inserir/atualizar
CREATE OR REPLACE FUNCTION sync_lead_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Se status_id foi definido, sincroniza status
  IF NEW.status_id IS NOT NULL THEN
    SELECT nome INTO NEW.status
    FROM lead_status_config
    WHERE id = NEW.status_id;
  END IF;
  
  -- Se status foi definido mas status_id não, tenta encontrar status_id
  IF NEW.status IS NOT NULL AND NEW.status_id IS NULL THEN
    SELECT id INTO NEW.status_id
    FROM lead_status_config
    WHERE nome = NEW.status
    LIMIT 1;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para sincronizar antes de insert/update
DROP TRIGGER IF EXISTS trg_sync_lead_status ON leads;
CREATE TRIGGER trg_sync_lead_status
  BEFORE INSERT OR UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION sync_lead_status();