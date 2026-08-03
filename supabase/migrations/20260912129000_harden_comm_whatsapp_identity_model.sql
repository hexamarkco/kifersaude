BEGIN;

ALTER TABLE public.comm_whatsapp_chats
  ADD COLUMN IF NOT EXISTS merged_into_chat_id uuid,
  ADD COLUMN IF NOT EXISTS lead_link_source text,
  ADD COLUMN IF NOT EXISTS lead_linked_at timestamptz,
  ADD COLUMN IF NOT EXISTS lead_linked_by uuid,
  ADD COLUMN IF NOT EXISTS auto_link_blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS identity_conflict boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'comm_whatsapp_chats_merged_into_chat_id_fkey'
  ) THEN
    ALTER TABLE public.comm_whatsapp_chats
      ADD CONSTRAINT comm_whatsapp_chats_merged_into_chat_id_fkey
      FOREIGN KEY (merged_into_chat_id)
      REFERENCES public.comm_whatsapp_chats(id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'comm_whatsapp_chats_lead_link_source_check'
  ) THEN
    ALTER TABLE public.comm_whatsapp_chats
      ADD CONSTRAINT comm_whatsapp_chats_lead_link_source_check
      CHECK (
        lead_link_source IS NULL
        OR lead_link_source IN ('legacy', 'manual', 'crm_start', 'auto_phone', 'repair')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'comm_whatsapp_chats_not_self_merged_check'
  ) THEN
    ALTER TABLE public.comm_whatsapp_chats
      ADD CONSTRAINT comm_whatsapp_chats_not_self_merged_check
      CHECK (merged_into_chat_id IS NULL OR merged_into_chat_id <> id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'comm_whatsapp_chats_id_channel_id_key'
  ) THEN
    ALTER TABLE public.comm_whatsapp_chats
      ADD CONSTRAINT comm_whatsapp_chats_id_channel_id_key UNIQUE (id, channel_id);
  END IF;
END;
$$;

UPDATE public.comm_whatsapp_chats
SET lead_link_source = 'legacy',
    lead_linked_at = COALESCE(lead_linked_at, updated_at, created_at)
WHERE lead_id IS NOT NULL
  AND lead_link_source IS NULL;

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_chats_merged_into
  ON public.comm_whatsapp_chats (merged_into_chat_id)
  WHERE merged_into_chat_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_chats_canonical_inbox
  ON public.comm_whatsapp_chats (channel_id, last_message_at DESC)
  WHERE merged_into_chat_id IS NULL AND deleted_at IS NULL;

ALTER TABLE public.comm_whatsapp_chat_identifiers
  ADD COLUMN IF NOT EXISTS identifier_kind text,
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_observed_at timestamptz NOT NULL DEFAULT now();

UPDATE public.comm_whatsapp_chat_identifiers
SET identifier_kind = CASE
  WHEN external_chat_id ~* '@lid$' THEN 'lid'
  WHEN external_chat_id ~* '@s\.whatsapp\.net$' THEN 'wa_id'
  ELSE 'other'
END
WHERE identifier_kind IS NULL;

ALTER TABLE public.comm_whatsapp_chat_identifiers
  ALTER COLUMN identifier_kind SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'comm_whatsapp_chat_identifiers_kind_check'
  ) THEN
    ALTER TABLE public.comm_whatsapp_chat_identifiers
      ADD CONSTRAINT comm_whatsapp_chat_identifiers_kind_check
      CHECK (identifier_kind IN ('lid', 'wa_id', 'other'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'comm_whatsapp_chat_identifiers_channel_chat_fkey'
  ) THEN
    ALTER TABLE public.comm_whatsapp_chat_identifiers
      ADD CONSTRAINT comm_whatsapp_chat_identifiers_channel_chat_fkey
      FOREIGN KEY (chat_id, channel_id)
      REFERENCES public.comm_whatsapp_chats(id, channel_id)
      ON DELETE CASCADE;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.comm_whatsapp_identity_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key text NOT NULL UNIQUE,
  channel_id uuid NOT NULL REFERENCES public.comm_whatsapp_channels(id) ON DELETE CASCADE,
  chat_id uuid REFERENCES public.comm_whatsapp_chats(id) ON DELETE CASCADE,
  conflict_type text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid,
  CONSTRAINT comm_whatsapp_identity_conflicts_type_check
    CHECK (conflict_type IN ('lead_ambiguous', 'lead_conflict', 'identifier_conflict', 'reverse_mapping_conflict')),
  CONSTRAINT comm_whatsapp_identity_conflicts_status_check
    CHECK (status IN ('open', 'resolved', 'ignored')),
  CONSTRAINT comm_whatsapp_identity_conflicts_details_object_check
    CHECK (jsonb_typeof(details) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_identity_conflicts_open
  ON public.comm_whatsapp_identity_conflicts (status, created_at DESC)
  WHERE status = 'open';

CREATE TABLE IF NOT EXISTS public.comm_whatsapp_chat_merge_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.comm_whatsapp_channels(id) ON DELETE CASCADE,
  winner_chat_id uuid NOT NULL REFERENCES public.comm_whatsapp_chats(id) ON DELETE RESTRICT,
  loser_chat_id uuid NOT NULL REFERENCES public.comm_whatsapp_chats(id) ON DELETE RESTRICT,
  reason text NOT NULL,
  mapping_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  winner_before jsonb NOT NULL,
  loser_before jsonb NOT NULL,
  moved_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comm_whatsapp_chat_merge_log_distinct_check CHECK (winner_chat_id <> loser_chat_id),
  CONSTRAINT comm_whatsapp_chat_merge_log_evidence_object_check CHECK (jsonb_typeof(mapping_evidence) = 'object'),
  CONSTRAINT comm_whatsapp_chat_merge_log_counts_object_check CHECK (jsonb_typeof(moved_counts) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_chat_merge_log_run
  ON public.comm_whatsapp_chat_merge_log (run_id, created_at);

ALTER TABLE public.comm_whatsapp_identity_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comm_whatsapp_chat_merge_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages comm whatsapp identity conflicts" ON public.comm_whatsapp_identity_conflicts;
CREATE POLICY "Service role manages comm whatsapp identity conflicts"
  ON public.comm_whatsapp_identity_conflicts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users view comm whatsapp identity conflicts" ON public.comm_whatsapp_identity_conflicts;
CREATE POLICY "Users view comm whatsapp identity conflicts"
  ON public.comm_whatsapp_identity_conflicts FOR SELECT TO authenticated
  USING (public.current_user_can_view_comm_whatsapp());

DROP POLICY IF EXISTS "Service role manages comm whatsapp merge log" ON public.comm_whatsapp_chat_merge_log;
CREATE POLICY "Service role manages comm whatsapp merge log"
  ON public.comm_whatsapp_chat_merge_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users view comm whatsapp merge log" ON public.comm_whatsapp_chat_merge_log;
CREATE POLICY "Users view comm whatsapp merge log"
  ON public.comm_whatsapp_chat_merge_log FOR SELECT TO authenticated
  USING (public.current_user_can_view_comm_whatsapp());

CREATE OR REPLACE FUNCTION public.comm_whatsapp_resolve_chat_uuid(p_chat_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat_id uuid := p_chat_id;
  v_next_id uuid;
  v_channel_id uuid;
  v_next_channel_id uuid;
  v_iteration integer;
BEGIN
  IF v_chat_id IS NULL THEN
    RETURN NULL;
  END IF;

  FOR v_iteration IN 1..16 LOOP
    SELECT c.merged_into_chat_id, c.channel_id
    INTO v_next_id, v_channel_id
    FROM public.comm_whatsapp_chats c
    WHERE c.id = v_chat_id;

    IF NOT FOUND THEN
      RETURN NULL;
    END IF;

    IF v_next_id IS NULL THEN
      RETURN v_chat_id;
    END IF;

    SELECT c.channel_id INTO v_next_channel_id
    FROM public.comm_whatsapp_chats c
    WHERE c.id = v_next_id;

    IF v_next_channel_id IS DISTINCT FROM v_channel_id THEN
      RAISE EXCEPTION 'Redirecionamento de chat entre canais diferentes.';
    END IF;

    v_chat_id := v_next_id;
  END LOOP;

  RAISE EXCEPTION 'Ciclo ou cadeia excessiva de redirecionamento de chat.';
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_resolve_chat_uuid(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_resolve_chat_uuid(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_resolve_canonical_chat_uuid(
  p_channel_id uuid,
  p_external_chat_id text
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_external_chat_id text := NULLIF(public.normalize_comm_whatsapp_chat_id(p_external_chat_id), '');
  v_chat_id uuid;
BEGIN
  IF p_channel_id IS NULL OR v_external_chat_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT identifier.chat_id
  INTO v_chat_id
  FROM public.comm_whatsapp_chat_identifiers identifier
  WHERE identifier.channel_id = p_channel_id
    AND identifier.external_chat_id = v_external_chat_id;

  IF v_chat_id IS NULL THEN
    SELECT chat.id
    INTO v_chat_id
    FROM public.comm_whatsapp_chats chat
    WHERE chat.channel_id = p_channel_id
      AND chat.external_chat_id = v_external_chat_id;
  END IF;

  RETURN public.comm_whatsapp_resolve_chat_uuid(v_chat_id);
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_resolve_canonical_chat_uuid(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_resolve_canonical_chat_uuid(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_resolve_canonical_chat_id(
  p_channel_id uuid,
  p_external_chat_id text
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT chat.external_chat_id
      FROM public.comm_whatsapp_chats chat
      WHERE chat.id = public.comm_whatsapp_resolve_canonical_chat_uuid(p_channel_id, p_external_chat_id)
    ),
    public.normalize_comm_whatsapp_chat_id(p_external_chat_id)
  );
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_resolve_canonical_chat_id(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_resolve_canonical_chat_id(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_register_chat_identifier(
  p_channel_id uuid,
  p_chat_id uuid,
  p_external_chat_id text,
  p_source text DEFAULT 'observed',
  p_verified boolean DEFAULT false,
  p_evidence jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_external_chat_id text := NULLIF(public.normalize_comm_whatsapp_chat_id(p_external_chat_id), '');
  v_chat_id uuid := public.comm_whatsapp_resolve_chat_uuid(p_chat_id);
  v_existing_chat_id uuid;
  v_primary_chat_id uuid;
  v_kind text;
BEGIN
  IF p_channel_id IS NULL OR v_chat_id IS NULL OR v_external_chat_id IS NULL THEN
    RAISE EXCEPTION 'Canal, chat e identificador sao obrigatorios.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.comm_whatsapp_chats c
    WHERE c.id = v_chat_id AND c.channel_id = p_channel_id
  ) THEN
    RAISE EXCEPTION 'Chat canonico nao pertence ao canal informado.';
  END IF;

  SELECT public.comm_whatsapp_resolve_chat_uuid(identifier.chat_id)
  INTO v_existing_chat_id
  FROM public.comm_whatsapp_chat_identifiers identifier
  WHERE identifier.channel_id = p_channel_id
    AND identifier.external_chat_id = v_external_chat_id;

  IF v_existing_chat_id IS NOT NULL AND v_existing_chat_id <> v_chat_id THEN
    RAISE EXCEPTION 'Identificador ja pertence a outro chat canonico.';
  END IF;

  SELECT public.comm_whatsapp_resolve_chat_uuid(chat.id)
  INTO v_primary_chat_id
  FROM public.comm_whatsapp_chats chat
  WHERE chat.channel_id = p_channel_id
    AND chat.external_chat_id = v_external_chat_id;

  IF v_primary_chat_id IS NOT NULL AND v_primary_chat_id <> v_chat_id THEN
    RAISE EXCEPTION 'Identificador primario ja pertence a outro chat canonico.';
  END IF;

  v_kind := CASE
    WHEN v_external_chat_id ~* '@lid$' THEN 'lid'
    WHEN v_external_chat_id ~* '@s\.whatsapp\.net$' THEN 'wa_id'
    ELSE 'other'
  END;

  INSERT INTO public.comm_whatsapp_chat_identifiers (
    channel_id, external_chat_id, chat_id, source, identifier_kind,
    is_verified, evidence, last_confirmed_at, last_observed_at
  )
  VALUES (
    p_channel_id, v_external_chat_id, v_chat_id,
    COALESCE(NULLIF(btrim(p_source), ''), 'observed'), v_kind,
    COALESCE(p_verified, false), COALESCE(p_evidence, '{}'::jsonb), now(), now()
  )
  ON CONFLICT (channel_id, external_chat_id) DO UPDATE
  SET chat_id = EXCLUDED.chat_id,
      source = EXCLUDED.source,
      identifier_kind = EXCLUDED.identifier_kind,
      is_verified = public.comm_whatsapp_chat_identifiers.is_verified OR EXCLUDED.is_verified,
      evidence = public.comm_whatsapp_chat_identifiers.evidence || EXCLUDED.evidence,
      last_confirmed_at = CASE
        WHEN EXCLUDED.is_verified THEN now()
        ELSE public.comm_whatsapp_chat_identifiers.last_confirmed_at
      END,
      last_observed_at = now();

  RETURN v_chat_id;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_register_chat_identifier(uuid, uuid, text, text, boolean, jsonb) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_register_chat_identifier(uuid, uuid, text, text, boolean, jsonb) TO service_role;

INSERT INTO public.comm_whatsapp_chat_identifiers (
  channel_id, external_chat_id, chat_id, source, identifier_kind,
  is_verified, evidence, last_confirmed_at, last_observed_at
)
SELECT
  chat.channel_id,
  public.normalize_comm_whatsapp_chat_id(chat.external_chat_id),
  chat.id,
  'primary_backfill',
  CASE
    WHEN chat.external_chat_id ~* '@lid$' THEN 'lid'
    WHEN chat.external_chat_id ~* '@s\.whatsapp\.net$' THEN 'wa_id'
    ELSE 'other'
  END,
  false,
  '{}'::jsonb,
  now(),
  COALESCE(chat.updated_at, chat.created_at, now())
FROM public.comm_whatsapp_chats chat
WHERE NULLIF(public.normalize_comm_whatsapp_chat_id(chat.external_chat_id), '') IS NOT NULL
ON CONFLICT (channel_id, external_chat_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_try_auto_link_chat(
  p_chat_id uuid,
  p_phone_number text,
  p_source text DEFAULT 'auto_phone'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat public.comm_whatsapp_chats%ROWTYPE;
  v_phone text := NULLIF(public.normalize_comm_whatsapp_phone(p_phone_number), '');
  v_match_count integer := 0;
  v_lead_id uuid;
  v_candidate_ids uuid[];
BEGIN
  SELECT * INTO v_chat
  FROM public.comm_whatsapp_chats
  WHERE id = public.comm_whatsapp_resolve_chat_uuid(p_chat_id)
  FOR UPDATE;

  IF NOT FOUND OR v_phone IS NULL OR v_chat.lead_id IS NOT NULL OR v_chat.auto_link_blocked THEN
    RETURN false;
  END IF;

  SELECT count(*), min(lead.id::text)::uuid, array_agg(lead.id ORDER BY lead.id)
  INTO v_match_count, v_lead_id, v_candidate_ids
  FROM public.leads lead
  WHERE COALESCE(lead.arquivado, false) = false
    AND public.comm_whatsapp_phone_lookup_keys(lead.telefone)
      && public.comm_whatsapp_phone_lookup_keys(v_phone);

  IF v_match_count = 1 THEN
    UPDATE public.comm_whatsapp_chats
    SET lead_id = v_lead_id,
        lead_link_source = COALESCE(NULLIF(btrim(p_source), ''), 'auto_phone'),
        lead_linked_at = now(),
        lead_linked_by = NULL,
        identity_conflict = false,
        updated_at = now()
    WHERE id = v_chat.id;

    UPDATE public.comm_whatsapp_identity_conflicts
    SET status = 'resolved', resolved_at = now(), updated_at = now()
    WHERE dedupe_key = 'lead-ambiguous:' || v_chat.id::text
      AND status = 'open';

    PERFORM public.comm_whatsapp_refresh_chat_identity(v_chat.id);
    RETURN true;
  END IF;

  IF v_match_count > 1 THEN
    INSERT INTO public.comm_whatsapp_identity_conflicts (
      dedupe_key, channel_id, chat_id, conflict_type, details
    )
    VALUES (
      'lead-ambiguous:' || v_chat.id::text,
      v_chat.channel_id,
      v_chat.id,
      'lead_ambiguous',
      jsonb_build_object('phone', v_phone, 'candidate_lead_ids', v_candidate_ids)
    )
    ON CONFLICT (dedupe_key) DO UPDATE
    SET status = 'open',
        details = EXCLUDED.details,
        updated_at = now(),
        resolved_at = NULL,
        resolved_by = NULL;

    UPDATE public.comm_whatsapp_chats
    SET identity_conflict = true, updated_at = now()
    WHERE id = v_chat.id;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_try_auto_link_chat(uuid, text, text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_try_auto_link_chat(uuid, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_reconcile_lid_identifier(
  p_channel_id uuid,
  p_lid_external_chat_id text,
  p_phone_external_chat_id text
)
RETURNS TABLE(
  chat_id uuid,
  external_chat_id text,
  merged boolean,
  conflict_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lid text := NULLIF(public.normalize_comm_whatsapp_chat_id(p_lid_external_chat_id), '');
  v_phone text := NULLIF(public.normalize_comm_whatsapp_chat_id(p_phone_external_chat_id), '');
  v_phone_digits text;
  v_lid_chat_id uuid;
  v_phone_chat_id uuid;
  v_lid_chat public.comm_whatsapp_chats%ROWTYPE;
  v_phone_chat public.comm_whatsapp_chats%ROWTYPE;
  v_winner public.comm_whatsapp_chats%ROWTYPE;
  v_loser public.comm_whatsapp_chats%ROWTYPE;
  v_selected_lead_id uuid;
  v_selected_lead_source text;
  v_lead_conflict boolean := false;
  v_conflict_reason text;
  v_latest_record record;
  v_preview text;
  v_last_read_at timestamptz;
  v_unread integer := 0;
  v_count integer := 0;
  v_counts jsonb := '{}'::jsonb;
  v_run_id uuid := gen_random_uuid();
BEGIN
  IF v_lid IS NULL OR v_phone IS NULL OR v_lid !~* '@lid$' OR v_phone !~* '@s\.whatsapp\.net$' THEN
    RAISE EXCEPTION 'Mapeamento LID e WA ID invalido.';
  END IF;

  v_phone_digits := NULLIF(public.normalize_comm_whatsapp_phone(split_part(v_phone, '@', 1)), '');
  IF v_phone_digits IS NULL OR v_phone_digits = regexp_replace(split_part(v_lid, '@', 1), '\D', '', 'g') THEN
    RAISE EXCEPTION 'Telefone resolvido invalido ou igual ao LID.';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('comm-whatsapp-identity:' || p_channel_id::text || ':' || LEAST(v_lid, v_phone), 0)
  );
  PERFORM pg_advisory_xact_lock(
    hashtextextended('comm-whatsapp-identity:' || p_channel_id::text || ':' || GREATEST(v_lid, v_phone), 0)
  );

  v_lid_chat_id := public.comm_whatsapp_resolve_canonical_chat_uuid(p_channel_id, v_lid);
  v_phone_chat_id := public.comm_whatsapp_resolve_canonical_chat_uuid(p_channel_id, v_phone);

  IF v_lid_chat_id IS NULL AND v_phone_chat_id IS NULL THEN
    INSERT INTO public.comm_whatsapp_chats (
      channel_id, external_chat_id, phone_number, phone_digits, display_name,
      last_message_direction
    )
    VALUES (
      p_channel_id, v_phone, v_phone_digits, v_phone_digits,
      public.comm_whatsapp_format_phone_label(v_phone_digits), 'system'
    )
    RETURNING * INTO v_winner;
  ELSIF v_lid_chat_id IS NOT NULL AND v_phone_chat_id IS NULL THEN
    SELECT * INTO v_winner
    FROM public.comm_whatsapp_chats WHERE id = v_lid_chat_id FOR UPDATE;
  ELSIF v_lid_chat_id IS NULL AND v_phone_chat_id IS NOT NULL THEN
    SELECT * INTO v_winner
    FROM public.comm_whatsapp_chats WHERE id = v_phone_chat_id FOR UPDATE;
  ELSIF v_lid_chat_id = v_phone_chat_id THEN
    SELECT * INTO v_winner
    FROM public.comm_whatsapp_chats WHERE id = v_lid_chat_id FOR UPDATE;
  ELSE
    SELECT * INTO v_lid_chat
    FROM public.comm_whatsapp_chats WHERE id = v_lid_chat_id FOR UPDATE;
    SELECT * INTO v_phone_chat
    FROM public.comm_whatsapp_chats WHERE id = v_phone_chat_id FOR UPDATE;

    IF v_lid_chat.channel_id <> p_channel_id OR v_phone_chat.channel_id <> p_channel_id THEN
      RAISE EXCEPTION 'Chats de canais diferentes nao podem ser reconciliados.';
    END IF;

    IF v_lid_chat.deleted_at IS NULL AND v_phone_chat.deleted_at IS NOT NULL THEN
      v_winner := v_lid_chat;
      v_loser := v_phone_chat;
    ELSIF v_phone_chat.deleted_at IS NULL AND v_lid_chat.deleted_at IS NOT NULL THEN
      v_winner := v_phone_chat;
      v_loser := v_lid_chat;
    ELSIF v_lid_chat.lead_link_source = 'manual' AND v_phone_chat.lead_link_source IS DISTINCT FROM 'manual' THEN
      v_winner := v_lid_chat;
      v_loser := v_phone_chat;
    ELSIF v_phone_chat.lead_link_source = 'manual' AND v_lid_chat.lead_link_source IS DISTINCT FROM 'manual' THEN
      v_winner := v_phone_chat;
      v_loser := v_lid_chat;
    ELSIF v_lid_chat.created_at <= v_phone_chat.created_at THEN
      v_winner := v_lid_chat;
      v_loser := v_phone_chat;
    ELSE
      v_winner := v_phone_chat;
      v_loser := v_lid_chat;
    END IF;

    IF v_winner.lead_id IS NOT NULL AND v_loser.lead_id IS NOT NULL
      AND v_winner.lead_id <> v_loser.lead_id
    THEN
      IF v_winner.lead_link_source = 'manual' AND v_loser.lead_link_source IS DISTINCT FROM 'manual' THEN
        v_selected_lead_id := v_winner.lead_id;
        v_selected_lead_source := 'manual';
      ELSIF v_loser.lead_link_source = 'manual' AND v_winner.lead_link_source IS DISTINCT FROM 'manual' THEN
        v_selected_lead_id := v_loser.lead_id;
        v_selected_lead_source := 'manual';
      ELSE
        v_selected_lead_id := NULL;
        v_selected_lead_source := NULL;
        v_lead_conflict := true;
        v_conflict_reason := 'lead_review_required';
      END IF;
    ELSE
      v_selected_lead_id := COALESCE(v_winner.lead_id, v_loser.lead_id);
      v_selected_lead_source := CASE
        WHEN v_winner.lead_id IS NOT NULL THEN v_winner.lead_link_source
        ELSE v_loser.lead_link_source
      END;
    END IF;

    UPDATE public.comm_whatsapp_messages SET chat_id = v_winner.id WHERE chat_id = v_loser.id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('messages', v_count);

    UPDATE public.comm_whatsapp_enrichment_jobs SET chat_id = v_winner.id WHERE chat_id = v_loser.id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('enrichment_jobs', v_count);

    UPDATE public.comm_whatsapp_ai_intent_suggestions SET chat_id = v_winner.id WHERE chat_id = v_loser.id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('ai_suggestions', v_count);

    UPDATE public.comm_whatsapp_campaign_targets SET chat_id = v_winner.id WHERE chat_id = v_loser.id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('campaign_targets', v_count);

    UPDATE public.comm_whatsapp_opt_outs SET source_chat_id = v_winner.id WHERE source_chat_id = v_loser.id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('opt_outs', v_count);

    UPDATE public.comm_follow_up_audit_log SET chat_id = v_winner.id::text WHERE chat_id = v_loser.id::text;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('follow_up_audit', v_count);

    UPDATE public.comm_whatsapp_chat_identifiers
    SET chat_id = v_winner.id,
        last_confirmed_at = now(),
        last_observed_at = now()
    WHERE chat_id = v_loser.id;

    v_last_read_at := CASE
      WHEN v_winner.last_read_at IS NULL AND v_loser.last_read_at IS NULL THEN NULL
      ELSE GREATEST(
        COALESCE(v_winner.last_read_at, '-infinity'::timestamptz),
        COALESCE(v_loser.last_read_at, '-infinity'::timestamptz)
      )
    END;

    UPDATE public.comm_whatsapp_chats
    SET phone_number = v_phone_digits,
        phone_digits = v_phone_digits,
        lead_id = v_selected_lead_id,
        lead_link_source = v_selected_lead_source,
        lead_linked_at = CASE WHEN v_selected_lead_id IS NULL THEN NULL ELSE COALESCE(v_winner.lead_linked_at, v_loser.lead_linked_at, now()) END,
        lead_linked_by = CASE
          WHEN v_selected_lead_source = 'manual' AND v_winner.lead_link_source = 'manual' THEN v_winner.lead_linked_by
          WHEN v_selected_lead_source = 'manual' THEN v_loser.lead_linked_by
          ELSE NULL
        END,
        auto_link_blocked = v_winner.auto_link_blocked OR v_loser.auto_link_blocked,
        identity_conflict = v_lead_conflict,
        push_name = COALESCE(NULLIF(v_winner.push_name, ''), NULLIF(v_loser.push_name, '')),
        saved_contact_name = COALESCE(NULLIF(v_winner.saved_contact_name, ''), NULLIF(v_loser.saved_contact_name, '')),
        last_read_at = v_last_read_at,
        is_archived = v_winner.is_archived OR v_loser.is_archived,
        archived_at = CASE
          WHEN v_winner.is_archived OR v_loser.is_archived THEN GREATEST(v_winner.archived_at, v_loser.archived_at)
          ELSE NULL
        END,
        is_muted = v_winner.is_muted OR v_loser.is_muted,
        muted_at = CASE
          WHEN v_winner.is_muted OR v_loser.is_muted THEN GREATEST(v_winner.muted_at, v_loser.muted_at)
          ELSE NULL
        END,
        is_pinned = v_winner.is_pinned OR v_loser.is_pinned,
        pinned_at = CASE
          WHEN v_winner.is_pinned OR v_loser.is_pinned THEN GREATEST(v_winner.pinned_at, v_loser.pinned_at)
          ELSE NULL
        END,
        manual_unread = v_winner.manual_unread OR v_loser.manual_unread,
        manual_unread_at = CASE
          WHEN v_winner.manual_unread OR v_loser.manual_unread THEN GREATEST(v_winner.manual_unread_at, v_loser.manual_unread_at)
          ELSE NULL
        END,
        deleted_at = CASE
          WHEN v_winner.deleted_at IS NULL OR v_loser.deleted_at IS NULL THEN NULL
          ELSE LEAST(v_winner.deleted_at, v_loser.deleted_at)
        END,
        updated_at = now()
    WHERE id = v_winner.id
    RETURNING * INTO v_winner;

    UPDATE public.comm_whatsapp_chats
    SET merged_into_chat_id = v_winner.id,
        deleted_at = COALESCE(deleted_at, now()),
        lead_id = NULL,
        lead_link_source = NULL,
        lead_linked_at = NULL,
        lead_linked_by = NULL,
        unread_count = 0,
        manual_unread = false,
        manual_unread_at = NULL,
        updated_at = now()
    WHERE id = v_loser.id;

    IF v_lead_conflict THEN
      INSERT INTO public.comm_whatsapp_identity_conflicts (
        dedupe_key, channel_id, chat_id, conflict_type, details
      )
      VALUES (
        'lead-conflict:' || v_winner.id::text,
        p_channel_id,
        v_winner.id,
        'lead_conflict',
        jsonb_build_object(
          'winner_previous_lead_id', v_winner.lead_id,
          'loser_previous_lead_id', v_loser.lead_id,
          'action', 'unlinked_for_manual_review'
        )
      )
      ON CONFLICT (dedupe_key) DO UPDATE
      SET status = 'open', details = EXCLUDED.details, updated_at = now(), resolved_at = NULL;
    END IF;

    INSERT INTO public.comm_whatsapp_chat_merge_log (
      run_id, channel_id, winner_chat_id, loser_chat_id, reason,
      mapping_evidence, winner_before, loser_before, moved_counts
    )
    VALUES (
      v_run_id, p_channel_id, v_winner.id, v_loser.id, 'verified_lid_phone_mapping',
      jsonb_build_object('lid', v_lid, 'wa_id', v_phone),
      to_jsonb(CASE WHEN v_winner.id = v_lid_chat.id THEN v_lid_chat ELSE v_phone_chat END),
      to_jsonb(v_loser),
      v_counts
    );
  END IF;

  UPDATE public.comm_whatsapp_chats
  SET phone_number = v_phone_digits,
      phone_digits = v_phone_digits,
      updated_at = now()
  WHERE id = v_winner.id
  RETURNING * INTO v_winner;

  PERFORM public.comm_whatsapp_register_chat_identifier(
    p_channel_id, v_winner.id, v_lid, 'whapi_lid_to_id', true,
    jsonb_build_object('paired_with', v_phone)
  );
  PERFORM public.comm_whatsapp_register_chat_identifier(
    p_channel_id, v_winner.id, v_phone, 'whapi_lid_to_id', true,
    jsonb_build_object('paired_with', v_lid)
  );

  PERFORM public.comm_whatsapp_try_auto_link_chat(v_winner.id, v_phone_digits, 'auto_phone');

  SELECT m.text_content, m.message_at, m.direction, m.message_type, m.media_caption
  INTO v_latest_record
  FROM public.comm_whatsapp_messages m
  WHERE m.chat_id = v_winner.id
    AND COALESCE(m.delivery_status, '') <> 'deleted'
  ORDER BY m.message_at DESC, m.created_at DESC, m.id DESC
  LIMIT 1;

  v_preview := CASE
    WHEN v_latest_record.message_at IS NOT NULL THEN public.comm_whatsapp_message_preview_text(
      v_latest_record.media_caption,
      v_latest_record.text_content,
      v_latest_record.message_type
    )
    ELSE NULL
  END;

  SELECT count(*)::integer INTO v_unread
  FROM public.comm_whatsapp_messages message
  JOIN public.comm_whatsapp_chats chat ON chat.id = v_winner.id
  WHERE message.chat_id = v_winner.id
    AND message.direction = 'inbound'
    AND COALESCE(message.delivery_status, '') <> 'deleted'
    AND (chat.last_read_at IS NULL OR message.message_at > chat.last_read_at);

  UPDATE public.comm_whatsapp_chats
  SET last_message_text = COALESCE(v_preview, last_message_text),
      last_message_direction = CASE WHEN v_preview IS NULL THEN last_message_direction ELSE v_latest_record.direction END,
      last_message_at = CASE WHEN v_preview IS NULL THEN last_message_at ELSE v_latest_record.message_at END,
      unread_count = v_unread,
      updated_at = now()
  WHERE id = v_winner.id
  RETURNING * INTO v_winner;

  SELECT * INTO v_winner FROM public.comm_whatsapp_refresh_chat_identity(v_winner.id);

  RETURN QUERY SELECT v_winner.id, v_winner.external_chat_id, true, v_conflict_reason;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_reconcile_lid_identifier(uuid, text, text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_reconcile_lid_identifier(uuid, text, text) TO service_role;

ALTER TABLE public.comm_whatsapp_phone_contacts_cache
  ALTER COLUMN phone_number DROP NOT NULL,
  ALTER COLUMN phone_digits DROP NOT NULL;

ALTER TABLE public.comm_whatsapp_phone_contacts_cache
  ADD COLUMN IF NOT EXISTS push_name text;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_refresh_chat_identity(p_chat_id uuid)
RETURNS SETOF public.comm_whatsapp_chats
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat public.comm_whatsapp_chats%ROWTYPE;
  v_saved_contact_name text;
  v_lead_name text;
  v_connected_user_name text;
  v_safe_push_name text;
  v_display_name text;
BEGIN
  SELECT * INTO v_chat
  FROM public.comm_whatsapp_chats
  WHERE id = public.comm_whatsapp_resolve_chat_uuid(p_chat_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT NULLIF(btrim(contact.display_name), '')
  INTO v_saved_contact_name
  FROM public.comm_whatsapp_phone_contacts_cache contact
  WHERE contact.channel_id = v_chat.channel_id
    AND contact.saved = true
    AND public.comm_whatsapp_is_valid_display_name(contact.display_name)
    AND (
      (
        NULLIF(btrim(COALESCE(contact.phone_digits, '')), '') IS NOT NULL
        AND NULLIF(btrim(COALESCE(v_chat.phone_digits, '')), '') IS NOT NULL
        AND public.comm_whatsapp_phone_lookup_keys(contact.phone_digits)
          && public.comm_whatsapp_phone_lookup_keys(v_chat.phone_digits)
      )
      OR EXISTS (
        SELECT 1
        FROM public.comm_whatsapp_chat_identifiers identifier
        WHERE identifier.chat_id = v_chat.id
          AND identifier.channel_id = v_chat.channel_id
          AND identifier.external_chat_id = public.normalize_comm_whatsapp_chat_id(contact.contact_id)
      )
    )
  ORDER BY
    CASE WHEN contact.contact_id LIKE 'manual:%' THEN 0 ELSE 1 END,
    contact.updated_at DESC,
    contact.last_synced_at DESC,
    contact.id DESC
  LIMIT 1;

  SELECT NULLIF(btrim(lead.nome_completo), '')
  INTO v_lead_name
  FROM public.leads lead
  WHERE lead.id = v_chat.lead_id
    AND public.comm_whatsapp_is_valid_display_name(lead.nome_completo);

  SELECT NULLIF(btrim(channel.connected_user_name), '')
  INTO v_connected_user_name
  FROM public.comm_whatsapp_channels channel
  WHERE channel.id = v_chat.channel_id;

  v_safe_push_name := NULLIF(btrim(v_chat.push_name), '');
  IF v_safe_push_name IS NOT NULL AND (
    NOT public.comm_whatsapp_is_valid_display_name(v_safe_push_name)
    OR (v_connected_user_name IS NOT NULL AND lower(v_safe_push_name) = lower(v_connected_user_name))
  ) THEN
    v_safe_push_name := NULL;
  END IF;

  v_display_name := COALESCE(
    v_saved_contact_name,
    v_lead_name,
    v_safe_push_name,
    CASE
      WHEN NULLIF(btrim(COALESCE(v_chat.phone_number, '')), '') IS NOT NULL
        THEN public.comm_whatsapp_format_phone_label(v_chat.phone_number)
      ELSE 'Contato privado'
    END
  );

  IF v_chat.saved_contact_name IS DISTINCT FROM v_saved_contact_name
    OR v_chat.push_name IS DISTINCT FROM v_safe_push_name
    OR v_chat.display_name IS DISTINCT FROM v_display_name
  THEN
    UPDATE public.comm_whatsapp_chats
    SET saved_contact_name = v_saved_contact_name,
        push_name = v_safe_push_name,
        display_name = v_display_name,
        updated_at = now()
    WHERE id = v_chat.id
    RETURNING * INTO v_chat;
  END IF;

  RETURN NEXT v_chat;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_refresh_chat_identity(uuid) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_refresh_chat_identity(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_refresh_channel_chat_identities(p_channel_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat record;
  v_count integer := 0;
BEGIN
  FOR v_chat IN
    SELECT id
    FROM public.comm_whatsapp_chats
    WHERE channel_id = p_channel_id
      AND merged_into_chat_id IS NULL
  LOOP
    PERFORM public.comm_whatsapp_refresh_chat_identity(v_chat.id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_refresh_channel_chat_identities(uuid) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_refresh_channel_chat_identities(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_link_chat_lead(p_chat_id uuid, p_lead_id uuid)
RETURNS SETOF public.comm_whatsapp_chats
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat_id uuid := public.comm_whatsapp_resolve_chat_uuid(p_chat_id);
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_can_edit_comm_whatsapp() THEN
    RAISE EXCEPTION 'Permissao insuficiente para vincular lead.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.leads WHERE id = p_lead_id) THEN
    RAISE EXCEPTION 'Lead nao encontrado para vinculo.';
  END IF;

  UPDATE public.comm_whatsapp_chats
  SET lead_id = p_lead_id,
      lead_link_source = 'manual',
      lead_linked_at = now(),
      lead_linked_by = auth.uid(),
      auto_link_blocked = false,
      identity_conflict = false,
      updated_at = now()
  WHERE id = v_chat_id;

  UPDATE public.comm_whatsapp_identity_conflicts
  SET status = 'resolved', resolved_at = now(), resolved_by = auth.uid(), updated_at = now()
  WHERE chat_id = v_chat_id AND status = 'open' AND conflict_type IN ('lead_ambiguous', 'lead_conflict');

  RETURN QUERY SELECT * FROM public.comm_whatsapp_refresh_chat_identity(v_chat_id);
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_link_chat_lead(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_link_chat_lead(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_unlink_chat_lead(p_chat_id uuid)
RETURNS SETOF public.comm_whatsapp_chats
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat_id uuid := public.comm_whatsapp_resolve_chat_uuid(p_chat_id);
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_can_edit_comm_whatsapp() THEN
    RAISE EXCEPTION 'Permissao insuficiente para desvincular lead.';
  END IF;

  UPDATE public.comm_whatsapp_chats
  SET lead_id = NULL,
      lead_link_source = NULL,
      lead_linked_at = NULL,
      lead_linked_by = NULL,
      auto_link_blocked = true,
      updated_at = now()
  WHERE id = v_chat_id;

  RETURN QUERY SELECT * FROM public.comm_whatsapp_refresh_chat_identity(v_chat_id);
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_unlink_chat_lead(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_unlink_chat_lead(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_open_or_create_chat(
  p_external_chat_id text,
  p_phone_number text,
  p_push_name text DEFAULT NULL,
  p_saved_contact_name text DEFAULT NULL,
  p_lead_id uuid DEFAULT NULL
)
RETURNS SETOF public.comm_whatsapp_chats
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_channel_id uuid;
  v_chat public.comm_whatsapp_chats%ROWTYPE;
  v_chat_id uuid;
  v_phone_number text := NULLIF(public.normalize_comm_whatsapp_phone(COALESCE(p_phone_number, '')), '');
  v_saved_contact_name text := NULLIF(btrim(COALESCE(p_saved_contact_name, '')), '');
  v_push_name text := NULLIF(btrim(COALESCE(p_push_name, '')), '');
  v_lead_name text;
  v_external_chat_id text := NULLIF(public.normalize_comm_whatsapp_chat_id(p_external_chat_id), '');
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_can_edit_comm_whatsapp() THEN
    RAISE EXCEPTION 'Permissao insuficiente para iniciar conversa.';
  END IF;

  IF v_phone_number IS NULL OR v_external_chat_id !~* '@s\.whatsapp\.net$' THEN
    RAISE EXCEPTION 'WA ID canonico obrigatorio para iniciar conversa.';
  END IF;

  SELECT id INTO v_channel_id
  FROM public.comm_whatsapp_channels
  WHERE slug = 'primary'
  LIMIT 1;

  v_chat_id := public.comm_whatsapp_resolve_canonical_chat_uuid(v_channel_id, v_external_chat_id);

  IF p_lead_id IS NOT NULL THEN
    SELECT NULLIF(btrim(nome_completo), '') INTO v_lead_name
    FROM public.leads WHERE id = p_lead_id;
  END IF;

  IF v_chat_id IS NULL THEN
    INSERT INTO public.comm_whatsapp_chats (
      channel_id, external_chat_id, phone_number, phone_digits, display_name,
      push_name, saved_contact_name, lead_id, lead_link_source, lead_linked_at,
      lead_linked_by, last_message_direction, unread_count, status
    )
    VALUES (
      v_channel_id, v_external_chat_id, v_phone_number, v_phone_number,
      COALESCE(v_saved_contact_name, v_lead_name, v_push_name, public.comm_whatsapp_format_phone_label(v_phone_number)),
      v_push_name, v_saved_contact_name, p_lead_id,
      CASE WHEN p_lead_id IS NULL THEN NULL ELSE 'crm_start' END,
      CASE WHEN p_lead_id IS NULL THEN NULL ELSE now() END,
      CASE WHEN p_lead_id IS NULL THEN NULL ELSE auth.uid() END,
      'system', 0, 'open'
    )
    RETURNING * INTO v_chat;
  ELSE
    SELECT * INTO v_chat FROM public.comm_whatsapp_chats WHERE id = v_chat_id FOR UPDATE;

    IF p_lead_id IS NOT NULL AND v_chat.lead_id IS NOT NULL AND v_chat.lead_id <> p_lead_id THEN
      RAISE EXCEPTION 'A identidade WhatsApp ja esta vinculada a outro lead.';
    END IF;

    UPDATE public.comm_whatsapp_chats
    SET phone_number = v_phone_number,
        phone_digits = v_phone_number,
        push_name = COALESCE(v_push_name, push_name),
        saved_contact_name = COALESCE(v_saved_contact_name, saved_contact_name),
        lead_id = COALESCE(p_lead_id, lead_id),
        lead_link_source = CASE WHEN p_lead_id IS NULL THEN lead_link_source ELSE 'crm_start' END,
        lead_linked_at = CASE WHEN p_lead_id IS NULL THEN lead_linked_at ELSE now() END,
        lead_linked_by = CASE WHEN p_lead_id IS NULL THEN lead_linked_by ELSE auth.uid() END,
        updated_at = now()
    WHERE id = v_chat.id
    RETURNING * INTO v_chat;
  END IF;

  PERFORM public.comm_whatsapp_register_chat_identifier(
    v_channel_id, v_chat.id, v_external_chat_id, 'open_or_create', true, '{}'::jsonb
  );

  RETURN QUERY SELECT * FROM public.comm_whatsapp_refresh_chat_identity(v_chat.id);
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_open_or_create_chat(text, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_open_or_create_chat(text, text, text, text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_persist_message(
  p_channel_id uuid,
  p_external_chat_id text,
  p_phone_number text,
  p_display_name text,
  p_push_name text,
  p_last_message_text text,
  p_last_message_direction text,
  p_last_message_at timestamptz,
  p_increment_unread boolean,
  p_external_message_id text,
  p_direction text,
  p_message_type text,
  p_delivery_status text,
  p_text_content text,
  p_created_by uuid,
  p_source text,
  p_sender_name text,
  p_sender_phone text,
  p_status_updated_at timestamptz,
  p_error_message text,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_media_id text DEFAULT NULL,
  p_media_url text DEFAULT NULL,
  p_media_mime_type text DEFAULT NULL,
  p_media_file_name text DEFAULT NULL,
  p_media_size_bytes bigint DEFAULT NULL,
  p_media_duration_seconds integer DEFAULT NULL,
  p_media_caption text DEFAULT NULL
)
RETURNS TABLE(
  chat_id uuid,
  message_id uuid,
  inserted boolean,
  unread_count integer,
  summary_updated boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result record;
  v_input_external_chat_id text := NULLIF(public.normalize_comm_whatsapp_chat_id(p_external_chat_id), '');
  v_resolved_external_chat_id text;
  v_canonical_chat_id uuid;
  v_phone_number text := NULLIF(public.normalize_comm_whatsapp_phone(COALESCE(p_phone_number, '')), '');
  v_display_name text := NULLIF(btrim(COALESCE(p_display_name, '')), '');
  v_direction text := COALESCE(NULLIF(btrim(COALESCE(p_direction, '')), ''), 'system');
  v_message_at timestamptz := COALESCE(p_last_message_at, p_status_updated_at, now());
  v_summary_text text := public.comm_whatsapp_message_preview_text(
    p_media_caption,
    COALESCE(p_text_content, p_last_message_text),
    COALESCE(NULLIF(btrim(COALESCE(p_message_type, '')), ''), 'text')
  );
  v_input_is_lid boolean := false;
  v_lid_digits text;
  v_unread_count integer;
BEGIN
  IF v_input_external_chat_id IS NULL THEN
    RAISE EXCEPTION 'Identificador externo obrigatorio.';
  END IF;

  v_input_is_lid := v_input_external_chat_id ~* '@lid$';
  v_lid_digits := regexp_replace(split_part(v_input_external_chat_id, '@', 1), '\D', '', 'g');
  IF v_input_is_lid AND v_phone_number = v_lid_digits THEN
    v_phone_number := NULL;
  END IF;

  v_canonical_chat_id := public.comm_whatsapp_resolve_canonical_chat_uuid(p_channel_id, v_input_external_chat_id);
  IF v_canonical_chat_id IS NOT NULL THEN
    SELECT external_chat_id,
           COALESCE(v_phone_number, NULLIF(btrim(phone_digits), ''))
    INTO v_resolved_external_chat_id, v_phone_number
    FROM public.comm_whatsapp_chats
    WHERE id = v_canonical_chat_id;
  ELSE
    v_resolved_external_chat_id := v_input_external_chat_id;
  END IF;

  IF v_phone_number IS NULL AND v_resolved_external_chat_id ~* '@s\.whatsapp\.net$' THEN
    v_phone_number := NULLIF(public.normalize_comm_whatsapp_phone(split_part(v_resolved_external_chat_id, '@', 1)), '');
  END IF;

  INSERT INTO public.comm_whatsapp_chats (
    channel_id, external_chat_id, phone_number, phone_digits, display_name, last_message_direction
  )
  VALUES (
    p_channel_id,
    v_resolved_external_chat_id,
    COALESCE(v_phone_number, ''),
    COALESCE(v_phone_number, ''),
    COALESCE(v_display_name, public.comm_whatsapp_format_phone_label(v_phone_number), 'Contato privado'),
    'system'
  )
  ON CONFLICT (channel_id, external_chat_id) DO NOTHING;

  SELECT * INTO v_result
  FROM public.comm_whatsapp_persist_message_internal(
    p_channel_id, v_resolved_external_chat_id, v_phone_number, p_display_name, p_push_name,
    p_last_message_text, p_last_message_direction, p_last_message_at, p_increment_unread,
    p_external_message_id, p_direction, p_message_type, p_delivery_status, p_text_content,
    p_created_by, p_source, p_sender_name, p_sender_phone, p_status_updated_at,
    p_error_message, p_metadata, p_media_id, p_media_url, p_media_mime_type,
    p_media_file_name, p_media_size_bytes, p_media_duration_seconds, p_media_caption
  );

  v_result.chat_id := public.comm_whatsapp_resolve_chat_uuid(v_result.chat_id);

  IF v_input_is_lid AND v_phone_number IS NULL THEN
    UPDATE public.comm_whatsapp_chats chat
    SET phone_number = '',
        phone_digits = '',
        display_name = CASE
          WHEN regexp_replace(COALESCE(chat.display_name, ''), '\D', '', 'g') = v_lid_digits
            THEN COALESCE(NULLIF(btrim(chat.push_name), ''), 'Contato privado')
          ELSE chat.display_name
        END,
        updated_at = now()
    WHERE chat.id = v_result.chat_id;
  END IF;

  PERFORM public.comm_whatsapp_register_chat_identifier(
    p_channel_id,
    v_result.chat_id,
    v_input_external_chat_id,
    COALESCE(NULLIF(btrim(p_source), ''), 'message'),
    false,
    jsonb_build_object('external_message_id', p_external_message_id)
  );

  IF v_resolved_external_chat_id <> v_input_external_chat_id THEN
    PERFORM public.comm_whatsapp_register_chat_identifier(
      p_channel_id, v_result.chat_id, v_resolved_external_chat_id, 'canonical', false, '{}'::jsonb
    );
  END IF;

  IF v_phone_number IS NOT NULL THEN
    PERFORM public.comm_whatsapp_try_auto_link_chat(v_result.chat_id, v_phone_number, 'auto_phone');
  END IF;

  PERFORM public.comm_whatsapp_refresh_chat_identity(v_result.chat_id);

  IF v_result.inserted
    AND v_direction IN ('inbound', 'outbound')
    AND v_summary_text IS NOT NULL
  THEN
    UPDATE public.comm_whatsapp_chats chat
    SET is_archived = false, archived_at = NULL, updated_at = now()
    WHERE chat.id = v_result.chat_id
      AND chat.is_archived
      AND NOT chat.is_muted
      AND (chat.archived_at IS NULL OR v_message_at > chat.archived_at)
    RETURNING chat.unread_count INTO v_unread_count;
  END IF;

  RETURN QUERY SELECT
    v_result.chat_id,
    v_result.message_id,
    v_result.inserted,
    COALESCE(v_unread_count, v_result.unread_count),
    v_result.summary_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_persist_message(
  uuid, text, text, text, text, text, text, timestamptz, boolean, text, text, text, text, text, uuid, text, text, text, timestamptz, text, jsonb, text, text, text, text, bigint, integer, text
) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_persist_message(
  uuid, text, text, text, text, text, text, timestamptz, boolean, text, text, text, text, text, uuid, text, text, text, timestamptz, text, jsonb, text, text, text, text, bigint, integer, text
) TO service_role;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_list_messages_page(
  p_chat_id uuid,
  p_before_message_at timestamptz DEFAULT NULL,
  p_before_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS SETOF public.comm_whatsapp_messages
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT message.*
  FROM public.comm_whatsapp_messages message
  WHERE message.chat_id = public.comm_whatsapp_resolve_chat_uuid(p_chat_id)
    AND public.current_user_can_view_comm_whatsapp()
    AND (
      p_before_message_at IS NULL
      OR message.message_at < p_before_message_at
      OR (
        message.message_at = p_before_message_at
        AND p_before_id IS NOT NULL
        AND message.id < p_before_id
      )
    )
  ORDER BY message.message_at DESC, message.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 201);
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_list_messages_page(uuid, timestamptz, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_list_messages_page(uuid, timestamptz, uuid, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.enqueue_comm_whatsapp_message_enrichment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_identity_payload jsonb;
  v_media_payload jsonb;
  v_requeue_identity boolean := false;
BEGIN
  IF NEW.chat_id IS NOT NULL AND COALESCE(NEW.message_type, '') <> 'action' THEN
    SELECT chat.external_chat_id ~* '@lid$'
      AND NULLIF(btrim(COALESCE(chat.phone_digits, '')), '') IS NULL
    INTO v_requeue_identity
    FROM public.comm_whatsapp_chats chat
    WHERE chat.id = public.comm_whatsapp_resolve_chat_uuid(NEW.chat_id);

    v_identity_payload := jsonb_build_object(
      'external_message_id', NEW.external_message_id,
      'message_id', NEW.id
    );

    INSERT INTO public.comm_whatsapp_enrichment_jobs (
      kind, channel_id, chat_id, message_id, dedupe_key, payload
    )
    VALUES (
      'chat_identity', NEW.channel_id, public.comm_whatsapp_resolve_chat_uuid(NEW.chat_id), NEW.id,
      'identity:' || NEW.channel_id::text || ':' || public.comm_whatsapp_resolve_chat_uuid(NEW.chat_id)::text,
      v_identity_payload
    )
    ON CONFLICT (dedupe_key) DO UPDATE
    SET message_id = EXCLUDED.message_id,
        chat_id = EXCLUDED.chat_id,
        payload = EXCLUDED.payload,
        status = CASE
          WHEN v_requeue_identity AND public.comm_whatsapp_enrichment_jobs.status IN ('completed', 'failed') THEN 'queued'
          ELSE public.comm_whatsapp_enrichment_jobs.status
        END,
        attempts = CASE
          WHEN v_requeue_identity AND public.comm_whatsapp_enrichment_jobs.status IN ('completed', 'failed') THEN 0
          ELSE public.comm_whatsapp_enrichment_jobs.attempts
        END,
        next_attempt_at = CASE
          WHEN v_requeue_identity AND public.comm_whatsapp_enrichment_jobs.status IN ('completed', 'failed') THEN now()
          ELSE public.comm_whatsapp_enrichment_jobs.next_attempt_at
        END,
        completed_at = CASE
          WHEN v_requeue_identity AND public.comm_whatsapp_enrichment_jobs.status IN ('completed', 'failed') THEN NULL
          ELSE public.comm_whatsapp_enrichment_jobs.completed_at
        END,
        last_error = CASE
          WHEN v_requeue_identity AND public.comm_whatsapp_enrichment_jobs.status IN ('completed', 'failed') THEN NULL
          ELSE public.comm_whatsapp_enrichment_jobs.last_error
        END,
        updated_at = now();
  END IF;

  IF NULLIF(btrim(COALESCE(NEW.media_id, '')), '') IS NOT NULL THEN
    v_media_payload := jsonb_build_object(
      'media_id', NEW.media_id,
      'media_url', NEW.media_url,
      'media_mime_type', NEW.media_mime_type,
      'media_file_name', NEW.media_file_name
    );

    INSERT INTO public.comm_whatsapp_enrichment_jobs (
      kind, channel_id, chat_id, message_id, dedupe_key, payload
    )
    VALUES (
      'media_archive', NEW.channel_id, public.comm_whatsapp_resolve_chat_uuid(NEW.chat_id), NEW.id,
      'media:' || NEW.channel_id::text || ':' || NEW.media_id,
      v_media_payload
    )
    ON CONFLICT (dedupe_key) DO UPDATE
    SET message_id = EXCLUDED.message_id,
        chat_id = EXCLUDED.chat_id,
        payload = EXCLUDED.payload,
        status = CASE
          WHEN public.comm_whatsapp_enrichment_jobs.status = 'failed' THEN 'queued'
          ELSE public.comm_whatsapp_enrichment_jobs.status
        END,
        next_attempt_at = CASE
          WHEN public.comm_whatsapp_enrichment_jobs.status = 'failed' THEN now()
          ELSE public.comm_whatsapp_enrichment_jobs.next_attempt_at
        END,
        last_error = CASE
          WHEN public.comm_whatsapp_enrichment_jobs.status = 'failed' THEN NULL
          ELSE public.comm_whatsapp_enrichment_jobs.last_error
        END,
        updated_at = now()
    WHERE public.comm_whatsapp_enrichment_jobs.status <> 'completed';
  END IF;

  RETURN NULL;
END;
$$;

INSERT INTO public.comm_whatsapp_enrichment_jobs (
  kind, channel_id, chat_id, message_id, dedupe_key, payload, status, attempts, next_attempt_at
)
SELECT
  'chat_identity',
  chat.channel_id,
  chat.id,
  NULL,
  'identity:' || chat.channel_id::text || ':' || chat.id::text,
  jsonb_build_object('reason', 'identity_model_backfill'),
  'queued',
  0,
  now()
FROM public.comm_whatsapp_chats chat
WHERE chat.merged_into_chat_id IS NULL
  AND chat.external_chat_id ~* '@lid$'
  AND (
    NULLIF(btrim(COALESCE(chat.phone_digits, '')), '') IS NULL
    OR regexp_replace(chat.phone_digits, '\D', '', 'g') = regexp_replace(split_part(chat.external_chat_id, '@', 1), '\D', '', 'g')
  )
ON CONFLICT (dedupe_key) DO UPDATE
SET status = 'queued',
    attempts = 0,
    next_attempt_at = now(),
    completed_at = NULL,
    last_error = NULL,
    updated_at = now();

CREATE OR REPLACE FUNCTION public.refresh_comm_whatsapp_identity_after_lead_name_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat record;
BEGIN
  IF NEW.nome_completo IS DISTINCT FROM OLD.nome_completo THEN
    FOR v_chat IN
      SELECT id
      FROM public.comm_whatsapp_chats
      WHERE lead_id = NEW.id
        AND merged_into_chat_id IS NULL
    LOOP
      PERFORM public.comm_whatsapp_refresh_chat_identity(v_chat.id);
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_comm_whatsapp_identity_after_lead_name ON public.leads;
CREATE TRIGGER trg_refresh_comm_whatsapp_identity_after_lead_name
  AFTER UPDATE OF nome_completo ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_comm_whatsapp_identity_after_lead_name_change();

SELECT public.comm_whatsapp_refresh_chat_identity(chat.id)
FROM public.comm_whatsapp_chats chat
WHERE chat.merged_into_chat_id IS NULL;

NOTIFY pgrst, 'reload schema';

COMMIT;
