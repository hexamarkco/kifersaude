ALTER TABLE lead_origens
  ADD COLUMN IF NOT EXISTS visivel_para_observadores boolean DEFAULT true;

UPDATE lead_origens
SET visivel_para_observadores = true
WHERE visivel_para_observadores IS NULL;
