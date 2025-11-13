/*
  # Migrate legacy system configuration arrays

  ## Summary
  - Expand legacy config_key/config_value arrays into normalized option rows
  - Map legacy contract and lead settings to the new category-based structure
  - Optionally remove legacy array-based rows to avoid duplication
*/

DO $$
DECLARE
  has_table boolean;
  has_category boolean;
  has_label boolean;
  has_value boolean;
  has_ordem boolean;
  has_ativo boolean;
  has_config_key boolean;
  has_config_value boolean;
  err_msg text;
  legacy record;
  legacy_keys CONSTANT text[] := ARRAY[
    'contract_types',
    'responsible_users',
    'contract_statuses',
    'contract_modalities',
    'contract_coverages',
    'contract_accommodations',
    'contract_waiting_periods'
  ];
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'system_configurations'
  )
  INTO has_table;

  IF NOT has_table THEN
    RAISE NOTICE 'system_configurations table not found, skipping migration.';
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'system_configurations'
      AND column_name = 'category'
  )
  INTO has_category;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'system_configurations'
      AND column_name = 'label'
  )
  INTO has_label;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'system_configurations'
      AND column_name = 'value'
  )
  INTO has_value;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'system_configurations'
      AND column_name = 'ordem'
  )
  INTO has_ordem;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'system_configurations'
      AND column_name = 'ativo'
  )
  INTO has_ativo;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'system_configurations'
      AND column_name = 'config_key'
  )
  INTO has_config_key;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'system_configurations'
      AND column_name = 'config_value'
  )
  INTO has_config_value;

  IF NOT has_config_key OR NOT has_config_value THEN
    RAISE NOTICE 'Legacy config_key/config_value columns missing, skipping migration.';
    RETURN;
  END IF;

  IF NOT has_category OR NOT has_label OR NOT has_value THEN
    RAISE NOTICE 'Normalized columns missing, skipping migration.';
    RETURN;
  END IF;

  IF NOT has_ordem THEN
    RAISE NOTICE 'ordem column missing, skipping migration.';
    RETURN;
  END IF;

  IF NOT has_ativo THEN
    RAISE NOTICE 'ativo column missing, skipping migration.';
    RETURN;
  END IF;

  FOR legacy IN
    SELECT *
    FROM (VALUES
      ('contract_types', 'lead_tipo_contratacao'),
      ('responsible_users', 'lead_responsavel'),
      ('contract_statuses', 'contract_status'),
      ('contract_modalities', 'contract_modalidade'),
      ('contract_coverages', 'contract_abrangencia'),
      ('contract_accommodations', 'contract_acomodacao'),
      ('contract_waiting_periods', 'contract_carencia')
    ) AS mapping(legacy_key, new_category)
  LOOP
    PERFORM 1
    FROM system_configurations
    WHERE config_key = legacy.legacy_key
      AND config_value IS NOT NULL
      AND btrim(config_value::text) <> '';

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    BEGIN
      EXECUTE format($sql$
        WITH legacy_rows AS (
          SELECT
            btrim(arr.item) AS item,
            arr.position::integer AS position
          FROM system_configurations sc,
          LATERAL jsonb_array_elements_text(sc.config_value::jsonb) WITH ORDINALITY AS arr(item, position)
          WHERE sc.config_key = %L
        ),
        filtered AS (
          SELECT item, position
          FROM legacy_rows
          WHERE item IS NOT NULL AND item <> ''
        ),
        max_ordem AS (
          SELECT COALESCE(MAX(ordem), 0) AS max_ordem
          FROM system_configurations
          WHERE category = %L
        )
        INSERT INTO system_configurations (category, label, value, ordem, ativo)
        SELECT
          %L,
          filtered.item,
          filtered.item,
          max_ordem.max_ordem + filtered.position,
          true
        FROM filtered
        CROSS JOIN max_ordem
        ORDER BY filtered.position
        ON CONFLICT (category, label) DO UPDATE
          SET value = EXCLUDED.value,
              ordem = EXCLUDED.ordem,
              ativo = true;
      $sql$, legacy.legacy_key, legacy.new_category, legacy.new_category);
    EXCEPTION
      WHEN others THEN
        GET STACKED DIAGNOSTICS err_msg = MESSAGE_TEXT;
        RAISE NOTICE 'Skipping legacy key % due to error: %', legacy.legacy_key, err_msg;
    END;
  END LOOP;

  BEGIN
    EXECUTE '
      DELETE FROM system_configurations
      WHERE config_key = ANY($1)
        AND config_value IS NOT NULL
        AND btrim(config_value::text) <> ''''
        AND jsonb_typeof(config_value::jsonb) = ''array'';
    ' USING legacy_keys;
  EXCEPTION
    WHEN undefined_column THEN
      RAISE NOTICE 'Legacy cleanup skipped because required columns are missing.';
    WHEN others THEN
      GET STACKED DIAGNOSTICS err_msg = MESSAGE_TEXT;
      RAISE NOTICE 'Legacy cleanup skipped due to error: %', err_msg;
  END;
END $$;
