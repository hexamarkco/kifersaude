BEGIN;

CREATE TABLE IF NOT EXISTS public.comm_whatsapp_enrichment_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  channel_id uuid NOT NULL REFERENCES public.comm_whatsapp_channels(id) ON DELETE CASCADE,
  chat_id uuid REFERENCES public.comm_whatsapp_chats(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.comm_whatsapp_messages(id) ON DELETE CASCADE,
  dedupe_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued',
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  lock_token text,
  completed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comm_whatsapp_enrichment_jobs_kind_check
    CHECK (kind IN ('chat_identity', 'media_archive')),
  CONSTRAINT comm_whatsapp_enrichment_jobs_status_check
    CHECK (status IN ('queued', 'processing', 'retrying', 'completed', 'failed')),
  CONSTRAINT comm_whatsapp_enrichment_jobs_attempts_check
    CHECK (attempts >= 0),
  CONSTRAINT comm_whatsapp_enrichment_jobs_payload_is_object
    CHECK (jsonb_typeof(payload) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_enrichment_jobs_due
  ON public.comm_whatsapp_enrichment_jobs (status, next_attempt_at, created_at)
  WHERE status IN ('queued', 'retrying', 'processing');

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_enrichment_jobs_chat_kind
  ON public.comm_whatsapp_enrichment_jobs (chat_id, kind, created_at DESC);

ALTER TABLE public.comm_whatsapp_enrichment_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage comm whatsapp enrichment jobs" ON public.comm_whatsapp_enrichment_jobs;
CREATE POLICY "Service role can manage comm whatsapp enrichment jobs"
  ON public.comm_whatsapp_enrichment_jobs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_comm_whatsapp_enrichment_jobs_updated_at ON public.comm_whatsapp_enrichment_jobs;
CREATE TRIGGER trg_comm_whatsapp_enrichment_jobs_updated_at
  BEFORE UPDATE ON public.comm_whatsapp_enrichment_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.enqueue_comm_whatsapp_message_enrichment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_identity_payload jsonb;
  v_media_payload jsonb;
BEGIN
  IF TG_OP = 'INSERT'
    AND NEW.chat_id IS NOT NULL
    AND COALESCE(NEW.message_type, '') <> 'action'
  THEN
    v_identity_payload := jsonb_build_object(
      'external_message_id', NEW.external_message_id,
      'message_id', NEW.id
    );

    INSERT INTO public.comm_whatsapp_enrichment_jobs (
      kind, channel_id, chat_id, message_id, dedupe_key, payload
    )
    VALUES (
      'chat_identity',
      NEW.channel_id,
      NEW.chat_id,
      NEW.id,
      'identity:' || NEW.channel_id::text || ':' || NEW.chat_id::text,
      v_identity_payload
    )
    ON CONFLICT (dedupe_key) DO UPDATE
    SET message_id = EXCLUDED.message_id,
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
      'media_archive',
      NEW.channel_id,
      NEW.chat_id,
      NEW.id,
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

DROP TRIGGER IF EXISTS trg_comm_whatsapp_enqueue_message_enrichment ON public.comm_whatsapp_messages;
CREATE TRIGGER trg_comm_whatsapp_enqueue_message_enrichment
  AFTER INSERT OR UPDATE OF media_id, media_url, media_mime_type, media_file_name, chat_id
  ON public.comm_whatsapp_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_comm_whatsapp_message_enrichment();

-- Queue existing media once. The worker performs a Storage-first lookup, so
-- this is idempotent and does not download media that is already archived.
INSERT INTO public.comm_whatsapp_enrichment_jobs (
  kind, channel_id, chat_id, message_id, dedupe_key, payload
)
SELECT DISTINCT ON (message.channel_id, message.media_id)
  'media_archive',
  message.channel_id,
  message.chat_id,
  message.id,
  'media:' || message.channel_id::text || ':' || message.media_id,
  jsonb_build_object(
    'media_id', message.media_id,
    'media_url', message.media_url,
    'media_mime_type', message.media_mime_type,
    'media_file_name', message.media_file_name
  )
FROM public.comm_whatsapp_messages AS message
WHERE NULLIF(btrim(COALESCE(message.media_id, '')), '') IS NOT NULL
ORDER BY message.channel_id, message.media_id, message.created_at DESC
ON CONFLICT (dedupe_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.claim_comm_whatsapp_enrichment_jobs(
  p_limit integer DEFAULT 25,
  p_lock_token text DEFAULT gen_random_uuid()::text,
  p_lock_ttl interval DEFAULT interval '15 minutes'
)
RETURNS SETOF public.comm_whatsapp_enrichment_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH due_jobs AS (
    SELECT job.id
    FROM public.comm_whatsapp_enrichment_jobs AS job
    WHERE (
      job.status IN ('queued', 'retrying')
      OR (job.status = 'processing' AND job.locked_at < now() - p_lock_ttl)
    )
      AND job.next_attempt_at <= now()
      AND (job.locked_at IS NULL OR job.locked_at < now() - p_lock_ttl)
    ORDER BY job.next_attempt_at, job.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100)
  )
  UPDATE public.comm_whatsapp_enrichment_jobs AS job
  SET status = 'processing',
      attempts = job.attempts + 1,
      locked_at = now(),
      lock_token = p_lock_token,
      last_error = NULL,
      updated_at = now()
  FROM due_jobs
  WHERE job.id = due_jobs.id
  RETURNING job.*;
END;
$$;

CREATE TABLE IF NOT EXISTS public.comm_whatsapp_pending_message_mutations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.comm_whatsapp_channels(id) ON DELETE CASCADE,
  target_external_message_id text NOT NULL,
  event_external_message_id text,
  mutation_type text NOT NULL,
  dedupe_key text NOT NULL,
  occurred_at timestamptz NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comm_whatsapp_pending_message_mutations_type_check
    CHECK (mutation_type IN ('edit', 'delete', 'reaction')),
  CONSTRAINT comm_whatsapp_pending_message_mutations_payload_is_object
    CHECK (jsonb_typeof(payload) = 'object'),
  CONSTRAINT comm_whatsapp_pending_message_mutations_dedupe
    UNIQUE (channel_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_pending_mutations_target
  ON public.comm_whatsapp_pending_message_mutations (channel_id, target_external_message_id, occurred_at, created_at);

ALTER TABLE public.comm_whatsapp_pending_message_mutations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage comm whatsapp pending mutations" ON public.comm_whatsapp_pending_message_mutations;
CREATE POLICY "Service role can manage comm whatsapp pending mutations"
  ON public.comm_whatsapp_pending_message_mutations FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_comm_whatsapp_pending_message_mutations_updated_at ON public.comm_whatsapp_pending_message_mutations;
CREATE TRIGGER trg_comm_whatsapp_pending_message_mutations_updated_at
  BEFORE UPDATE ON public.comm_whatsapp_pending_message_mutations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.comm_whatsapp_apply_message_mutation(
  p_channel_id uuid,
  p_target_external_message_id text,
  p_mutation_type text,
  p_event_external_message_id text DEFAULT NULL,
  p_occurred_at timestamptz DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_dedupe_key text DEFAULT NULL
)
RETURNS TABLE (
  chat_id uuid,
  applied boolean,
  queued boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_external_message_id text := NULLIF(btrim(COALESCE(p_target_external_message_id, '')), '');
  v_mutation_type text := lower(NULLIF(btrim(COALESCE(p_mutation_type, '')), ''));
  v_event_external_message_id text := NULLIF(btrim(COALESCE(p_event_external_message_id, '')), '');
  v_occurred_at timestamptz := COALESCE(p_occurred_at, clock_timestamp());
  v_payload jsonb := COALESCE(p_payload, '{}'::jsonb);
  v_dedupe_key text := NULLIF(btrim(COALESCE(p_dedupe_key, '')), '');
  v_message public.comm_whatsapp_messages%ROWTYPE;
  v_metadata jsonb;
  v_original_text text;
  v_history jsonb;
  v_existing_at timestamptz;
  v_actor_key text;
  v_emoji text;
  v_reactions jsonb;
  v_without_actor jsonb;
  v_actor_reaction jsonb;
  v_existing_reaction_at timestamptz;
BEGIN
  IF p_channel_id IS NULL OR v_target_external_message_id IS NULL THEN
    RAISE EXCEPTION 'Canal e mensagem alvo sao obrigatorios para aplicar mutacao.';
  END IF;

  IF v_mutation_type NOT IN ('edit', 'delete', 'reaction') THEN
    RAISE EXCEPTION 'Tipo de mutacao invalido.';
  END IF;

  IF jsonb_typeof(v_payload) <> 'object' THEN
    RAISE EXCEPTION 'O payload da mutacao deve ser um objeto JSON.';
  END IF;

  -- Keep a target insert and an out-of-order mutation in the same critical section.
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'comm-whatsapp-message-mutation:' || p_channel_id::text || ':' || v_target_external_message_id,
    0
  ));

  IF v_dedupe_key IS NULL THEN
    v_dedupe_key := COALESCE(
      v_event_external_message_id,
      v_mutation_type || ':' || v_target_external_message_id || ':' || v_occurred_at::text
    );
  END IF;

  SELECT *
  INTO v_message
  FROM public.comm_whatsapp_messages AS message
  WHERE message.channel_id = p_channel_id
    AND message.external_message_id = v_target_external_message_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.comm_whatsapp_pending_message_mutations (
      channel_id,
      target_external_message_id,
      event_external_message_id,
      mutation_type,
      dedupe_key,
      occurred_at,
      payload
    )
    VALUES (
      p_channel_id,
      v_target_external_message_id,
      v_event_external_message_id,
      v_mutation_type,
      v_dedupe_key,
      v_occurred_at,
      v_payload
    )
    ON CONFLICT (channel_id, dedupe_key) DO UPDATE
    SET occurred_at = GREATEST(
          public.comm_whatsapp_pending_message_mutations.occurred_at,
          EXCLUDED.occurred_at
        ),
        payload = EXCLUDED.payload,
        event_external_message_id = COALESCE(
          EXCLUDED.event_external_message_id,
          public.comm_whatsapp_pending_message_mutations.event_external_message_id
        ),
        updated_at = now();

    RETURN QUERY SELECT NULL::uuid, false, true;
    RETURN;
  END IF;

  v_metadata := COALESCE(v_message.metadata, '{}'::jsonb);

  IF v_mutation_type = 'edit' THEN
    BEGIN
      v_existing_at := NULLIF(v_metadata ->> 'edited_at', '')::timestamptz;
    EXCEPTION WHEN OTHERS THEN
      v_existing_at := NULL;
    END;

    IF COALESCE(v_metadata ->> 'deleted', 'false') <> 'true'
      AND (v_existing_at IS NULL OR v_existing_at <= v_occurred_at)
    THEN
      v_original_text := NULLIF(btrim(COALESCE(
        v_metadata ->> 'original_text_content',
        v_payload ->> 'original_text',
        v_message.text_content,
        v_message.media_caption,
        ''
      )), '');
      v_history := CASE
        WHEN jsonb_typeof(v_metadata -> 'edit_history') = 'array' THEN v_metadata -> 'edit_history'
        ELSE '[]'::jsonb
      END || jsonb_build_array(jsonb_build_object(
        'at', v_occurred_at,
        'previous_text', COALESCE(v_message.text_content, v_message.media_caption),
        'next_text', v_payload ->> 'edited_text',
        'action_type', v_payload ->> 'action_type'
      ));

      IF jsonb_array_length(v_history) > 10 THEN
        SELECT COALESCE(jsonb_agg(history.value ORDER BY history.ordinality), '[]'::jsonb)
        INTO v_history
        FROM (
          SELECT value, ordinality
          FROM jsonb_array_elements(v_history) WITH ORDINALITY
          ORDER BY ordinality DESC
          LIMIT 10
        ) AS history;
      END IF;

      UPDATE public.comm_whatsapp_messages AS message
      SET text_content = v_payload ->> 'edited_text',
          media_caption = CASE
            WHEN lower(COALESCE(message.message_type, '')) IN ('image', 'video', 'gif', 'short', 'document', 'audio', 'voice', 'sticker')
              THEN v_payload ->> 'edited_text'
            ELSE message.media_caption
          END,
          status_updated_at = GREATEST(COALESCE(message.status_updated_at, '-infinity'::timestamptz), v_occurred_at),
          metadata = v_metadata || jsonb_build_object(
            'edited', true,
            'edited_at', v_occurred_at,
            'original_text_content', v_original_text,
            'edit_action_type', v_payload ->> 'action_type',
            'edit_history', v_history
          )
      WHERE message.id = v_message.id;

      UPDATE public.comm_whatsapp_chats AS chat
      SET last_message_text = v_payload ->> 'edited_text',
          updated_at = now()
      WHERE chat.id = v_message.chat_id
        AND chat.last_message_at = v_message.message_at;
    END IF;
  ELSIF v_mutation_type = 'delete' THEN
    BEGIN
      v_existing_at := NULLIF(v_metadata ->> 'deleted_at', '')::timestamptz;
    EXCEPTION WHEN OTHERS THEN
      v_existing_at := NULL;
    END;

    IF v_existing_at IS NULL OR v_existing_at <= v_occurred_at THEN
      v_original_text := NULLIF(btrim(COALESCE(
        v_metadata ->> 'deleted_original_text_content',
        v_payload ->> 'original_text',
        v_message.text_content,
        v_message.media_caption,
        ''
      )), '');

      UPDATE public.comm_whatsapp_messages AS message
      SET delivery_status = 'deleted',
          status_updated_at = GREATEST(COALESCE(message.status_updated_at, '-infinity'::timestamptz), v_occurred_at),
          error_message = NULL,
          metadata = v_metadata || jsonb_build_object(
            'deleted', true,
            'deleted_at', v_occurred_at,
            'deleted_action_type', v_payload ->> 'action_type',
            'deleted_by', v_payload ->> 'deleted_by',
            'deleted_original_text_content', v_original_text,
            'deleted_source_message_id', v_event_external_message_id
          )
      WHERE message.id = v_message.id;

      UPDATE public.comm_whatsapp_chats AS chat
      SET last_message_text = '[Mensagem apagada]',
          updated_at = now()
      WHERE chat.id = v_message.chat_id
        AND chat.last_message_at = v_message.message_at;
    END IF;
  ELSE
    v_actor_key := NULLIF(btrim(COALESCE(v_payload ->> 'actor_key', '')), '');
    v_emoji := NULLIF(btrim(COALESCE(v_payload ->> 'emoji', '')), '');
    IF v_actor_key IS NULL THEN
      RAISE EXCEPTION 'Reacao sem autor.';
    END IF;

    v_reactions := CASE
      WHEN jsonb_typeof(v_metadata -> 'reactions') = 'array' THEN v_metadata -> 'reactions'
      ELSE '[]'::jsonb
    END;
    SELECT reaction.value
    INTO v_actor_reaction
    FROM jsonb_array_elements(v_reactions) AS reaction(value)
    WHERE reaction.value ->> 'actor_key' = v_actor_key
    LIMIT 1;

    BEGIN
      v_existing_reaction_at := NULLIF(v_actor_reaction ->> 'reacted_at', '')::timestamptz;
    EXCEPTION WHEN OTHERS THEN
      v_existing_reaction_at := NULL;
    END;

    IF COALESCE(v_metadata ->> 'deleted', 'false') <> 'true'
      AND (v_existing_reaction_at IS NULL OR v_existing_reaction_at <= v_occurred_at)
    THEN
      SELECT COALESCE(jsonb_agg(reaction.value), '[]'::jsonb)
      INTO v_without_actor
      FROM jsonb_array_elements(v_reactions) AS reaction(value)
      WHERE COALESCE(reaction.value ->> 'actor_key', '') <> v_actor_key;

      IF v_emoji IS NOT NULL THEN
        v_reactions := v_without_actor || jsonb_build_array(jsonb_build_object(
          'actor_key', v_actor_key,
          'emoji', v_emoji,
          'from_me', COALESCE((v_payload ->> 'from_me')::boolean, false),
          'from', NULLIF(v_payload ->> 'from', ''),
          'from_name', NULLIF(v_payload ->> 'from_name', ''),
          'reacted_at', v_occurred_at,
          'target_external_message_id', v_target_external_message_id
        ));
      ELSE
        v_reactions := v_without_actor;
      END IF;

      UPDATE public.comm_whatsapp_messages AS message
      SET metadata = v_metadata || jsonb_build_object(
            'reactions', v_reactions,
            'last_reaction_at', v_occurred_at
          ),
          status_updated_at = GREATEST(COALESCE(message.status_updated_at, '-infinity'::timestamptz), v_occurred_at)
      WHERE message.id = v_message.id;
    END IF;
  END IF;

  IF v_event_external_message_id IS NOT NULL
    AND v_event_external_message_id <> v_target_external_message_id
  THEN
    DELETE FROM public.comm_whatsapp_messages AS event_message
    WHERE event_message.channel_id = p_channel_id
      AND event_message.external_message_id = v_event_external_message_id
      AND event_message.message_type = 'action';
  END IF;

  DELETE FROM public.comm_whatsapp_pending_message_mutations AS pending
  WHERE pending.channel_id = p_channel_id
    AND pending.dedupe_key = v_dedupe_key;

  RETURN QUERY SELECT v_message.chat_id, true, false;
END;
$$;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_apply_pending_message_mutations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending public.comm_whatsapp_pending_message_mutations%ROWTYPE;
BEGIN
  IF NEW.external_message_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Match the RPC lock so a just-created pending mutation cannot be missed.
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'comm-whatsapp-message-mutation:' || NEW.channel_id::text || ':' || NEW.external_message_id,
    0
  ));

  FOR v_pending IN
    SELECT *
    FROM public.comm_whatsapp_pending_message_mutations AS pending
    WHERE pending.channel_id = NEW.channel_id
      AND pending.target_external_message_id = NEW.external_message_id
    ORDER BY pending.occurred_at, pending.created_at
  LOOP
    PERFORM public.comm_whatsapp_apply_message_mutation(
      v_pending.channel_id,
      v_pending.target_external_message_id,
      v_pending.mutation_type,
      v_pending.event_external_message_id,
      v_pending.occurred_at,
      v_pending.payload,
      v_pending.dedupe_key
    );
  END LOOP;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_comm_whatsapp_apply_pending_message_mutations ON public.comm_whatsapp_messages;
CREATE TRIGGER trg_comm_whatsapp_apply_pending_message_mutations
  AFTER INSERT OR UPDATE OF external_message_id ON public.comm_whatsapp_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.comm_whatsapp_apply_pending_message_mutations();

CREATE OR REPLACE FUNCTION public.invoke_comm_whatsapp_enrichment_worker()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
  function_url text;
  service_role_key text;
  request_id bigint;
BEGIN
  function_url := NULLIF(trim(both '"' FROM COALESCE(current_setting('app.settings.supabase_url', true), '')), '');
  service_role_key := NULLIF(trim(both '"' FROM COALESCE(current_setting('app.settings.supabase_service_role_key', true), '')), '');

  IF function_url IS NULL THEN
    SELECT NULLIF(trim(both '"' FROM COALESCE(value, '')), '') INTO function_url
    FROM public.system_configurations
    WHERE label = 'supabase_url'
    LIMIT 1;
  END IF;

  IF service_role_key IS NULL THEN
    SELECT NULLIF(trim(both '"' FROM COALESCE(value, '')), '') INTO service_role_key
    FROM public.system_configurations
    WHERE label = 'supabase_service_role_key'
    LIMIT 1;
  END IF;

  IF function_url IS NULL THEN
    EXECUTE $sql$
      SELECT NULLIF(trim(both '"' FROM config_value::text), '')
      FROM public.system_configurations
      WHERE config_key = 'supabase_url'
      LIMIT 1
    $sql$ INTO function_url;
  END IF;

  IF service_role_key IS NULL THEN
    EXECUTE $sql$
      SELECT NULLIF(trim(both '"' FROM config_value::text), '')
      FROM public.system_configurations
      WHERE config_key = 'supabase_service_role_key'
      LIMIT 1
    $sql$ INTO service_role_key;
  END IF;

  IF function_url IS NULL OR service_role_key IS NULL THEN
    RAISE NOTICE 'WhatsApp enrichment worker skipped: missing Supabase URL or service role key.';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := rtrim(function_url, '/') || '/functions/v1/comm-whatsapp-enrichment-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object('limit', 25)
  ) INTO request_id;

  RETURN request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_comm_whatsapp_enrichment_jobs(integer, text, interval) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_comm_whatsapp_enrichment_jobs(integer, text, interval) TO service_role;

REVOKE ALL ON FUNCTION public.comm_whatsapp_apply_message_mutation(uuid, text, text, text, timestamptz, jsonb, text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_apply_message_mutation(uuid, text, text, text, timestamptz, jsonb, text) TO service_role;

REVOKE ALL ON FUNCTION public.invoke_comm_whatsapp_enrichment_worker() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invoke_comm_whatsapp_enrichment_worker() TO postgres, service_role;

DO $$
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RAISE NOTICE 'cron.job table not found, skipping WhatsApp enrichment worker scheduler setup.';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-comm-whatsapp-enrichment-worker') THEN
    PERFORM cron.unschedule('process-comm-whatsapp-enrichment-worker');
  END IF;

  PERFORM cron.schedule(
    'process-comm-whatsapp-enrichment-worker',
    '* * * * *',
    'SELECT public.invoke_comm_whatsapp_enrichment_worker();'
  );
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
