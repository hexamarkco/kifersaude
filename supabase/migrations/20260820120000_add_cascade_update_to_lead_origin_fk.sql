-- Ensure lead origin updates propagate to existing leads
ALTER TABLE leads DROP CONSTRAINT IF EXISTS fk_leads_origem;
ALTER TABLE leads
  ADD CONSTRAINT fk_leads_origem
    FOREIGN KEY (origem) REFERENCES lead_origens(nome)
    ON UPDATE CASCADE;
