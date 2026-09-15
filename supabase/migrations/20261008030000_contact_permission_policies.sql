-- Canonical, endpoint-scoped outbound contact permission state.
-- Existing campaign opt-outs are migrated as commercial blocks; no preference
-- is copied to another contact or family member.
BEGIN;

CREATE TABLE IF NOT EXISTS public.contact_permission_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL,
  endpoint_normalized text NOT NULL,
  purpose_scope text NOT NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  lead_match_ambiguous boolean NOT NULL DEFAULT false,
  state text NOT NULL DEFAULT 'unknown',
  source text NOT NULL,
  reason text,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  decision_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contact_permission_policies_channel_check
    CHECK (channel IN ('whatsapp', 'sms', 'email', 'phone_call')),
  CONSTRAINT contact_permission_policies_endpoint_check
    CHECK (length(endpoint_normalized) BETWEEN 3 AND 320),
  CONSTRAINT contact_permission_policies_scope_check
    CHECK (purpose_scope IN ('global', 'commercial', 'service_reply', 'transactional')),
  CONSTRAINT contact_permission_policies_state_check
    CHECK (state IN ('blocked', 'allowed', 'unknown')),
  CONSTRAINT contact_permission_policies_source_check
    CHECK (source IN (
      'manual', 'ai_suggestion', 'import', 'system', 'legacy_sync',
      'mcp', 'user_explicit', 'inbound_keyword', 'unknown'
    )),
  CONSTRAINT contact_permission_policies_endpoint_scope_unique
    UNIQUE (channel, endpoint_normalized, purpose_scope),
  CONSTRAINT contact_permission_policies_evidence_object
    CHECK (jsonb_typeof(evidence) = 'object')
);

CREATE TABLE IF NOT EXISTS public.contact_permission_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid REFERENCES public.contact_permission_policies(id) ON DELETE SET NULL,
  channel text NOT NULL,
  endpoint_normalized text NOT NULL,
  purpose_scope text NOT NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  lead_match_ambiguous boolean NOT NULL DEFAULT false,
  state text NOT NULL,
  source text NOT NULL,
  reason text,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contact_permission_events_evidence_object
    CHECK (jsonb_typeof(evidence) = 'object'),
  CONSTRAINT contact_permission_events_scope_check
    CHECK (purpose_scope IN ('global', 'commercial', 'service_reply', 'transactional')),
  CONSTRAINT contact_permission_events_state_check
    CHECK (state IN ('blocked', 'allowed', 'unknown'))
);

CREATE INDEX IF NOT EXISTS idx_contact_permission_policies_blocked_endpoint
  ON public.contact_permission_policies (channel, endpoint_normalized, purpose_scope)
  WHERE state = 'blocked';

CREATE INDEX IF NOT EXISTS idx_contact_permission_events_endpoint_time
  ON public.contact_permission_events (channel, endpoint_normalized, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_permission_policies_lead
  ON public.contact_permission_policies (lead_id)
  WHERE lead_id IS NOT NULL;

-- Contact linkage is intentionally exact and endpoint-scoped. Archived leads
-- are not candidates, and multiple active matches stay unlinked/ambiguous.
CREATE OR REPLACE FUNCTION public._resolve_contact_permission_lead(
  p_channel text,
  p_endpoint_normalized text,
  p_lead_id uuid DEFAULT NULL
)
RETURNS TABLE (lead_id uuid, lead_match_ambiguous boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count bigint;
  v_matching_lead_ids uuid[];
BEGIN
  IF p_lead_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.leads AS lead
      WHERE lead.id = p_lead_id
        AND COALESCE(lead.arquivado, false) = false
        AND CASE
          WHEN p_channel = 'email' THEN lower(btrim(COALESCE(lead.email, ''))) = p_endpoint_normalized
          ELSE regexp_replace(COALESCE(lead.telefone, ''), '[^0-9]', '', 'g') = p_endpoint_normalized
        END
    ) THEN
      RETURN QUERY SELECT p_lead_id, false;
      RETURN;
    END IF;
    RAISE EXCEPTION 'CONTACT_PERMISSION_LEAD_ENDPOINT_MISMATCH' USING ERRCODE = '22023';
  END IF;

  SELECT count(*), array_agg(lead.id ORDER BY lead.id)
    INTO v_count, v_matching_lead_ids
  FROM public.leads AS lead
  WHERE COALESCE(lead.arquivado, false) = false
    AND CASE
      WHEN p_channel = 'email' THEN lower(btrim(COALESCE(lead.email, ''))) = p_endpoint_normalized
      ELSE regexp_replace(COALESCE(lead.telefone, ''), '[^0-9]', '', 'g') = p_endpoint_normalized
    END;

  IF v_count = 1 THEN
    RETURN QUERY SELECT v_matching_lead_ids[1], false;
  ELSE
    RETURN QUERY SELECT NULL::uuid, v_count > 1;
  END IF;
END;
$$;

ALTER TABLE public.contact_permission_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_permission_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.contact_permission_policies FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.contact_permission_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.contact_permission_policies TO service_role;
GRANT SELECT ON public.contact_permission_events TO service_role;

COMMENT ON TABLE public.contact_permission_policies IS
  'Current outbound contact permission by channel, normalized endpoint, and scope; no household or family propagation.';
COMMENT ON TABLE public.contact_permission_events IS
  'Append-only history of explicit and legacy-synchronized contact permission decisions.';

-- Preserve every existing campaign opt-out as the matching contact's
-- commercial permission. The legacy table remains only as a compatibility
-- write surface for the existing campaign review UI.
WITH legacy_permissions AS (
  SELECT
    'whatsapp'::text AS channel,
    regexp_replace(COALESCE(legacy.phone_digits, ''), '[^0-9]', '', 'g') AS endpoint_normalized,
    'commercial'::text AS purpose_scope,
    contact_match.lead_id,
    contact_match.lead_match_ambiguous,
    CASE
      WHEN legacy.status = 'blocked' AND legacy.source = 'ai_suggestion'
        AND suggestion.intent IS DISTINCT FROM 'opt_out' THEN 'unknown'
      WHEN legacy.status = 'blocked' THEN 'blocked'
      ELSE 'allowed'
    END AS state,
    CASE WHEN legacy.source IN ('manual', 'ai_suggestion', 'import', 'system') THEN legacy.source ELSE 'legacy_sync' END AS source,
    legacy.reason,
    legacy.created_by AS actor_user_id,
    jsonb_strip_nulls(jsonb_build_object(
      'legacy_opt_out_id', legacy.id,
      'source_campaign_id', legacy.source_campaign_id,
      'source_chat_id', legacy.source_chat_id,
      'source_message_id', legacy.source_message_id,
      'ai_suggestion_id', legacy.ai_suggestion_id,
      'ai_suggestion_intent', suggestion.intent,
      'legacy_lead_id', legacy.lead_id,
      'lead_match_ambiguous', CASE WHEN contact_match.lead_match_ambiguous THEN true END
    )) AS evidence,
    COALESCE(legacy.updated_at, legacy.created_at, now()) AS decision_at,
    legacy.id AS legacy_id
  FROM public.comm_whatsapp_opt_outs AS legacy
  LEFT JOIN public.comm_whatsapp_ai_intent_suggestions AS suggestion
    ON suggestion.id = legacy.ai_suggestion_id
  LEFT JOIN LATERAL public._resolve_contact_permission_lead(
    'whatsapp',
    regexp_replace(COALESCE(legacy.phone_digits, ''), '[^0-9]', '', 'g'),
    CASE WHEN EXISTS (
      SELECT 1 FROM public.leads AS candidate
      WHERE candidate.id = legacy.lead_id
        AND COALESCE(candidate.arquivado, false) = false
        AND regexp_replace(COALESCE(candidate.telefone, ''), '[^0-9]', '', 'g') = regexp_replace(COALESCE(legacy.phone_digits, ''), '[^0-9]', '', 'g')
    ) THEN legacy.lead_id ELSE NULL END
  ) AS contact_match ON true
  WHERE length(regexp_replace(COALESCE(legacy.phone_digits, ''), '[^0-9]', '', 'g')) BETWEEN 3 AND 320
), latest_legacy_permission AS (
  SELECT DISTINCT ON (channel, endpoint_normalized, purpose_scope) *
  FROM legacy_permissions
  ORDER BY channel, endpoint_normalized, purpose_scope, decision_at DESC, (state = 'blocked') DESC, legacy_id DESC
)
INSERT INTO public.contact_permission_policies (
  channel, endpoint_normalized, purpose_scope, state, source,
  lead_id, lead_match_ambiguous,
  reason, actor_user_id, evidence, decision_at
)
SELECT
  channel, endpoint_normalized, purpose_scope, state, source,
  lead_id, lead_match_ambiguous,
  reason, actor_user_id, evidence, decision_at
FROM latest_legacy_permission
ON CONFLICT (channel, endpoint_normalized, purpose_scope) DO NOTHING;

INSERT INTO public.contact_permission_events (
  policy_id,
  channel,
  endpoint_normalized,
  purpose_scope,
  lead_id,
  lead_match_ambiguous,
  state,
  source,
  reason,
  actor_user_id,
  evidence,
  event_type,
  occurred_at
)
SELECT
  policy.id,
  'whatsapp',
  regexp_replace(COALESCE(legacy.phone_digits, ''), '[^0-9]', '', 'g'),
  'commercial',
  contact_match.lead_id,
  contact_match.lead_match_ambiguous,
  CASE
    WHEN legacy.status = 'blocked' AND legacy.source = 'ai_suggestion'
      AND suggestion.intent IS DISTINCT FROM 'opt_out' THEN 'unknown'
    WHEN legacy.status = 'blocked' THEN 'blocked'
    ELSE 'allowed'
  END,
  CASE WHEN legacy.source IN ('manual', 'ai_suggestion', 'import', 'system') THEN legacy.source ELSE 'legacy_sync' END,
  legacy.reason,
  legacy.created_by,
  jsonb_strip_nulls(jsonb_build_object(
    'legacy_opt_out_id', legacy.id,
    'source_campaign_id', legacy.source_campaign_id,
    'source_chat_id', legacy.source_chat_id,
    'source_message_id', legacy.source_message_id,
    'ai_suggestion_id', legacy.ai_suggestion_id,
    'ai_suggestion_intent', suggestion.intent,
    'legacy_lead_id', legacy.lead_id,
    'lead_match_ambiguous', CASE WHEN contact_match.lead_match_ambiguous THEN true END
  )),
  'legacy_backfill',
  COALESCE(legacy.updated_at, legacy.created_at, now())
FROM public.comm_whatsapp_opt_outs AS legacy
LEFT JOIN public.comm_whatsapp_ai_intent_suggestions AS suggestion
  ON suggestion.id = legacy.ai_suggestion_id
LEFT JOIN LATERAL public._resolve_contact_permission_lead(
  'whatsapp',
  regexp_replace(COALESCE(legacy.phone_digits, ''), '[^0-9]', '', 'g'),
  CASE WHEN EXISTS (
    SELECT 1 FROM public.leads AS candidate
    WHERE candidate.id = legacy.lead_id
      AND COALESCE(candidate.arquivado, false) = false
      AND regexp_replace(COALESCE(candidate.telefone, ''), '[^0-9]', '', 'g') = regexp_replace(COALESCE(legacy.phone_digits, ''), '[^0-9]', '', 'g')
  ) THEN legacy.lead_id ELSE NULL END
) AS contact_match ON true
JOIN public.contact_permission_policies AS policy
  ON policy.channel = 'whatsapp'
  AND policy.endpoint_normalized = regexp_replace(COALESCE(legacy.phone_digits, ''), '[^0-9]', '', 'g')
  AND policy.purpose_scope = 'commercial'
WHERE length(regexp_replace(COALESCE(legacy.phone_digits, ''), '[^0-9]', '', 'g')) BETWEEN 3 AND 320;

CREATE OR REPLACE FUNCTION public.sync_legacy_comm_whatsapp_opt_out_permission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_endpoint text;
  v_state text;
  v_source text;
  v_suggestion_intent text;
  v_actor uuid;
  v_reason text;
  v_evidence jsonb;
  v_policy_id uuid;
  v_lead_id uuid;
  v_lead_input uuid;
  v_lead_match_ambiguous boolean;
  v_old_lead_id uuid;
  v_old_lead_match_ambiguous boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_endpoint := regexp_replace(COALESCE(OLD.phone_digits, ''), '[^0-9]', '', 'g');
    v_lead_input := OLD.lead_id;
    v_state := 'unknown';
    v_source := 'legacy_sync';
    v_actor := COALESCE(auth.uid(), OLD.created_by);
    v_reason := COALESCE(OLD.reason, 'Registro legado removido; estado histórico preservado.');
    v_evidence := jsonb_strip_nulls(jsonb_build_object(
      'legacy_opt_out_id', OLD.id,
      'legacy_source', OLD.source,
      'legacy_deleted', true,
      'legacy_lead_id', OLD.lead_id
    ));
  ELSE
    v_endpoint := regexp_replace(COALESCE(NEW.phone_digits, ''), '[^0-9]', '', 'g');
    v_lead_input := NEW.lead_id;
    SELECT suggestion.intent INTO v_suggestion_intent
    FROM public.comm_whatsapp_ai_intent_suggestions AS suggestion
    WHERE suggestion.id = NEW.ai_suggestion_id;
    v_state := CASE
      WHEN NEW.status = 'blocked' AND NEW.source = 'ai_suggestion'
        AND v_suggestion_intent IS DISTINCT FROM 'opt_out' THEN 'unknown'
      WHEN NEW.status = 'blocked' THEN 'blocked'
      ELSE 'allowed'
    END;
    v_source := CASE WHEN NEW.source IN ('manual', 'ai_suggestion', 'import', 'system') THEN NEW.source ELSE 'legacy_sync' END;
    v_actor := COALESCE(auth.uid(), NEW.created_by);
    v_reason := NEW.reason;
    v_evidence := jsonb_strip_nulls(jsonb_build_object(
      'legacy_opt_out_id', NEW.id,
      'source_campaign_id', NEW.source_campaign_id,
      'source_chat_id', NEW.source_chat_id,
      'source_message_id', NEW.source_message_id,
      'ai_suggestion_id', NEW.ai_suggestion_id,
      'ai_suggestion_intent', v_suggestion_intent,
      'legacy_lead_id', NEW.lead_id
    ));
  END IF;

  SELECT match.lead_id, match.lead_match_ambiguous
    INTO v_lead_id, v_lead_match_ambiguous
  FROM public._resolve_contact_permission_lead('whatsapp', v_endpoint, v_lead_input) AS match;
  IF v_lead_match_ambiguous THEN
    v_evidence := v_evidence || jsonb_build_object('lead_match_ambiguous', true);
  END IF;

  IF length(v_endpoint) BETWEEN 3 AND 320 THEN
    INSERT INTO public.contact_permission_policies (
      channel, endpoint_normalized, purpose_scope, lead_id,
      lead_match_ambiguous, state, source,
      reason, actor_user_id, evidence, decision_at, updated_at
    ) VALUES (
      'whatsapp', v_endpoint, 'commercial', v_lead_id,
      v_lead_match_ambiguous, v_state, v_source,
      v_reason, v_actor, v_evidence, now(), now()
    )
    ON CONFLICT (channel, endpoint_normalized, purpose_scope)
    DO UPDATE SET
      state = EXCLUDED.state,
      lead_id = EXCLUDED.lead_id,
      lead_match_ambiguous = EXCLUDED.lead_match_ambiguous,
      source = EXCLUDED.source,
      reason = EXCLUDED.reason,
      actor_user_id = EXCLUDED.actor_user_id,
      evidence = EXCLUDED.evidence,
      decision_at = EXCLUDED.decision_at,
      updated_at = EXCLUDED.updated_at
    RETURNING id INTO v_policy_id;

    INSERT INTO public.contact_permission_events (
      policy_id, channel, endpoint_normalized, purpose_scope, lead_id,
      lead_match_ambiguous, state,
      source, reason, actor_user_id, evidence, event_type
    ) VALUES (
      v_policy_id, 'whatsapp', v_endpoint, 'commercial', v_lead_id,
      v_lead_match_ambiguous, v_state,
      v_source, v_reason, v_actor, v_evidence,
      CASE WHEN TG_OP = 'DELETE' THEN 'legacy_removed' ELSE 'legacy_synced' END
    );
  END IF;

  -- If a legacy row's phone changes, preserve the previous endpoint's history
  -- while no longer blocking it based on this row.
  IF TG_OP = 'UPDATE'
    AND regexp_replace(COALESCE(OLD.phone_digits, ''), '[^0-9]', '', 'g') <> v_endpoint
  THEN
    SELECT match.lead_id, match.lead_match_ambiguous
      INTO v_old_lead_id, v_old_lead_match_ambiguous
    FROM public._resolve_contact_permission_lead(
      'whatsapp', regexp_replace(COALESCE(OLD.phone_digits, ''), '[^0-9]', '', 'g'), OLD.lead_id
    ) AS match;
    UPDATE public.contact_permission_policies
    SET state = 'unknown', source = 'legacy_sync',
        lead_id = v_old_lead_id,
        lead_match_ambiguous = v_old_lead_match_ambiguous,
        reason = 'Telefone alterado no registro legado; estado histórico preservado.',
        actor_user_id = COALESCE(auth.uid(), NEW.created_by),
        evidence = jsonb_strip_nulls(jsonb_build_object(
          'legacy_opt_out_id', NEW.id,
          'legacy_phone_changed', true,
          'legacy_lead_id', OLD.lead_id,
          'resolved_lead_id', v_old_lead_id,
          'lead_match_ambiguous', CASE WHEN v_old_lead_match_ambiguous THEN true END
        )),
        decision_at = now(), updated_at = now()
    WHERE channel = 'whatsapp'
      AND endpoint_normalized = regexp_replace(COALESCE(OLD.phone_digits, ''), '[^0-9]', '', 'g')
      AND purpose_scope = 'commercial'
    RETURNING id INTO v_policy_id;

    IF FOUND THEN
      INSERT INTO public.contact_permission_events (
        policy_id, channel, endpoint_normalized, purpose_scope, lead_id,
        lead_match_ambiguous, state,
        source, reason, actor_user_id, evidence, event_type
      ) VALUES (
        v_policy_id, 'whatsapp', regexp_replace(COALESCE(OLD.phone_digits, ''), '[^0-9]', '', 'g'),
        'commercial', v_old_lead_id, v_old_lead_match_ambiguous, 'unknown', 'legacy_sync',
        'Telefone alterado no registro legado; estado histórico preservado.',
        COALESCE(auth.uid(), NEW.created_by),
        jsonb_build_object(
          'legacy_opt_out_id', NEW.id,
          'legacy_phone_changed', true,
          'legacy_lead_id', OLD.lead_id,
          'resolved_lead_id', v_old_lead_id,
          'lead_match_ambiguous', v_old_lead_match_ambiguous
        ),
        'legacy_endpoint_changed'
      );
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_legacy_comm_whatsapp_opt_out_permission() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_legacy_comm_whatsapp_opt_out_permission ON public.comm_whatsapp_opt_outs;
CREATE TRIGGER trg_sync_legacy_comm_whatsapp_opt_out_permission
  AFTER INSERT OR UPDATE OF phone_digits, status, reason, source, created_by,
    source_campaign_id, source_chat_id, source_message_id, ai_suggestion_id
  OR DELETE ON public.comm_whatsapp_opt_outs
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_legacy_comm_whatsapp_opt_out_permission();

-- Call only from trusted Edge Functions using the service-role client. The
-- database check always evaluates both the requested scope and the global
-- scope. Errors are not converted into an allow decision by callers.
CREATE OR REPLACE FUNCTION public.check_contact_permission_for_send(
  p_channel text,
  p_endpoint_normalized text,
  p_purpose_scope text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_endpoint text;
  v_blocked_scope text;
  v_reason text;
  v_source text;
BEGIN
  IF p_channel IS NULL OR p_channel NOT IN ('whatsapp', 'sms', 'email', 'phone_call') THEN
    RAISE EXCEPTION 'unsupported contact channel' USING ERRCODE = '22023';
  END IF;
  IF p_purpose_scope IS NULL OR p_purpose_scope NOT IN ('commercial', 'service_reply', 'transactional') THEN
    RAISE EXCEPTION 'unsupported send purpose' USING ERRCODE = '22023';
  END IF;

  v_endpoint := CASE
    WHEN p_channel IN ('whatsapp', 'sms', 'phone_call')
      THEN regexp_replace(COALESCE(p_endpoint_normalized, ''), '[^0-9]', '', 'g')
    ELSE lower(btrim(COALESCE(p_endpoint_normalized, '')))
  END;
  IF length(v_endpoint) NOT BETWEEN 3 AND 320 THEN
    RAISE EXCEPTION 'invalid contact endpoint' USING ERRCODE = '22023';
  END IF;

  SELECT policy.purpose_scope, policy.reason, policy.source
    INTO v_blocked_scope, v_reason, v_source
  FROM public.contact_permission_policies AS policy
  WHERE policy.channel = p_channel
    AND policy.endpoint_normalized = v_endpoint
    AND policy.state = 'blocked'
    AND policy.purpose_scope IN ('global', p_purpose_scope)
  ORDER BY CASE WHEN policy.purpose_scope = 'global' THEN 0 ELSE 1 END
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'blocked_scope', v_blocked_scope,
      'source', v_source,
      'reason', v_reason
    );
  END IF;

  RETURN jsonb_build_object('allowed', true, 'blocked_scope', NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.check_contact_permission_for_send(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_contact_permission_for_send(text, text, text) TO service_role;

-- MCP permission tools expose three narrow RPCs. The service-role credential
-- only transports OAuth actor identity; each database entrypoint rechecks that
-- the actor is still an active admin with an email address.
CREATE TABLE public.contact_permission_mutation_requests (
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  tool_name text NOT NULL,
  client_request_id text NOT NULL,
  payload_hash text NOT NULL,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  PRIMARY KEY (actor_id, tool_name, client_request_id),
  CONSTRAINT contact_permission_mutation_tool_check
    CHECK (tool_name IN ('kifer_set_contact_permission', 'kifer_bulk_set_contact_permission')),
  CONSTRAINT contact_permission_mutation_request_id_check
    CHECK (client_request_id ~ '^[A-Za-z0-9:_-]{1,128}$'),
  CONSTRAINT contact_permission_mutation_hash_check
    CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT contact_permission_mutation_result_object
    CHECK (result IS NULL OR jsonb_typeof(result) = 'object')
);
ALTER TABLE public.contact_permission_mutation_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contact_permission_mutation_requests FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public._assert_contact_permission_admin(p_actor_user_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_actor_user_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.user_profiles AS profile
    WHERE profile.id = p_actor_user_id
      AND profile.role = 'admin'
      AND NULLIF(btrim(profile.email), '') IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'MCP_ADMIN_REQUIRED' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public._normalize_contact_permission_endpoint(
  p_channel text,
  p_endpoint text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_endpoint text;
BEGIN
  IF p_channel IS NULL OR p_channel NOT IN ('whatsapp', 'sms', 'email', 'phone_call') THEN
    RAISE EXCEPTION 'CONTACT_PERMISSION_INVALID_CHANNEL' USING ERRCODE = '22023';
  END IF;
  v_endpoint := CASE
    WHEN p_channel IN ('whatsapp', 'sms', 'phone_call')
      THEN regexp_replace(COALESCE(p_endpoint, ''), '[^0-9]', '', 'g')
    ELSE lower(btrim(COALESCE(p_endpoint, '')))
  END;
  IF length(v_endpoint) NOT BETWEEN 3 AND 320 THEN
    RAISE EXCEPTION 'CONTACT_PERMISSION_INVALID_ENDPOINT' USING ERRCODE = '22023';
  END IF;
  RETURN v_endpoint;
END;
$$;

CREATE OR REPLACE FUNCTION public._upsert_contact_permission_policy(
  p_channel text,
  p_endpoint_normalized text,
  p_purpose_scope text,
  p_lead_id uuid,
  p_lead_match_ambiguous boolean,
  p_state text,
  p_reason text,
  p_actor_user_id uuid,
  p_evidence jsonb,
  p_event_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_policy public.contact_permission_policies%ROWTYPE;
  v_now timestamptz := clock_timestamp();
  v_evidence jsonb;
BEGIN
  v_evidence := COALESCE(p_evidence, '{}'::jsonb)
    || jsonb_build_object('lead_id_at_decision', p_lead_id, 'lead_match_ambiguous', COALESCE(p_lead_match_ambiguous, false));
  INSERT INTO public.contact_permission_policies AS policy (
    channel, endpoint_normalized, purpose_scope, lead_id, lead_match_ambiguous,
    state, source,
    reason, actor_user_id, evidence, decision_at, updated_at
  ) VALUES (
    p_channel, p_endpoint_normalized, p_purpose_scope,
    p_lead_id, COALESCE(p_lead_match_ambiguous, false), p_state, 'mcp',
    NULLIF(btrim(COALESCE(p_reason, '')), ''), p_actor_user_id,
    v_evidence, v_now, v_now
  )
  ON CONFLICT (channel, endpoint_normalized, purpose_scope)
  DO UPDATE SET
    state = EXCLUDED.state,
    lead_id = EXCLUDED.lead_id,
    lead_match_ambiguous = EXCLUDED.lead_match_ambiguous,
    source = EXCLUDED.source,
    reason = EXCLUDED.reason,
    actor_user_id = EXCLUDED.actor_user_id,
    evidence = EXCLUDED.evidence,
    decision_at = EXCLUDED.decision_at,
    updated_at = GREATEST(EXCLUDED.updated_at, policy.updated_at + interval '1 microsecond')
  RETURNING policy.* INTO v_policy;

  INSERT INTO public.contact_permission_events (
    policy_id, channel, endpoint_normalized, purpose_scope, lead_id,
    lead_match_ambiguous, state,
    source, reason, actor_user_id, evidence, event_type, occurred_at
  ) VALUES (
    v_policy.id, v_policy.channel, v_policy.endpoint_normalized,
    v_policy.purpose_scope, v_policy.lead_id, v_policy.lead_match_ambiguous,
    v_policy.state, v_policy.source, v_policy.reason,
    v_policy.actor_user_id, v_policy.evidence, p_event_type, v_now
  );

  RETURN jsonb_build_object(
    'id', v_policy.id,
    'channel', v_policy.channel,
    'endpoint_normalized', v_policy.endpoint_normalized,
    'purpose_scope', v_policy.purpose_scope,
    'lead_id', v_policy.lead_id,
    'lead_match_ambiguous', v_policy.lead_match_ambiguous,
    'state', v_policy.state,
    'source', v_policy.source,
    'reason', v_policy.reason,
    'actor_user_id', v_policy.actor_user_id,
    'evidence', v_policy.evidence,
    'decision_at', v_policy.decision_at,
    'updated_at', v_policy.updated_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public._begin_contact_permission_request(
  p_actor_user_id uuid,
  p_tool_name text,
  p_client_request_id text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp, extensions
AS $$
DECLARE
  v_hash text;
  v_existing public.contact_permission_mutation_requests%ROWTYPE;
  v_inserted boolean;
BEGIN
  IF p_client_request_id IS NULL OR p_client_request_id !~ '^[A-Za-z0-9:_-]{1,128}$' THEN
    RAISE EXCEPTION 'CONTACT_PERMISSION_INVALID_REQUEST_ID' USING ERRCODE = '22023';
  END IF;
  v_hash := encode(extensions.digest(convert_to(p_payload::text, 'UTF8'), 'sha256'), 'hex');
  INSERT INTO public.contact_permission_mutation_requests (
    actor_id, tool_name, client_request_id, payload_hash
  ) VALUES (p_actor_user_id, p_tool_name, p_client_request_id, v_hash)
  ON CONFLICT (actor_id, tool_name, client_request_id) DO NOTHING
  RETURNING true INTO v_inserted;

  IF COALESCE(v_inserted, false) THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_existing
  FROM public.contact_permission_mutation_requests
  WHERE actor_id = p_actor_user_id
    AND tool_name = p_tool_name
    AND client_request_id = p_client_request_id
  FOR UPDATE;

  IF v_existing.payload_hash IS DISTINCT FROM v_hash THEN
    RAISE EXCEPTION 'CONTACT_PERMISSION_IDEMPOTENCY_CONFLICT' USING ERRCODE = '22023';
  END IF;
  IF v_existing.result IS NULL THEN
    RAISE EXCEPTION 'CONTACT_PERMISSION_IDEMPOTENCY_INCOMPLETE' USING ERRCODE = '40001';
  END IF;
  RETURN v_existing.result || jsonb_build_object('duplicate', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.mcp_get_contact_permission(
  p_actor_user_id uuid,
  p_channel text,
  p_endpoint text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_endpoint text;
  v_policies jsonb;
BEGIN
  PERFORM public._assert_contact_permission_admin(p_actor_user_id);
  v_endpoint := public._normalize_contact_permission_endpoint(p_channel, p_endpoint);
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', policy.id,
    'channel', policy.channel,
    'endpoint_normalized', policy.endpoint_normalized,
    'purpose_scope', policy.purpose_scope,
    'state', policy.state,
    'source', policy.source,
    'reason', policy.reason,
    'actor_user_id', policy.actor_user_id,
    'evidence', policy.evidence,
    'decision_at', policy.decision_at,
    'updated_at', policy.updated_at,
    'lead_id', policy.lead_id,
    'lead_match_ambiguous', policy.lead_match_ambiguous
  ) ORDER BY policy.purpose_scope), '[]'::jsonb)
  INTO v_policies
  FROM public.contact_permission_policies AS policy
  WHERE policy.channel = p_channel
    AND policy.endpoint_normalized = v_endpoint;

  RETURN jsonb_build_object(
    'success', true,
    'channel', p_channel,
    'endpoint_normalized', v_endpoint,
    'policies', v_policies
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mcp_set_contact_permission(
  p_actor_user_id uuid,
  p_client_request_id text,
  p_channel text,
  p_endpoint text,
  p_purpose_scope text,
  p_state text,
  p_reason text DEFAULT NULL,
  p_evidence jsonb DEFAULT '{}'::jsonb,
  p_lead_id uuid DEFAULT NULL,
  p_expected_updated_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp, extensions
AS $$
DECLARE
  v_endpoint text;
  v_payload jsonb;
  v_duplicate jsonb;
  v_result jsonb;
  v_existing_updated_at timestamptz;
  v_lead_id uuid;
  v_lead_match_ambiguous boolean;
BEGIN
  PERFORM public._assert_contact_permission_admin(p_actor_user_id);
  IF p_purpose_scope IS NULL OR p_purpose_scope NOT IN ('global', 'commercial', 'service_reply', 'transactional') THEN
    RAISE EXCEPTION 'CONTACT_PERMISSION_INVALID_SCOPE' USING ERRCODE = '22023';
  END IF;
  IF p_state IS NULL OR p_state NOT IN ('blocked', 'allowed', 'unknown') THEN
    RAISE EXCEPTION 'CONTACT_PERMISSION_INVALID_STATE' USING ERRCODE = '22023';
  END IF;
  IF char_length(COALESCE(p_reason, '')) > 1000 THEN
    RAISE EXCEPTION 'CONTACT_PERMISSION_REASON_TOO_LONG' USING ERRCODE = '22023';
  END IF;
  IF p_evidence IS NULL OR jsonb_typeof(p_evidence) <> 'object' OR octet_length(p_evidence::text) > 8192 THEN
    RAISE EXCEPTION 'CONTACT_PERMISSION_INVALID_EVIDENCE' USING ERRCODE = '22023';
  END IF;
  v_endpoint := public._normalize_contact_permission_endpoint(p_channel, p_endpoint);
  v_payload := jsonb_build_object(
    'channel', p_channel, 'endpoint_normalized', v_endpoint,
    'purpose_scope', p_purpose_scope, 'state', p_state,
    'reason', NULLIF(btrim(COALESCE(p_reason, '')), ''), 'evidence', p_evidence,
    'lead_id', p_lead_id, 'expected_updated_at', p_expected_updated_at
  );
  v_duplicate := public._begin_contact_permission_request(
    p_actor_user_id, 'kifer_set_contact_permission', p_client_request_id, v_payload
  );
  IF v_duplicate IS NOT NULL THEN RETURN v_duplicate; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_channel || '|' || v_endpoint || '|' || p_purpose_scope, 0));
  SELECT policy.updated_at INTO v_existing_updated_at
  FROM public.contact_permission_policies AS policy
  WHERE policy.channel = p_channel
    AND policy.endpoint_normalized = v_endpoint
    AND policy.purpose_scope = p_purpose_scope
  FOR UPDATE;

  IF (FOUND AND (p_expected_updated_at IS NULL OR v_existing_updated_at IS DISTINCT FROM p_expected_updated_at))
    OR (NOT FOUND AND p_expected_updated_at IS NOT NULL) THEN
    v_result := jsonb_build_object(
      'success', false,
      'duplicate', false,
      'error_code', 'STALE_WRITE',
      'message', 'A política foi alterada desde a última leitura. Consulte novamente e envie expected_updated_at atualizado.',
      'channel', p_channel,
      'endpoint_normalized', v_endpoint,
      'purpose_scope', p_purpose_scope,
      'expected_updated_at', p_expected_updated_at,
      'actual_updated_at', v_existing_updated_at,
      'lead_match_ambiguous', false
    );
    UPDATE public.contact_permission_mutation_requests
    SET result = v_result, completed_at = clock_timestamp()
    WHERE actor_id = p_actor_user_id
      AND tool_name = 'kifer_set_contact_permission'
      AND client_request_id = p_client_request_id;
    RETURN v_result;
  END IF;

  SELECT match.lead_id, match.lead_match_ambiguous
    INTO v_lead_id, v_lead_match_ambiguous
  FROM public._resolve_contact_permission_lead(p_channel, v_endpoint, p_lead_id) AS match;
  IF v_lead_match_ambiguous THEN
    p_evidence := p_evidence || jsonb_build_object('lead_match_ambiguous', true);
  END IF;

  v_result := jsonb_build_object(
    'success', true,
    'duplicate', false,
    'client_request_id', p_client_request_id,
    'policy', public._upsert_contact_permission_policy(
      p_channel, v_endpoint, p_purpose_scope, v_lead_id, v_lead_match_ambiguous,
      p_state, p_reason, p_actor_user_id, p_evidence, 'mcp_admin_decision'
    ),
    'lead_match_ambiguous', v_lead_match_ambiguous
  );
  UPDATE public.contact_permission_mutation_requests
  SET result = v_result, completed_at = clock_timestamp()
  WHERE actor_id = p_actor_user_id
    AND tool_name = 'kifer_set_contact_permission'
    AND client_request_id = p_client_request_id;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.mcp_bulk_set_contact_permission(
  p_actor_user_id uuid,
  p_client_request_id text,
  p_changes jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp, extensions
AS $$
DECLARE
  v_payload jsonb;
  v_duplicate jsonb;
  v_result jsonb;
  v_results jsonb := '[]'::jsonb;
  v_change jsonb;
  v_channel text;
  v_endpoint text;
  v_scope text;
  v_state text;
  v_reason text;
  v_evidence jsonb;
  v_lead_id uuid;
  v_lead_match_ambiguous boolean;
  v_expected_updated_at timestamptz;
  v_existing_updated_at timestamptz;
  v_existing_found boolean;
  v_key text;
  v_seen text[] := ARRAY[]::text[];
  v_extra jsonb;
  v_stale_policies jsonb := '[]'::jsonb;
  v_ambiguous_count integer := 0;
BEGIN
  PERFORM public._assert_contact_permission_admin(p_actor_user_id);
  IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'array'
    OR jsonb_array_length(p_changes) NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'CONTACT_PERMISSION_BULK_LIMIT' USING ERRCODE = '22023';
  END IF;

  -- Normalize before hashing so equivalent phone/email forms share an
  -- idempotency signature. The original evidence/reason remains auditable.
  v_payload := '[]'::jsonb;
  FOR v_change IN SELECT value FROM jsonb_array_elements(p_changes)
  LOOP
    IF jsonb_typeof(v_change) <> 'object' THEN
      RAISE EXCEPTION 'CONTACT_PERMISSION_INVALID_BULK_ITEM' USING ERRCODE = '22023';
    END IF;
    v_extra := v_change - 'channel' - 'endpoint' - 'purpose_scope' - 'state' - 'reason' - 'evidence'
      - 'lead_id' - 'expected_updated_at';
    IF v_extra <> '{}'::jsonb THEN
      RAISE EXCEPTION 'CONTACT_PERMISSION_INVALID_BULK_ITEM' USING ERRCODE = '22023';
    END IF;
    v_channel := v_change->>'channel';
    v_endpoint := public._normalize_contact_permission_endpoint(v_channel, v_change->>'endpoint');
    v_scope := v_change->>'purpose_scope';
    v_state := v_change->>'state';
    v_reason := NULLIF(btrim(COALESCE(v_change->>'reason', '')), '');
    v_evidence := COALESCE(v_change->'evidence', '{}'::jsonb);
    v_lead_id := NULLIF(v_change->>'lead_id', '')::uuid;
    v_expected_updated_at := NULLIF(v_change->>'expected_updated_at', '')::timestamptz;
    IF v_scope IS NULL OR v_scope NOT IN ('global', 'commercial', 'service_reply', 'transactional')
      OR v_state IS NULL OR v_state NOT IN ('blocked', 'allowed', 'unknown')
      OR char_length(COALESCE(v_reason, '')) > 1000
      OR jsonb_typeof(v_evidence) <> 'object' OR octet_length(v_evidence::text) > 8192 THEN
      RAISE EXCEPTION 'CONTACT_PERMISSION_INVALID_BULK_ITEM' USING ERRCODE = '22023';
    END IF;
    v_key := v_channel || '|' || v_endpoint || '|' || v_scope;
    IF v_key = ANY(v_seen) THEN
      RAISE EXCEPTION 'CONTACT_PERMISSION_DUPLICATE_BULK_TARGET' USING ERRCODE = '22023';
    END IF;
    v_seen := array_append(v_seen, v_key);
    v_payload := v_payload || jsonb_build_array(jsonb_build_object(
      'channel', v_channel, 'endpoint_normalized', v_endpoint,
      'purpose_scope', v_scope, 'state', v_state,
      'reason', v_reason, 'evidence', v_evidence,
      'lead_id', v_lead_id, 'expected_updated_at', v_expected_updated_at
    ));
  END LOOP;

  v_duplicate := public._begin_contact_permission_request(
    p_actor_user_id, 'kifer_bulk_set_contact_permission', p_client_request_id, v_payload
  );
  IF v_duplicate IS NOT NULL THEN RETURN v_duplicate; END IF;

  -- Lock targets in a stable order, including targets that do not exist yet,
  -- so concurrent creators cannot silently bypass expected_updated_at.
  FOR v_key IN
    SELECT DISTINCT (value->>'channel') || '|' || (value->>'endpoint_normalized') || '|' || (value->>'purpose_scope')
    FROM jsonb_array_elements(v_payload) AS entries(value)
    ORDER BY 1
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(v_key, 0));
  END LOOP;

  FOR v_change IN SELECT value FROM jsonb_array_elements(v_payload)
  LOOP
    v_existing_updated_at := NULL;
    SELECT policy.updated_at INTO v_existing_updated_at
    FROM public.contact_permission_policies AS policy
    WHERE policy.channel = v_change->>'channel'
      AND policy.endpoint_normalized = v_change->>'endpoint_normalized'
      AND policy.purpose_scope = v_change->>'purpose_scope'
    FOR UPDATE;
    v_existing_found := FOUND;
    v_expected_updated_at := NULLIF(v_change->>'expected_updated_at', '')::timestamptz;
    IF (v_existing_found AND (v_expected_updated_at IS NULL OR v_existing_updated_at IS DISTINCT FROM v_expected_updated_at))
      OR (NOT v_existing_found AND v_expected_updated_at IS NOT NULL) THEN
      v_stale_policies := v_stale_policies || jsonb_build_array(jsonb_build_object(
        'channel', v_change->>'channel',
        'endpoint_normalized', v_change->>'endpoint_normalized',
        'purpose_scope', v_change->>'purpose_scope',
        'expected_updated_at', v_expected_updated_at,
        'actual_updated_at', v_existing_updated_at,
        'exists', v_existing_found
      ));
    END IF;
  END LOOP;

  IF jsonb_array_length(v_stale_policies) > 0 THEN
    v_result := jsonb_build_object(
      'success', false,
      'duplicate', false,
      'error_code', 'STALE_WRITE',
      'message', 'Uma ou mais políticas foram alteradas desde a última leitura. Nenhuma alteração do lote foi aplicada.',
      'client_request_id', p_client_request_id,
      'stale_policies', v_stale_policies
    );
    UPDATE public.contact_permission_mutation_requests
    SET result = v_result, completed_at = clock_timestamp()
    WHERE actor_id = p_actor_user_id
      AND tool_name = 'kifer_bulk_set_contact_permission'
      AND client_request_id = p_client_request_id;
    RETURN v_result;
  END IF;

  FOR v_change IN SELECT value FROM jsonb_array_elements(v_payload)
  LOOP
    SELECT match.lead_id, match.lead_match_ambiguous
      INTO v_lead_id, v_lead_match_ambiguous
    FROM public._resolve_contact_permission_lead(
      v_change->>'channel',
      v_change->>'endpoint_normalized',
      NULLIF(v_change->>'lead_id', '')::uuid
    ) AS match;
    v_evidence := v_change->'evidence';
    IF v_lead_match_ambiguous THEN
      v_evidence := v_evidence || jsonb_build_object('lead_match_ambiguous', true);
      v_ambiguous_count := v_ambiguous_count + 1;
    END IF;
    v_results := v_results || jsonb_build_array(public._upsert_contact_permission_policy(
      v_change->>'channel',
      v_change->>'endpoint_normalized',
      v_change->>'purpose_scope',
      v_lead_id,
      v_lead_match_ambiguous,
      v_change->>'state',
      v_change->>'reason',
      p_actor_user_id,
      v_evidence,
      'mcp_admin_decision'
    ));
  END LOOP;

  v_result := jsonb_build_object(
    'success', true,
    'duplicate', false,
    'client_request_id', p_client_request_id,
    'count', jsonb_array_length(v_results),
    'ambiguous_lead_matches', v_ambiguous_count,
    'policies', v_results
  );
  UPDATE public.contact_permission_mutation_requests
  SET result = v_result, completed_at = clock_timestamp()
  WHERE actor_id = p_actor_user_id
    AND tool_name = 'kifer_bulk_set_contact_permission'
    AND client_request_id = p_client_request_id;
  RETURN v_result;
END;
$$;

-- Audit rows are append-only from every runtime role. Writes happen only under
-- the migration/table owner inside the controlled RPCs and legacy trigger.
CREATE OR REPLACE FUNCTION public.reject_contact_permission_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- FK cleanup may detach a deleted lead, policy, or auth user. The original
  -- IDs remain in evidence, and no decision fields may be changed.
  IF TG_OP = 'UPDATE'
    AND (to_jsonb(OLD) - ARRAY['lead_id', 'policy_id', 'actor_user_id'])
      = (to_jsonb(NEW) - ARRAY['lead_id', 'policy_id', 'actor_user_id'])
    AND (OLD.lead_id IS NOT DISTINCT FROM NEW.lead_id OR (OLD.lead_id IS NOT NULL AND NEW.lead_id IS NULL))
    AND (OLD.policy_id IS NOT DISTINCT FROM NEW.policy_id OR (OLD.policy_id IS NOT NULL AND NEW.policy_id IS NULL))
    AND (OLD.actor_user_id IS NOT DISTINCT FROM NEW.actor_user_id OR (OLD.actor_user_id IS NOT NULL AND NEW.actor_user_id IS NULL))
    AND (
      (OLD.lead_id IS NOT NULL AND NEW.lead_id IS NULL)
      OR (OLD.policy_id IS NOT NULL AND NEW.policy_id IS NULL)
      OR (OLD.actor_user_id IS NOT NULL AND NEW.actor_user_id IS NULL)
    ) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'CONTACT_PERMISSION_AUDIT_APPEND_ONLY' USING ERRCODE = '42501';
END;
$$;
CREATE TRIGGER trg_contact_permission_events_append_only
  BEFORE UPDATE OR DELETE ON public.contact_permission_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_contact_permission_event_mutation();

REVOKE ALL ON FUNCTION public._assert_contact_permission_admin(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._normalize_contact_permission_endpoint(text, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._resolve_contact_permission_lead(text, text, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._upsert_contact_permission_policy(text, text, text, uuid, boolean, text, text, uuid, jsonb, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._begin_contact_permission_request(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.reject_contact_permission_event_mutation() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mcp_get_contact_permission(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_set_contact_permission(uuid, text, text, text, text, text, text, jsonb, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_bulk_set_contact_permission(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_get_contact_permission(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_set_contact_permission(uuid, text, text, text, text, text, text, jsonb, uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_bulk_set_contact_permission(uuid, text, jsonb) TO service_role;

COMMENT ON FUNCTION public.mcp_get_contact_permission(uuid, text, text) IS
  'MCP OAuth-admin read of all current permission scopes for one normalized endpoint.';
COMMENT ON FUNCTION public.mcp_set_contact_permission(uuid, text, text, text, text, text, text, jsonb, uuid, timestamptz) IS
  'Idempotent MCP OAuth-admin single-scope permission decision; source is fixed to mcp and every decision is audited.';
COMMENT ON FUNCTION public.mcp_bulk_set_contact_permission(uuid, text, jsonb) IS
  'Atomic idempotent MCP OAuth-admin permission decisions, 1–50 unique channel/endpoint/scope targets.';

-- A send blocked after the scheduled row was claimed must reach a terminal
-- state. Preserve retry/sent transitions and permit only this additional
-- sending -> cancelled transition used for explicit contact permission blocks.
CREATE OR REPLACE FUNCTION public.advance_scheduled_message(
  p_message_id uuid,
  p_new_status text,
  p_external_message_id text DEFAULT NULL,
  p_delivery_status text DEFAULT NULL,
  p_error_message text DEFAULT NULL,
  p_next_retry_at timestamptz DEFAULT NULL
)
RETURNS TABLE (
  message_id uuid,
  old_status text,
  new_status text,
  next_run_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_msg public.comm_whatsapp_scheduled_messages%ROWTYPE;
  v_next_run timestamptz;
  v_interval interval;
BEGIN
  SELECT * INTO v_msg
  FROM public.comm_whatsapp_scheduled_messages
  WHERE id = p_message_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;
  old_status := v_msg.status;
  new_status := p_new_status;

  IF NOT (
    (p_new_status = 'sent' AND v_msg.status = 'sending')
    OR (p_new_status = 'failed' AND v_msg.status = 'sending')
    OR (p_new_status = 'cancelled' AND v_msg.status IN ('scheduled', 'failed', 'sending'))
    OR (p_new_status = 'expired' AND v_msg.status = 'scheduled')
  ) THEN
    RAISE EXCEPTION 'Transicao de status invalida: % -> %', v_msg.status, p_new_status;
  END IF;

  v_next_run := NULL;
  IF p_new_status = 'sent' AND v_msg.recurrence <> 'none' THEN
    IF v_msg.recurrence_ends_at IS NULL OR v_msg.recurrence_ends_at > v_now THEN
      v_interval := CASE v_msg.recurrence
        WHEN 'daily' THEN make_interval(days => COALESCE((v_msg.recurrence_config->>'interval')::int, 1))
        WHEN 'weekly' THEN make_interval(days => 7 * COALESCE((v_msg.recurrence_config->>'interval')::int, 1))
        WHEN 'monthly' THEN make_interval(months => COALESCE((v_msg.recurrence_config->>'interval')::int, 1))
        ELSE NULL
      END;
      IF v_interval IS NOT NULL THEN
        v_next_run := COALESCE(v_msg.next_run_at, v_msg.scheduled_at) + v_interval;
        IF v_msg.recurrence_ends_at IS NOT NULL AND v_next_run > v_msg.recurrence_ends_at THEN
          v_next_run := NULL;
        END IF;
      END IF;
    END IF;
  END IF;

  UPDATE public.comm_whatsapp_scheduled_messages AS sm
  SET
    status = CASE
      WHEN p_new_status = 'sent' AND v_msg.recurrence <> 'none' AND v_next_run IS NULL THEN 'expired'
      ELSE p_new_status
    END,
    external_message_id = COALESCE(p_external_message_id, sm.external_message_id),
    delivery_status = COALESCE(p_delivery_status, sm.delivery_status),
    error_message = p_error_message,
    next_retry_at = p_next_retry_at,
    attempts = v_msg.attempts + CASE WHEN p_new_status IN ('sent', 'failed') THEN 1 ELSE 0 END,
    sent_at = CASE WHEN p_new_status = 'sent' THEN v_now ELSE sm.sent_at END,
    cancelled_at = CASE WHEN p_new_status = 'cancelled' THEN v_now ELSE sm.cancelled_at END,
    cancelled_reason = CASE WHEN p_new_status = 'cancelled' THEN p_error_message ELSE sm.cancelled_reason END,
    next_run_at = CASE
      WHEN p_new_status = 'sent' AND v_msg.recurrence <> 'none' THEN v_next_run
      ELSE sm.next_run_at
    END,
    updated_at = v_now
  WHERE sm.id = p_message_id
  RETURNING sm.id, v_msg.status, sm.status, sm.next_run_at
  INTO message_id, old_status, new_status, next_run_at;
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.advance_scheduled_message(uuid, text, text, text, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.advance_scheduled_message(uuid, text, text, text, text, timestamptz) TO service_role;

COMMIT;
