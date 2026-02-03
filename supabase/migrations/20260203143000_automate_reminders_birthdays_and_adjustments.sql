/*
  # Automate reminders for birthdays and contract adjustments

  - Adds person tracking fields to reminders
  - Schedules annual birthday reminders (01/01 job)
  - Syncs birthdays on holder/dependent changes
  - Syncs adjustment reminders on contract changes
*/

ALTER TABLE reminders
  ADD COLUMN IF NOT EXISTS pessoa_tipo text,
  ADD COLUMN IF NOT EXISTS pessoa_id uuid,
  ADD COLUMN IF NOT EXISTS pessoa_chave text,
  ADD COLUMN IF NOT EXISTS ano integer;

CREATE UNIQUE INDEX IF NOT EXISTS idx_reminders_aniversario_unique
  ON reminders (pessoa_tipo, pessoa_chave, ano)
  WHERE tipo = 'Aniversário';

WITH ranked_reajustes AS (
  SELECT
    id,
    contract_id,
    ROW_NUMBER() OVER (
      PARTITION BY contract_id
      ORDER BY data_lembrete DESC NULLS LAST, created_at DESC NULLS LAST
    ) AS row_num
  FROM reminders
  WHERE tipo = 'Reajuste' AND contract_id IS NOT NULL
)
DELETE FROM reminders
WHERE id IN (
  SELECT id FROM ranked_reajustes WHERE row_num > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reminders_reajuste_unique
  ON reminders (contract_id)
  WHERE tipo = 'Reajuste';

CREATE OR REPLACE FUNCTION public.normalize_cpf(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(regexp_replace(coalesce(value, ''), '\D', '', 'g'), '')
$$;

CREATE OR REPLACE FUNCTION public.normalize_person_name(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(trim(regexp_replace(lower(coalesce(value, '')), '\s+', ' ', 'g')), '')
$$;

CREATE OR REPLACE FUNCTION public.is_leap_year(year_value int)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (year_value % 400 = 0) OR (year_value % 4 = 0 AND year_value % 100 <> 0)
$$;

CREATE OR REPLACE FUNCTION public.safe_make_date(year_value int, month_value int, day_value int)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF month_value = 2 AND day_value = 29 AND NOT public.is_leap_year(year_value) THEN
    RETURN make_date(year_value, 2, 28);
  END IF;

  RETURN make_date(year_value, month_value, day_value);
END;
$$;

CREATE OR REPLACE FUNCTION public.build_holder_pessoa_chave(cpf_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN public.normalize_cpf(cpf_value) IS NULL THEN NULL
    ELSE 'cpf:' || public.normalize_cpf(cpf_value)
  END
$$;

CREATE OR REPLACE FUNCTION public.build_dependent_pessoa_chave(
  cpf_value text,
  name_value text,
  birth_value date
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN public.normalize_cpf(cpf_value) IS NOT NULL THEN 'cpf:' || public.normalize_cpf(cpf_value)
    WHEN public.normalize_person_name(name_value) IS NOT NULL AND birth_value IS NOT NULL THEN
      'nome:' || public.normalize_person_name(name_value) || '|nasc:' || birth_value::text
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION public.compute_next_adjustment_date(
  reajuste_month int,
  contract_start date,
  reference_date date
)
RETURNS date
LANGUAGE plpgsql
AS $$
DECLARE
  candidate date;
BEGIN
  IF reajuste_month IS NULL OR reajuste_month < 1 OR reajuste_month > 12 THEN
    RETURN NULL;
  END IF;

  candidate := make_date(EXTRACT(YEAR FROM reference_date)::int, reajuste_month, 1);

  LOOP
    IF candidate > contract_start
      AND candidate > reference_date
      AND (candidate - INTERVAL '60 days')::date > reference_date THEN
      EXIT;
    END IF;

    candidate := (candidate + INTERVAL '1 year')::date;
  END LOOP;

  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_birthdays_for_year(target_year int)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF target_year IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO reminders (
    contract_id,
    lead_id,
    tipo,
    titulo,
    descricao,
    data_lembrete,
    lido,
    prioridade,
    pessoa_tipo,
    pessoa_id,
    pessoa_chave,
    ano
  )
  SELECT
    latest_contract.contract_id,
    latest_contract.lead_id,
    'Aniversário',
    'Aniversário de ' || holder.nome_completo,
    'Enviar parabéns ao titular ' || holder.nome_completo || '.',
    (public.safe_make_date(target_year, EXTRACT(MONTH FROM holder.data_nascimento)::int, EXTRACT(DAY FROM holder.data_nascimento)::int)
      + time '09:00')::timestamptz,
    false,
    'normal',
    'titular',
    holder.id,
    public.build_holder_pessoa_chave(holder.cpf),
    target_year
  FROM contract_holders holder
  LEFT JOIN LATERAL (
    SELECT c.id AS contract_id, c.lead_id
    FROM contract_holders h2
    JOIN contracts c ON c.id = h2.contract_id
    WHERE public.normalize_cpf(h2.cpf) = public.normalize_cpf(holder.cpf)
    ORDER BY c.created_at DESC NULLS LAST, h2.created_at DESC NULLS LAST
    LIMIT 1
  ) AS latest_contract ON true
  WHERE holder.data_nascimento IS NOT NULL
    AND public.build_holder_pessoa_chave(holder.cpf) IS NOT NULL
  ON CONFLICT (pessoa_tipo, pessoa_chave, ano) WHERE tipo = 'Aniversário'
  DO UPDATE SET
    contract_id = EXCLUDED.contract_id,
    lead_id = EXCLUDED.lead_id,
    titulo = EXCLUDED.titulo,
    descricao = EXCLUDED.descricao,
    data_lembrete = EXCLUDED.data_lembrete,
    pessoa_id = EXCLUDED.pessoa_id;

  INSERT INTO reminders (
    contract_id,
    lead_id,
    tipo,
    titulo,
    descricao,
    data_lembrete,
    lido,
    prioridade,
    pessoa_tipo,
    pessoa_id,
    pessoa_chave,
    ano
  )
  SELECT
    latest_contract.contract_id,
    latest_contract.lead_id,
    'Aniversário',
    'Aniversário de ' || dependent.nome_completo,
    'Enviar parabéns ao dependente ' || dependent.nome_completo ||
      CASE
        WHEN holder.nome_completo IS NOT NULL THEN ' (titular: ' || holder.nome_completo || ').'
        ELSE '.'
      END,
    (public.safe_make_date(target_year, EXTRACT(MONTH FROM dependent.data_nascimento)::int, EXTRACT(DAY FROM dependent.data_nascimento)::int)
      + time '09:00')::timestamptz,
    false,
    'normal',
    'dependente',
    dependent.id,
    public.build_dependent_pessoa_chave(dependent.cpf, dependent.nome_completo, dependent.data_nascimento),
    target_year
  FROM dependents dependent
  LEFT JOIN contract_holders holder ON holder.id = dependent.holder_id
  LEFT JOIN LATERAL (
    SELECT c.id AS contract_id, c.lead_id
    FROM dependents d2
    JOIN contracts c ON c.id = d2.contract_id
    WHERE public.build_dependent_pessoa_chave(d2.cpf, d2.nome_completo, d2.data_nascimento)
      = public.build_dependent_pessoa_chave(dependent.cpf, dependent.nome_completo, dependent.data_nascimento)
    ORDER BY c.created_at DESC NULLS LAST, d2.created_at DESC NULLS LAST
    LIMIT 1
  ) AS latest_contract ON true
  WHERE dependent.data_nascimento IS NOT NULL
    AND public.build_dependent_pessoa_chave(dependent.cpf, dependent.nome_completo, dependent.data_nascimento) IS NOT NULL
  ON CONFLICT (pessoa_tipo, pessoa_chave, ano) WHERE tipo = 'Aniversário'
  DO UPDATE SET
    contract_id = EXCLUDED.contract_id,
    lead_id = EXCLUDED.lead_id,
    titulo = EXCLUDED.titulo,
    descricao = EXCLUDED.descricao,
    data_lembrete = EXCLUDED.data_lembrete,
    pessoa_id = EXCLUDED.pessoa_id;

  DELETE FROM reminders r
  WHERE r.tipo = 'Aniversário'
    AND r.ano = target_year
    AND r.pessoa_tipo = 'titular'
    AND NOT EXISTS (
      SELECT 1
      FROM contract_holders h
      WHERE public.build_holder_pessoa_chave(h.cpf) = r.pessoa_chave
    );

  DELETE FROM reminders r
  WHERE r.tipo = 'Aniversário'
    AND r.ano = target_year
    AND r.pessoa_tipo = 'dependente'
    AND NOT EXISTS (
      SELECT 1
      FROM dependents d
      WHERE public.build_dependent_pessoa_chave(d.cpf, d.nome_completo, d.data_nascimento) = r.pessoa_chave
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_birthday_holder()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  current_year int := EXTRACT(YEAR FROM CURRENT_DATE)::int;
  old_key text;
  new_key text;
  latest_contract_id uuid;
  latest_lead_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    old_key := public.build_holder_pessoa_chave(OLD.cpf);
    IF old_key IS NOT NULL THEN
      DELETE FROM reminders
      WHERE tipo = 'Aniversário'
        AND pessoa_tipo = 'titular'
        AND pessoa_chave = old_key
        AND ano = current_year;
    END IF;
    RETURN OLD;
  END IF;

  new_key := public.build_holder_pessoa_chave(NEW.cpf);
  old_key := public.build_holder_pessoa_chave(COALESCE(OLD.cpf, NEW.cpf));

  IF new_key IS NULL OR NEW.data_nascimento IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND old_key IS NOT NULL AND old_key <> new_key THEN
    DELETE FROM reminders
    WHERE tipo = 'Aniversário'
      AND pessoa_tipo = 'titular'
      AND pessoa_chave = old_key
      AND ano = current_year;
  END IF;

  SELECT c.id, c.lead_id
  INTO latest_contract_id, latest_lead_id
  FROM contract_holders h2
  JOIN contracts c ON c.id = h2.contract_id
  WHERE public.normalize_cpf(h2.cpf) = public.normalize_cpf(NEW.cpf)
  ORDER BY c.created_at DESC NULLS LAST, h2.created_at DESC NULLS LAST
  LIMIT 1;

  INSERT INTO reminders (
    contract_id,
    lead_id,
    tipo,
    titulo,
    descricao,
    data_lembrete,
    lido,
    prioridade,
    pessoa_tipo,
    pessoa_id,
    pessoa_chave,
    ano
  )
  VALUES (
    latest_contract_id,
    latest_lead_id,
    'Aniversário',
    'Aniversário de ' || NEW.nome_completo,
    'Enviar parabéns ao titular ' || NEW.nome_completo || '.',
    (public.safe_make_date(current_year, EXTRACT(MONTH FROM NEW.data_nascimento)::int, EXTRACT(DAY FROM NEW.data_nascimento)::int)
      + time '09:00')::timestamptz,
    false,
    'normal',
    'titular',
    NEW.id,
    new_key,
    current_year
  )
  ON CONFLICT (pessoa_tipo, pessoa_chave, ano) WHERE tipo = 'Aniversário'
  DO UPDATE SET
    contract_id = EXCLUDED.contract_id,
    lead_id = EXCLUDED.lead_id,
    titulo = EXCLUDED.titulo,
    descricao = EXCLUDED.descricao,
    data_lembrete = EXCLUDED.data_lembrete,
    pessoa_id = EXCLUDED.pessoa_id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_birthday_dependent()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  current_year int := EXTRACT(YEAR FROM CURRENT_DATE)::int;
  old_key text;
  new_key text;
  latest_contract_id uuid;
  latest_lead_id uuid;
  holder_name text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    old_key := public.build_dependent_pessoa_chave(OLD.cpf, OLD.nome_completo, OLD.data_nascimento);
    IF old_key IS NOT NULL THEN
      DELETE FROM reminders
      WHERE tipo = 'Aniversário'
        AND pessoa_tipo = 'dependente'
        AND pessoa_chave = old_key
        AND ano = current_year;
    END IF;
    RETURN OLD;
  END IF;

  new_key := public.build_dependent_pessoa_chave(NEW.cpf, NEW.nome_completo, NEW.data_nascimento);
  old_key := public.build_dependent_pessoa_chave(COALESCE(OLD.cpf, NEW.cpf), COALESCE(OLD.nome_completo, NEW.nome_completo), COALESCE(OLD.data_nascimento, NEW.data_nascimento));

  IF new_key IS NULL OR NEW.data_nascimento IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND old_key IS NOT NULL AND old_key <> new_key THEN
    DELETE FROM reminders
    WHERE tipo = 'Aniversário'
      AND pessoa_tipo = 'dependente'
      AND pessoa_chave = old_key
      AND ano = current_year;
  END IF;

  SELECT c.id, c.lead_id
  INTO latest_contract_id, latest_lead_id
  FROM dependents d2
  JOIN contracts c ON c.id = d2.contract_id
  WHERE public.build_dependent_pessoa_chave(d2.cpf, d2.nome_completo, d2.data_nascimento) = new_key
  ORDER BY c.created_at DESC NULLS LAST, d2.created_at DESC NULLS LAST
  LIMIT 1;

  SELECT nome_completo
  INTO holder_name
  FROM contract_holders
  WHERE id = NEW.holder_id;

  INSERT INTO reminders (
    contract_id,
    lead_id,
    tipo,
    titulo,
    descricao,
    data_lembrete,
    lido,
    prioridade,
    pessoa_tipo,
    pessoa_id,
    pessoa_chave,
    ano
  )
  VALUES (
    latest_contract_id,
    latest_lead_id,
    'Aniversário',
    'Aniversário de ' || NEW.nome_completo,
    'Enviar parabéns ao dependente ' || NEW.nome_completo ||
      CASE WHEN holder_name IS NOT NULL THEN ' (titular: ' || holder_name || ').' ELSE '.' END,
    (public.safe_make_date(current_year, EXTRACT(MONTH FROM NEW.data_nascimento)::int, EXTRACT(DAY FROM NEW.data_nascimento)::int)
      + time '09:00')::timestamptz,
    false,
    'normal',
    'dependente',
    NEW.id,
    new_key,
    current_year
  )
  ON CONFLICT (pessoa_tipo, pessoa_chave, ano) WHERE tipo = 'Aniversário'
  DO UPDATE SET
    contract_id = EXCLUDED.contract_id,
    lead_id = EXCLUDED.lead_id,
    titulo = EXCLUDED.titulo,
    descricao = EXCLUDED.descricao,
    data_lembrete = EXCLUDED.data_lembrete,
    pessoa_id = EXCLUDED.pessoa_id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_contract_adjustment_reminder()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  start_date date;
  adjustment_date date;
  reminder_date timestamptz;
BEGIN
  IF NEW.mes_reajuste IS NULL THEN
    DELETE FROM reminders WHERE tipo = 'Reajuste' AND contract_id = NEW.id;
    RETURN NEW;
  END IF;

  IF NEW.status IN ('Cancelado', 'Encerrado') THEN
    DELETE FROM reminders WHERE tipo = 'Reajuste' AND contract_id = NEW.id;
    RETURN NEW;
  END IF;

  start_date := COALESCE(NEW.data_inicio, NEW.created_at::date, CURRENT_DATE);
  adjustment_date := public.compute_next_adjustment_date(NEW.mes_reajuste, start_date, CURRENT_DATE);

  IF adjustment_date IS NULL THEN
    DELETE FROM reminders WHERE tipo = 'Reajuste' AND contract_id = NEW.id;
    RETURN NEW;
  END IF;

  reminder_date := (adjustment_date - INTERVAL '60 days')::date + time '09:00';

  INSERT INTO reminders (
    contract_id,
    lead_id,
    tipo,
    titulo,
    descricao,
    data_lembrete,
    lido,
    prioridade,
    ano
  )
  VALUES (
    NEW.id,
    NEW.lead_id,
    'Reajuste',
    'Reajuste anual ' || LPAD(NEW.mes_reajuste::text, 2, '0') || '/' || EXTRACT(YEAR FROM adjustment_date)::text ||
      CASE WHEN NEW.codigo_contrato IS NOT NULL THEN ' - ' || NEW.codigo_contrato ELSE '' END,
    'Reajuste anual previsto para ' || TO_CHAR(adjustment_date, 'DD/MM/YYYY') || '.',
    reminder_date,
    false,
    'normal',
    EXTRACT(YEAR FROM adjustment_date)::int
  )
  ON CONFLICT (contract_id) WHERE tipo = 'Reajuste'
  DO UPDATE SET
    lead_id = EXCLUDED.lead_id,
    titulo = EXCLUDED.titulo,
    descricao = EXCLUDED.descricao,
    data_lembrete = EXCLUDED.data_lembrete,
    lido = false,
    ano = EXCLUDED.ano;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_birthday_holder ON contract_holders;
CREATE TRIGGER trg_sync_birthday_holder
AFTER INSERT OR UPDATE OF data_nascimento, cpf, nome_completo ON contract_holders
FOR EACH ROW
EXECUTE FUNCTION public.sync_birthday_holder();

DROP TRIGGER IF EXISTS trg_sync_birthday_holder_delete ON contract_holders;
CREATE TRIGGER trg_sync_birthday_holder_delete
AFTER DELETE ON contract_holders
FOR EACH ROW
EXECUTE FUNCTION public.sync_birthday_holder();

DROP TRIGGER IF EXISTS trg_sync_birthday_dependent ON dependents;
CREATE TRIGGER trg_sync_birthday_dependent
AFTER INSERT OR UPDATE OF data_nascimento, cpf, nome_completo ON dependents
FOR EACH ROW
EXECUTE FUNCTION public.sync_birthday_dependent();

DROP TRIGGER IF EXISTS trg_sync_birthday_dependent_delete ON dependents;
CREATE TRIGGER trg_sync_birthday_dependent_delete
AFTER DELETE ON dependents
FOR EACH ROW
EXECUTE FUNCTION public.sync_birthday_dependent();

DROP TRIGGER IF EXISTS trg_sync_contract_adjustment_reminder ON contracts;
CREATE TRIGGER trg_sync_contract_adjustment_reminder
AFTER INSERT OR UPDATE OF mes_reajuste, data_inicio, status ON contracts
FOR EACH ROW
EXECUTE FUNCTION public.sync_contract_adjustment_reminder();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'generate-yearly-birthdays') THEN
    PERFORM cron.unschedule('generate-yearly-birthdays');
  END IF;

  PERFORM cron.schedule(
    'generate-yearly-birthdays',
    '5 0 1 1 *',
    'select public.generate_birthdays_for_year(extract(year from now())::int);'
  );
END;
$$;

SELECT public.generate_birthdays_for_year(EXTRACT(YEAR FROM CURRENT_DATE)::int);
