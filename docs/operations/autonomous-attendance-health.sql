-- Manual, read-only inspection after the reviewed migration. No scheduling or sends.
-- Internal IDs allow an operator to inspect the conversation without exporting PII.
SELECT c.id AS chat_id, inbound.created_at AS inbound_received_at,
  floor(extract(epoch FROM now() - inbound.created_at)) AS waiting_seconds,
  pending.status AS latest_job_status, pending.attempts,
  EXISTS (SELECT 1 FROM public.ai_autonomous_reply_delivery_keys d
    WHERE d.chat_id = c.id AND d.status IN ('reserved', 'unknown')) AS delivery_requires_review
FROM public.comm_whatsapp_chats c
JOIN public.comm_whatsapp_messages inbound ON inbound.id = public.latest_ai_autonomous_inbound(c.id)
LEFT JOIN LATERAL (
  SELECT j.status, j.attempts FROM public.ai_autonomous_reply_jobs j
  WHERE j.chat_id = c.id ORDER BY j.created_at DESC, j.id DESC LIMIT 1
) pending ON true
WHERE c.autonomous_attendance_status = 'active' AND c.deleted_at IS NULL
  AND inbound.created_at < now() - interval '2 minutes'
  AND NOT EXISTS (SELECT 1 FROM public.comm_whatsapp_messages outbound
    WHERE outbound.chat_id = c.id AND outbound.direction = 'outbound'
      AND outbound.delivery_status <> 'failed' AND outbound.created_at > inbound.created_at)
ORDER BY inbound.created_at;

SELECT count(*) AS calls, count(*) FILTER (WHERE success) AS successful_calls,
  percentile_cont(0.50) WITHIN GROUP (ORDER BY total_duration_ms) AS generation_p50_ms,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY total_duration_ms) AS generation_p95_ms,
  sum(retry_count) AS retries, sum(total_estimated_cost_usd) AS estimated_cost_usd,
  count(*) FILTER (WHERE stop_reason = 'timeout') AS timeouts
FROM public.ai_call_logs
WHERE feature_key = 'autonomous.reply' AND created_at > now() - interval '24 hours';

SELECT event_type, count(*) AS events
FROM public.ai_autonomous_attendance_events
WHERE created_at > now() - interval '24 hours'
GROUP BY event_type ORDER BY event_type;

-- Whapi acceptance (reply_sent) is distinct from delivered/read confirmation.
SELECT delivery_status, count(*) AS messages
FROM public.comm_whatsapp_messages
WHERE direction = 'outbound' AND metadata->>'provider' = 'ai_autonomous'
  AND created_at > now() - interval '24 hours'
GROUP BY delivery_status;

SELECT percentile_cont(0.50) WITHIN GROUP (ORDER BY (metadata->>'totalDurationMs')::double precision) AS worker_to_send_p50_ms,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY (metadata->>'totalDurationMs')::double precision) AS worker_to_send_p95_ms
FROM public.ai_autonomous_attendance_events
WHERE event_type = 'reply_sent' AND created_at > now() - interval '24 hours'
  AND jsonb_typeof(metadata->'totalDurationMs') = 'number';

-- Provider errors are codes only, never error_message (which may be historical text).
SELECT a.error_code, count(*) AS attempts
FROM public.ai_call_attempts a JOIN public.ai_call_logs c ON c.id = a.call_id
WHERE c.feature_key = 'autonomous.reply' AND c.created_at > now() - interval '24 hours'
  AND NOT a.success GROUP BY a.error_code;
