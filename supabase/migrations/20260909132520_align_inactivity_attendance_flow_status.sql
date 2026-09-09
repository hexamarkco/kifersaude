/*
  Align the "Follow-up sem resposta - Em atendimento" flow with the actual
  lead status stored by the CRM. The flow already lists "Atendimento" in its
  trigger statuses, but its condition and exit condition still used the old
  "Em atendimento" label. The worker therefore rejected every lead after the
  inactivity cron selected it, before a job could be created.
*/

WITH updated_settings AS (
  SELECT
    settings.id,
    jsonb_set(
      settings.settings,
      '{flows}',
      (
        SELECT jsonb_agg(
          CASE WHEN flow.value->>'id' = 'flow-inatividade-em-atendimento' THEN
            jsonb_set(
              jsonb_set(
                flow.value,
                '{conditions}',
                (
                  SELECT jsonb_agg(
                    CASE
                      WHEN condition.value->>'id' = 'condition-inactivity-service-status'
                        AND condition.value->>'field' = 'status'
                      THEN jsonb_set(condition.value, '{value}', to_jsonb('Atendimento'::text))
                      ELSE condition.value
                    END
                    ORDER BY condition.ordinality
                  )
                  FROM jsonb_array_elements(COALESCE(flow.value->'conditions', '[]'::jsonb))
                    WITH ORDINALITY AS condition(value, ordinality)
                ),
                true
              ),
              '{exitConditions}',
              (
                SELECT jsonb_agg(
                  CASE
                    WHEN exit_condition.value->>'id' = 'exit-inactivity-service-status'
                      AND exit_condition.value->>'field' = 'status'
                    THEN jsonb_set(exit_condition.value, '{value}', to_jsonb('Atendimento'::text))
                    ELSE exit_condition.value
                  END
                  ORDER BY exit_condition.ordinality
                )
                FROM jsonb_array_elements(COALESCE(flow.value->'exitConditions', '[]'::jsonb))
                  WITH ORDINALITY AS exit_condition(value, ordinality)
              ),
              true
            )
          ELSE flow.value
          END
          ORDER BY flow.ordinality
        )
        FROM jsonb_array_elements(COALESCE(settings.settings->'flows', '[]'::jsonb))
          WITH ORDINALITY AS flow(value, ordinality)
      ),
      true
    ) AS next_settings
  FROM public.integration_settings AS settings
  WHERE settings.slug = 'whatsapp_auto_contact'
)
UPDATE public.integration_settings AS settings
SET settings = updated_settings.next_settings
FROM updated_settings
WHERE settings.id = updated_settings.id
  AND settings.settings IS DISTINCT FROM updated_settings.next_settings;
