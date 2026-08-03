BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE OR REPLACE FUNCTION public.comm_whatsapp_is_valid_display_name(p_value text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  WITH normalized AS (
    SELECT btrim(COALESCE(p_value, '')) AS value
  )
  SELECT value <> ''
    AND value !~* '@(lid|s\.whatsapp\.net|c\.us|g\.us)$'
    AND regexp_replace(value, '[\s()+-]', '', 'g') !~ '^\+?[0-9]+$'
    AND value !~ '^[[:space:][:punct:]]+$'
  FROM normalized;
$$;

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
    WHERE conname = 'comm_whatsapp_chats_id_channel_id_key'
      AND conrelid = 'public.comm_whatsapp_chats'::regclass
  ) THEN
    ALTER TABLE public.comm_whatsapp_chats
      ADD CONSTRAINT comm_whatsapp_chats_id_channel_id_key UNIQUE (id, channel_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'comm_whatsapp_chats_merged_into_channel_fkey'
      AND conrelid = 'public.comm_whatsapp_chats'::regclass
  ) THEN
    ALTER TABLE public.comm_whatsapp_chats
      ADD CONSTRAINT comm_whatsapp_chats_merged_into_channel_fkey
      FOREIGN KEY (merged_into_chat_id, channel_id)
      REFERENCES public.comm_whatsapp_chats(id, channel_id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'comm_whatsapp_chats_lead_link_source_check'
      AND conrelid = 'public.comm_whatsapp_chats'::regclass
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
      AND conrelid = 'public.comm_whatsapp_chats'::regclass
  ) THEN
    ALTER TABLE public.comm_whatsapp_chats
      ADD CONSTRAINT comm_whatsapp_chats_not_self_merged_check
      CHECK (merged_into_chat_id IS NULL OR merged_into_chat_id <> id);
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
      AND conrelid = 'public.comm_whatsapp_chat_identifiers'::regclass
  ) THEN
    ALTER TABLE public.comm_whatsapp_chat_identifiers
      ADD CONSTRAINT comm_whatsapp_chat_identifiers_kind_check
      CHECK (identifier_kind IN ('lid', 'wa_id', 'other'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'comm_whatsapp_chat_identifiers_channel_chat_fkey'
      AND conrelid = 'public.comm_whatsapp_chat_identifiers'::regclass
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'comm_whatsapp_identity_conflicts_channel_chat_fkey'
      AND conrelid = 'public.comm_whatsapp_identity_conflicts'::regclass
  ) THEN
    ALTER TABLE public.comm_whatsapp_identity_conflicts
      ADD CONSTRAINT comm_whatsapp_identity_conflicts_channel_chat_fkey
      FOREIGN KEY (chat_id, channel_id)
      REFERENCES public.comm_whatsapp_chats(id, channel_id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'comm_whatsapp_chat_merge_log_winner_channel_fkey'
      AND conrelid = 'public.comm_whatsapp_chat_merge_log'::regclass
  ) THEN
    ALTER TABLE public.comm_whatsapp_chat_merge_log
      ADD CONSTRAINT comm_whatsapp_chat_merge_log_winner_channel_fkey
      FOREIGN KEY (winner_chat_id, channel_id)
      REFERENCES public.comm_whatsapp_chats(id, channel_id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'comm_whatsapp_chat_merge_log_loser_channel_fkey'
      AND conrelid = 'public.comm_whatsapp_chat_merge_log'::regclass
  ) THEN
    ALTER TABLE public.comm_whatsapp_chat_merge_log
      ADD CONSTRAINT comm_whatsapp_chat_merge_log_loser_channel_fkey
      FOREIGN KEY (loser_chat_id, channel_id)
      REFERENCES public.comm_whatsapp_chats(id, channel_id)
      ON DELETE RESTRICT;
  END IF;
END;
$$;

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

COMMIT;

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

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

  IF auth.role() = 'authenticated' AND NOT public.current_user_can_view_comm_whatsapp() THEN
    RAISE EXCEPTION 'Permissao insuficiente para consultar conversa.';
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
    AND identifier.external_chat_id = v_external_chat_id
    AND identifier.is_verified;

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

CREATE OR REPLACE FUNCTION public.comm_whatsapp_get_canonical_chat_route(
  p_chat_id uuid DEFAULT NULL,
  p_channel_id uuid DEFAULT NULL,
  p_external_chat_id text DEFAULT NULL
)
RETURNS TABLE(
  chat_id uuid,
  channel_id uuid,
  external_chat_id text,
  phone_number text,
  display_name text,
  push_name text,
  lead_id uuid,
  identity_conflict boolean,
  deleted_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH resolved AS (
    SELECT CASE
      WHEN p_chat_id IS NOT NULL THEN public.comm_whatsapp_resolve_chat_uuid(p_chat_id)
      WHEN p_channel_id IS NOT NULL AND NULLIF(btrim(COALESCE(p_external_chat_id, '')), '') IS NOT NULL
        THEN public.comm_whatsapp_resolve_canonical_chat_uuid(p_channel_id, p_external_chat_id)
      ELSE NULL::uuid
    END AS chat_id
  )
  SELECT
    chat.id,
    chat.channel_id,
    chat.external_chat_id,
    NULLIF(btrim(chat.phone_digits), ''),
    NULLIF(btrim(chat.display_name), ''),
    NULLIF(btrim(chat.push_name), ''),
    chat.lead_id,
    chat.identity_conflict,
    chat.deleted_at
  FROM resolved
  JOIN public.comm_whatsapp_chats AS chat ON chat.id = resolved.chat_id
  WHERE chat.merged_into_chat_id IS NULL
    AND (p_channel_id IS NULL OR chat.channel_id = p_channel_id)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_get_canonical_chat_route(uuid, uuid, text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_get_canonical_chat_route(uuid, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_lock_canonical_chat_uuid(p_chat_id uuid)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat_id uuid := p_chat_id;
  v_next_chat_id uuid;
  v_iteration integer;
BEGIN
  IF v_chat_id IS NULL THEN
    RETURN NULL;
  END IF;

  FOR v_iteration IN 1..16 LOOP
    SELECT chat.merged_into_chat_id
    INTO v_next_chat_id
    FROM public.comm_whatsapp_chats AS chat
    WHERE chat.id = v_chat_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN NULL;
    END IF;

    IF v_next_chat_id IS NULL THEN
      RETURN v_chat_id;
    END IF;

    v_chat_id := v_next_chat_id;
  END LOOP;

  RAISE EXCEPTION 'Ciclo ou cadeia excessiva de redirecionamento de chat.';
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_lock_canonical_chat_uuid(uuid) FROM PUBLIC, authenticated;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_canonicalize_chat_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_value text;
  v_chat_id uuid;
  v_next_chat_id uuid;
  v_iteration integer;
BEGIN
  IF TG_NARGS <> 1 THEN
    RAISE EXCEPTION 'A coluna da referencia canonica do chat nao foi configurada.';
  END IF;

  v_value := NULLIF(btrim(to_jsonb(NEW) ->> TG_ARGV[0]), '');
  IF v_value IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_chat_id := v_value::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN NEW;
  END;

  FOR v_iteration IN 1..16 LOOP
    SELECT chat.merged_into_chat_id
    INTO v_next_chat_id
    FROM public.comm_whatsapp_chats AS chat
    WHERE chat.id = v_chat_id
    FOR SHARE;

    IF NOT FOUND THEN
      RETURN NEW;
    END IF;

    EXIT WHEN v_next_chat_id IS NULL;
    v_chat_id := v_next_chat_id;
  END LOOP;

  IF v_next_chat_id IS NOT NULL THEN
    RAISE EXCEPTION 'Ciclo ou cadeia excessiva de redirecionamento de chat.';
  END IF;

  IF v_chat_id::text IS DISTINCT FROM v_value THEN
    NEW := jsonb_populate_record(NEW, jsonb_build_object(TG_ARGV[0], v_chat_id::text));
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_canonicalize_chat_reference() FROM PUBLIC, authenticated;

DROP TRIGGER IF EXISTS trg_comm_whatsapp_messages_canonical_chat ON public.comm_whatsapp_messages;
CREATE TRIGGER trg_comm_whatsapp_messages_canonical_chat
  BEFORE INSERT OR UPDATE OF chat_id ON public.comm_whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.comm_whatsapp_canonicalize_chat_reference('chat_id');

DROP TRIGGER IF EXISTS trg_comm_whatsapp_identifiers_canonical_chat ON public.comm_whatsapp_chat_identifiers;
CREATE TRIGGER trg_comm_whatsapp_identifiers_canonical_chat
  BEFORE INSERT OR UPDATE OF chat_id ON public.comm_whatsapp_chat_identifiers
  FOR EACH ROW EXECUTE FUNCTION public.comm_whatsapp_canonicalize_chat_reference('chat_id');

DROP TRIGGER IF EXISTS trg_comm_whatsapp_enrichment_jobs_canonical_chat ON public.comm_whatsapp_enrichment_jobs;
CREATE TRIGGER trg_comm_whatsapp_enrichment_jobs_canonical_chat
  BEFORE INSERT OR UPDATE OF chat_id ON public.comm_whatsapp_enrichment_jobs
  FOR EACH ROW EXECUTE FUNCTION public.comm_whatsapp_canonicalize_chat_reference('chat_id');

DROP TRIGGER IF EXISTS trg_comm_whatsapp_identity_conflicts_canonical_chat ON public.comm_whatsapp_identity_conflicts;
CREATE TRIGGER trg_comm_whatsapp_identity_conflicts_canonical_chat
  BEFORE INSERT OR UPDATE OF chat_id ON public.comm_whatsapp_identity_conflicts
  FOR EACH ROW EXECUTE FUNCTION public.comm_whatsapp_canonicalize_chat_reference('chat_id');

DROP TRIGGER IF EXISTS trg_comm_whatsapp_campaign_targets_canonical_chat ON public.comm_whatsapp_campaign_targets;
CREATE TRIGGER trg_comm_whatsapp_campaign_targets_canonical_chat
  BEFORE INSERT OR UPDATE OF chat_id ON public.comm_whatsapp_campaign_targets
  FOR EACH ROW EXECUTE FUNCTION public.comm_whatsapp_canonicalize_chat_reference('chat_id');

DROP TRIGGER IF EXISTS trg_comm_whatsapp_ai_suggestions_canonical_chat ON public.comm_whatsapp_ai_intent_suggestions;
CREATE TRIGGER trg_comm_whatsapp_ai_suggestions_canonical_chat
  BEFORE INSERT OR UPDATE OF chat_id ON public.comm_whatsapp_ai_intent_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.comm_whatsapp_canonicalize_chat_reference('chat_id');

DROP TRIGGER IF EXISTS trg_comm_whatsapp_opt_outs_canonical_chat ON public.comm_whatsapp_opt_outs;
CREATE TRIGGER trg_comm_whatsapp_opt_outs_canonical_chat
  BEFORE INSERT OR UPDATE OF source_chat_id ON public.comm_whatsapp_opt_outs
  FOR EACH ROW EXECUTE FUNCTION public.comm_whatsapp_canonicalize_chat_reference('source_chat_id');

DROP TRIGGER IF EXISTS trg_comm_follow_up_audit_canonical_chat ON public.comm_follow_up_audit_log;
CREATE TRIGGER trg_comm_follow_up_audit_canonical_chat
  BEFORE INSERT OR UPDATE OF chat_id ON public.comm_follow_up_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.comm_whatsapp_canonicalize_chat_reference('chat_id');

CREATE OR REPLACE FUNCTION public.comm_whatsapp_sync_identity_conflict_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat_id uuid;
  v_candidate_chat_id uuid;
  v_chat_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.chat_id IS NOT NULL THEN
    v_candidate_chat_id := public.comm_whatsapp_lock_canonical_chat_uuid(NEW.chat_id);
    IF v_candidate_chat_id IS NOT NULL THEN
      v_chat_ids := array_append(v_chat_ids, v_candidate_chat_id);
    END IF;
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.chat_id IS NOT NULL THEN
    v_candidate_chat_id := public.comm_whatsapp_lock_canonical_chat_uuid(OLD.chat_id);
    IF v_candidate_chat_id IS NOT NULL AND NOT v_candidate_chat_id = ANY(v_chat_ids) THEN
      v_chat_ids := array_append(v_chat_ids, v_candidate_chat_id);
    END IF;
  END IF;

  FOREACH v_chat_id IN ARRAY v_chat_ids LOOP
    UPDATE public.comm_whatsapp_chats AS chat
    SET identity_conflict = EXISTS (
          SELECT 1
          FROM public.comm_whatsapp_identity_conflicts AS conflict
          WHERE public.comm_whatsapp_resolve_chat_uuid(conflict.chat_id) = v_chat_id
            AND conflict.status = 'open'
        ),
        updated_at = now()
    WHERE chat.id = v_chat_id;
  END LOOP;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_sync_identity_conflict_flag() FROM PUBLIC, authenticated;

DROP TRIGGER IF EXISTS trg_comm_whatsapp_identity_conflicts_sync_chat ON public.comm_whatsapp_identity_conflicts;
CREATE TRIGGER trg_comm_whatsapp_identity_conflicts_sync_chat
  AFTER INSERT OR UPDATE OF chat_id, status OR DELETE ON public.comm_whatsapp_identity_conflicts
  FOR EACH ROW EXECUTE FUNCTION public.comm_whatsapp_sync_identity_conflict_flag();

CREATE OR REPLACE FUNCTION public.comm_whatsapp_set_chat_push_name(
  p_chat_id uuid,
  p_push_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat_id uuid := public.comm_whatsapp_lock_canonical_chat_uuid(p_chat_id);
  v_push_name text := NULLIF(btrim(COALESCE(p_push_name, '')), '');
BEGIN
  IF v_chat_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT public.comm_whatsapp_is_valid_display_name(v_push_name) THEN
    v_push_name := NULL;
  END IF;

  UPDATE public.comm_whatsapp_chats
  SET push_name = v_push_name,
      updated_at = now()
  WHERE id = v_chat_id
    AND merged_into_chat_id IS NULL;

  PERFORM public.comm_whatsapp_refresh_chat_identity(v_chat_id);
  RETURN v_chat_id;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_set_chat_push_name(uuid, text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_set_chat_push_name(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_clear_invalid_lid_phone(
  p_chat_id uuid,
  p_fallback_name text DEFAULT 'Contato privado'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat_id uuid := public.comm_whatsapp_lock_canonical_chat_uuid(p_chat_id);
  v_updated boolean := false;
BEGIN
  IF v_chat_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.comm_whatsapp_chats AS chat
  SET phone_number = '',
      phone_digits = '',
      display_name = CASE
        WHEN public.comm_whatsapp_is_valid_display_name(p_fallback_name) THEN btrim(p_fallback_name)
        ELSE 'Contato privado'
      END,
      updated_at = now()
  WHERE chat.id = v_chat_id
    AND chat.merged_into_chat_id IS NULL
    AND chat.external_chat_id ~* '@lid$'
    AND regexp_replace(COALESCE(chat.phone_digits, ''), '\D', '', 'g')
      = regexp_replace(split_part(chat.external_chat_id, '@', 1), '\D', '', 'g');

  v_updated := FOUND;
  PERFORM public.comm_whatsapp_refresh_chat_identity(v_chat_id);
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_clear_invalid_lid_phone(uuid, text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_clear_invalid_lid_phone(uuid, text) TO service_role;

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
  v_chat_id uuid;
  v_existing_chat_id uuid;
  v_existing_verified boolean := false;
  v_primary_chat_id uuid;
  v_kind text;
BEGIN
  v_chat_id := public.comm_whatsapp_resolve_chat_uuid(p_chat_id);

  IF p_channel_id IS NULL OR v_chat_id IS NULL OR v_external_chat_id IS NULL THEN
    RAISE EXCEPTION 'Canal, chat e identificador sao obrigatorios.';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('comm-whatsapp-identity:' || p_channel_id::text || ':' || v_external_chat_id, 0)
  );

  v_chat_id := public.comm_whatsapp_resolve_chat_uuid(p_chat_id);

  IF NOT EXISTS (
    SELECT 1 FROM public.comm_whatsapp_chats c
    WHERE c.id = v_chat_id AND c.channel_id = p_channel_id
  ) THEN
    RAISE EXCEPTION 'Chat canonico nao pertence ao canal informado.';
  END IF;

  SELECT public.comm_whatsapp_resolve_chat_uuid(identifier.chat_id), identifier.is_verified
  INTO v_existing_chat_id, v_existing_verified
  FROM public.comm_whatsapp_chat_identifiers identifier
  WHERE identifier.channel_id = p_channel_id
    AND identifier.external_chat_id = v_external_chat_id;

  IF v_existing_chat_id IS NOT NULL AND v_existing_chat_id <> v_chat_id AND v_existing_verified THEN
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
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULL::uuid, NULL::text, false, 'round_trip_evidence_required'::text;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_reconcile_lid_identifier(uuid, text, text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_reconcile_lid_identifier(uuid, text, text) TO service_role;

LOCK TABLE public.comm_whatsapp_chats, public.comm_whatsapp_chat_identifiers IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.comm_whatsapp_chats AS chat
    WHERE NULLIF(public.normalize_comm_whatsapp_chat_id(chat.external_chat_id), '') IS NOT NULL
    GROUP BY chat.channel_id, public.normalize_comm_whatsapp_chat_id(chat.external_chat_id)
    HAVING count(DISTINCT public.comm_whatsapp_resolve_chat_uuid(chat.id)::text) > 1
  ) THEN
    RAISE EXCEPTION 'Chats primarios normalizados ainda apontam para identidades canonicas diferentes.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.comm_whatsapp_chat_identifiers AS identifier
    JOIN public.comm_whatsapp_chats AS primary_chat
      ON primary_chat.channel_id = identifier.channel_id
     AND public.normalize_comm_whatsapp_chat_id(primary_chat.external_chat_id) = identifier.external_chat_id
    WHERE public.comm_whatsapp_resolve_chat_uuid(identifier.chat_id)
      IS DISTINCT FROM public.comm_whatsapp_resolve_chat_uuid(primary_chat.id)
  ) THEN
    RAISE EXCEPTION 'Conflito entre identificador legado e chat primario; reparo manual obrigatorio.';
  END IF;
END;
$$;

WITH primary_candidates AS (
  SELECT DISTINCT ON (
    chat.channel_id,
    public.normalize_comm_whatsapp_chat_id(chat.external_chat_id)
  )
    chat.channel_id,
    public.normalize_comm_whatsapp_chat_id(chat.external_chat_id) AS external_chat_id,
    public.comm_whatsapp_resolve_chat_uuid(chat.id) AS chat_id,
    chat.external_chat_id AS original_external_chat_id,
    COALESCE(chat.updated_at, chat.created_at, now()) AS observed_at
  FROM public.comm_whatsapp_chats AS chat
  WHERE NULLIF(public.normalize_comm_whatsapp_chat_id(chat.external_chat_id), '') IS NOT NULL
  ORDER BY
    chat.channel_id,
    public.normalize_comm_whatsapp_chat_id(chat.external_chat_id),
    (chat.merged_into_chat_id IS NULL) DESC,
    (chat.deleted_at IS NULL) DESC,
    chat.created_at,
    chat.id
)
INSERT INTO public.comm_whatsapp_chat_identifiers (
  channel_id, external_chat_id, chat_id, source, identifier_kind,
  is_verified, evidence, last_confirmed_at, last_observed_at
)
SELECT
  candidate.channel_id,
  candidate.external_chat_id,
  candidate.chat_id,
  'primary_backfill',
  CASE
    WHEN candidate.external_chat_id ~* '@lid$' THEN 'lid'
    WHEN candidate.external_chat_id ~* '@s\.whatsapp\.net$' THEN 'wa_id'
    ELSE 'other'
  END,
  true,
  jsonb_build_object(
    'primary_chat_id', candidate.chat_id,
    'original_external_chat_id', candidate.original_external_chat_id
  ),
  now(),
  candidate.observed_at
FROM primary_candidates AS candidate
ON CONFLICT (channel_id, external_chat_id) DO UPDATE
SET is_verified = true,
    evidence = public.comm_whatsapp_chat_identifiers.evidence || EXCLUDED.evidence,
    last_confirmed_at = now(),
    last_observed_at = GREATEST(public.comm_whatsapp_chat_identifiers.last_observed_at, EXCLUDED.last_observed_at)
WHERE public.comm_whatsapp_resolve_chat_uuid(public.comm_whatsapp_chat_identifiers.chat_id)
  = public.comm_whatsapp_resolve_chat_uuid(EXCLUDED.chat_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.comm_whatsapp_chat_identifiers AS identifier
    JOIN public.comm_whatsapp_chats AS primary_chat
      ON primary_chat.channel_id = identifier.channel_id
     AND public.normalize_comm_whatsapp_chat_id(primary_chat.external_chat_id) = identifier.external_chat_id
    WHERE NOT identifier.is_verified
      OR public.comm_whatsapp_resolve_chat_uuid(identifier.chat_id)
        IS DISTINCT FROM public.comm_whatsapp_resolve_chat_uuid(primary_chat.id)
  ) THEN
    RAISE EXCEPTION 'Certificacao de identificadores primarios nao atingiu a pos-condicao esperada.';
  END IF;
END;
$$;

COMMIT;

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

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

  IF NOT FOUND
    OR v_phone IS NULL
    OR v_chat.lead_id IS NOT NULL
    OR v_chat.auto_link_blocked
    OR EXISTS (
      SELECT 1
      FROM public.comm_whatsapp_identity_conflicts AS conflict
      WHERE conflict.chat_id = v_chat.id
        AND conflict.status = 'open'
    )
  THEN
    RETURN false;
  END IF;

  SELECT count(*), min(lead.id::text)::uuid, array_agg(lead.id ORDER BY lead.id)
  INTO v_match_count, v_lead_id, v_candidate_ids
  FROM public.leads lead
  WHERE COALESCE(lead.arquivado, false) = false
    AND public.comm_whatsapp_phone_lookup_keys(lead.telefone)
      && public.comm_whatsapp_phone_lookup_keys(v_phone);

  IF v_match_count = 1 THEN
    UPDATE public.comm_whatsapp_chats AS chat
    SET lead_id = v_lead_id,
        lead_link_source = COALESCE(NULLIF(btrim(p_source), ''), 'auto_phone'),
        lead_linked_at = now(),
        lead_linked_by = NULL,
        identity_conflict = EXISTS (
          SELECT 1
          FROM public.comm_whatsapp_identity_conflicts AS conflict
          WHERE conflict.chat_id = chat.id
            AND conflict.status = 'open'
        ),
        updated_at = now()
    WHERE chat.id = v_chat.id;

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
    SET identity_conflict = true,
        auto_link_blocked = true,
        updated_at = now()
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
  p_phone_external_chat_id text,
  p_mapping_evidence jsonb
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
  v_selected_lead_linked_at timestamptz;
  v_selected_lead_linked_by uuid;
  v_winner_previous_lead_id uuid;
  v_loser_previous_lead_id uuid;
  v_lead_conflict boolean := false;
  v_conflict_reason text;
  v_connected_user_name text;
  v_winner_before jsonb;
  v_latest_record record;
  v_preview text;
  v_last_read_at timestamptz;
  v_unread integer := 0;
  v_count integer := 0;
  v_counts jsonb := '{}'::jsonb;
  v_run_id uuid := gen_random_uuid();
BEGIN
  IF jsonb_typeof(COALESCE(p_mapping_evidence, '{}'::jsonb)) <> 'object'
    OR COALESCE(p_mapping_evidence ->> 'round_trip_verified', 'false') <> 'true'
  THEN
    RAISE EXCEPTION 'Reconciliacao exige evidencia bidirecional confirmada.';
  END IF;

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
    PERFORM chat.id
    FROM public.comm_whatsapp_chats AS chat
    WHERE chat.id IN (v_lid_chat_id, v_phone_chat_id)
    ORDER BY chat.id
    FOR UPDATE;

    SELECT * INTO v_lid_chat
    FROM public.comm_whatsapp_chats WHERE id = v_lid_chat_id;
    SELECT * INTO v_phone_chat
    FROM public.comm_whatsapp_chats WHERE id = v_phone_chat_id;

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

    v_winner_before := to_jsonb(v_winner);
    v_winner_previous_lead_id := v_winner.lead_id;
    v_loser_previous_lead_id := v_loser.lead_id;

    SELECT NULLIF(btrim(channel.connected_user_name), '')
    INTO v_connected_user_name
    FROM public.comm_whatsapp_channels AS channel
    WHERE channel.id = p_channel_id;

    IF v_winner.lead_id IS NOT NULL AND v_loser.lead_id IS NOT NULL
      AND v_winner.lead_id <> v_loser.lead_id
    THEN
      IF v_winner.lead_link_source = 'manual' AND v_loser.lead_link_source IS DISTINCT FROM 'manual' THEN
        v_selected_lead_id := v_winner.lead_id;
        v_selected_lead_source := v_winner.lead_link_source;
        v_selected_lead_linked_at := v_winner.lead_linked_at;
        v_selected_lead_linked_by := v_winner.lead_linked_by;
      ELSIF v_loser.lead_link_source = 'manual' AND v_winner.lead_link_source IS DISTINCT FROM 'manual' THEN
        v_selected_lead_id := v_loser.lead_id;
        v_selected_lead_source := v_loser.lead_link_source;
        v_selected_lead_linked_at := v_loser.lead_linked_at;
        v_selected_lead_linked_by := v_loser.lead_linked_by;
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
      v_selected_lead_linked_at := CASE
        WHEN v_winner.lead_id IS NOT NULL THEN v_winner.lead_linked_at
        ELSE v_loser.lead_linked_at
      END;
      v_selected_lead_linked_by := CASE
        WHEN v_winner.lead_id IS NOT NULL THEN v_winner.lead_linked_by
        ELSE v_loser.lead_linked_by
      END;
    END IF;

    UPDATE public.comm_whatsapp_messages AS message
    SET chat_id = v_winner.id
    WHERE message.chat_id = v_loser.id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('messages', v_count);

    UPDATE public.comm_whatsapp_enrichment_jobs AS job
    SET chat_id = v_winner.id
    WHERE job.chat_id = v_loser.id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('enrichment_jobs', v_count);

    UPDATE public.comm_whatsapp_ai_intent_suggestions AS suggestion
    SET chat_id = v_winner.id
    WHERE suggestion.chat_id = v_loser.id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('ai_suggestions', v_count);

    UPDATE public.comm_whatsapp_campaign_targets AS target
    SET chat_id = v_winner.id
    WHERE target.chat_id = v_loser.id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('campaign_targets', v_count);

    UPDATE public.comm_whatsapp_opt_outs AS opt_out
    SET source_chat_id = v_winner.id
    WHERE opt_out.source_chat_id = v_loser.id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('opt_outs', v_count);

    UPDATE public.comm_follow_up_audit_log AS audit
    SET chat_id = v_winner.id::text
    WHERE audit.chat_id = v_loser.id::text;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('follow_up_audit', v_count);

    UPDATE public.comm_whatsapp_chat_identifiers AS identifier
    SET chat_id = v_winner.id,
        last_confirmed_at = now(),
        last_observed_at = now()
    WHERE identifier.chat_id = v_loser.id;

    UPDATE public.comm_whatsapp_identity_conflicts AS conflict
    SET chat_id = v_winner.id,
        updated_at = now()
    WHERE conflict.chat_id = v_loser.id;

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
        lead_linked_at = CASE WHEN v_selected_lead_id IS NULL THEN NULL ELSE COALESCE(v_selected_lead_linked_at, now()) END,
        lead_linked_by = CASE WHEN v_selected_lead_id IS NULL THEN NULL ELSE v_selected_lead_linked_by END,
        auto_link_blocked = v_winner.auto_link_blocked OR v_loser.auto_link_blocked OR v_lead_conflict,
        identity_conflict = v_winner.identity_conflict OR v_loser.identity_conflict OR v_lead_conflict,
        push_name = CASE
          WHEN public.comm_whatsapp_is_valid_display_name(v_winner.push_name)
            AND (v_connected_user_name IS NULL OR lower(btrim(v_winner.push_name)) <> lower(v_connected_user_name))
            THEN btrim(v_winner.push_name)
          WHEN public.comm_whatsapp_is_valid_display_name(v_loser.push_name)
            AND (v_connected_user_name IS NULL OR lower(btrim(v_loser.push_name)) <> lower(v_connected_user_name))
            THEN btrim(v_loser.push_name)
          ELSE NULL
        END,
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
        identity_conflict = false,
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
          'winner_previous_lead_id', v_winner_previous_lead_id,
          'loser_previous_lead_id', v_loser_previous_lead_id,
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
      COALESCE(p_mapping_evidence, '{}'::jsonb) || jsonb_build_object('lid', v_lid, 'wa_id', v_phone),
      v_winner_before,
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

  UPDATE public.comm_whatsapp_identity_conflicts AS conflict
  SET status = 'resolved',
      resolved_at = now(),
      updated_at = now()
  WHERE conflict.chat_id = v_winner.id
    AND conflict.status = 'open'
    AND conflict.conflict_type = 'reverse_mapping_conflict'
    AND (
      conflict.dedupe_key = 'reverse:' || p_channel_id::text || ':' || v_lid || ':' || v_phone
      OR (
        conflict.details ->> 'lid_chat_id' = v_lid
        AND conflict.details ->> 'phone_chat_id' = v_phone
      )
    );

  IF NOT v_lead_conflict THEN
    PERFORM public.comm_whatsapp_try_auto_link_chat(v_winner.id, v_phone_digits, 'auto_phone');
  END IF;

  SELECT
    m.text_content,
    m.message_at,
    m.direction,
    m.message_type,
    m.media_caption,
    public.comm_whatsapp_message_preview_text(m.media_caption, m.text_content, m.message_type) AS preview
  INTO v_latest_record
  FROM public.comm_whatsapp_messages m
  WHERE m.chat_id = v_winner.id
    AND COALESCE(m.delivery_status, '') <> 'deleted'
    AND public.comm_whatsapp_message_preview_text(m.media_caption, m.text_content, m.message_type) IS NOT NULL
  ORDER BY m.message_at DESC, m.created_at DESC, m.id DESC
  LIMIT 1;

  v_preview := CASE WHEN v_latest_record.message_at IS NOT NULL THEN v_latest_record.preview ELSE NULL END;

  SELECT count(*)::integer INTO v_unread
  FROM public.comm_whatsapp_messages message
  JOIN public.comm_whatsapp_chats chat ON chat.id = v_winner.id
  WHERE message.chat_id = v_winner.id
    AND message.direction = 'inbound'
    AND COALESCE(message.delivery_status, '') <> 'deleted'
    AND public.comm_whatsapp_message_preview_text(
      message.media_caption,
      message.text_content,
      message.message_type
    ) IS NOT NULL
    AND (chat.last_read_at IS NULL OR message.message_at > chat.last_read_at);

  UPDATE public.comm_whatsapp_chats
  SET last_message_text = COALESCE(v_preview, last_message_text),
      last_message_direction = CASE WHEN v_preview IS NULL THEN last_message_direction ELSE v_latest_record.direction END,
      last_message_at = CASE WHEN v_preview IS NULL THEN last_message_at ELSE v_latest_record.message_at END,
      unread_count = v_unread,
      updated_at = now()
  WHERE id = v_winner.id
  RETURNING * INTO v_winner;

  UPDATE public.comm_whatsapp_chats AS chat
  SET identity_conflict = EXISTS (
        SELECT 1
        FROM public.comm_whatsapp_identity_conflicts AS conflict
        WHERE conflict.chat_id = chat.id
          AND conflict.status = 'open'
      ),
      updated_at = now()
  WHERE chat.id = v_winner.id
  RETURNING * INTO v_winner;

  SELECT * INTO v_winner FROM public.comm_whatsapp_refresh_chat_identity(v_winner.id);

  RETURN QUERY SELECT v_winner.id, v_winner.external_chat_id, true, v_conflict_reason;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_reconcile_lid_identifier(uuid, text, text, jsonb) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_reconcile_lid_identifier(uuid, text, text, jsonb) TO service_role;

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
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    NULL::uuid,
    NULL::text,
    false,
    'round_trip_evidence_required'::text;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_reconcile_lid_identifier(uuid, text, text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_reconcile_lid_identifier(uuid, text, text) TO service_role;

COMMIT;

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE public.comm_whatsapp_phone_contacts_cache
  ALTER COLUMN phone_number DROP NOT NULL,
  ALTER COLUMN phone_digits DROP NOT NULL;

ALTER TABLE public.comm_whatsapp_phone_contacts_cache
  ADD COLUMN IF NOT EXISTS push_name text;

COMMIT;

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

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
  v_chat_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_can_edit_comm_whatsapp() THEN
    RAISE EXCEPTION 'Permissao insuficiente para vincular lead.';
  END IF;

  v_chat_id := public.comm_whatsapp_lock_canonical_chat_uuid(p_chat_id);
  IF v_chat_id IS NULL THEN
    RAISE EXCEPTION 'Conversa do WhatsApp nao encontrada.' USING ERRCODE = 'P0002';
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
      updated_at = now()
  WHERE id = v_chat_id
    AND deleted_at IS NULL
    AND merged_into_chat_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversa do WhatsApp nao encontrada.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.comm_whatsapp_identity_conflicts
  SET status = 'resolved', resolved_at = now(), resolved_by = auth.uid(), updated_at = now()
  WHERE chat_id = v_chat_id AND status = 'open' AND conflict_type IN ('lead_ambiguous', 'lead_conflict');

  UPDATE public.comm_whatsapp_chats AS chat
  SET identity_conflict = EXISTS (
        SELECT 1
        FROM public.comm_whatsapp_identity_conflicts AS conflict
        WHERE conflict.chat_id = chat.id
          AND conflict.status = 'open'
      ),
      updated_at = now()
  WHERE chat.id = v_chat_id;

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
  v_chat_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_can_edit_comm_whatsapp() THEN
    RAISE EXCEPTION 'Permissao insuficiente para desvincular lead.';
  END IF;

  v_chat_id := public.comm_whatsapp_lock_canonical_chat_uuid(p_chat_id);
  IF v_chat_id IS NULL THEN
    RAISE EXCEPTION 'Conversa do WhatsApp nao encontrada.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.comm_whatsapp_chats
  SET lead_id = NULL,
      lead_link_source = NULL,
      lead_linked_at = NULL,
      lead_linked_by = NULL,
      auto_link_blocked = true,
      updated_at = now()
  WHERE id = v_chat_id
    AND deleted_at IS NULL
    AND merged_into_chat_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversa do WhatsApp nao encontrada.' USING ERRCODE = 'P0002';
  END IF;

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

  IF v_phone_number IS NULL
    OR v_external_chat_id IS NULL
    OR v_external_chat_id !~* '@s\.whatsapp\.net$'
    OR public.normalize_comm_whatsapp_phone(split_part(v_external_chat_id, '@', 1)) <> v_phone_number
  THEN
    RAISE EXCEPTION 'WA ID canonico obrigatorio para iniciar conversa.';
  END IF;

  SELECT id INTO v_channel_id
  FROM public.comm_whatsapp_channels
  WHERE slug = 'primary'
  LIMIT 1;

  IF v_channel_id IS NULL THEN
    RAISE EXCEPTION 'Canal principal do WhatsApp nao encontrado.';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('comm-whatsapp-identity:' || v_channel_id::text || ':' || v_external_chat_id, 0)
  );

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
        lead_link_source = CASE
          WHEN p_lead_id IS NULL THEN lead_link_source
          WHEN lead_id = p_lead_id AND lead_link_source = 'manual' THEN lead_link_source
          ELSE 'crm_start'
        END,
        lead_linked_at = CASE
          WHEN p_lead_id IS NULL OR (lead_id = p_lead_id AND lead_link_source = 'manual') THEN lead_linked_at
          ELSE now()
        END,
        lead_linked_by = CASE
          WHEN p_lead_id IS NULL OR (lead_id = p_lead_id AND lead_link_source = 'manual') THEN lead_linked_by
          ELSE auth.uid()
        END,
        deleted_at = NULL,
        is_archived = false,
        archived_at = NULL,
        status = 'open',
        updated_at = now()
    WHERE id = v_chat.id
    RETURNING * INTO v_chat;
  END IF;

  PERFORM public.comm_whatsapp_register_chat_identifier(
    v_channel_id, v_chat.id, v_external_chat_id, 'open_or_create', true, '{}'::jsonb
  );

  IF p_lead_id IS NOT NULL THEN
    UPDATE public.comm_whatsapp_identity_conflicts AS conflict
    SET status = 'resolved',
        resolved_at = now(),
        resolved_by = auth.uid(),
        updated_at = now()
    WHERE conflict.chat_id = v_chat.id
      AND conflict.status = 'open'
      AND conflict.conflict_type IN ('lead_ambiguous', 'lead_conflict');

    UPDATE public.comm_whatsapp_chats AS chat
    SET identity_conflict = EXISTS (
          SELECT 1
          FROM public.comm_whatsapp_identity_conflicts AS conflict
          WHERE conflict.chat_id = chat.id
            AND conflict.status = 'open'
        ),
        updated_at = now()
    WHERE chat.id = v_chat.id;
  END IF;

  RETURN QUERY SELECT * FROM public.comm_whatsapp_refresh_chat_identity(v_chat.id);
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_open_or_create_chat(text, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_open_or_create_chat(text, text, text, text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_ensure_observed_chat(
  p_channel_id uuid,
  p_external_chat_id text,
  p_phone_number text DEFAULT NULL,
  p_push_name text DEFAULT NULL
)
RETURNS SETOF public.comm_whatsapp_chats
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_external_chat_id text := NULLIF(public.normalize_comm_whatsapp_chat_id(p_external_chat_id), '');
  v_phone_number text := NULLIF(public.normalize_comm_whatsapp_phone(COALESCE(p_phone_number, '')), '');
  v_push_name text := NULLIF(btrim(COALESCE(p_push_name, '')), '');
  v_chat_id uuid;
  v_chat public.comm_whatsapp_chats%ROWTYPE;
BEGIN
  IF p_channel_id IS NULL
    OR v_external_chat_id IS NULL
    OR v_external_chat_id !~* '(@lid|@s\.whatsapp\.net)$'
  THEN
    RAISE EXCEPTION 'Canal e identificador direto observado sao obrigatorios.';
  END IF;

  IF v_external_chat_id ~* '@s\.whatsapp\.net$' THEN
    v_phone_number := public.normalize_comm_whatsapp_phone(split_part(v_external_chat_id, '@', 1));
  ELSIF v_phone_number = regexp_replace(split_part(v_external_chat_id, '@', 1), '\D', '', 'g') THEN
    v_phone_number := NULL;
  END IF;

  IF NOT public.comm_whatsapp_is_valid_display_name(v_push_name) THEN
    v_push_name := NULL;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('comm-whatsapp-identity:' || p_channel_id::text || ':' || v_external_chat_id, 0)
  );

  v_chat_id := public.comm_whatsapp_resolve_canonical_chat_uuid(p_channel_id, v_external_chat_id);

  IF v_chat_id IS NULL THEN
    INSERT INTO public.comm_whatsapp_chats (
      channel_id,
      external_chat_id,
      phone_number,
      phone_digits,
      display_name,
      push_name,
      last_message_direction
    )
    VALUES (
      p_channel_id,
      v_external_chat_id,
      COALESCE(v_phone_number, ''),
      COALESCE(v_phone_number, ''),
      COALESCE(
        v_push_name,
        CASE WHEN v_phone_number IS NULL THEN NULL ELSE public.comm_whatsapp_format_phone_label(v_phone_number) END,
        'Contato privado'
      ),
      v_push_name,
      'system'
    )
    ON CONFLICT (channel_id, external_chat_id) DO NOTHING;

    v_chat_id := public.comm_whatsapp_resolve_canonical_chat_uuid(p_channel_id, v_external_chat_id);
  END IF;

  SELECT * INTO v_chat
  FROM public.comm_whatsapp_chats AS chat
  WHERE chat.id = v_chat_id
    AND chat.channel_id = p_channel_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nao foi possivel garantir o chat observado.';
  END IF;

  UPDATE public.comm_whatsapp_chats AS chat
  SET phone_number = COALESCE(v_phone_number, chat.phone_number),
      phone_digits = COALESCE(v_phone_number, chat.phone_digits),
      push_name = COALESCE(v_push_name, chat.push_name),
      updated_at = now()
  WHERE chat.id = v_chat.id
  RETURNING * INTO v_chat;

  PERFORM public.comm_whatsapp_register_chat_identifier(
    p_channel_id,
    v_chat.id,
    v_external_chat_id,
    'provider_observed',
    true,
    '{}'::jsonb
  );

  RETURN QUERY SELECT * FROM public.comm_whatsapp_refresh_chat_identity(v_chat.id);
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_ensure_observed_chat(uuid, text, text, text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_ensure_observed_chat(uuid, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.resolve_comm_whatsapp_campaign_stop_on_reply(
  p_chat_id uuid,
  p_message_at timestamptz
)
RETURNS TABLE(target_id uuid, campaign_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat_id uuid := public.comm_whatsapp_lock_canonical_chat_uuid(p_chat_id);
  v_phone_digits text;
BEGIN
  IF v_chat_id IS NULL THEN
    RETURN;
  END IF;

  SELECT NULLIF(btrim(chat.phone_digits), '')
  INTO v_phone_digits
  FROM public.comm_whatsapp_chats AS chat
  WHERE chat.id = v_chat_id;

  RETURN QUERY
  WITH matched_target AS (
    SELECT target.id, target.campaign_id
    FROM public.comm_whatsapp_campaign_targets AS target
    JOIN public.comm_whatsapp_campaigns AS campaign ON campaign.id = target.campaign_id
    WHERE (
        public.comm_whatsapp_resolve_chat_uuid(target.chat_id) = v_chat_id
        OR (
          v_phone_digits IS NOT NULL
          AND public.comm_whatsapp_phone_lookup_keys(target.phone_digits)
            && public.comm_whatsapp_phone_lookup_keys(v_phone_digits)
        )
      )
      AND campaign.stop_on_reply = true
      AND target.status IN ('scheduled', 'sent', 'sending')
      AND target.responded_at IS NULL
    ORDER BY target.sent_at DESC NULLS LAST
    LIMIT 1
  )
  UPDATE public.comm_whatsapp_campaign_targets AS target
  SET status = 'responded',
      responded_at = p_message_at,
      stopped_at = p_message_at,
      stopped_reason = 'inbound_reply',
      chat_id = v_chat_id,
      updated_at = now()
  FROM matched_target
  WHERE target.id = matched_target.id
  RETURNING matched_target.id, matched_target.campaign_id;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_comm_whatsapp_campaign_stop_on_reply(uuid, timestamptz) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_comm_whatsapp_campaign_stop_on_reply(uuid, timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.resolve_comm_whatsapp_campaign_stop_on_reply(
  p_external_chat_id text,
  p_message_at timestamptz
)
RETURNS TABLE(target_id uuid, campaign_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_channel_id uuid;
  v_chat_id uuid;
BEGIN
  SELECT channel.id
  INTO v_channel_id
  FROM public.comm_whatsapp_channels AS channel
  WHERE channel.slug = 'primary'
  LIMIT 1;

  v_chat_id := public.comm_whatsapp_resolve_canonical_chat_uuid(v_channel_id, p_external_chat_id);
  IF v_chat_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT result.target_id, result.campaign_id
  FROM public.resolve_comm_whatsapp_campaign_stop_on_reply(v_chat_id, p_message_at) AS result;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_comm_whatsapp_campaign_stop_on_reply(text, timestamptz) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_comm_whatsapp_campaign_stop_on_reply(text, timestamptz) TO service_role;

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
  v_next_chat_id uuid;
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
  IF p_channel_id IS NULL OR v_input_external_chat_id IS NULL THEN
    RAISE EXCEPTION 'Canal e identificador externo sao obrigatorios.';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('comm-whatsapp-identity:' || p_channel_id::text || ':' || v_input_external_chat_id, 0)
  );

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
    COALESCE(
      v_display_name,
      CASE WHEN v_phone_number IS NULL THEN NULL ELSE public.comm_whatsapp_format_phone_label(v_phone_number) END,
      'Contato privado'
    ),
    'system'
  )
  ON CONFLICT (channel_id, external_chat_id) DO NOTHING;

  v_canonical_chat_id := COALESCE(
    public.comm_whatsapp_resolve_canonical_chat_uuid(p_channel_id, v_input_external_chat_id),
    public.comm_whatsapp_resolve_canonical_chat_uuid(p_channel_id, v_resolved_external_chat_id)
  );

  LOOP
    SELECT
      chat.merged_into_chat_id,
      chat.external_chat_id,
      COALESCE(v_phone_number, NULLIF(btrim(chat.phone_digits), ''))
    INTO v_next_chat_id, v_resolved_external_chat_id, v_phone_number
    FROM public.comm_whatsapp_chats AS chat
    WHERE chat.id = v_canonical_chat_id
      AND chat.channel_id = p_channel_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Chat canonico nao encontrado durante persistencia.';
    END IF;

    EXIT WHEN v_next_chat_id IS NULL;
    v_canonical_chat_id := public.comm_whatsapp_resolve_chat_uuid(v_next_chat_id);
  END LOOP;

  SELECT * INTO v_result
  FROM public.comm_whatsapp_persist_message_internal(
    p_channel_id, v_resolved_external_chat_id, v_phone_number, p_display_name, p_push_name,
    p_last_message_text, p_last_message_direction, p_last_message_at, p_increment_unread,
    p_external_message_id, p_direction, p_message_type, p_delivery_status, p_text_content,
    p_created_by, p_source, p_sender_name, p_sender_phone, p_status_updated_at,
    p_error_message, p_metadata, p_media_id, p_media_url, p_media_mime_type,
    p_media_file_name, p_media_size_bytes, p_media_duration_seconds, p_media_caption
  );

  IF public.comm_whatsapp_resolve_chat_uuid(v_result.chat_id) IS DISTINCT FROM v_canonical_chat_id THEN
    RAISE EXCEPTION 'Persistencia retornou chat diferente da identidade canonica bloqueada.';
  END IF;
  v_result.chat_id := v_canonical_chat_id;

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

DROP FUNCTION IF EXISTS public.comm_whatsapp_list_chats(text, text, text, text, text, text[], integer, integer);

CREATE OR REPLACE FUNCTION public.comm_whatsapp_list_chats(
  p_search text DEFAULT NULL,
  p_activity_filter text DEFAULT 'all',
  p_lead_filter text DEFAULT 'all',
  p_saved_filter text DEFAULT 'all',
  p_archived_filter text DEFAULT 'active',
  p_lead_status_filters text[] DEFAULT NULL,
  p_limit integer DEFAULT 80,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  channel_id uuid,
  external_chat_id text,
  phone_number text,
  phone_digits text,
  display_name text,
  saved_contact_name text,
  push_name text,
  lead_id uuid,
  lead_name text,
  lead_status text,
  merged_into_chat_id uuid,
  lead_link_source text,
  lead_linked_at timestamptz,
  lead_linked_by uuid,
  auto_link_blocked boolean,
  identity_conflict boolean,
  is_archived boolean,
  archived_at timestamptz,
  is_muted boolean,
  muted_at timestamptz,
  is_pinned boolean,
  pinned_at timestamptz,
  manual_unread boolean,
  manual_unread_at timestamptz,
  last_message_text text,
  last_message_direction text,
  last_message_at timestamptz,
  last_message_delivery_status text,
  unread_count integer,
  status text,
  last_read_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '15s'
STABLE
AS $$
  WITH input AS (
    SELECT
      NULLIF(btrim(COALESCE(p_search, '')), '') AS search_text,
      regexp_replace(COALESCE(p_search, ''), '\D', '', 'g') AS search_digits,
      lower(NULLIF(btrim(COALESCE(p_activity_filter, 'all')), '')) AS activity_filter,
      lower(NULLIF(btrim(COALESCE(p_lead_filter, 'all')), '')) AS lead_filter,
      lower(NULLIF(btrim(COALESCE(p_saved_filter, 'all')), '')) AS saved_filter,
      lower(NULLIF(btrim(COALESCE(p_archived_filter, 'active')), '')) AS archived_filter,
      ARRAY(
        SELECT lower(btrim(value))
        FROM unnest(COALESCE(p_lead_status_filters, ARRAY[]::text[])) AS value
        WHERE btrim(value) <> ''
      ) AS lead_status_filters,
      LEAST(GREATEST(COALESCE(p_limit, 80), 1), 500) AS safe_limit,
      GREATEST(COALESCE(p_offset, 0), 0) AS safe_offset
  ),
  page AS MATERIALIZED (
    SELECT
      chat.*,
      lead.nome_completo AS resolved_lead_name,
      COALESCE(status_config.nome, lead.status) AS resolved_lead_status
    FROM public.comm_whatsapp_chats AS chat
    LEFT JOIN public.leads AS lead ON lead.id = chat.lead_id
    LEFT JOIN public.lead_status_config AS status_config ON status_config.id = lead.status_id
    CROSS JOIN input
    WHERE public.current_user_can_view_comm_whatsapp()
      AND chat.deleted_at IS NULL
      AND chat.merged_into_chat_id IS NULL
      AND (
        input.activity_filter IS NULL OR input.activity_filter = 'all'
        OR (input.activity_filter = 'unread' AND (chat.unread_count > 0 OR chat.manual_unread = true))
      )
      AND (
        input.lead_filter IS NULL OR input.lead_filter = 'all'
        OR (input.lead_filter = 'with_lead' AND chat.lead_id IS NOT NULL)
        OR (input.lead_filter = 'without_lead' AND chat.lead_id IS NULL)
      )
      AND (
        input.saved_filter IS NULL OR input.saved_filter = 'all'
        OR (input.saved_filter = 'saved' AND NULLIF(btrim(chat.saved_contact_name), '') IS NOT NULL)
        OR (input.saved_filter = 'unsaved' AND NULLIF(btrim(chat.saved_contact_name), '') IS NULL)
      )
      AND (
        input.archived_filter IS NULL OR input.archived_filter = 'all'
        OR (input.archived_filter = 'active' AND chat.is_archived = false)
        OR (input.archived_filter = 'archived' AND chat.is_archived = true)
      )
      AND (
        cardinality(input.lead_status_filters) = 0
        OR lower(COALESCE(status_config.nome, lead.status, '')) = ANY(input.lead_status_filters)
      )
      AND (
        input.search_text IS NULL
        OR chat.display_name ILIKE '%' || input.search_text || '%'
        OR chat.saved_contact_name ILIKE '%' || input.search_text || '%'
        OR chat.push_name ILIKE '%' || input.search_text || '%'
        OR lead.nome_completo ILIKE '%' || input.search_text || '%'
        OR chat.phone_number ILIKE '%' || input.search_text || '%'
        OR (input.search_digits <> '' AND chat.phone_digits ILIKE '%' || input.search_digits || '%')
      )
    ORDER BY chat.is_pinned DESC, chat.pinned_at DESC NULLS LAST, chat.last_message_at DESC NULLS LAST, chat.updated_at DESC
    LIMIT (SELECT safe_limit FROM input)
    OFFSET (SELECT safe_offset FROM input)
  ),
  page_delivery AS MATERIALIZED (
    SELECT DISTINCT ON (message.chat_id) message.chat_id, message.delivery_status
    FROM public.comm_whatsapp_messages AS message
    WHERE message.chat_id IN (SELECT page_chat.id FROM page AS page_chat)
      AND COALESCE(message.delivery_status, '') <> 'deleted'
      AND public.comm_whatsapp_message_preview_text(
        message.media_caption,
        message.text_content,
        message.message_type
      ) IS NOT NULL
    ORDER BY message.chat_id, message.message_at DESC, message.created_at DESC, message.id DESC
  )
  SELECT
    chat.id,
    chat.channel_id,
    chat.external_chat_id,
    chat.phone_number,
    chat.phone_digits,
    COALESCE(
      NULLIF(btrim(chat.saved_contact_name), ''),
      NULLIF(btrim(chat.resolved_lead_name), ''),
      NULLIF(btrim(chat.push_name), ''),
      NULLIF(btrim(chat.display_name), ''),
      CASE
        WHEN NULLIF(btrim(chat.phone_number), '') IS NULL THEN 'Contato privado'
        ELSE public.comm_whatsapp_format_phone_label(chat.phone_number)
      END
    ) AS display_name,
    chat.saved_contact_name,
    chat.push_name,
    chat.lead_id,
    chat.resolved_lead_name AS lead_name,
    chat.resolved_lead_status AS lead_status,
    chat.merged_into_chat_id,
    chat.lead_link_source,
    chat.lead_linked_at,
    chat.lead_linked_by,
    chat.auto_link_blocked,
    chat.identity_conflict,
    chat.is_archived,
    chat.archived_at,
    chat.is_muted,
    chat.muted_at,
    chat.is_pinned,
    chat.pinned_at,
    chat.manual_unread,
    chat.manual_unread_at,
    chat.last_message_text,
    chat.last_message_direction,
    chat.last_message_at,
    delivery.delivery_status AS last_message_delivery_status,
    chat.unread_count,
    chat.status,
    chat.last_read_at,
    chat.deleted_at,
    chat.created_at,
    chat.updated_at
  FROM page AS chat
  LEFT JOIN page_delivery AS delivery ON delivery.chat_id = chat.id
  ORDER BY chat.is_pinned DESC, chat.pinned_at DESC NULLS LAST, chat.last_message_at DESC NULLS LAST, chat.updated_at DESC;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_list_chats(text, text, text, text, text, text[], integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_list_chats(text, text, text, text, text, text[], integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_get_chat_thread(
  p_chat_id uuid,
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  v_chat_id uuid := public.comm_whatsapp_resolve_chat_uuid(p_chat_id);
  v_chat jsonb;
  v_lead jsonb;
  v_messages jsonb;
  v_message_count integer;
BEGIN
  IF NOT public.current_user_can_view_comm_whatsapp() THEN
    RAISE EXCEPTION 'Permissao insuficiente para visualizar conversa do WhatsApp.' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'id', chat.id,
    'channel_id', chat.channel_id,
    'external_chat_id', chat.external_chat_id,
    'phone_number', chat.phone_number,
    'phone_digits', chat.phone_digits,
    'display_name', COALESCE(
      NULLIF(btrim(saved_contact.display_name), ''),
      NULLIF(btrim(lead.nome_completo), ''),
      NULLIF(btrim(chat.push_name), ''),
      NULLIF(btrim(chat.display_name), ''),
      CASE
        WHEN NULLIF(btrim(chat.phone_number), '') IS NULL THEN 'Contato privado'
        ELSE public.comm_whatsapp_format_phone_label(chat.phone_number)
      END
    ),
    'saved_contact_name', saved_contact.display_name,
    'push_name', chat.push_name,
    'lead_id', chat.lead_id,
    'lead_name', lead.nome_completo,
    'lead_status', COALESCE(status_config.nome, lead.status),
    'merged_into_chat_id', chat.merged_into_chat_id,
    'lead_link_source', chat.lead_link_source,
    'lead_linked_at', chat.lead_linked_at,
    'lead_linked_by', chat.lead_linked_by,
    'auto_link_blocked', chat.auto_link_blocked,
    'identity_conflict', chat.identity_conflict,
    'is_archived', chat.is_archived,
    'archived_at', chat.archived_at,
    'is_muted', chat.is_muted,
    'muted_at', chat.muted_at,
    'is_pinned', chat.is_pinned,
    'pinned_at', chat.pinned_at,
    'manual_unread', chat.manual_unread,
    'manual_unread_at', chat.manual_unread_at,
    'last_message_text', COALESCE(latest_message.preview_text, chat_preview.preview_text),
    'last_message_direction', CASE
      WHEN latest_message.preview_text IS NOT NULL THEN latest_message.direction
      ELSE COALESCE(NULLIF(btrim(chat.last_message_direction), ''), latest_message.direction)
    END,
    'last_message_at', COALESCE(latest_message.message_at, chat.last_message_at),
    'last_message_delivery_status', latest_message.delivery_status,
    'unread_count', chat.unread_count,
    'status', chat.status,
    'last_read_at', chat.last_read_at,
    'deleted_at', chat.deleted_at,
    'created_at', chat.created_at,
    'updated_at', chat.updated_at
  )
  INTO v_chat
  FROM public.comm_whatsapp_chats AS chat
  LEFT JOIN public.leads AS lead ON lead.id = chat.lead_id
  LEFT JOIN public.lead_status_config AS status_config ON status_config.id = lead.status_id
  LEFT JOIN LATERAL (
    SELECT NULLIF(btrim(contact.display_name), '') AS display_name
    FROM public.comm_whatsapp_phone_contacts_cache AS contact
    WHERE contact.channel_id = chat.channel_id
      AND contact.saved = true
      AND public.comm_whatsapp_is_valid_display_name(contact.display_name)
      AND (
        public.comm_whatsapp_phone_lookup_keys(contact.phone_digits)
          && public.comm_whatsapp_phone_lookup_keys(chat.phone_digits)
        OR EXISTS (
          SELECT 1
          FROM public.comm_whatsapp_chat_identifiers AS identifier
          WHERE identifier.chat_id = chat.id
            AND identifier.channel_id = chat.channel_id
            AND identifier.external_chat_id = public.normalize_comm_whatsapp_chat_id(contact.contact_id)
        )
      )
    ORDER BY
      CASE WHEN contact.contact_id LIKE 'manual:%' THEN 0 ELSE 1 END,
      contact.updated_at DESC,
      contact.last_synced_at DESC,
      contact.id DESC
    LIMIT 1
  ) AS saved_contact ON true
  LEFT JOIN LATERAL (
    SELECT CASE
      WHEN public.comm_whatsapp_is_hidden_preview_text(chat.last_message_text, NULL) THEN NULL
      ELSE NULLIF(btrim(chat.last_message_text), '')
    END AS preview_text
  ) AS chat_preview ON true
  LEFT JOIN LATERAL (
    SELECT candidate.direction, candidate.message_at, candidate.preview_text, candidate.delivery_status
    FROM (
      SELECT
        message.direction,
        message.message_at,
        message.delivery_status,
        public.comm_whatsapp_message_preview_text(
          message.media_caption,
          message.text_content,
          message.message_type
        ) AS preview_text,
        message.created_at,
        message.id
      FROM public.comm_whatsapp_messages AS message
      WHERE message.chat_id = chat.id
        AND COALESCE(message.delivery_status, '') <> 'deleted'
    ) AS candidate
    WHERE candidate.preview_text IS NOT NULL
    ORDER BY candidate.message_at DESC, candidate.created_at DESC, candidate.id DESC
    LIMIT 1
  ) AS latest_message ON true
  WHERE chat.id = v_chat_id
    AND chat.deleted_at IS NULL
    AND chat.merged_into_chat_id IS NULL
  LIMIT 1;

  IF v_chat IS NULL THEN
    RAISE EXCEPTION 'Conversa do WhatsApp nao encontrada.' USING ERRCODE = 'P0002';
  END IF;

  SELECT jsonb_build_object(
    'id', lead.id,
    'nome_completo', lead.nome_completo,
    'telefone', lead.telefone,
    'observacoes', lead.observacoes,
    'status_nome', COALESCE(status_config.nome, lead.status),
    'status_value', COALESCE(status_config.nome, lead.status),
    'responsavel_label', responsible.label,
    'responsavel_value', COALESCE(responsible.value, '')
  )
  INTO v_lead
  FROM public.comm_whatsapp_chats AS chat
  JOIN public.leads AS lead ON lead.id = chat.lead_id
  LEFT JOIN public.lead_status_config AS status_config ON status_config.id = lead.status_id
  LEFT JOIN public.lead_responsaveis AS responsible ON responsible.id = lead.responsavel_id
  WHERE chat.id = v_chat_id;

  WITH ranked AS (
    SELECT message.*
    FROM public.comm_whatsapp_messages AS message
    WHERE message.chat_id = v_chat_id
    ORDER BY message.message_at DESC, message.id DESC
    LIMIT v_limit + 1
  ),
  page AS (
    SELECT *
    FROM ranked
    ORDER BY message_at DESC, id DESC
    LIMIT v_limit
  )
  SELECT
    COALESCE(jsonb_agg(to_jsonb(page) ORDER BY page.message_at ASC, page.id ASC), '[]'::jsonb),
    (SELECT count(*) FROM ranked)
  INTO v_messages, v_message_count
  FROM page;

  RETURN jsonb_build_object(
    'chat', v_chat,
    'lead', v_lead,
    'messages', COALESCE(v_messages, '[]'::jsonb),
    'hasMore', COALESCE(v_message_count, 0) > v_limit,
    'generatedAt', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_get_chat_thread(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_get_chat_thread(uuid, integer) TO authenticated;

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
    SELECT (
        chat.external_chat_id ~* '@lid$'
        AND NOT EXISTS (
          SELECT 1
          FROM public.comm_whatsapp_chat_identifiers AS identifier
          WHERE identifier.chat_id = chat.id
            AND identifier.channel_id = chat.channel_id
            AND identifier.identifier_kind = 'wa_id'
            AND identifier.is_verified
        )
      ) OR EXISTS (
        SELECT 1
        FROM public.comm_whatsapp_chat_identifiers AS identifier
        WHERE identifier.chat_id = chat.id
          AND identifier.channel_id = chat.channel_id
          AND identifier.identifier_kind = 'lid'
          AND NOT identifier.is_verified
      )
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

CREATE OR REPLACE FUNCTION public.comm_whatsapp_update_chat_inbox_state(
  p_chat_id uuid,
  p_is_archived boolean DEFAULT NULL,
  p_is_muted boolean DEFAULT NULL,
  p_is_pinned boolean DEFAULT NULL,
  p_mark_as_unread boolean DEFAULT NULL
)
RETURNS SETOF public.comm_whatsapp_chats
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat_id uuid;
  v_chat public.comm_whatsapp_chats%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_can_edit_comm_whatsapp() THEN
    RAISE EXCEPTION 'Permissao insuficiente para atualizar conversa.';
  END IF;

  v_chat_id := public.comm_whatsapp_lock_canonical_chat_uuid(p_chat_id);
  IF v_chat_id IS NULL THEN
    RAISE EXCEPTION 'Conversa do WhatsApp nao encontrada.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.comm_whatsapp_chats
  SET is_archived = COALESCE(p_is_archived, public.comm_whatsapp_chats.is_archived),
      archived_at = CASE
        WHEN p_is_archived IS NULL THEN public.comm_whatsapp_chats.archived_at
        WHEN p_is_archived THEN now()
        ELSE NULL
      END,
      is_muted = COALESCE(p_is_muted, public.comm_whatsapp_chats.is_muted),
      muted_at = CASE
        WHEN p_is_muted IS NULL THEN public.comm_whatsapp_chats.muted_at
        WHEN p_is_muted THEN COALESCE(public.comm_whatsapp_chats.muted_at, now())
        ELSE NULL
      END,
      is_pinned = COALESCE(p_is_pinned, public.comm_whatsapp_chats.is_pinned),
      pinned_at = CASE
        WHEN p_is_pinned IS NULL THEN public.comm_whatsapp_chats.pinned_at
        WHEN p_is_pinned THEN COALESCE(public.comm_whatsapp_chats.pinned_at, now())
        ELSE NULL
      END,
      manual_unread = CASE
        WHEN p_mark_as_unread IS NULL THEN public.comm_whatsapp_chats.manual_unread
        WHEN p_mark_as_unread AND public.comm_whatsapp_chats.unread_count = 0 THEN true
        ELSE false
      END,
      manual_unread_at = CASE
        WHEN p_mark_as_unread IS NULL THEN public.comm_whatsapp_chats.manual_unread_at
        WHEN p_mark_as_unread AND public.comm_whatsapp_chats.unread_count = 0
          THEN COALESCE(public.comm_whatsapp_chats.manual_unread_at, now())
        ELSE NULL
      END,
      last_read_at = CASE
        WHEN p_mark_as_unread THEN NULL
        WHEN p_mark_as_unread = false THEN now()
        ELSE public.comm_whatsapp_chats.last_read_at
      END,
      unread_count = CASE
        WHEN p_mark_as_unread = false THEN 0
        ELSE public.comm_whatsapp_chats.unread_count
      END,
      updated_at = now()
  WHERE public.comm_whatsapp_chats.id = v_chat_id
    AND public.comm_whatsapp_chats.deleted_at IS NULL
    AND public.comm_whatsapp_chats.merged_into_chat_id IS NULL
  RETURNING * INTO v_chat;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversa do WhatsApp nao encontrada.' USING ERRCODE = 'P0002';
  END IF;

  RETURN NEXT v_chat;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_update_chat_inbox_state(uuid, boolean, boolean, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_update_chat_inbox_state(uuid, boolean, boolean, boolean, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_mark_chat_read(
  p_chat_id uuid,
  p_last_seen_message_at timestamptz,
  p_last_seen_message_id uuid
)
RETURNS TABLE(id uuid, unread_count integer, last_read_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat_id uuid;
  v_seen_at timestamptz;
  v_next_read_at timestamptz;
  v_unread_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_can_edit_comm_whatsapp() THEN
    RAISE EXCEPTION 'Permissao insuficiente para atualizar conversa.';
  END IF;

  v_chat_id := public.comm_whatsapp_lock_canonical_chat_uuid(p_chat_id);
  IF v_chat_id IS NULL THEN
    RAISE EXCEPTION 'Conversa do WhatsApp nao encontrada.' USING ERRCODE = 'P0002';
  END IF;

  IF p_last_seen_message_at IS NOT NULL THEN
    v_seen_at := p_last_seen_message_at;
  ELSIF p_last_seen_message_id IS NOT NULL THEN
    SELECT message.message_at
    INTO v_seen_at
    FROM public.comm_whatsapp_messages AS message
    WHERE message.id = p_last_seen_message_id
      AND message.chat_id = v_chat_id;
  ELSE
    SELECT max(message.message_at)
    INTO v_seen_at
    FROM public.comm_whatsapp_messages AS message
    WHERE message.chat_id = v_chat_id
      AND public.comm_whatsapp_message_preview_text(
        message.media_caption,
        message.text_content,
        message.message_type
      ) IS NOT NULL;
  END IF;

  v_next_read_at := COALESCE(v_seen_at, now());

  UPDATE public.comm_whatsapp_chats AS chat
  SET last_read_at = GREATEST(COALESCE(chat.last_read_at, '-infinity'::timestamptz), v_next_read_at),
      manual_unread = false,
      manual_unread_at = NULL,
      updated_at = now()
  WHERE chat.id = v_chat_id
    AND chat.deleted_at IS NULL
    AND chat.merged_into_chat_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversa do WhatsApp nao encontrada.' USING ERRCODE = 'P0002';
  END IF;

  SELECT count(*)::integer
  INTO v_unread_count
  FROM public.comm_whatsapp_messages AS message
  WHERE message.chat_id = v_chat_id
    AND message.direction = 'inbound'
    AND message.message_at > v_next_read_at
    AND public.comm_whatsapp_message_preview_text(
      message.media_caption,
      message.text_content,
      message.message_type
    ) IS NOT NULL;

  UPDATE public.comm_whatsapp_chats AS chat
  SET unread_count = v_unread_count
  WHERE chat.id = v_chat_id
  RETURNING chat.id, chat.unread_count, chat.last_read_at
  INTO id, unread_count, last_read_at;

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_mark_chat_read(p_chat_id uuid)
RETURNS TABLE(id uuid, unread_count integer, last_read_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.comm_whatsapp_mark_chat_read(p_chat_id, NULL::timestamptz, NULL::uuid);
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_mark_chat_read(uuid, timestamptz, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_mark_chat_read(uuid, timestamptz, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.comm_whatsapp_mark_chat_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_mark_chat_read(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_delete_chat(p_chat_id uuid)
RETURNS SETOF public.comm_whatsapp_chats
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat_id uuid;
  v_chat public.comm_whatsapp_chats%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_can_edit_comm_whatsapp() THEN
    RAISE EXCEPTION 'Permissao insuficiente para excluir conversa.';
  END IF;

  v_chat_id := public.comm_whatsapp_lock_canonical_chat_uuid(p_chat_id);

  UPDATE public.comm_whatsapp_chats
  SET deleted_at = now(),
      updated_at = now()
  WHERE id = v_chat_id
    AND deleted_at IS NULL
    AND merged_into_chat_id IS NULL
  RETURNING * INTO v_chat;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversa do WhatsApp nao encontrada.' USING ERRCODE = 'P0002';
  END IF;

  RETURN NEXT v_chat;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_delete_chat(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_delete_chat(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_get_chat_lead_panel(p_chat_id uuid)
RETURNS TABLE(
  id uuid,
  nome_completo text,
  telefone text,
  observacoes text,
  status_nome text,
  status_value text,
  responsavel_label text,
  responsavel_value text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    lead.id,
    lead.nome_completo,
    lead.telefone,
    lead.observacoes,
    COALESCE(status_config.nome, lead.status),
    COALESCE(status_config.nome, lead.status),
    responsible.label,
    COALESCE(responsible.value, '')
  FROM public.comm_whatsapp_chats AS chat
  JOIN public.leads AS lead ON lead.id = chat.lead_id
  LEFT JOIN public.lead_status_config AS status_config ON status_config.id = lead.status_id
  LEFT JOIN public.lead_responsaveis AS responsible ON responsible.id = lead.responsavel_id
  WHERE chat.id = public.comm_whatsapp_resolve_chat_uuid(p_chat_id)
    AND chat.deleted_at IS NULL
    AND chat.merged_into_chat_id IS NULL
    AND public.current_user_can_view_comm_whatsapp();
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_get_chat_lead_panel(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_get_chat_lead_panel(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_update_linked_lead_status(
  p_chat_id uuid,
  p_new_status text
)
RETURNS TABLE(lead_id uuid, status text, ultimo_contato timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat_id uuid;
  v_lead public.leads%ROWTYPE;
  v_new_status text := NULLIF(btrim(COALESCE(p_new_status, '')), '');
  v_timestamp timestamptz := now();
  v_status_id uuid;
  v_responsavel_label text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_can_edit_comm_whatsapp() THEN
    RAISE EXCEPTION 'Permissao insuficiente para atualizar status do lead.';
  END IF;
  IF v_new_status IS NULL THEN
    RAISE EXCEPTION 'Novo status do lead obrigatorio.';
  END IF;

  v_chat_id := public.comm_whatsapp_lock_canonical_chat_uuid(p_chat_id);
  SELECT lead.*
  INTO v_lead
  FROM public.comm_whatsapp_chats AS chat
  JOIN public.leads AS lead ON lead.id = chat.lead_id
  WHERE chat.id = v_chat_id
    AND chat.deleted_at IS NULL
    AND chat.merged_into_chat_id IS NULL
  FOR UPDATE OF lead;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nenhum lead vinculado a esta conversa.';
  END IF;

  SELECT status_config.id
  INTO v_status_id
  FROM public.lead_status_config AS status_config
  WHERE status_config.nome = v_new_status
  LIMIT 1;

  UPDATE public.leads
  SET status = v_new_status,
      status_id = COALESCE(v_status_id, public.leads.status_id),
      ultimo_contato = v_timestamp,
      updated_at = v_timestamp
  WHERE public.leads.id = v_lead.id;

  SELECT responsible.label
  INTO v_responsavel_label
  FROM public.lead_responsaveis AS responsible
  WHERE responsible.id = v_lead.responsavel_id
  LIMIT 1;

  INSERT INTO public.interactions (lead_id, tipo, descricao, responsavel)
  VALUES (
    v_lead.id,
    'Observação',
    'Status alterado de "' || COALESCE(v_lead.status, 'Sem status') || '" para "' || v_new_status || '" via WhatsApp',
    COALESCE(v_responsavel_label, 'WhatsApp Inbox')
  );

  INSERT INTO public.lead_status_history (lead_id, status_anterior, status_novo, responsavel)
  VALUES (
    v_lead.id,
    COALESCE(v_lead.status, 'Sem status'),
    v_new_status,
    COALESCE(v_responsavel_label, 'WhatsApp Inbox')
  );

  RETURN QUERY
  SELECT lead.id, lead.status, lead.ultimo_contato
  FROM public.leads AS lead
  WHERE lead.id = v_lead.id;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_update_linked_lead_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_update_linked_lead_status(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_update_linked_lead_responsavel(
  p_chat_id uuid,
  p_new_responsavel_value text
)
RETURNS TABLE(lead_id uuid, responsavel text, responsavel_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat_id uuid;
  v_lead public.leads%ROWTYPE;
  v_option public.lead_responsaveis%ROWTYPE;
  v_value text := NULLIF(btrim(COALESCE(p_new_responsavel_value, '')), '');
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_can_edit_comm_whatsapp() THEN
    RAISE EXCEPTION 'Permissao insuficiente para atualizar responsavel do lead.';
  END IF;
  IF v_value IS NULL THEN
    RAISE EXCEPTION 'Responsavel obrigatorio.';
  END IF;

  v_chat_id := public.comm_whatsapp_lock_canonical_chat_uuid(p_chat_id);
  SELECT lead.*
  INTO v_lead
  FROM public.comm_whatsapp_chats AS chat
  JOIN public.leads AS lead ON lead.id = chat.lead_id
  WHERE chat.id = v_chat_id
    AND chat.deleted_at IS NULL
    AND chat.merged_into_chat_id IS NULL
  FOR UPDATE OF lead;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nenhum lead vinculado a esta conversa.';
  END IF;

  SELECT *
  INTO v_option
  FROM public.lead_responsaveis
  WHERE value = v_value
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Responsavel nao encontrado.';
  END IF;

  UPDATE public.leads
  SET responsavel_id = v_option.id,
      updated_at = now()
  WHERE public.leads.id = v_lead.id;

  RETURN QUERY
  SELECT lead.id, v_option.label, lead.responsavel_id
  FROM public.leads AS lead
  WHERE lead.id = v_lead.id;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_update_linked_lead_responsavel(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_update_linked_lead_responsavel(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_list_chat_media_page(
  p_chat_id uuid,
  p_media_type text DEFAULT 'all',
  p_before_message_at timestamptz DEFAULT NULL,
  p_before_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 40
)
RETURNS SETOF public.comm_whatsapp_messages
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT message.*
  FROM public.comm_whatsapp_messages AS message
  WHERE message.chat_id = public.comm_whatsapp_resolve_chat_uuid(p_chat_id)
    AND public.current_user_can_view_comm_whatsapp()
    AND (message.media_id IS NOT NULL OR message.media_url IS NOT NULL)
    AND message.message_type IN ('image', 'video', 'document', 'audio', 'voice')
    AND (
      p_media_type = 'all'
      OR (p_media_type = 'image' AND message.message_type = 'image')
      OR (p_media_type = 'video' AND message.message_type = 'video')
      OR (p_media_type = 'document' AND message.message_type = 'document')
      OR (p_media_type = 'audio' AND message.message_type IN ('audio', 'voice'))
    )
    AND (
      p_before_message_at IS NULL
      OR message.message_at < p_before_message_at
      OR (message.message_at = p_before_message_at AND p_before_id IS NOT NULL AND message.id < p_before_id)
    )
  ORDER BY message.message_at DESC, message.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 40), 1), 101);
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_list_chat_media_page(uuid, text, timestamptz, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_list_chat_media_page(uuid, text, timestamptz, uuid, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_list_message_context(
  p_chat_id uuid,
  p_message_id uuid,
  p_before_limit integer DEFAULT 40,
  p_after_limit integer DEFAULT 40
)
RETURNS SETOF public.comm_whatsapp_messages
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH input AS (
    SELECT
      public.comm_whatsapp_resolve_chat_uuid(p_chat_id) AS chat_id,
      LEAST(GREATEST(COALESCE(p_before_limit, 40), 0), 100) AS before_limit,
      LEAST(GREATEST(COALESCE(p_after_limit, 40), 0), 100) AS after_limit
  ),
  target AS (
    SELECT message.*
    FROM public.comm_whatsapp_messages AS message
    CROSS JOIN input
    WHERE message.chat_id = input.chat_id
      AND message.id = p_message_id
      AND public.current_user_can_view_comm_whatsapp()
    LIMIT 1
  ),
  older AS (
    SELECT message.*
    FROM public.comm_whatsapp_messages AS message
    CROSS JOIN target
    CROSS JOIN input
    WHERE message.chat_id = input.chat_id
      AND (
        message.message_at < target.message_at
        OR (message.message_at = target.message_at AND message.id < target.id)
      )
    ORDER BY message.message_at DESC, message.id DESC
    LIMIT (SELECT before_limit FROM input)
  ),
  newer AS (
    SELECT message.*
    FROM public.comm_whatsapp_messages AS message
    CROSS JOIN target
    CROSS JOIN input
    WHERE message.chat_id = input.chat_id
      AND (
        message.message_at > target.message_at
        OR (message.message_at = target.message_at AND message.id > target.id)
      )
    ORDER BY message.message_at ASC, message.id ASC
    LIMIT (SELECT after_limit FROM input)
  )
  SELECT *
  FROM (
    SELECT * FROM older
    UNION ALL
    SELECT * FROM target
    UNION ALL
    SELECT * FROM newer
  ) AS context_messages
  ORDER BY message_at ASC, id ASC;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_list_message_context(uuid, uuid, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_list_message_context(uuid, uuid, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_search_messages(
  p_search text,
  p_chat_ids uuid[] DEFAULT NULL,
  p_archived_filter text DEFAULT 'all',
  p_limit integer DEFAULT 30
)
RETURNS TABLE(message jsonb, chat jsonb)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH input AS (
    SELECT
      NULLIF(btrim(COALESCE(p_search, '')), '') AS search_text,
      lower(NULLIF(btrim(COALESCE(p_archived_filter, 'all')), '')) AS archived_filter,
      LEAST(GREATEST(COALESCE(p_limit, 30), 1), 100) AS safe_limit
  )
  SELECT
    to_jsonb(message) AS message,
    to_jsonb(chat_row) || jsonb_build_object('lead_status', lead.status) AS chat
  FROM public.comm_whatsapp_messages AS message
  JOIN public.comm_whatsapp_chats AS chat_row ON chat_row.id = message.chat_id
  LEFT JOIN public.leads AS lead ON lead.id = chat_row.lead_id
  CROSS JOIN input
  WHERE public.current_user_can_view_comm_whatsapp()
    AND chat_row.deleted_at IS NULL
    AND chat_row.merged_into_chat_id IS NULL
    AND input.search_text IS NOT NULL
    AND (
      p_chat_ids IS NULL
      OR EXISTS (
        SELECT 1
        FROM unnest(p_chat_ids) AS requested(chat_id)
        WHERE public.comm_whatsapp_resolve_chat_uuid(requested.chat_id) = chat_row.id
      )
    )
    AND (
      input.archived_filter IS NULL OR input.archived_filter = 'all'
      OR (input.archived_filter = 'active' AND chat_row.is_archived = false)
      OR (input.archived_filter = 'archived' AND chat_row.is_archived = true)
    )
    AND (
      message.text_content ILIKE '%' || input.search_text || '%'
      OR message.media_caption ILIKE '%' || input.search_text || '%'
      OR message.transcription_text ILIKE '%' || input.search_text || '%'
    )
  ORDER BY message.message_at DESC, message.created_at DESC, message.id DESC
  LIMIT (SELECT safe_limit FROM input);
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_search_messages(text, uuid[], text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_search_messages(text, uuid[], text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_pending_follow_up_chats()
RETURNS TABLE(
  chat_id uuid,
  external_chat_id text,
  lead_id uuid,
  lead_name text,
  lead_phone text,
  reminder_id uuid,
  reminder_title text,
  reminder_due_at timestamptz,
  reminder_priority text,
  last_message_at timestamptz,
  last_message_text text
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    chat.id,
    chat.external_chat_id,
    lead.id,
    lead.nome_completo,
    lead.telefone,
    reminder.id,
    reminder.titulo,
    reminder.data_lembrete,
    reminder.prioridade,
    chat.last_message_at,
    chat.last_message_text
  FROM public.reminders AS reminder
  JOIN public.leads AS lead
    ON lead.id = reminder.lead_id
   AND COALESCE(lead.arquivado, false) = false
  JOIN LATERAL (
    SELECT candidate.*
    FROM public.comm_whatsapp_chats AS candidate
    WHERE candidate.lead_id = lead.id
      AND candidate.deleted_at IS NULL
      AND candidate.merged_into_chat_id IS NULL
    ORDER BY
      CASE
        WHEN candidate.external_chat_id = public.normalize_comm_whatsapp_chat_id(
          COALESCE(lead.telefone, candidate.external_chat_id)
        ) THEN 0
        ELSE 1
      END,
      CASE
        WHEN candidate.external_chat_id = public.normalize_comm_whatsapp_chat_id(candidate.external_chat_id) THEN 0
        ELSE 1
      END,
      CASE WHEN NULLIF(btrim(COALESCE(candidate.external_chat_id, '')), '') IS NULL THEN 1 ELSE 0 END,
      candidate.last_message_at DESC NULLS LAST,
      candidate.updated_at DESC NULLS LAST,
      candidate.id ASC
    LIMIT 1
  ) AS chat ON true
  WHERE COALESCE(reminder.lido, false) = false
    AND reminder.tipo = 'Follow-up'
    AND reminder.data_lembrete <= now()
  ORDER BY reminder.prioridade DESC, reminder.data_lembrete ASC, lead.nome_completo ASC;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_pending_follow_up_chats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_pending_follow_up_chats() TO authenticated;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_get_dashboard_metrics()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH permission AS (
    SELECT public.current_user_can_view_comm_whatsapp() AS ok
  ),
  channel AS (
    SELECT
      c.id,
      c.name,
      c.enabled,
      c.connection_status,
      c.health_status,
      c.phone_number,
      c.connected_user_name,
      c.last_health_check_at,
      c.last_webhook_received_at,
      c.last_error,
      c.updated_at
    FROM public.comm_whatsapp_channels c
    WHERE c.slug = 'primary'
      AND EXISTS (SELECT 1 FROM permission WHERE ok)
    LIMIT 1
  ),
  chats AS (
    SELECT c.*
    FROM public.comm_whatsapp_chats c
    INNER JOIN channel ch ON ch.id = c.channel_id
    WHERE c.deleted_at IS NULL
      AND c.merged_into_chat_id IS NULL
  ),
  messages AS (
    SELECT m.*
    FROM public.comm_whatsapp_messages m
    INNER JOIN chats c ON c.id = m.chat_id
  ),
  chat_metrics AS (
    SELECT
      COUNT(*) AS total_chats,
      COUNT(*) FILTER (WHERE NOT COALESCE(is_archived, false)) AS active_chats,
      COUNT(*) FILTER (WHERE COALESCE(is_archived, false)) AS archived_chats,
      COUNT(*) FILTER (WHERE COALESCE(unread_count, 0) > 0 OR COALESCE(manual_unread, false)) AS unread_chats,
      COALESCE(SUM(GREATEST(COALESCE(unread_count, 0), 0)), 0) AS unread_messages,
      COUNT(*) FILTER (WHERE lead_id IS NOT NULL) AS linked_lead_chats,
      COUNT(*) FILTER (WHERE lead_id IS NULL AND NOT COALESCE(is_archived, false)) AS active_unlinked_chats,
      COUNT(*) FILTER (WHERE COALESCE(is_pinned, false)) AS pinned_chats,
      COUNT(*) FILTER (WHERE COALESCE(is_muted, false)) AS muted_chats,
      COUNT(*) FILTER (
        WHERE (COALESCE(unread_count, 0) > 0 OR COALESCE(manual_unread, false))
          AND last_message_at < now() - interval '2 hours'
      ) AS stale_unread_chats,
      MIN(last_message_at) FILTER (WHERE COALESCE(unread_count, 0) > 0 OR COALESCE(manual_unread, false)) AS oldest_unread_at,
      MAX(last_message_at) FILTER (WHERE last_message_direction = 'inbound') AS last_inbound_at,
      MAX(last_message_at) FILTER (WHERE last_message_direction = 'outbound') AS last_outbound_at
    FROM chats
  ),
  message_metrics AS (
    SELECT
      COUNT(*) FILTER (WHERE message_at >= now() - interval '24 hours') AS messages_24h,
      COUNT(*) FILTER (WHERE direction = 'inbound' AND message_at >= now() - interval '24 hours') AS inbound_24h,
      COUNT(*) FILTER (WHERE direction = 'outbound' AND message_at >= now() - interval '24 hours') AS outbound_24h,
      COUNT(*) FILTER (WHERE direction = 'outbound' AND lower(delivery_status) IN ('pending', 'queued', 'sending')) AS pending_outbound,
      COUNT(*) FILTER (WHERE direction = 'outbound' AND lower(delivery_status) IN ('failed', 'error') AND message_at >= now() - interval '24 hours') AS failed_outbound_24h
    FROM messages
  ),
  reminder_metrics AS (
    SELECT
      COUNT(*) FILTER (WHERE NOT COALESCE(r.lido, false) AND r.data_lembrete < now()) AS overdue_reminders,
      COUNT(*) FILTER (WHERE NOT COALESCE(r.lido, false) AND r.data_lembrete >= now() AND r.data_lembrete < now() + interval '24 hours') AS upcoming_reminders_24h
    FROM public.reminders r
    WHERE r.lead_id IN (
      SELECT DISTINCT lead_id
      FROM chats
      WHERE lead_id IS NOT NULL
    )
  ),
  recent_chats AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', ranked.id,
          'displayName', ranked.display_name,
          'phoneNumber', ranked.phone_number,
          'leadId', ranked.lead_id,
          'leadStatus', ranked.lead_status,
          'unreadCount', ranked.unread_count,
          'manualUnread', ranked.manual_unread,
          'isArchived', ranked.is_archived,
          'isMuted', ranked.is_muted,
          'isPinned', ranked.is_pinned,
          'lastMessageAt', ranked.last_message_at,
          'lastMessageDirection', ranked.last_message_direction,
          'lastMessageStatus', ranked.last_message_delivery_status,
          'lastMessageText', ranked.last_message_text
        )
        ORDER BY ranked.last_message_at DESC NULLS LAST, ranked.updated_at DESC
      ),
      '[]'::jsonb
    ) AS items
    FROM (
      SELECT
        c.*,
        l.status AS lead_status,
        latest_message.delivery_status AS last_message_delivery_status
      FROM chats c
      LEFT JOIN public.leads l ON l.id = c.lead_id
      LEFT JOIN LATERAL (
        SELECT m.delivery_status
        FROM messages m
        WHERE m.chat_id = c.id
        ORDER BY m.message_at DESC, m.created_at DESC, m.id DESC
        LIMIT 1
      ) latest_message ON true
      WHERE NOT COALESCE(c.is_archived, false)
      ORDER BY COALESCE(c.is_pinned, false) DESC, c.pinned_at DESC NULLS LAST, c.last_message_at DESC NULLS LAST, c.updated_at DESC
      LIMIT 8
    ) ranked
  )
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM permission WHERE ok) THEN jsonb_build_object('authorized', false)
    ELSE jsonb_build_object(
      'authorized', true,
      'generatedAt', now(),
      'channel', (SELECT to_jsonb(channel) FROM channel),
      'chatMetrics', (SELECT to_jsonb(chat_metrics) FROM chat_metrics),
      'messageMetrics', (SELECT to_jsonb(message_metrics) FROM message_metrics),
      'reminderMetrics', (SELECT to_jsonb(reminder_metrics) FROM reminder_metrics),
      'recentChats', COALESCE((SELECT items FROM recent_chats), '[]'::jsonb)
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_get_dashboard_metrics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_get_dashboard_metrics() TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
