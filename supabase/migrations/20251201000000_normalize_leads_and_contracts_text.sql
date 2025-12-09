-- Ensure consistent capitalization across lead and contract data
CREATE OR REPLACE FUNCTION public.normalize_sentence_case(value text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  cleaned text;
BEGIN
  IF value IS NULL THEN
    RETURN NULL;
  END IF;

  cleaned := regexp_replace(trim(value), '\\s+', ' ', 'g');
  IF cleaned = '' THEN
    RETURN NULL;
  END IF;

  cleaned := lower(cleaned);
  RETURN upper(left(cleaned, 1)) || substring(cleaned FROM 2);
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_title_case(value text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  cleaned text;
BEGIN
  IF value IS NULL THEN
    RETURN NULL;
  END IF;

  cleaned := regexp_replace(trim(value), '\\s+', ' ', 'g');
  IF cleaned = '' THEN
    RETURN NULL;
  END IF;

  RETURN initcap(lower(cleaned));
END;
$$;

-- Normalize lead text fields before saving
CREATE OR REPLACE FUNCTION public.normalize_leads_text_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.nome_completo := public.normalize_title_case(NEW.nome_completo);
  NEW.cidade := public.normalize_title_case(NEW.cidade);
  NEW.regiao := public.normalize_title_case(NEW.regiao);
  NEW.origem := public.normalize_sentence_case(NEW.origem);
  NEW.tipo_contratacao := public.normalize_sentence_case(NEW.tipo_contratacao);
  NEW.operadora_atual := public.normalize_sentence_case(NEW.operadora_atual);
  NEW.status := public.normalize_sentence_case(NEW.status);
  NEW.responsavel := public.normalize_title_case(NEW.responsavel);
  NEW.endereco := public.normalize_title_case(NEW.endereco);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_leads_text_fields ON leads;
CREATE TRIGGER trg_normalize_leads_text_fields
BEFORE INSERT OR UPDATE ON leads
FOR EACH ROW
EXECUTE FUNCTION public.normalize_leads_text_fields();

-- Normalize contract text fields before saving
CREATE OR REPLACE FUNCTION public.normalize_contracts_text_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.status := public.normalize_sentence_case(NEW.status);
  NEW.modalidade := public.normalize_sentence_case(NEW.modalidade);
  NEW.operadora := public.normalize_sentence_case(NEW.operadora);
  NEW.produto_plano := public.normalize_sentence_case(NEW.produto_plano);
  NEW.abrangencia := public.normalize_sentence_case(NEW.abrangencia);
  NEW.acomodacao := public.normalize_sentence_case(NEW.acomodacao);
  NEW.carencia := public.normalize_sentence_case(NEW.carencia);
  NEW.responsavel := public.normalize_title_case(NEW.responsavel);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_contracts_text_fields ON contracts;
CREATE TRIGGER trg_normalize_contracts_text_fields
BEFORE INSERT OR UPDATE ON contracts
FOR EACH ROW
EXECUTE FUNCTION public.normalize_contracts_text_fields();

-- Normalize holder text fields before saving
CREATE OR REPLACE FUNCTION public.normalize_contract_holders_text_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.nome_completo := public.normalize_title_case(NEW.nome_completo);
  NEW.cidade := public.normalize_title_case(NEW.cidade);
  NEW.estado := public.normalize_sentence_case(NEW.estado);
  NEW.endereco := public.normalize_title_case(NEW.endereco);
  NEW.bairro := public.normalize_title_case(NEW.bairro);
  NEW.complemento := public.normalize_sentence_case(NEW.complemento);
  NEW.razao_social := public.normalize_title_case(NEW.razao_social);
  NEW.nome_fantasia := public.normalize_title_case(NEW.nome_fantasia);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_contract_holders_text_fields ON contract_holders;
CREATE TRIGGER trg_normalize_contract_holders_text_fields
BEFORE INSERT OR UPDATE ON contract_holders
FOR EACH ROW
EXECUTE FUNCTION public.normalize_contract_holders_text_fields();

-- Normalize dependent text fields before saving
CREATE OR REPLACE FUNCTION public.normalize_dependents_text_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.nome_completo := public.normalize_title_case(NEW.nome_completo);
  NEW.relacao := public.normalize_sentence_case(NEW.relacao);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_dependents_text_fields ON dependents;
CREATE TRIGGER trg_normalize_dependents_text_fields
BEFORE INSERT OR UPDATE ON dependents
FOR EACH ROW
EXECUTE FUNCTION public.normalize_dependents_text_fields();

-- Normalize existing data
UPDATE leads
SET
  nome_completo = public.normalize_title_case(nome_completo),
  cidade = public.normalize_title_case(cidade),
  regiao = public.normalize_title_case(regiao),
  origem = public.normalize_sentence_case(origem),
  tipo_contratacao = public.normalize_sentence_case(tipo_contratacao),
  operadora_atual = public.normalize_sentence_case(operadora_atual),
  status = public.normalize_sentence_case(status),
  responsavel = public.normalize_title_case(responsavel),
  endereco = public.normalize_title_case(endereco);

UPDATE contracts
SET
  status = public.normalize_sentence_case(status),
  modalidade = public.normalize_sentence_case(modalidade),
  operadora = public.normalize_sentence_case(operadora),
  produto_plano = public.normalize_sentence_case(produto_plano),
  abrangencia = public.normalize_sentence_case(abrangencia),
  acomodacao = public.normalize_sentence_case(acomodacao),
  carencia = public.normalize_sentence_case(carencia),
  responsavel = public.normalize_title_case(responsavel);

UPDATE contract_holders
SET
  nome_completo = public.normalize_title_case(nome_completo),
  cidade = public.normalize_title_case(cidade),
  estado = public.normalize_sentence_case(estado),
  endereco = public.normalize_title_case(endereco),
  bairro = public.normalize_title_case(bairro),
  complemento = public.normalize_sentence_case(complemento),
  razao_social = public.normalize_title_case(razao_social),
  nome_fantasia = public.normalize_title_case(nome_fantasia);

UPDATE dependents
SET
  nome_completo = public.normalize_title_case(nome_completo),
  relacao = public.normalize_sentence_case(relacao);
