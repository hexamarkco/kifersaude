-- Manual, read-only queries. Do not install a cron or query customer message content.
-- Qualification quality: one decision per logical turn, never per model attempt.
WITH turns AS (
  SELECT DISTINCT ON (correlation_id) correlation_id, decision, created_at
  FROM public.ai_autonomous_attendance_events
  WHERE event_type = 'v2_decision' AND created_at > now() - interval '24 hours'
  ORDER BY correlation_id, created_at DESC
)
SELECT decision->>'intent' AS intent, decision->>'action' AS action, decision->>'reason' AS reason,
  decision->>'configVersion' AS config_version, count(*) AS turns,
  count(*) FILTER (WHERE decision->>'handoffCode' = 'QUALIFICACAO_COMPLETA'
    AND decision->'missing' <> '[]'::jsonb) AS invalid_completions
FROM turns GROUP BY 1,2,3,4 ORDER BY turns DESC;

-- Technical quality: aggregate generation and provider acceptance separately.
SELECT event_type, count(*) AS events,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY (metadata->>'generationDurationMs')::numeric)
    FILTER (WHERE metadata ? 'generationDurationMs') AS generation_p95_ms,
  sum((metadata->>'estimatedCostUsd')::numeric) FILTER (WHERE metadata ? 'estimatedCostUsd') AS estimated_cost_usd
FROM public.ai_autonomous_attendance_events
WHERE created_at > now() - interval '24 hours'
  AND event_type IN ('reply_generated','reply_sent','reply_cancelled','v2_processing_failed')
GROUP BY event_type;

-- Failures by stage, without copying personal information into logs.
SELECT decision->>'stage' AS stage, decision->>'reason' AS reason, count(*) AS failures
FROM public.ai_autonomous_attendance_events
WHERE event_type = 'v2_processing_failed' AND created_at > now() - interval '24 hours'
GROUP BY 1,2;

-- Current-state invariant, independent of the model's tag or recorded missing list.
SELECT count(*) AS snapshots_marked_complete_but_invalid
FROM public.ai_autonomous_qualification_states
WHERE state->'v2Decision'->>'handoffCode' = 'QUALIFICACAO_COMPLETA'
  AND NOT public.ai_autonomous_qualification_can_complete(state);

-- Commercial outcomes must be assessed separately using actual proposals/contracts.
-- A completed qualification or accepted WhatsApp send is not a sale.
