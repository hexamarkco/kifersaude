/*
  # Fix adjustment reminder scheduling

  - Allow scheduling even if reminder date is in the past
  - Backfill yearly adjustment reminders
*/

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
    IF candidate > contract_start AND candidate > reference_date THEN
      EXIT;
    END IF;

    candidate := (candidate + INTERVAL '1 year')::date;
  END LOOP;

  RETURN candidate;
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
  IF reminder_date::date < CURRENT_DATE THEN
    reminder_date := CURRENT_DATE + time '09:00';
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

CREATE OR REPLACE FUNCTION public.generate_adjustment_reminders_for_year(target_year int)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  adjustment_date date;
  reminder_date timestamptz;
  start_date date;
  contract_row contracts%ROWTYPE;
BEGIN
  IF target_year IS NULL THEN
    RETURN;
  END IF;

  FOR contract_row IN
    SELECT * FROM contracts
    WHERE mes_reajuste IS NOT NULL
      AND status NOT IN ('Cancelado', 'Encerrado')
  LOOP
    adjustment_date := make_date(target_year, contract_row.mes_reajuste, 1);
    start_date := COALESCE(contract_row.data_inicio, contract_row.created_at::date, CURRENT_DATE);

    IF adjustment_date <= start_date THEN
      CONTINUE;
    END IF;

    IF adjustment_date <= CURRENT_DATE THEN
      CONTINUE;
    END IF;

    reminder_date := (adjustment_date - INTERVAL '60 days')::date + time '09:00';
    IF reminder_date::date < CURRENT_DATE THEN
      reminder_date := CURRENT_DATE + time '09:00';
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
      ano
    )
    VALUES (
      contract_row.id,
      contract_row.lead_id,
      'Reajuste',
      'Reajuste anual ' || LPAD(contract_row.mes_reajuste::text, 2, '0') || '/' || target_year::text ||
        CASE WHEN contract_row.codigo_contrato IS NOT NULL THEN ' - ' || contract_row.codigo_contrato ELSE '' END,
      'Reajuste anual previsto para ' || TO_CHAR(adjustment_date, 'DD/MM/YYYY') || '.',
      reminder_date,
      false,
      'normal',
      target_year
    )
    ON CONFLICT (contract_id) WHERE tipo = 'Reajuste'
    DO UPDATE SET
      lead_id = EXCLUDED.lead_id,
      titulo = EXCLUDED.titulo,
      descricao = EXCLUDED.descricao,
      data_lembrete = EXCLUDED.data_lembrete,
      lido = false,
      ano = EXCLUDED.ano;
  END LOOP;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'generate-yearly-adjustments') THEN
    PERFORM cron.unschedule('generate-yearly-adjustments');
  END IF;

  PERFORM cron.schedule(
    'generate-yearly-adjustments',
    '5 0 1 1 *',
    'select public.generate_adjustment_reminders_for_year(extract(year from now())::int);'
  );
END $$;

SELECT public.generate_adjustment_reminders_for_year(EXTRACT(YEAR FROM CURRENT_DATE)::int);
